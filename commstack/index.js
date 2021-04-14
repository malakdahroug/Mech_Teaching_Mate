import {
    OPCUAClient,
    MessageSecurityMode, SecurityPolicy,
    AttributeIds,
    makeBrowsePath,
    ClientSubscription,
    TimestampsToReturn,
    ClientMonitoredItem, DataType,
} from "node-opcua";

import express from 'express';
const app = express();

// OPC UA Establishing connection settings
const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
}

// OPC UA Connection Settings
const options = {
    applicationName: "MyClient",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpoint_must_exist: false,
};

// Creating OPC UA Client
const client = OPCUAClient.create(options);

console.log('Started');

// Defining PLC list of objects, object contains basic PLC information
// - name(string) - Name of the PLC, this is only for display
// - ip(string) - IP Address of the OPC UA Server of the PLC
// - state(boolean) - current state of the PLC availability, if true then PLC can be connected to
// - stopSignal(boolean) - was stopSignal issued? if set to true, PLC will be attempted to be stopped at next possible opportunity in the code execution
let plcList = [
    {name: 'PLC_5', ip: '192.168.0.42', state: true, stopSignal: false}
];

// Main function containing all logics of the simulated PLC
async function main(sequence, ip) {
    try {
        // Find PLC with the given IP address in the list
        const plc = plcList.find((e) => {
            return e.ip === ip;
        });

        // Find the list index of the given PLC
        const plcIndex = plcList.indexOf(plc);
        // Set PLC state to false (will prevent others from trying to connect to this PLC while it's running)
        plc.state = false;

        // Update the PLC in the list
        plcList[plcIndex] = plc;

        // Construct the OPC UA connection URL
        const endpointUrl = 'opc.tcp://' + ip + ':4840';

        // Connect to PLC
        console.warn('Connecting to',ip);
        await client.connect(endpointUrl);
        console.log("Connected to PLC", ip);

        console.warn('Starting PLC session!');
        // Create OPC session
        const session = await client.createSession();
        console.log("PLC session created");

        // Generate mock T value that can be used in e.g. T+1S or TS, value generated will be between 1 and 3 seconds
        const tTime = Math.ceil(Math.random()*3);
        // Prepare the Node-OPCUA command to be written with the generated value
        const tVar = [{
            nodeId: 'ns=3;s=\"T_VARIABLE\"',
            attributeId: AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: "Int16",
                    value: tTime
                }
            }
        }];

        // Generate mock N value that can be used in e.g. [A+,A-]^N+2, value generated will be between 1 and 3
        const nRepetitions = Math.ceil(Math.random()*3);
        // Prepare the Node-OPCUA command to be written with the generated value
        const nVar = [{
            nodeId: 'ns=3;s=\"N_VARIABLE\"',
            attributeId: AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: "Int16",
                    value: nRepetitions
                }
            }
        }];

        // Write N_VARIABLE to the PLC memory
        await session.write(nVar, (err, res) => {
            console.log('Setting mock value of N_VARIABLE to',nRepetitions)
        });

        // Write T_VARIABLE to the PLC memory
        await session.write(tVar, (err, res) => {
            console.log('Setting mock value of T_VARIABLE to',tTime)
        });

        // Prepare the empty Set for actuators (set was chosen to ensure only unique entries)
        let actuators = new Set();

        // Iterate through the whole sequence to add all actuators to the set (later on set will be used to start all
        // cylinders in their retracted positions);
        for(let i = 0; i < sequence.length; i++) {
            const actuator = sequence[i].replaceAll(/[T\[\]()+S\-0-9]/g, '');
            if(actuator) {
                actuators.add(actuator);
            }
        }

        // Convert set to array to ensure static order and correct indexing
        actuators = Array.from(actuators);

        // Preparing an empty list to store list of OPC UA commands to retract all the cylinders
        let actuatorActions = [];

        // Iterate through the list of actuators and add retraction action for each of them to actuatorActions
        for(let i = 0; i < actuators.length; i++) {
            actuatorActions = actuatorActions.concat(retract(actuators[i]));
        }

        // Write all retractions of cylinders to the PLC memory
        await session.write(actuatorActions, (err, res) => {
            console.log('Retracting all cylinders');
        });

        // Wait 1s to ensure that command has fully completed
        await sleep(1000);

        // Config variables
        let concurrentStart = false; // Holds information if the concurrent sequence start was detected
        let concurrentEnd = false;  // Holds information if the concurrent sequence end was detected
        let action = []; // List of actions to perform in the current cycle
        let previousActuators = []; // List of the actuations from the previous cycle
        let currentActutations = []; // List of the actuations in the current cycle

        let repeatStart = -1; // Contains index of the start of repeating part of the sequence
        let repeatCount = -1; // Holds information how many actuations already occurred
        let repetitions = -1; // Holds information how many repetitions there are
        let repeatTarget = -1; // Holds target index (end) of the repeating part
        let repeatDifference = -1; // Holds the difference between start and end indexes of repeating sequence (how many actions there are)

        // Copy content of the sequence into tempSequence (so it can be freely modified without affecting initial sequence)
        let tempSequence = [...sequence];

        // Contains information if the current sequence is a nested repeating sequence
        let nested = false;

        // Checks if the first sequence element contains square bracket and if the last element contains closing square bracket
        if(tempSequence[0].search(/\[/) !== -1 && tempSequence[tempSequence.length - 1].search(/]/) !== -1) {
            // Remove square bracket from the start and end
            tempSequence[0] = tempSequence[0].replace('[', '');
            tempSequence[tempSequence.length - 1] = tempSequence[tempSequence.length - 1].replace(']', '');

            // Checks if there are any other square brackets in the sequence, if so it is a repeating sequence
            for(let i = 0; i < tempSequence.length; i++) {
                if(tempSequence[i].search(/\[/) !== -1) {
                    nested = true;
                    break;
                }

                if(tempSequence[i].search(/]/) !== -1) {
                    nested = false;
                    break;
                }
            }
        }

        // If sequence is nested - starting and ending square brackets are removed
        if(nested) {
            sequence[0] = sequence[0].replace('[', '');
            sequence[sequence.length - 1] = sequence[sequence.length - 1].substr(0, sequence[sequence.length - 1].length - 1);
        }

        // tempSequence is assigned with updated version of sequence (without square brackets)
        tempSequence = [...sequence];

        // Main logics
        // It will iterate through each element of the sequence and perform the corresponding action
        for(let i = 0; i < sequence.length; i++) {
            // Finds PLC in the list
            const plcStatus = plcList.find((e) => {
                return e.ip === ip;
            });

            // If stopSignal for this PLC was detected it is going to start a stop procedure
            if(plcStatus.stopSignal) {
                // Close the OPC session
                await session.close();
                // Disconnect from the PLC
                await client.disconnect();
                console.log("done !");

                // Set state to available (true)
                plc.state = true;
                // Set stopSignal to false as PLC is stopping
                plc.stopSignal = false;

                // Update the PLC in the list with updated values
                plcList[plcIndex] = plc;
                return;
            }

            // Search for opening square bracket, if it was found set a repeating part start point at the current list index
            // It will be going back to this point until all repetitions are fulfilled
            if(sequence[i].search(/\[/) !== -1) {
                // Remove the bracket from the current sequence action
                sequence[i] = sequence[i].replace(/\[/, '');

                // Set starting point to the current index
                repeatStart = i;
            }

            // Search for closing square bracket, if it was found set a repeating part end point at the current list index
            if(sequence[i].search(/]/) !== -1) {
                // Set ending point to the current index
                repeatTarget = i;

                // Search for repeating sequence with counter
                if(sequence[i].search(/]\^/) !== -1) {
                    // Set repetitions to the default value (-1)
                    repetitions = -1;

                    // Check if there is N variable in the current sequence action
                    if(sequence[i].substr(sequence[i].search(/\^/) + 1, sequence[i].length).startsWith('N')) {
                        // Remove N+ from the current action
                        sequence[i] = sequence[i].replace('N+', '');
                        const nValue = (await session.readVariableValue("ns=3;s=\"N_VARIABLE\"")).value.value;
                        // Increment repetitions count by the value of N variable
                        repetitions += nValue;
                    }

                    // Increment repetitions by the number present in the current action
                    repetitions += parseInt(sequence[i].substr(sequence[i].search(/\^/) + 1, sequence[i].length));

                    // Set initial repeat count to 0
                    repeatCount = 0;
                    // Calculate how many elements there are to repeat (current index - starting index of the repeating sequence)
                    repeatDifference = i - repeatStart;
                }
                // Remove square bracket and anything after it from the current action
                sequence[i] = sequence[i].substr(0, sequence[i].search(/]/));
            }

            // Check if the current action contains a timer using regular expression
            const timerMatch = sequence[i].match(/((((T\+)?(([0-9].[0-9]+)|([1-9]+[0-9]*)|([1-9]+[0-9]*.[0-9]+)))S)|TS)*/i);

            // If current action contains timer, perform timer logics
            if (timerMatch && timerMatch[0] !== '') {
                // Set initial time delay to 0
                let time = 0;

                // Check if the current action uses T variable
                if(sequence[i].search('T') !== -1) {
                    // Check if T variable is modified incremented by +number
                    if(sequence[i].search(/\+/) !== -1) {
                        // Read current value of T and add number
                        const tValue = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value;
                        // Set time to a number read from the current action + current value of T variable, multiply by 1000 to form milliseconds
                        time = (parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) + tValue) * 1000;
                    } else {
                        // If T variable is not modified by +number, read T variable and multiply it by 1000
                        time = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value * 1000;
                    }
                } else {
                    // If T was not detected in the current action, but timer was then take the delay value from the current
                    // action, multiply it by 1000 to form milliseconds and assign it to time variable
                    time = parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) * 1000;
                }

                // Sleep for 1 second
                await sleep(time);

                // If sequence is forever looping, start is defined, target is defined and the current index matches
                // target index of repeating sequence - set i to the start - 1 (-1 as i is being incremented after each iteration of the loop)
                if(repetitions === -1 && repeatStart !== -1 && repeatTarget !== -1 && i === repeatTarget) {
                    i = repeatStart - 1;
                }

                // If repeat target is defined and i equals to repeating sequence target index, set i to start - 1  and increment repeatCount
                if(repeatTarget !== -1 && i === repeatTarget) {
                    repeatCount++;
                    i = repeatStart - 1;
                }

                // If repetitions are defined and repeatCount equals to repetition count it means all repetitions are fulfilled
                // reset all repeating sequence values
                if(repetitions !== -1 && repeatCount === repetitions) {
                    repeatStart = -1;
                    repeatCount = -1;
                    repetitions = -1;
                    repeatTarget = -1;
                    repeatDifference = -1;
                }

                // If sequence is nested and it is the last iteration of the sequence
                // - set i to -1 to go back to the beginning of the sequence
                // - set sequence to tempSequence so the original values are retrieved (before any modification, with initial square brackets removed)
                // - set all repeating sequence values to their initial values
                if(nested && i === sequence.length - 1) {
                    sequence = tempSequence;
                    i = -1;
                    repeatStart = -1;
                    repeatCount = -1;
                    repetitions = -1;
                    repeatTarget = -1;
                    repeatDifference = -1;
                }
                // Skip the rest of the iteration
                continue;
            }

            // Get the current element of the sequence (it will be modified so it is a safer way of doing it)
            let current = sequence[i];

            // Search for opening round bracket, if it is present in the current element it means it is concurrent sequence)
            if(current.search(/\(/) !== -1) {
                // Remove round bracket
                current = current.replace(/\(/, '');
                // Set concurrentStart to true to indicated the next actions should occur at the same time until the closing round bracket is found)
                concurrentStart = true;
            }

            // Search for closing round bracket, if it is present in the current element it means it is the end of concurrent sequence)
            if(current.search(/\)/) !== -1) {
                // Remove round bracket
                current = current.replace(/\)/, '');
                // Set concurrentEnd to false to indicate actuations can occur now
                concurrentEnd = true;
            }

            // Check if actuations from the previous section completed succesfully
            let previousCompleted = await checkActuators(session, previousActuators);
            // Wait until the actuations from the previous iteration have fully completed
            while(!previousCompleted) {
                // If stopSignal for this PLC was detected it is going to start a stop procedure
                if(plcStatus.stopSignal) {
                    // Close the OPC session
                    await session.close();
                    // Disconnect from the PLC
                    await client.disconnect();
                    console.log("done !");

                    // Set state to available (true)
                    plc.state = true;
                    // Set stopSignal to false as PLC is stopping
                    plc.stopSignal = false;

                    // Update the PLC in the list with updated values
                    plcList[plcIndex] = plc;
                    return;
                }
                // Refresh the state of acutators from the previous step to ensure it is in its latest form
                previousCompleted = await checkActuators(session, previousActuators);
            }

            // If loop got to this point it means that it must be an actuation
            // Check if the second character is + or - and add the right actuation to the action list
            if(current[1] === '-') {
                // If the current actuation is retract, add retraction command to action list
                action = action.concat(retract(current[0]));
            } else if(current[1] === '+') {
                // If the current actuation is extend, add extension command to action list
                action = action.concat(extend(current[0]));
            }

            // Add current action to the list of currentActuations
            currentActutations.push(current);

            // If start of the concurrent sequence was detected, but it has not reached the end of the concurrent part
            // continue (skip the rest of the iteration)
            if(concurrentStart && !concurrentEnd) {
                continue;
            }

            // If concurrent part end was detected, set start and end to false (then proceed to the actuation)
            if(concurrentEnd) {
                concurrentStart = false;
                concurrentEnd = false;
            }

            // Perform the actuations
            await session.write(action, (err, res) => {});

            // If sequence is forever looping, start is defined, target is defined and the current index matches
            // target index of repeating sequence - set i to the start - 1 (-1 as i is being incremented after each iteration of the loop)
            if(repetitions === -1 && repeatStart !== -1 && repeatTarget !== -1 && i === repeatTarget) {
                i = repeatStart - 1;
            }

            // If repeat target is defined and i equals to repeating sequence target index, set i to start - 1  and increment repeatCount
            if(repeatTarget !== -1 && i === repeatTarget) {
                repeatCount++;
                i = repeatStart - 1;
            }

            // If repetitions are defined and repeatCount equals to repetition count it means all repetitions are fulfilled
            // reset all repeating sequence values
            if(repetitions !== -1 && repeatCount === repetitions) {
                repeatStart = -1;
                repeatCount = -1;
                repetitions = -1;
                repeatTarget = -1;
                repeatDifference = -1;
            }

            // If sequence is nested and it is the last iteration of the sequence
            // - set i to -1 to go back to the beginning of the sequence
            // - set sequence to tempSequence so the original values are retrieved (before any modification, with initial square brackets removed)
            // - set all repeating sequence values to their initial values
            if(nested && i === sequence.length - 1) {
                sequence = tempSequence;
                i = -1;
                repeatStart = -1;
                repeatCount = -1;
                repetitions = -1;
                repeatTarget = -1;
                repeatDifference = -1;
            }

            // Set all actions from the current loop run to previousActuators (so it can be validated in the next step)
            previousActuators = [...currentActutations];
            // Empty the list of actions
            action = [];
            // Empty the list of current actuations
            currentActutations = [];
        }


        // After the sequence was fulfilled close the OPC session
        await session.close();

        // Disconnect from the PLC
        await client.disconnect();
        console.log("done !");

        // Set PLC state to available(true)
        plc.state = true;
        // Update state of the PLC in the list
        plcList[plcIndex] = plc;

    } catch (err) {
        console.log("An error has occured : ", err);
    }
}

// GET Route that fulfills sequence execution
app.get('/sequence/:sequence/:ip', async (req, res) => {
    // Break the sequence down using commas (converts it to an array of actions), remove any white space and convert it to all capitals
    let sequence = req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(',');

    // Get IP of the PLC from the URL parameter
    let ip = req.params.ip;

    // Search for PLC with the given IP address in the list of PLCs
    const plc = plcList.find((e) => {return e.ip === ip});
    // If PLC was found and it is available
    if(plc && plc.state) {
        // Execute the sequence
        main(sequence, ip).then(() => {
            console.log('PLC execution finished');
        });
        // Send confirmation back to the client
        res.send({status: 'OK', msg: 'PLC execution started!'});
    // If PLC was found, but state is not true, send feedback saying PLC is currently bust
    } else if(plc) {
        res.send({status: 'Error', msg: 'Chosen PLC is currently busy!'});
    // If PLC was not found, send feedback saying PLC was not found
    } else {
        res.send({status: 'Error', msg: 'PLC not found!'});
    }
});

// GET Route that fulfills stopping PLC execution
app.get('/stop/:ip', async (req, res) => {
    // Get IP of the PLC from the URL parameter
    let ip = req.params.ip;

    // Search for PLC with the given IP address in the list of PLCs
    const plc = plcList.find((e) => {return e.ip === ip});

    // Get index of the PLC in the list
    const plcIndex = plcList.indexOf(plc);

    // If PLC was found
    if(plc) {
        // Set stopSignal to true so it can be stopped at the first opportunity
        plc.stopSignal = true;
        // Update PLC in the list
        plc[plcIndex] = plc;

        // Send confirmation that PLC execution stop was triggered
        res.send({status: 'OK', msg: 'PLC stop signal sent!'});
    // If PLC was not found, send feedback saying PLC was not found
    } else {
        res.send({status: 'Error', msg: 'PLC not found!'});
    }
});

// Define port application will be listening on (3005), it was separated from the backend to prevent full system crash if there's a PLC error e.g. connection error
app.listen(3005);

// Function that checks if the actuators are in their desired state, returns false if not, returns true if the actuations completed
async function checkActuators(session, actuators) {
    // Prepare an object to store state of the cylinder's sensors
    let state = {};

    // Iterate through the list of actuations
    for(let i = 0; i < actuators.length; i++) {
        // Poll each of the sensors to check their current state
        state.ext = (await session.readVariableValue("ns=3;s=\"Sensor_" + actuators[i][0] + "_Extended\"")).value.value;
        state.ret = (await session.readVariableValue("ns=3;s=\"Sensor_" + actuators[i][0] + "_Retracted\"")).value.value;

        // If the action was to retract and cylinder has not retracted return false indicating it is still retracting
        if(actuators[i][1] === '-') {
            if(!state.ret) {
                return false;
            }
        // If the action was to extend and cylinder has not extended return false indicating it is still extending
        } else if(actuators[i][1] === '+') {
            if(!state.ext) {
                return false;
            }
        }
    }

    // If nothing was returned yet it means that all cylinders completed there actuations
    return true;
}

// Implementation of sleep function, it will wait given amount of time and then return
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function that fulfills retraction of the cylinder, it will return an array of two actions
// - Set extend to False
// - Set retract to True
function retract(cylinder) {
    return [{
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Extend\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: false
            }
        }
    },
        {
            nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Retract\"',
            attributeId: AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: "Boolean",
                    value: true
                }
            }
        }
    ]
}

// Function that fulfills extension of the cylinder, it will return an array of two actions
// - Set retract to False
// - Set extend to True
function extend(cylinder) {
    return [{
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Retract\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: false
            }
        }
    },
        {
        nodeId: 'ns=3;s=\"Cylinder_' + cylinder +'_Extend\"',
        attributeId: AttributeIds.Value,
        indexRange: null,
        value: {
            value: {
                dataType: "Boolean",
                value: true
            }
        }
    }
    ]
}
