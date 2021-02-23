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
    sequenceType += ((req.params.sequence.toUpperCase().search(/\((([A-Z](\+|\-),)|([1-9]+[0-9]*S,))+([A-Z](\+|\-)|([1-9]+[0-9]*S))\)/) !== -1) ? 1 : 0);

    // Regular expression that detects if sequence has repeated actions (e.g. through a counter)
    sequenceType += ((req.params.sequence.toUpperCase().search(/\[(([A-Z](\+|\-),)|([1-9]+[0-9]*S,))*([A-Z](\+|\-)\)|([1-9]+[0-9]*S))\]\^([2-9]|[1-9]+[0-9]+)/) !== -1) ? 1 : 0);

    // Regular expression that detects if sequence includes a timer
    sequenceType += ((req.params.sequence.toUpperCase().search(/([1-9]+[0-9]*S)/) !== -1) ? 1 : 0);

    console.log(sequenceType)

    let sequence = req.params.sequence.toUpperCase().split(',');

    // If concurrent, repetitive or timed sequence was detected it will return an error informing these types of sequences are not currently supported
    if(sequenceType !== '000') {
        res.send('Concurrent, repetitive and timed sequences are not currently supported!');
    } else {
        res.send(generateCode(sequence, sequenceQueue, sensors)); // Sends response to the client
    }
});


app.get('/sequence/isValid/:sequence', function(req, res){
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    res.setHeader('Content-Type', 'application/json');

    let sequence = req.params.sequence.toUpperCase().split(',');

    const sequenceValidator = isValid(sequence);

    // #START - For actual API responses - for testing comment
    // if(sequenceValidator.length === 0) {
    //     res.send('The sequence provided is valid!');
    // } else {
    //     let response = 'The sequence contains the following errors:\n'
    //     for(const element of sequenceValidator) {
    //         response += '- ' + element + '\n';
    //     }
    //     res.send(response);
    // }
    // #END - For actual API responses - for testing comment

    // #START - For testing only - if not running tests - comment
    res.send(sequenceValidator);
    // #END - For testing only - if not running tests - comment
});

/**
 * Function that validates if the sequence provided is correct. If there are any errors they will be returned as an array
 * If there are no errors an empty array will be returned.
 *
 * @param sequence an array of elements containing the next instructions
 * @returns {array} an empty array if sequence is valid, an array with parts that contain errors if it's invalid
 */
function isValid(sequence) {
    // An array containing indexes of opening brackets
    let openingBrackets = [];

    // An array containing indexes of opening square brackets
    let openingRepeating = [];

    // An array containing indexes of closing brackets
    let closingBrackets = [];


    // An array containing indexes of closings for repeating sequence
    let closingRepeating = [];

    // A set containing errors in the sequence
    let errorSet = new Set([]);

    // Regular expression to validate each action in the sequence
    // It can either be:
    // - A single letter followed by +
    // - A single letter followed by +
    // - T followed by a letter S
    // - A number followed by a letter S
    // - A number followed by a string BAR
    let regex = /^([A-Z]\+)|([A-Z]-)|([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])S|TS|([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])BAR$/;

    // Check if sequence starts and ends with [] it means it is a looping sequence - better way has to be found for verification
    // It is just a temporary solution
    if(sequence[0][0] === '[' && sequence[sequence.length - 1][sequence[sequence.length - 1].length - 1] === ']') {
        sequence[0] = sequence[0].substring(1,sequence[0].length);
        sequence[sequence.length - 1] = sequence[sequence.length - 1].substring(0, sequence[sequence.length - 1].length - 1);
    }

    // Iterates through the sequence array and find opening and closing brackets
    // Pushes indexes of opening and closing brackets to the openingBrackets array and closingBrackets array
    for(let i = 0; i < sequence.length; i++) {

        // Store current action of the sequence in temp variable - it is because action will be modified to validate against regex
        let temp = sequence[i];

        // Get index of opening bracket in the current action of the sequence
        let opening = sequence[i].search(/\(/);
        let openingSquare = sequence[i].search(/\[/);

        // Get index of closing bracket in the current action of the sequence
        let closing = sequence[i].search(/\)/);
        let closingSquare = sequence[i].search(/\]\^(([1-9]+[0-9]+)|([2-9]))|(\]\^N\+[1-9]+[0-9]*)|(\]\^N)|\]/);


        // If opening bracket was found in the current element it pushes its index to the openingBrackets array
        // It then removes it from the temp variable (current action)
        if(opening !== -1) {
            openingBrackets.push(i);
            temp = temp.replace(/\(/, '');
        }

        // If opening square bracket was found in the current element it pushes its index to the openingRepeating array
        // It then removes it from the temp variable (current action)
        if(openingSquare !== -1) {
            openingRepeating.push(i);
            temp = temp.replace(/\[/, '');
        }

        // If closing bracket was found in the current element it pushes its index to the closingBrackets array
        // It then removes it from the temp variable (current action)
        if(closing !== -1) {
            closingBrackets.push(i);
            temp = temp.replace(/\)/, '');
        }

        // If closing of the repeating sequence was found in the current element it pushes its index to the closingRepeating array
        // It then removes it from the temp variable (current action)
        if(closingSquare !== -1) {
            closingRepeating.push(i);
            temp = temp.replace(/\]\^(([1-9]+[0-9]+)|([2-9]))|(\]\^N\+[1-9]+[0-9]*)|(\]\^N)|\]/, '');
        }

        // Tries to match a string to the regular expression provided
        const match = temp.match(regex);

        // Checks if match exists and if the string provided equals to the match returned
        // If it doesn't then the current element will be added to the error set
        if(match && !(temp === match[0])) {
            errorSet.add(sequence[i]);
        } else if (match === null) {
            errorSet.add(sequence[i]);
        }
    }

    // If the amount of closing and opening brackets is the same, carry on with validating the sequence
    // else return an error informing user if there are too many / not enough closing brackets
    if(openingBrackets.length === closingBrackets.length) {
        // Iterate through both opening and closing brackets arrays
        for(let i = 0; i < openingBrackets.length; i++) {
            // Check if the opening bracket is after the closing bracket
            // If it is add it to the error set
            if(openingBrackets[i] >= closingBrackets[i]) {
                errorSet.add(sequence[openingBrackets[i]]);
                errorSet.add(sequence[closingBrackets[i]]);
            // Check if it is not last element of openingBrackets
            // If it is not, check if the closing bracket is before the next opening bracket
            // If it is not, add it to the error set
            } else if(i !== openingBrackets.length - 1) {
                if(closingBrackets[i] >= openingBrackets[i + 1]) {
                    errorSet.add(sequence[closingBrackets[i]]);
                    errorSet.add(sequence[openingBrackets[i + 1]]);
                }
            }
        }
    }

    // If the amount of closing and opening brackets for repeating sequence is the same, carry on with validating the sequence
    // else return an error informing user if there are too many / not enough closing square brackets
    if(openingRepeating.length === closingRepeating.length) {
        // Iterate through both opening and closing brackets arrays for repeating sequence
        for(let i = 0; i < openingRepeating.length; i++) {
            // Check if the opening square bracket is after the closing bracket of the repeating sequence
            // If it is add it to the error set
            if(openingRepeating[i] >= closingRepeating[i]) {
                errorSet.add(sequence[openingRepeating[i]]);
                errorSet.add(sequence[closingRepeating[i]]);
                console.log(1);
            // Check if it is not last element of openingRepeating
            // If it is not, check if the closing of the repeating sequence is before the next opening square bracket
            // If it is not, add it to the error set
            } else if(i !== openingRepeating.length - 1) {
                if(closingRepeating[i] >= openingRepeating[i + 1]) {
                    errorSet.add(sequence[closingRepeating[i]]);
                    errorSet.add(sequence[openingRepeating[i + 1]]);
                }
            }
        }
    }


    // If there are more closing brackets than opening ones, return an error informing user that
    // there are too many closing brackets
    // Otherwise, return an error that one or more of the opening brackets were not closed
    if(openingRepeating.length < closingRepeating.length) {
        errorSet.add("There are one or more closing bracket for repeating sequence that are missing an opening square bracket");
    } else if(openingRepeating.length > closingRepeating.length) {
        errorSet.add("There is a syntax error in the repeating sequence, it is either missing a closing bracket or no number of repetitions was provided!");
    }

    // If there are more closing brackets than opening ones, return an error informing user that
    // there are too many closing brackets
    // Otherwise, return an error that one or more of the opening brackets were not closed
    if(openingBrackets.length < closingBrackets.length) {
        errorSet.add("There are one or more closing round bracket that are missing an opening round bracket");
    } else if(openingBrackets.length > closingBrackets.length) {
        errorSet.add("One or more of the opening round brackets are not closed!");
    }



    // Return all the errors in array form or empty array if there are no errors present
    return Array.from(errorSet);
}

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

module.exports = app
