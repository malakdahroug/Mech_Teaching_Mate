// Routing module -> takes care of executing right functions depending on HTTP route called
// When the action is performed on the website/application it will create a backend call on a given (unique to every action) URL
// Express will parse it and return the right response based on the business logics
const express = require('express');
const app = express(); // Instantiates express -> creates an Express object that will be used to deal with routes
const queue = require('./queue'); // Imports Queue module
const bodyParser = require('body-parser'); // Module that parses body of the HTTP request - used for POST requests
const passwordHash = require('password-hash'); // Module that hashes the passwords
const mongoose = require('mongoose'); // Module that handles database connection
const cors = require('cors');

mongoose.connect('mongodb://localhost:27017/teaching-mate', {useNewUrlParser: true, useUnifiedTopology: true});

// Configures express to use body-parser
app.use(bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

app.use(
    cors({
        origin: ["http://localhost:63342"]
    })
);
app.options("*", cors()); // include before other routes

// DATABASE SCHEMAS START - Schemas for each of the collections used by the application
const User = mongoose.model('User', { name: String, username: String, email: String, password: String });
const Project = mongoose.model('Project', { user_id: String, project_name: String, project_sequence: String, validity: Boolean });
const ProjectConfig = mongoose.model('ProjectConfig', { project_id: String, assigned_elements: Array });
// DATABASE SCHEMAS END

// // Legacy route for generating the code based on the given sequence
// app.get('/generateSequence/:sequence/:sensorsPresent', function(req, res){
//     // Temporary Cross Origin workaround
//     res.header("Access-Control-Allow-Origin", "*");
//
//     const sequenceQueue = new queue(); // Instantiates a new Queue for the client and stores it in a constant sequenceQueue
//     const sensors = req.params.sensorsPresent === '1';
//
//     // Takes a sequence from a URL parameter, converts it to uppercase letter and splits it by commas
//     // The result will form an array of each of the actuations
//     let sequenceType = '';
//
//     // Each of the regular expression below is supposed to detect different type of sequence, if it is matching
//     // a regular expression it will add 1 to the sequence type string, otherwise it will add 0
//
//     // Regular expression that detects if sequence has multiple actuations occurring at once
//     sequenceType += ((req.params.sequence.toUpperCase().search(/\((([A-Z](\+|\-),)|([1-9]+[0-9]*S,))+([A-Z](\+|\-)|([1-9]+[0-9]*S))\)/) !== -1) ? 1 : 0);
//
//     // Regular expression that detects if sequence has repeated actions (e.g. through a counter)
//     sequenceType += ((req.params.sequence.toUpperCase().search(/\[(([A-Z](\+|\-),)|([1-9]+[0-9]*S,))*([A-Z](\+|\-)\)|([1-9]+[0-9]*S))\]\^([2-9]|[1-9]+[0-9]+)/) !== -1) ? 1 : 0);
//
//     // Regular expression that detects if sequence includes a timer
//     sequenceType += ((req.params.sequence.toUpperCase().search(/([1-9]+[0-9]*S)/) !== -1) ? 1 : 0);
//
//     console.log(sequenceType)
//
//     let sequence = req.params.sequence.toUpperCase().split(',');
//
//     // If concurrent, repetitive or timed sequence was detected it will return an error informing these types of sequences are not currently supported
//     if(sequenceType !== '000') {
//         res.send('Concurrent, repetitive and timed sequences are not currently supported!');
//     } else {
//         res.send(generateCode(sequence, sequenceQueue, sensors)); // Sends response to the client
//     }
// });

// Route that handles the project creation
app.get('/project/create/:id/:name/:sequence', async function(req, res){
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Check validity of the sequence provided - if the sequence is correct the project will be added to the database
    const validator = isValid(req.params.sequence.toUpperCase().split(','));
    const validity = validator.length === 0;

    // If sequence provided is valid, add the project to the database and create a ProjectConfig for it
    if(validity) {
        // Describe the new project
        const newProject = new Project({user_id: req.params.id, project_name: req.params.name, project_sequence: req.params.sequence, validity: validity});

        // Try to get records from the database that match the sequence provided and id of the user
        const project = await Project.find({project_sequence: req.params.sequence, user_id: req.params.id}).exec();

        // If user does not have a project fulfilling this sequence add it to the database
        if(project.length === 0) {
            // Add new project to the database
            newProject.save().then(() => {
                // When the project gets successfully created, create an object for the ProjectConfig
                const newProjectConfig = new ProjectConfig({project_id: newProject._id, assigned_elements: []});

                // Add new ProjectConfig to the database
                newProjectConfig.save().then(() => {
                    // If everything succeeded return message to the frontend informing that project was added
                    res.send({status: 'OK', msg: {data: 'Project has been created successfully!', project_id: newProject._id}});
                });
            });
        } else {
            // If user has an existing project fulfilling given sequence return an error informing the user that project exists already
            res.send({status: 'Error', msg: {data: 'You have an existing project for this sequence already!', project_id: project[0]._id}});
        }
    } else {
        // If sequence has error do not add it to the database, return an error to the user
        res.send({status: 'Error', msg: {data: 'An error has occurred please fix the sequence!', errors: validator}});
    }
});

// Sequence validation route
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

// New route for generating code with errors
app.get('/sequence/generate/:sequence/:sensorsPresent/:withFaults', function(req, res){
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    const sequenceQueue = new queue(); // Instantiates a new Queue for the client and stores it in a constant sequenceQueue

    // If sensorsPresent URL param is set to 1 it means sequence should be generated with sensors included
    const sensors = req.params.sensorsPresent === '1';

    // Splitting withFaults parameter by comma as they arrive in the following form 1,easy/hard/medium or 0,none
    // If the value before comma is one it means sequence is supposed to be generated with errors
    // The second parameter (after comma) controls the difficulty
    const faultsSettings = req.params.withFaults.split(',');

    // If the first URL parameter (withFaults) is set to 1, faults settings will be set to true which will result
    // in generating code with errors
    const faults = faultsSettings[0] === '1';

    // Errors complexity is extracted from the second parameter of withFaults
    const complexity = faultsSettings[1];

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
        res.send({correct: 'Concurrent, repetitive and timed sequences are not currently supported!'});
    } else {
        // Prepare code object - it will contain both correct and incorrect sequences
        let code = {correct: generateCode(sequence, sequenceQueue, sensors, 0, ''), incorrect: generateCode(sequence, sequenceQueue, sensors, faults, complexity)}
        res.send(code); // Sends response to the client
    }
});

// POST route was used as the data passed in the form is sensitive. This will prevent the application from adding user
// data to the URL. It is more secure than GET request.
app.post('/user/register', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Retrieve data from the form
    const name = req.body.name; // Name, does not have to be unique
    const username = req.body.username; // Username, it has to be unique
    const password = req.body.password; // Password, does not have to be unique must be the same as password2
    const password2 = req.body.password2;
    const email = req.body.email; // Email address, it has to be unique

    // Checks if user with the given email address exists in the database - if it is emailExists will be set to true
    const emailExists = await User.findOne({email: email}).exec() !== null;
    // Checks if user with the given username exists in the database - if it is usernameExists will be set to true
    const usernameExists = await User.findOne({username: username}).exec() !== null;

    // Checks if all form fields have been filled
    if(name === '' || username === '' || password === '' || password2 === '' || email === '') {
        res.send({status: 'Error', msg: 'All form fields are required!'});
    // Checks if password is not equal to password, if true it will return an error
    } else if(password !== password2) {
        res.send({status: 'Error', msg: 'Passwords do not match!'});
    // Checks if email is already registered in the database, if true it will throw an error
    } else if(emailExists) {
        res.send({status: 'Error', msg: 'User with email provided exists already!'});
    // Checks if username is already registered in the database, if true it will throw an error
    } else if(usernameExists) {
        res.send({status: 'Error', msg: 'User with username provided exists already!'});
    // If no errors were present it will return status OK and add given user to the users collection in MongoDB
    } else {
        const newUser = new User({ name: name, username: username.toLowerCase(), email: email.toLowerCase(), password: passwordHash.generate(password)});
        newUser.save().then((e) => res.send({status: 'OK', msg: 'User registered successfully!'}));
    }
});

// POST route that authenticates users (login system). POST was chosen as it is much more secure than GET which adds
// parameters to the URL rather than sending them in request body.
app.post('/user/login', async function(req, res) {
    // Retrieve POST parameters
    const username = req.body.username.toLowerCase(); // Username

    const password = req.body.password; // Password

    // Find user in the database and assign it to user constant - if user was not found it will assign null
    const user = await User.findOne({username: username}).exec();

    // If user does not exist return an error
    if(user === null) {
        res.send({status: 'Error', msg: 'Username does not exist or password provided is incorrect!'});
    // If password matches, authenticate the user
    } else if(passwordHash.verify(password, user.password)) {
        res.send({status: 'OK', msg: 'User authenticated successfully!', details: user._id});
    // If password does not match, return an error, the same error is returned if username does not exist and if password
    // does not match as per security recommendations
    } else {
        res.send({status: 'Error', msg: 'Username does not exist or password provided is incorrect!'});
    }
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
 * @param faults boolean that controls whether to generate correct code or code with errors
 * @param complexity complexity of faults generated
 * @returns {string} generated code based on the given sequence
 */
function generateCode(sequence, q, sensors, faults, complexity) {
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

    let actionCount = 0;

    // Keeps iterating until the queue is fully emptied
    while(!q.isEmpty()) {
        // Empty the first element in the queue and assign it to element variable
        const element = q.dequeue();
        actionCount++;
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
                    logicCode.push('            #NEXT := ' + currentCase + ';'); // Move to the next case
                    logicCode.push('        END_IF;<br>'); // Retract cylinder
                } else {
                    logicCode.push('        Cylinder_' + element[0] + '_Extend := TRUE;'); // Extend cylinder
                    logicCode.push('        Cylinder_' + element[0] + '_Retract := FALSE;'); // Extend cylinder
                    logicCode.push('        #NEXT := ' + currentCase + ';<br>'); // Move to the next case
                }
            // Checks if it is retraction
            } else if(element[1] === '-') {
                // Add retraction actuation to the logicCode
                if(sensors) {
                    logicCode.push('        IF "Cylinder_' + element[0] + '_Ext_Sensor" THEN');
                    logicCode.push('            Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                    logicCode.push('            Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
                    logicCode.push('            #NEXT := ' + currentCase + ';'); // Move to the next case
                    logicCode.push('        END_IF;<br>'); // Retract cylinder
                } else {
                    logicCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                    logicCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
                    logicCode.push('        #NEXT := ' + currentCase + ';<br>'); // Move to the next case
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

    // After code is generated, the function checks if faults parameter is set to true
    // If it is it will modify logic code to generate some errors
    if(faults) {

        // Setting initial value of faultsLimit to 0, it will be amended depending on complexity chosen
        // Using a formulae from the next set of if - else-if statements
        let faultsLimit = 0;

        // Current number of errors generated
        let faultsCount = 0;
        if(complexity === 'easy') {
            faultsLimit = Math.ceil(logicCode.length/5);
        } else if(complexity === 'medium') {
            faultsLimit = Math.ceil(logicCode.length/4);
        } else if(complexity === 'hard') {
            faultsLimit = Math.ceil(logicCode.length/3);
        }

        // If number of generated faults is less than a limit - it will keep repeating until it generates enough errors
        while(faultsCount < faultsLimit) {

            // It will keep iterating through logicCode array
            for(let i = 0; i < logicCode.length; i++) {

                // Checks if enough faults were generated already, if so - it will break the loop as well as condition
                // of the while loop won't be satisfied anymore
                if(faultsCount >= faultsLimit) {
                    break;
                }

                // Generates a pseudo random number between 0 and 10,
                // if the number is smaller than 3 (which maps to roughly 30% chances of error being generated in that line)
                // it will then generate an error
                if(Math.floor(Math.random() * 10) < 3) {
                    // Generates a random number between 0 and 2 to decide which type of fault to include
                    // - 0 -> will shift line of code 2 lines forward (for the last 3 lines it will shift them 2 lines backward)
                    // - 1 -> it will remove up to 3 characters from the end of the string
                    // - 2 -> it will completely remove the line of code
                    let faultOption = Math.floor(Math.random() * 3);
                    switch(faultOption) {
                        case 0:
                            let currentElement = logicCode[i];
                            if(i >= logicCode.length - 3) {
                                logicCode[i] = logicCode[i - 2];
                                logicCode[i - 2] = currentElement;
                            } else {
                                logicCode[i] = logicCode[i + 2];
                                logicCode[i + 2] = currentElement;
                            }
                            break;
                        case 1:
                            logicCode[i] = logicCode[i].substring(0, logicCode[i].length - Math.ceil(Math.random()*3));
                            break;
                        case 2:
                            logicCode.splice(i, 1);
                            break;
                    }

                    // When the fault was generated increment faultCount
                    faultsCount++;
                }
            }
        }
    }

    // Generate the string containing the code, by joining setupCode array with line breaks followed by one more line break
    // and logicCode array joined with line breaks
    let outputCode = setupCode.join('<br>') + '<br>' + logicCode.join('<br>');

    // If there were no errors in the sequence it will return the generated code to the user
    return outputCode;
}

module.exports = app
