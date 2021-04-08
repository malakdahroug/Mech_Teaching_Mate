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

const connectionStrategy = {
    initialDelay: 1000,
    maxRetry: 1
}
const options = {
    applicationName: "MyClient",
    connectionStrategy: connectionStrategy,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpoint_must_exist: false,
};
const client = OPCUAClient.create(options);
// const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

console.log('Started');

let plcList = [
    {name: 'PLC_1', ip: '192.168.0.242', state: true, stopSignal: false}
];

async function main(sequence, ip) {
    try {
        const plc = plcList.find((e) => {
            return e.ip === ip;
        });
        const plcIndex = plcList.indexOf(plc);
        plc.state = false;
        plcList[plcIndex] = plc;

        // 192.168.0.242
        const endpointUrl = 'opc.tcp://' + ip + ':4840';
        // step 1 : connect to
        console.warn('Connecting to',ip);
        await client.connect(endpointUrl);
        console.log("Connected to PLC", ip);

        console.warn('Starting PLC session!');
        // step 2 : createSession
        const session = await client.createSession();
        console.log("PLC session created");

        let previous = {actuator: '', action: ''};
        let state = {ret: null, ext: null};

        const tTime = Math.ceil(Math.random()*3);

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

        await session.write(tVar, (err, res) => {
            console.log('Setting mock value of T_VARIABLE to',tTime)
        });

        let actuators = new Set();

        for(let i = 0; i < sequence.length; i++) {
            const actuator = sequence[i].replaceAll(/[T\[\]()+S\-0-9]/g, '');
            if(actuator) {
                actuators.add(actuator);
            }
        }
        actuators = Array.from(actuators);

        let actuatorActions = [];

        for(let i = 0; i < actuators.length; i++) {
            actuatorActions = actuatorActions.concat(retract(actuators[i]));
        }

        await session.write(actuatorActions, (err, res) => {
            console.log('Retracting all cylinders');
        });

        await sleep(300);

        let concurrentStart = false;
        let concurrentEnd = false;
        let action = [];
        let previousActuators = [];
        let currentActutations = [];

        let repeatStart = -1;
        let repeatCount = -1;
        let repetitions = -1;
        let repeatTarget = -1;
        let repeatDifference = -1;

        for(let i = 0; i < sequence.length; i++) {
            const plcStatus = plcList.find((e) => {
                return e.ip === ip;
            });

            if(plcStatus.stopSignal) {
                plc.state = true;
                plc.stopSignal = false;

                await session.close();
                await client.disconnect();
                console.log("done !");

                plc.state = true;
                plcList[plcIndex] = plc;
                return;
            }

            if(sequence[i].search(/\[/) !== -1) {
                sequence[i] = sequence[i].replace(/\[/, '');
                repeatStart = i;
            }

            if(sequence[i].search(/]/) !== -1) {
                repeatTarget = i;
                if(sequence[i].search(/]\^/) !== -1) {
                    repetitions = parseInt(sequence[i].substr(sequence[i].search(/\^/) + 1, sequence[i].length)) - 1;
                    repeatCount = 0;
                    repeatDifference = i - repeatStart;
                }
                sequence[i] = sequence[i].substr(0, sequence[i].search(/]/));
            }

            const timerMatch = sequence[i].match(/((((T\+)?(([0-9].[0-9]+)|([1-9]+[0-9]*)|([1-9]+[0-9]*.[0-9]+)))S)|TS)*/i);
            if (timerMatch && timerMatch[0] !== '') {
                let time = 0;
                if(sequence[i].search('T') !== -1) {
                    if(sequence[i].search(/\+/) !== -1) {
                        // Read T and add number
                        const tValue = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value;
                        time = (parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) + tValue) * 1000;
                    } else {
                        time = (await session.readVariableValue("ns=3;s=\"T_VARIABLE\"")).value.value * 1000;
                    }
                } else {
                    time = parseInt(sequence[i].replaceAll('T', '').replaceAll('+', '').replaceAll('S', '')) * 1000;
                }

                await sleep(time);
                if(repetitions === -1 && repeatStart !== -1 && repeatTarget !== -1 && i === repeatTarget) {
                    i = repeatStart - 1;
                }

                if(repeatTarget !== -1 && i === repeatTarget) {
                    repeatCount++;
                    i = repeatStart - 1;
                }

                if(repetitions !== -1 && repeatCount === repetitions) {
                    repeatStart = -1;
                    repeatCount = -1;
                    repetitions = -1;
                    repeatTarget = -1;
                    repeatDifference = -1;
                }
                continue;
            }


            let current = sequence[i];


            if(current.search(/\(/) !== -1) {
                current = current.replace(/\(/, '');
                concurrentStart = true;
            }

            if(current.search(/\)/) !== -1) {
                current = current.replace(/\)/, '');
                concurrentEnd = true;
            }

            let previousCompleted = await checkActuators(session, previousActuators);
            while(!previousCompleted) {
                previousCompleted = await checkActuators(session, previousActuators);
            }

            if(current[1] === '-') {
                action = action.concat(retract(current[0]));
            } else if(current[1] === '+') {
                action = action.concat(extend(current[0]));
            }

            currentActutations.push(current);

            if(concurrentStart && !concurrentEnd) {
                continue;
            }

            if(concurrentEnd) {
                concurrentStart = false;
                concurrentEnd = false;
            }

            await session.write(action, (err, res) => {});
            console.log(i, repeatTarget);

            if(repetitions === -1 && repeatStart !== -1 && repeatTarget !== -1 && i === repeatTarget) {
                i = repeatStart - 1;
            }

            if(repeatTarget !== -1 && i === repeatTarget) {
                repeatCount++;
                i = repeatStart - 1;
            }

            if(repetitions !== -1 && repeatCount === repetitions) {
                repeatStart = -1;
                repeatCount = -1;
                repetitions = -1;
                repeatTarget = -1;
                repeatDifference = -1;
            }

            previousActuators = [...currentActutations];
            action = [];
            currentActutations = [];
        }


        // close session
        await session.close();

        // disconnecting
        await client.disconnect();
        console.log("done !");
        plc.state = true;
        plcList[plcIndex] = plc;

    } catch (err) {
        console.log("An error has occured : ", err);
    }
}

app.get('/sequence/:sequence/:ip', async (req, res) => {
    let sequence = req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(',');
    let ip = req.params.ip;
    const plc = plcList.find((e) => {return e.ip === ip});
    if(plc && plc.state) {
        main(sequence, ip).then(() => {
            console.log('PLC execution finished');
        });
        res.send({status: 'OK', msg: 'PLC execution started!'});
    } else {
        res.send({status: 'Error', msg: 'Chosen PLC is currently busy!'});
    }
});

app.get('/stop/:ip', async (req, res) => {
    let ip = req.params.ip;
    const plc = plcList.find((e) => {return e.ip === ip});
    const plcIndex = plcList.indexOf(plc);
    if(plc) {
        plc.stopSignal = true;
        plc[plcIndex] = plc;
        res.send({status: 'OK', msg: 'PLC stop signal sent!'});
    } else {
        res.send({status: 'Error', msg: 'PLC not found!'});
    }
});

app.listen(3005);

async function checkActuators(session, actuators) {
    let state = {};

    for(let i = 0; i < actuators.length; i++) {
        state.ext = (await session.readVariableValue("ns=3;s=\"Sensor_" + actuators[i][0] + "_Extended\"")).value.value;
        state.ret = (await session.readVariableValue("ns=3;s=\"Sensor_" + actuators[i][0] + "_Retracted\"")).value.value;

        if(actuators[i][1] === '-') {
            if(!state.ret) {
                return false;
            }
        } else if(actuators[i][1] === '+') {
            if(!state.ext) {
                return false;
            }
        }
    }

    return true;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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