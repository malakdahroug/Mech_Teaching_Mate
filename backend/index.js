// Routing module -> takes care of executing right functions depending on HTTP route called
// When the action is performed on the website/application it will create a backend call on a given (unique to every action) URL
// Express will parse it and return the right response based on the business logics
const express = require('express');
const app = express(); // Instantiates express -> creates an Express object that will be used to deal with routes
const queue = require('./queue') // Imports Queue module

app.get('/generateSequence/:sequence', function(req, res){
    const sequenceQueue = new queue(); // Instantiates a new Queue for the client and stores it in a constant sequenceQueue

    // Takes a sequence from a URL parameter, converts it to uppercase letter and splits it by commas
    // The result will form an array of each of the actuations
    let sequence = req.params.sequence.toUpperCase().split(',');
    res.send(generateCode(sequence, sequenceQueue)); // Sends response to the client
});

/**
 * Function responsible for generating PLC code
 *
 * @param sequence an array containing initially processed sequence
 * @param q empty Queue prepared for sequence generation
 * @returns {string} generated code based on the given sequence
 */
function generateCode(sequence, q) {
    // Add all elements from the sequence array to the Queue
    for(const element of sequence) {
        q.enqueue(element);
    }

    // Initial code (sequence setup) that will contain all the setup info e.g. cylinders retracted, timers reset etc
    let setupCode = 'Setup code';

    // Actual logics code for each of the actions in the sequence
    let logicCode = '';

    // Defines a validator (Regular expression) for a valid input - currently it is capable of validating the following options:
    // A-Z -> cylinder to actuate
    // + -> extend cylinder
    // - -> retract cylinder
    // A+ -> valid, A- -> valid, A3 -> invalid
    const validator = /[A-Z](\+|\-)/i;
    let invalid = false;
    let invalidElements = [];

    // Keeps iterating until the queue is fully emptied
    while(!q.isEmpty()) {
        // Empty the first element in the queue and assign it to element variable
        const element = q.dequeue();

        // If element is correct i.e. matches the regular expression given
        if(element.match(validator)) {
            // Checks if it is extension
            if(element[1] === '+') {
                // Add extension actuation to the logicCode
                logicCode += 'Extend ' + element[0] + '<br>';
            // Checks if it is retraction
            } else if(element[1] === '-') {
                // Add retraction actuation to the logicCode
                logicCode += 'Retract ' + element[0] + '<br>';
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

    // If there were no errors in the sequence it will return the generated code to the user
    return setupCode + '<br>' + logicCode;
}

// Defines the port backend will be served on
app.listen(3000);
