// Routing module -> takes care of executing right functions depending on HTTP route called
// When the action is performed on the website/application it will create a backend call on a given (unique to every action) URL
// Express will parse it and return the right response based on the business logics
const express = require('express');
const app = express(); // Instantiates express -> creates an Express object that will be used to deal with routes
const queue = require('./queue') // Imports Queue module

app.get('/generateSequence/:sequence/:sensorsPresent', function(req, res){
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    const sequenceQueue = new queue(); // Instantiates a new Queue for the client and stores it in a constant sequenceQueue
    const sensors = req.params.sensorsPresent === '1';

    // Takes a sequence from a URL parameter, converts it to uppercase letter and splits it by commas
    // The result will form an array of each of the actuations
    let sequenceType = '';

    // Each of the regular expression below is supposed to detect different type of sequence, if it is matching
    // a regular expression it will add 1 to the sequence type string, otherwise it will add 0

    // Regular expression that detects if sequence has multiple actuations occurring at once
    sequenceType += ((req.params.sequence.toUpperCase().search(/\((([A-Z](\+|\-),)|(T[1-9]+[0-9]*S,))+([A-Z](\+|\-)|(T[1-9]+[0-9]*S))\)/) !== -1) ? 1 : 0);

    // Regular expression that detects if sequence has repeated actions (e.g. through a counter)
    sequenceType += ((req.params.sequence.toUpperCase().search(/\[(([A-Z](\+|\-),)|(T[1-9]+[0-9]*S,))*([A-Z](\+|\-)\)|(T[1-9]+[0-9]*S))\]\^([2-9]|[1-9]+[0-9]+)/) !== -1) ? 1 : 0);

    // Regular expression that detects if sequence includes a timer
    sequenceType += ((req.params.sequence.toUpperCase().search(/T[1-9]+[0-9]*S/) !== -1) ? 1 : 0);

    console.log(sequenceType)

    let sequence = req.params.sequence.toUpperCase().split(',');

    // If concurrent, repetitive or timed sequence was detected it will return an error informing these types of sequences are not currently supported
    if(sequenceType !== '000') {
        res.send('Concurrent, repetitive and timed sequences are not currently supported!');
    } else {
        res.send(generateCode(sequence, sequenceQueue, sensors)); // Sends response to the client
    }
});

/**
 * Function responsible for generating PLC code
 *
 * @param sequence an array containing initially processed sequence
 * @param q empty Queue prepared for sequence generation
 * @param sensors true if sensors are present, false if sensors are not present
 * @returns {string} generated code based on the given sequence
 */
function generateCode(sequence, q, sensors) {
    // Add all elements from the sequence array to the Queue
    for(const element of sequence) {
        q.enqueue(element);
    }

    // Initial code (sequence setup) that will contain all the setup info e.g. cylinders retracted, timers reset etc
    let setupCode = [];

    // Create a set for all actuators
    let actuators = new Set([]);

    // Actual logics code for each of the actions in the sequence
    let logicCode = [];

    // Create setup code and case 0, so e.g. all cylinders can start in their desired positions
    setupCode.push('CASE #NEXT OF');
    setupCode.push('    0:');

    // Defines a validator (Regular expression) for a valid input - currently it is capable of validating the following options:
    // A-Z -> cylinder to actuate
    // + -> extend cylinder
    // - -> retract cylinder
    // A+ -> valid, A- -> valid, A3 -> invalid
    const validator = /[A-Z](\+|\-)/i;
    let invalid = false;
    let invalidElements = [];
    let currentCase = 10; // Current case count for actuations
    // Keeps iterating until the queue is fully emptied
    while(!q.isEmpty()) {
        // Empty the first element in the queue and assign it to element variable
        const element = q.dequeue();
        if(element.length !== 2) {
            invalid = true;
            invalidElements.push(element);
        // If element is correct i.e. matches the regular expression given
        } else if(element.match(validator)) {

            // Checks if actuator is an actuator set, if it's not it's going to add it to the set
            // and add it's setup action (for now cylinder retracted) to the setup code
            if(!actuators.has(element[0])) {
                actuators.add(element[0]); // Add to set
                setupCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                setupCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
            }

            // Add current case count
            logicCode.push('    ' + currentCase + ':');

            // Increase case count for the next operation
            currentCase += 10;

            // Checks if it is extension
            if(element[1] === '+') {
                // Add extension actuation to the logicCode
                if(sensors) {
                    logicCode.push('        IF "Cylinder_' + element[0] + '_Ret_Sensor" THEN');
                    logicCode.push('            Cylinder_' + element[0] + '_Extend := TRUE;'); // Extend cylinder
                    logicCode.push('            Cylinder_' + element[0] + '_Retract := FALSE;'); // Extend cylinder
                    logicCode.push('            #NEXT := ' + currentCase + ''); // Move to the next case
                    logicCode.push('        END_IF;<br>'); // Retract cylinder
                } else {
                    logicCode.push('        Cylinder_' + element[0] + '_Extend := TRUE;'); // Extend cylinder
                    logicCode.push('        Cylinder_' + element[0] + '_Retract := FALSE;'); // Extend cylinder
                    logicCode.push('        #NEXT := ' + currentCase + '<br>'); // Move to the next case
                }
            // Checks if it is retraction
            } else if(element[1] === '-') {
                // Add retraction actuation to the logicCode
                if(sensors) {
                    logicCode.push('        IF "Cylinder_' + element[0] + '_Ext_Sensor" THEN');
                    logicCode.push('            Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                    logicCode.push('            Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
                    logicCode.push('            #NEXT := ' + currentCase + ''); // Move to the next case
                    logicCode.push('        END_IF;<br>'); // Retract cylinder
                } else {
                    logicCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                    logicCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
                    logicCode.push('        #NEXT := ' + currentCase + '<br>'); // Move to the next case
                }
            }

        // If current element in the queue is not a valid expression, it will set invalid to true
        // it will also add the invalid elements in the sequence to the invalidArray, which later on will be
        // displayed to the user
        } else {
            invalid = true;
            invalidElements.push(element);
        }
    }

    // If invalid element was detected, it will return the message with invalid elements in the sequence
    if(invalid) {
        return 'The sequence provided is invalid, please check the following part of the sequence "' + invalidElements + '"!';
    }

    // Add next jump to first actuation case at the end of setup case
    setupCode.push('        #NEXT := 10;' + '<br>');

    // If sensors are used then it removes second to last element from logicCode array
    // It will remove #NEXT := case jump as there's no next case (second to last element)
    // If sensors are not used it will also remove #NEXT := case jump by removing the last element from logicCode array
    if(sensors) {
        logicCode.splice(logicCode.length-2, 1);
    } else {
        logicCode.splice(logicCode.length-1, 1);
    }

    // Generate the string containing the code, by joining setupCode array with line breaks followed by one more line break
    // and logicCode array joined with line breaks
    let outputCode = setupCode.join('<br>') + '<br>' + logicCode.join('<br>');

    // If there were no errors in the sequence it will return the generated code to the user
    return outputCode;
}

// Defines the port backend will be served on
app.listen(3000);
