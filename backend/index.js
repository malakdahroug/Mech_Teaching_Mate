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
app.use(bodyParser.json());       // to support JSON-encoded bodies
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
const User = mongoose.model('User', {name: String, username: String, email: String, password: String});
const Project = mongoose.model('Project', {
    user_id: String,
    project_name: String,
    project_sequence: String,
    validity: Boolean
});
const ProjectConfig = mongoose.model('ProjectConfig', {project_id: String, assigned_elements: Array});
const ActuatorConfig = mongoose.model('ActuatorConfig', {
    project_id: String,
    label: String,
    type: String,
    extTag: String,
    retTag: String,
    extSnsTag: String,
    retSnsTag: String
});
const TimerConfig = mongoose.model('TimerConfig', {
    project_id: String,
    label: String,
    resetTag: String,
    completedTag: String
});
const CounterConfig = mongoose.model('CounterConfig', {
    project_id: String,
    label: String,
    resetTag: String,
    completedTag: String,
    currentValueTag: String
});

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
app.get('/project/create/:id/:name/:sequence', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Check validity of the sequence provided - if the sequence is correct the project will be added to the database
    const validator = isValid(req.params.sequence.toUpperCase().split(','));
    const validity = validator.length === 0;

    // If sequence provided is valid, add the project to the database and create a ProjectConfig for it
    if (validity) {
        // Describe the new project
        const newProject = new Project({
            user_id: req.params.id,
            project_name: req.params.name,
            project_sequence: req.params.sequence.toUpperCase(),
            validity: validity
        });

        // Try to get records from the database that match the sequence provided and id of the user
        const project = await Project.find({
            project_sequence: req.params.sequence.toUpperCase(),
            user_id: req.params.id
        }).exec();

        // If user does not have a project fulfilling this sequence add it to the database
        if (project.length === 0) {
            // Add new project to the database
            newProject.save().then(() => {
                // When the project gets successfully created, create an object for the ProjectConfig
                const newProjectConfig = new ProjectConfig({project_id: newProject._id, assigned_elements: []});

                // Add new ProjectConfig to the database
                newProjectConfig.save().then(() => {
                    // If everything succeeded return message to the frontend informing that project was added
                    res.send({
                        status: 'OK',
                        msg: {data: 'Project has been created successfully!', project_id: newProject._id}
                    });
                });
            });
        } else {
            // If user has an existing project fulfilling given sequence return an error informing the user that project exists already
            res.send({
                status: 'Error',
                msg: {data: 'You have an existing project for this sequence already!', project_id: project[0]._id}
            });
        }
    } else {
        // If sequence has error do not add it to the database, return an error to the user
        res.send({status: 'Error', msg: {data: 'An error has occurred please fix the sequence!', errors: validator}});
    }
});

// Route that handles the single project retrieval
app.get('/project/get/:project_id', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    const project = await Project.findOne({_id: req.params.project_id}).exec();
    const projectConfig = await ProjectConfig.findOne({project_id: req.params.project_id}).exec();

    const sequence = project.project_sequence.toUpperCase().split(',');

    const components = getComponents(sequence);
    const unassignedComponents = getUnassignedComponents(components, projectConfig);
    const assignedComponents = getAssignedComponents(components, projectConfig);

    if (project) {
        res.send({
            status: 'OK',
            msg: {
                project_data: project,
                project_config: projectConfig,
                components: components,
                unassignedComponents: unassignedComponents,
                assignedComponents: assignedComponents
            }
        });
    } else {
        res.send({status: 'Error', msg: 'Project with the given ID does not exist!'});
    }
});

// Route that handles user projects retrieval
app.get('/project/get/user/:user_id', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    const projects = await Project.find({user_id: req.params.user_id}).exec();

    if (projects.length > 0) {
        res.send({status: 'OK', msg: {projects: projects}});
    } else {
        res.send({status: 'Error', msg: 'You do not have any projects!'});
    }
});

app.post('/project/config/add', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    const projectID = req.body.pid;
    const elementLabel = req.body.label;
    const elementType = req.body.type;
    const cylinders = ['singleActingSingleTag', 'singleActingDoubleTag', 'doubleActing'];

    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();
    if (projectConfig.length === 1) {
        if (cylinders.includes(elementType)) {
            let extTag, retTag, extSnsTag, retSnsTag;
            extTag = req.body.extensionTag;
            if (elementType !== 'singleActingSingleTag') {
                retTag = req.body.retractionTag;
            }
            extSnsTag = req.body.extSensorTag;
            retSnsTag = req.body.retSensorTag;
            let newActuator;

            if (retTag) {
                newActuator = new ActuatorConfig({
                    project_id: projectID,
                    label: elementLabel,
                    type: elementType,
                    extTag: extTag,
                    retTag: retTag,
                    extSnsTag: extSnsTag,
                    retSnsTag: retSnsTag
                });
            } else {
                newActuator = new ActuatorConfig({
                    project_id: projectID,
                    label: elementLabel,
                    type: elementType,
                    extTag: extTag,
                    retTag: null,
                    extSnsTag: extSnsTag,
                    retSnsTag: retSnsTag
                });
            }

            newActuator.save().then(async () => {
                const elements = projectConfig[0].assigned_elements;
                elements.push({
                    component_id: newActuator._id,
                    component_type: elementType,
                    component_name: elementLabel
                });
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                if (update) {
                    res.send({status: 'OK', msg: 'Configuration has been updated!'});
                } else {
                    res.send({status: 'Error', msg: 'An error occurred while updating the component!'});
                }
            });
        } else if (elementType === 'timer') {
            const newTimer = new TimerConfig({
                project_id: projectID,
                label: elementLabel,
                resetTag: req.body.resetTag,
                completedTag: req.body.completedTag
            });

            newTimer.save().then(async () => {
                const elements = projectConfig[0].assigned_elements;
                elements.push({
                    component_id: newTimer._id,
                    component_type: elementType,
                    component_name: elementLabel
                });
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                if (update) {
                    res.send({status: 'OK', msg: 'Configuration has been updated!'});
                } else {
                    res.send({status: 'Error', msg: 'An error occurred while updating the component!'});
                }
            });
        } else if (elementType === 'counter') {
            const newCounter = new CounterConfig({
                project_id: projectID,
                label: elementLabel,
                resetTag: req.body.resetTag,
                completedTag: req.body.completedTag,
                currentValueTag: req.body.currentValueTag
            });

            newCounter.save().then(async () => {
                const elements = projectConfig[0].assigned_elements;
                elements.push({
                    component_id: newCounter._id,
                    component_type: elementType,
                    component_name: elementLabel
                });
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                if (update) {
                    res.send({status: 'OK', msg: 'Configuration has been updated!'});
                } else {
                    res.send({status: 'Error', msg: 'An error occurred while updating the component!'});
                }
            });
        }
    } else {
        res.send({status: 'Error', msg: 'Project config not found!'});
    }
});

app.post('/project/config/delete', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    const projectID = req.body.pid;
    const component = req.body.component;
    const componentElements = component.split('_');
    const type = componentElements[0];
    let label = '';
    if(componentElements[2]) {
        label = componentElements[1] + '_' + componentElements[2];
    } else {
        label = componentElements[1];
    }

    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();
    if (projectConfig.length === 1) {
        let collection;

        switch(type) {
            case 'actuator':
                collection = ActuatorConfig;
                break;
            case 'timer':
                collection = TimerConfig;
                break;
            case 'counter':
                collection = CounterConfig;
                break;
        }

        if(collection) {
            const element = await collection.find({label: label, project_id: projectID}).exec();

            if(element.length > 0) {
                const result = await collection.deleteMany({label: label, project_id: projectID});

                if(result) {
                    const elements = projectConfig[0].assigned_elements;
                    const indexDeleted = elements.findIndex((e) => {
                        return e.component_name === label;
                    });
                    if(indexDeleted !== -1) {
                        elements.splice(indexDeleted, 1);
                    }

                    const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                    if(update) {
                        res.send({status: 'OK', msg: 'Component deleted!'});
                    } else {
                        res.send({status: 'Error', msg: 'An error occurred!'});
                    }
                } else {
                    res.send({status: 'Error', msg: 'An error occurred!'});
                }
            } else {
                res.send({status: 'Error', msg: 'An error occurred!'});
            }
        } else {
            res.send({status: 'Error', msg: 'An error occurred!'});
        }
    } else {
        res.send({status: 'Error', msg: 'Project config not found!'});
    }
});

app.post('/project/config/get', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    const projectID = req.body.pid;
    const component = req.body.component;
    const componentElements = component.split('_');
    const type = componentElements[0];
    let label = '';
    if(componentElements[2]) {
        label = componentElements[1] + '_' + componentElements[2];
    } else {
        label = componentElements[1];
    }

    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();
    if (projectConfig.length === 1) {
        let collection;

        switch(type) {
            case 'actuator':
                collection = ActuatorConfig;
                break;
            case 'timer':
                collection = TimerConfig;
                break;
            case 'counter':
                collection = CounterConfig;
                break;
        }

        if(collection) {
            const element = await collection.find({label: label, project_id: projectID}).exec();

            if(element.length > 0) {
                res.send({status: 'OK', msg: element});
            } else {
                res.send({status: 'Error', msg: 'An error occurred!'});
            }
        } else {
            res.send({status: 'Error', msg: 'An error occurred!'});
        }
    } else {
        res.send({status: 'Error', msg: 'Project config not found!'});
    }
});


// Sequence validation route
app.get('/sequence/isValid/:sequence', function (req, res) {
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
app.get('/sequence/generate/:sequence/:sensorsPresent/:withFaults', function (req, res) {
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

    let sequence = req.params.sequence.toUpperCase().split(',');

    // If concurrent, repetitive or timed sequence was detected it will return an error informing these types of sequences are not currently supported
    if (sequenceType !== '000') {
        res.send({correct: 'Concurrent, repetitive and timed sequences are not currently supported!'});
    } else {
        // Prepare code object - it will contain both correct and incorrect sequences
        let code = {
            correct: generateCode(sequence, sequenceQueue, sensors, 0, ''),
            incorrect: generateCode(sequence, sequenceQueue, sensors, faults, complexity)
        }
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
    const username = req.body.username.toLowerCase(); // Username, it has to be unique
    const password = req.body.password; // Password, does not have to be unique must be the same as password2
    const password2 = req.body.password2;
    const email = req.body.email; // Email address, it has to be unique

    // Checks if user with the given email address exists in the database - if it is emailExists will be set to true
    const emailExists = await User.findOne({email: email}).exec() !== null;
    // Checks if user with the given username exists in the database - if it is usernameExists will be set to true
    const usernameExists = await User.findOne({username: username}).exec() !== null;

    // Checks if all form fields have been filled
    if (name === '' || username === '' || password === '' || password2 === '' || email === '') {
        res.send({status: 'Error', msg: 'All form fields are required!'});
        // Checks if password is not equal to password, if true it will return an error
    } else if (password !== password2) {
        res.send({status: 'Error', msg: 'Passwords do not match!'});
        // Checks if email is already registered in the database, if true it will throw an error
    } else if (emailExists) {
        res.send({status: 'Error', msg: 'User with email provided exists already!'});
        // Checks if username is already registered in the database, if true it will throw an error
    } else if (usernameExists) {
        res.send({status: 'Error', msg: 'User with username provided exists already!'});
        // If no errors were present it will return status OK and add given user to the users collection in MongoDB
    } else {
        const newUser = new User({
            name: name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: passwordHash.generate(password)
        });
        newUser.save().then((e) => res.send({status: 'OK', msg: 'User registered successfully!'}));
    }
});

// POST route that authenticates users (login system). POST was chosen as it is much more secure than GET which adds
// parameters to the URL rather than sending them in request body.
app.post('/user/login', async function (req, res) {
    // Retrieve POST parameters
    const username = req.body.username.toLowerCase(); // Username

    const password = req.body.password; // Password

    // Find user in the database and assign it to user constant - if user was not found it will assign null
    const user = await User.findOne({username: username}).exec();

    // If user does not exist return an error
    if (user === null) {
        res.send({status: 'Error', msg: 'Username does not exist or password provided is incorrect!'});
        // If password matches, authenticate the user
    } else if (passwordHash.verify(password, user.password)) {
        res.send({status: 'OK', msg: 'User authenticated successfully!', details: user._id});
        // If password does not match, return an error, the same error is returned if username does not exist and if password
        // does not match as per security recommendations
    } else {
        res.send({status: 'Error', msg: 'Username does not exist or password provided is incorrect!'});
    }
});

app.get('/user/get/profile/:uid', async function (req, res) {
    const userID = req.params.uid;

    const userData = await User.find({_id: userID}).exec();

    if (userData.length >= 1) {
        res.send({
            status: 'OK',
            msg: {
                _id: userData[0]._id,
                name: userData[0].name,
                username: userData[0].username,
                email: userData[0].email
            }
        });
    } else {
        res.send({status: 'Error', msg: 'The given user does not exist!'});
    }
});

app.post('/user/update/profile', async function (req, res) {
    const userID = req.body.uid;
    const name = req.body.name;
    const email = req.body.email.toLowerCase();
    const password = req.body.password;
    const password2 = req.body.password2;

    const userData = await User.find({_id: userID}).exec();

    const userDataVerify = await User.find({email: email, _id: {$ne: userID}}).exec();

    if (userDataVerify.length > 0) {
        res.send({status: 'Error', msg: 'Email address is being used by someone else!'});
    } else if (userData.length === 1) {
        const updatedUser = {name: name, email: email}
        if (password && password2) {
            if (password === password2) {
                updatedUser.password = passwordHash.generate(password);
            } else {
                res.send({status: 'Error', msg: 'Passwords provided do not match!'});
            }
        }
        const update = await User.updateOne({_id: userID}, updatedUser);

        if (update) {
            res.send({status: 'OK', msg: 'Profile has been updated!'});
        } else {
            res.send({status: 'OK', msg: 'An internal error occurred! Please try again later!'});
        }
    } else {
        res.send({status: 'Error', msg: 'User does not exist!'});
    }
});

function getElementType(element) {
    const types = {
        actuator: false,
        timer: false,
        counter: false,
        pressure: false
    }
    const actuator = /[A-Z](\+|-)/;
    const counter = /\]\^(([1-9]+[0-9]+)|([2-9]))|(\]\^N\+[1-9]+[0-9]*)|(\]\^N)|\]/;
    const timer = /([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])S|TS/;
    const pressure = /([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])BAR/;

    // Tries to match a string to the regular expression provided
    const matchActuator = element.search(actuator);
    if (matchActuator !== -1) {
        types.actuator = true;
    }

    const matchCounter = element.search(counter);
    if (matchCounter !== -1) {
        types.counter = true;
    }

    const matchTimer = element.search(timer);
    if (matchTimer !== -1) {
        types.timer = true;
    }

    const matchPressure = element.search(pressure);
    if (matchPressure !== -1) {
        types.pressure = true;
    }

    return types;
}

const getComponents = (sequence) => {
    const sequenceElements = [];

    for (const element of sequence) {
        sequenceElements.push({name: element, types: getElementType(element)});
    }

    const actuators = new Set();
    const timers = new Set();
    const counters = new Set();
    const pressures = new Set();
    const evaluation = new Set();

    for (const element of sequenceElements) {
        const evaluatedElement = {name: element.name};

        if (element.types.actuator) {
            const match = /[A-Z]/;
            const name = element.name[element.name.search(match)];
            actuators.add(name);
            evaluatedElement['actuator'] = name;
        }

        if (element.types.timer) {
            timers.add('Timer_' + (timers.size + 1));
            evaluatedElement['timer'] = 'Timer_' + (timers.size);
        }

        if (element.types.counter) {
            counters.add('Counter_' + (counters.size + 1));
            evaluatedElement['counter'] = 'Counter_' + (counters.size);
        }

        if (element.types.pressure) {
            pressures.add('Pressure_' + (pressures.size + 1));
            evaluatedElement['pressure'] = 'Pressure_' + (pressures.size);
        }

        evaluation.add(evaluatedElement);
    }

    return {
        actuator: Array.from(actuators),
        timer: Array.from(timers),
        counter: Array.from(counters),
        pressure: Array.from(pressures),
        elements: Array.from(evaluation)
    }
}

const getUnassignedComponents = (components, config) => {
    const unassignedComponents = [];

    const keys = ['actuator', 'timer', 'counter', 'pressure'];

    for (const key of keys) {
        for (const element of components[key]) {
            const unassigned = config.assigned_elements.find((e) => {
                return e.component_name === element;
            });

            if (!unassigned) {
                unassignedComponents.push({type: key, label: element});
            }
        }
    }

    return unassignedComponents;
}

const getAssignedComponents = (components, config) => {
    const assignedComponents = [];

    const keys = ['actuator', 'timer', 'counter', 'pressure'];

    for (const key of keys) {
        for (const element of components[key]) {
            const assigned = config.assigned_elements.find((e) => {
                return e.component_name === element;
            });

            if (assigned) {
                assignedComponents.push({type: key, label: element});
            }
        }
    }

    return assignedComponents;
}

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
    if (sequence[0][0] === '[' && sequence[sequence.length - 1][sequence[sequence.length - 1].length - 1] === ']') {
        sequence[0] = sequence[0].substring(1, sequence[0].length);
        sequence[sequence.length - 1] = sequence[sequence.length - 1].substring(0, sequence[sequence.length - 1].length - 1);
    }

    // Iterates through the sequence array and find opening and closing brackets
    // Pushes indexes of opening and closing brackets to the openingBrackets array and closingBrackets array
    for (let i = 0; i < sequence.length; i++) {

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
        if (opening !== -1) {
            openingBrackets.push(i);
            temp = temp.replace(/\(/, '');
        }

        // If opening square bracket was found in the current element it pushes its index to the openingRepeating array
        // It then removes it from the temp variable (current action)
        if (openingSquare !== -1) {
            openingRepeating.push(i);
            temp = temp.replace(/\[/, '');
        }

        // If closing bracket was found in the current element it pushes its index to the closingBrackets array
        // It then removes it from the temp variable (current action)
        if (closing !== -1) {
            closingBrackets.push(i);
            temp = temp.replace(/\)/, '');
        }

        // If closing of the repeating sequence was found in the current element it pushes its index to the closingRepeating array
        // It then removes it from the temp variable (current action)
        if (closingSquare !== -1) {
            closingRepeating.push(i);
            temp = temp.replace(/\]\^(([1-9]+[0-9]+)|([2-9]))|(\]\^N\+[1-9]+[0-9]*)|(\]\^N)|\]/, '');
        }

        // Tries to match a string to the regular expression provided
        const match = temp.match(regex);

        // Checks if match exists and if the string provided equals to the match returned
        // If it doesn't then the current element will be added to the error set
        if (match && !(temp === match[0])) {
            errorSet.add(sequence[i]);
        } else if (match === null) {
            errorSet.add(sequence[i]);
        }
    }

    // If the amount of closing and opening brackets is the same, carry on with validating the sequence
    // else return an error informing user if there are too many / not enough closing brackets
    if (openingBrackets.length === closingBrackets.length) {
        // Iterate through both opening and closing brackets arrays
        for (let i = 0; i < openingBrackets.length; i++) {
            // Check if the opening bracket is after the closing bracket
            // If it is add it to the error set
            if (openingBrackets[i] >= closingBrackets[i]) {
                errorSet.add(sequence[openingBrackets[i]]);
                errorSet.add(sequence[closingBrackets[i]]);
                // Check if it is not last element of openingBrackets
                // If it is not, check if the closing bracket is before the next opening bracket
                // If it is not, add it to the error set
            } else if (i !== openingBrackets.length - 1) {
                if (closingBrackets[i] >= openingBrackets[i + 1]) {
                    errorSet.add(sequence[closingBrackets[i]]);
                    errorSet.add(sequence[openingBrackets[i + 1]]);
                }
            }
        }
    }

    // If the amount of closing and opening brackets for repeating sequence is the same, carry on with validating the sequence
    // else return an error informing user if there are too many / not enough closing square brackets
    if (openingRepeating.length === closingRepeating.length) {
        // Iterate through both opening and closing brackets arrays for repeating sequence
        for (let i = 0; i < openingRepeating.length; i++) {
            // Check if the opening square bracket is after the closing bracket of the repeating sequence
            // If it is add it to the error set
            if (openingRepeating[i] >= closingRepeating[i]) {
                errorSet.add(sequence[openingRepeating[i]]);
                errorSet.add(sequence[closingRepeating[i]]);
                // Check if it is not last element of openingRepeating
                // If it is not, check if the closing of the repeating sequence is before the next opening square bracket
                // If it is not, add it to the error set
            } else if (i !== openingRepeating.length - 1) {
                if (closingRepeating[i] >= openingRepeating[i + 1]) {
                    errorSet.add(sequence[closingRepeating[i]]);
                    errorSet.add(sequence[openingRepeating[i + 1]]);
                }
            }
        }
    }


    // If there are more closing brackets than opening ones, return an error informing user that
    // there are too many closing brackets
    // Otherwise, return an error that one or more of the opening brackets were not closed
    if (openingRepeating.length < closingRepeating.length) {
        errorSet.add("There are one or more closing bracket for repeating sequence that are missing an opening square bracket");
    } else if (openingRepeating.length > closingRepeating.length) {
        errorSet.add("There is a syntax error in the repeating sequence, it is either missing a closing bracket or no number of repetitions was provided!");
    }

    // If there are more closing brackets than opening ones, return an error informing user that
    // there are too many closing brackets
    // Otherwise, return an error that one or more of the opening brackets were not closed
    if (openingBrackets.length < closingBrackets.length) {
        errorSet.add("There are one or more closing round bracket that are missing an opening round bracket");
    } else if (openingBrackets.length > closingBrackets.length) {
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
    for (const element of sequence) {
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
    while (!q.isEmpty()) {
        // Empty the first element in the queue and assign it to element variable
        const element = q.dequeue();
        actionCount++;
        if (element.length !== 2) {
            invalid = true;
            invalidElements.push(element);
            // If element is correct i.e. matches the regular expression given
        } else if (element.match(validator)) {

            // Checks if actuator is an actuator set, if it's not it's going to add it to the set
            // and add it's setup action (for now cylinder retracted) to the setup code
            if (!actuators.has(element[0])) {
                actuators.add(element[0]); // Add to set
                setupCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
                setupCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
            }

            // Add current case count
            logicCode.push('    ' + currentCase + ':');

            // Increase case count for the next operation
            currentCase += 10;

            // Checks if it is extension
            if (element[1] === '+') {
                // Add extension actuation to the logicCode
                if (sensors) {
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
            } else if (element[1] === '-') {
                // Add retraction actuation to the logicCode
                if (sensors) {
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
    if (invalid) {
        return 'The sequence provided is invalid, please check the following part of the sequence "' + invalidElements + '"!';
    }

    // Add next jump to first actuation case at the end of setup case
    setupCode.push('        #NEXT := 10;' + '<br>');

    // If sensors are used then it removes second to last element from logicCode array
    // It will remove #NEXT := case jump as there's no next case (second to last element)
    // If sensors are not used it will also remove #NEXT := case jump by removing the last element from logicCode array
    if (sensors) {
        logicCode.splice(logicCode.length - 2, 1);
    } else {
        logicCode.splice(logicCode.length - 1, 1);
    }

    // After code is generated, the function checks if faults parameter is set to true
    // If it is it will modify logic code to generate some errors
    if (faults) {

        // Setting initial value of faultsLimit to 0, it will be amended depending on complexity chosen
        // Using a formulae from the next set of if - else-if statements
        let faultsLimit = 0;

        // Current number of errors generated
        let faultsCount = 0;
        if (complexity === 'easy') {
            faultsLimit = Math.ceil(logicCode.length / 5);
        } else if (complexity === 'medium') {
            faultsLimit = Math.ceil(logicCode.length / 4);
        } else if (complexity === 'hard') {
            faultsLimit = Math.ceil(logicCode.length / 3);
        }

        // If number of generated faults is less than a limit - it will keep repeating until it generates enough errors
        while (faultsCount < faultsLimit) {

            // It will keep iterating through logicCode array
            for (let i = 0; i < logicCode.length; i++) {

                // Checks if enough faults were generated already, if so - it will break the loop as well as condition
                // of the while loop won't be satisfied anymore
                if (faultsCount >= faultsLimit) {
                    break;
                }

                // Generates a pseudo random number between 0 and 10,
                // if the number is smaller than 3 (which maps to roughly 30% chances of error being generated in that line)
                // it will then generate an error
                if (Math.floor(Math.random() * 10) < 3) {
                    // Generates a random number between 0 and 2 to decide which type of fault to include
                    // - 0 -> will shift line of code 2 lines forward (for the last 3 lines it will shift them 2 lines backward)
                    // - 1 -> it will remove up to 3 characters from the end of the string
                    // - 2 -> it will completely remove the line of code
                    let faultOption = Math.floor(Math.random() * 3);
                    switch (faultOption) {
                        case 0:
                            let currentElement = logicCode[i];
                            if (i >= logicCode.length - 3) {
                                logicCode[i] = logicCode[i - 2];
                                logicCode[i - 2] = currentElement;
                            } else {
                                logicCode[i] = logicCode[i + 2];
                                logicCode[i + 2] = currentElement;
                            }
                            break;
                        case 1:
                            logicCode[i] = logicCode[i].substring(0, logicCode[i].length - Math.ceil(Math.random() * 3));
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
