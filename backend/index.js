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
    powerTag: String,
    completedTag: String,
    elapsedTimeTag: String
});

const CounterConfig = mongoose.model('CounterConfig', {
    project_id: String,
    label: String,
    counterVar: String
});
// DATABASE SCHEMAS END

// Route that handles the project creation
app.get('/project/create/:id/:name/:sequence', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Check validity of the sequence provided - if the sequence is correct the project will be added to the database
    const validator = isValid(req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(','));
    const validity = validator.length === 0;

    // If sequence provided is valid, add the project to the database and create a ProjectConfig for it
    if (validity) {
        // Describe the new project
        const newProject = new Project({
            user_id: req.params.id,
            project_name: req.params.name,
            project_sequence: req.params.sequence.toUpperCase().replaceAll(/\s/g, ""),
            validity: validity
        });

        // Try to get records from the database that match the sequence provided and id of the user
        const project = await Project.find({
            project_sequence: req.params.sequence.toUpperCase().replaceAll(/\s/g, ""),
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

    // Fetch the project with the given projectID (passed as parameter)
    const project = await Project.findOne({_id: req.params.project_id}).exec();

    // Fetch the corresponding config
    const projectConfig = await ProjectConfig.findOne({project_id: req.params.project_id}).exec();

    // Break down the sequence from the project configuration (using commas as a separator)
    const sequence = project.project_sequence.toUpperCase().replaceAll(/\s/g, "").split(',');

    // Goes through the sequence and returns list of components for the given sequence
    const components = getComponents(sequence);

    // Get list of unassigned components (components that do not have existing configuration)
    const unassignedComponents = getUnassignedComponents(components, projectConfig);

    // Get list of assigned components (components that do have assigned configuration)
    const assignedComponents = getAssignedComponents(components, projectConfig);

    // If project was found return success message
    if (project) {
        // Prepare the message and send it
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
        // If the project was not found, send error back
        res.send({status: 'Error', msg: 'Project with the given ID does not exist!'});
    }
});

// Route that handles user projects retrieval
app.get('/project/get/user/:user_id', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Fetch projects from the database based on the ID passed as a parameter
    const projects = await Project.find({user_id: req.params.user_id}).exec();

    // If results were returned by database - return them, otherwise return an error
    if (projects.length > 0) {
        res.send({status: 'OK', msg: {projects: projects}});
    } else {
        res.send({status: 'Error', msg: 'You do not have any projects!'});
    }
});

// Route that handles adding component configuration
app.post('/project/config/add', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    // Retrieve project ID, label of the element and type of the element from the request
    const projectID = req.body.pid;
    const elementLabel = req.body.label;
    const elementType = req.body.type;

    // Define types that correspond to different types of actuators
    const cylinders = ['singleActingSingleTag', 'singleActingDoubleTag', 'doubleActing'];

    // Fetch the project config with the given project ID from the database
    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();

    // If there is a project config assigned to this sequence then add the right entry based on component's type
    if (projectConfig.length === 1) {
        // If type is the component is cylinder
        if (cylinders.includes(elementType)) {

            // Prepare tag variables
            let extTag, retTag, extSnsTag, retSnsTag;

            // Extract values from the request and assign them to corresponding tag variable
            extTag = req.body.extensionTag;
            if (elementType !== 'singleActingSingleTag') {
                retTag = req.body.retractionTag;
            }
            extSnsTag = req.body.extSensorTag;
            retSnsTag = req.body.retSensorTag;
            let newActuator;

            // If retraction tag was defined it means cylinder is controlled with two tags, otherwise use single tag
            if (retTag) {
                // Prepare the new actuator to be added to ActuatorConfig collection in the database including retraction tag
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
                // Prepare the new actuator to be added to ActuatorConfig collection in the database with retraction tag set to null
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

            // Save the actuator prepared earlier, when it succeeds at this configuration to the ProjectConfig
            newActuator.save().then(async () => {
                // Get an array containing currently assigned configurations for this project
                const elements = projectConfig[0].assigned_elements;
                // Add ID of the new actuator, its type and label
                elements.push({
                    component_id: newActuator._id,
                    component_type: elementType,
                    component_name: elementLabel
                });

                // Update the collection in the database with new values
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                // If update was successful return OK, otherwise return an error
                if (update) {
                    res.send({status: 'OK', msg: 'Configuration has been updated!'});
                } else {
                    res.send({status: 'Error', msg: 'An error occurred while updating the component!'});
                }
            });
        // If type of the element is timer
        } else if (elementType === 'timer') {
            // Prepare the data to be added to TimerConfigs collection in the database
            const newTimer = new TimerConfig({
                project_id: projectID,
                label: elementLabel,
                powerTag: req.body.powerTag,
                completedTag: req.body.completedTag,
                elapsedTimeTag: req.body.elapsedTimeTag
            });

            // Save the timer prepared earlier, when it succeeds add this configuration to the ProjectConfig
            newTimer.save().then(async () => {
                const elements = projectConfig[0].assigned_elements;
                elements.push({
                    component_id: newTimer._id,
                    component_type: elementType,
                    component_name: elementLabel
                });

                // Update the collection in the database with new values
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                // If update was successful return OK, otherwise return an error
                if (update) {
                    res.send({status: 'OK', msg: 'Configuration has been updated!'});
                } else {
                    res.send({status: 'Error', msg: 'An error occurred while updating the component!'});
                }
            });
        // If type of the element is counter
        } else if (elementType === 'counter') {
            // Prepare the data to be added to CounterConfigs collection in the database
            const newCounter = new CounterConfig({
                project_id: projectID,
                label: elementLabel,
                counterVar: req.body.counterVar
            });

            // Save the counter prepared earlier, when it succeeds add this configuration to the ProjectConfig
            newCounter.save().then(async () => {
                const elements = projectConfig[0].assigned_elements;
                elements.push({
                    component_id: newCounter._id,
                    component_type: elementType,
                    component_name: elementLabel
                });

                // Update the collection in the database with new values
                const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                // If update was successful return OK, otherwise return an error
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

// Route that deletes component from the project config
app.post('/project/config/delete', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Retrieve required parameters from the request (project ID and component label)
    const projectID = req.body.pid;
    const component = req.body.component;

    // Split the string using underscore separator
    const componentElements = component.split('_');

    // Retrieve the type
    const type = componentElements[0];
    let label = '';

    // If array split has 3 elements (means its either timer or counter) use Type_label notation,
    // otherwise it means it is a cylinder and cylinder label should be used
    if (componentElements[2]) {
        label = componentElements[1] + '_' + componentElements[2];
    } else {
        label = componentElements[1];
    }

    // Find the project config in the database that matches ID passed as a parameter
    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();

    // If exactly one ProjectConfig was found carry on with logics
    if (projectConfig.length === 1) {
        let collection;

        // Check what is the type of current component and assign the right collection to the collection variable
        // e.g., if type is actuator the use ActuatorConfig collection
        switch (type) {
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

        // If collection is defined - the type was matching one of the predefined strings
        if (collection) {
            // Get that element from the collection
            const element = await collection.find({label: label, project_id: projectID}).exec();

            // If element was found
            if (element.length > 0) {
                // Remove that element from the collection
                const result = await collection.deleteMany({label: label, project_id: projectID});

                // If the component got deleted - remove it from ProjectConfig
                if (result) {
                    // Assign the assigned elements array of that ProjectConfig to a constant
                    const elements = projectConfig[0].assigned_elements;

                    // Search for the deleted element in the array
                    const indexDeleted = elements.findIndex((e) => {
                        return e.component_name === label;
                    });

                    // If the element was found, remove it from the assigned element array
                    if (indexDeleted !== -1) {
                        elements.splice(indexDeleted, 1);
                    }

                    // Update the ProjectConfig with element removed
                    const update = await ProjectConfig.updateOne({project_id: projectID}, {assigned_elements: elements});

                    // If update was successful, return OK status, otherwise return an error
                    if (update) {
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

// Route that retrieves project configuration
app.post('/project/config/get', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");

    // Retrieve required parameters from the request (project ID and component label)
    const projectID = req.body.pid;
    const component = req.body.component;

    // Split the string using underscore separator
    const componentElements = component.split('_');

    // Retrieve the type
    const type = componentElements[0];
    let label = '';

    // If array split has 3 elements (means its either timer or counter) use Type_label notation,
    // otherwise it means it is a cylinder and cylinder label should be used
    if (componentElements[2]) {
        label = componentElements[1] + '_' + componentElements[2];
    } else {
        label = componentElements[1];
    }
    // Find the project config in the database that matches ID passed as a parameter
    const projectConfig = await ProjectConfig.find({project_id: projectID}).exec();

    // If exactly one ProjectConfig was found carry on with logics
    if (projectConfig.length === 1) {
        let collection;

        // Check what is the type of current component and assign the right collection to the collection variable
        // e.g., if type is actuator the use ActuatorConfig collection
        switch (type) {
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

        // If collection is defined, retrieve the element from the collection using its label and project ID
        if (collection) {
            const element = await collection.find({label: label, project_id: projectID}).exec();

            // If element was found, return OK status, otherwise return an error.
            if (element.length > 0) {
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

    // Convert the sequence to uppercase letters, remove all whitespace, and split it using comma separator
    let sequence = req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(',');

    // Assign the result of isValid function to sequence validator
    // If the sequence is valid - an array returned will be empty
    // If it is invalid - the array will be containing a list of elements that could not be parsed
    const sequenceValidator = isValid(sequence);

    // Return the result
    res.send(sequenceValidator);
});

// // New route for generating code with errors
// app.get('/sequence/generate/:sequence/:sensorsPresent/:withFaults', function (req, res) {
//     // Temporary Cross Origin workaround
//     res.header("Access-Control-Allow-Origin", "*");
//
//     const sequenceQueue = new queue(); // Instantiates a new Queue for the client and stores it in a constant sequenceQueue
//
//     // If sensorsPresent URL param is set to 1 it means sequence should be generated with sensors included
//     const sensors = req.params.sensorsPresent === '1';
//
//     // Splitting withFaults parameter by comma as they arrive in the following form 1,easy/hard/medium or 0,none
//     // If the value before comma is one it means sequence is supposed to be generated with errors
//     // The second parameter (after comma) controls the difficulty
//     const faultsSettings = req.params.withFaults.split(',');
//
//     // If the first URL parameter (withFaults) is set to 1, faults settings will be set to true which will result
//     // in generating code with errors
//     const faults = faultsSettings[0] === '1';
//
//     // Errors complexity is extracted from the second parameter of withFaults
//     const complexity = faultsSettings[1];
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
//     let sequence = req.params.sequence.toUpperCase().split(',');
//
//     // If concurrent, repetitive or timed sequence was detected it will return an error informing these types of sequences are not currently supported
//     if (sequenceType !== '000') {
//         res.send({correct: 'Concurrent, repetitive and timed sequences are not currently supported!'});
//     } else {
//         // Prepare code object - it will contain both correct and incorrect sequences
//         let code = {
//             correct: generateCode(sequence, sequenceQueue, sensors, 0, ''),
//             incorrect: generateCode(sequence, sequenceQueue, sensors, faults, complexity)
//         }
//         res.send(code); // Sends response to the client
//     }
// });

// Sequence generation route
app.get('/sequence/generate2/:sequence/:errors/:projectID?', async function (req, res) {
    // Temporary Cross Origin workaround
    res.header("Access-Control-Allow-Origin", "*");
    res.setHeader('Content-Type', 'application/json');

    // Convert the sequence to uppercase letters, remove all whitespace, and split it using comma separator
    let sequence = req.params.sequence.toUpperCase().replaceAll(/\s/g, "").split(',');

    // Assign the result of isValid function to sequence validator
    // If the sequence is valid - an array returned will be empty
    // If it is invalid - the array will be containing a list of elements that could not be parsed
    const sequenceValidator = isValid([...sequence]);

    // If the sequence validator returned an empty array
    if (sequenceValidator.length === 0) {

        const doesStartWithRetract = startsWithRetract([...sequence]);

        if(doesStartWithRetract) {
            res.send({status: 'Error', msg: 'The sequences starting with extended cylinders are currently not supported!', retraction: true});
            return;
        }

        // Fetch the project config assigned to this sequence (it will return values only if the project ID was provided as a parameter)
        const projectConfigID = await ProjectConfig.findOne({project_id: req.params.projectID}).exec();

        // If the config was found, pass its ID to the generator
        if (projectConfigID) {
            // Call the generator function with 3 parameters: formatted sequence, projectID and error complexity
            const code = await generateCode2(sequence, projectConfigID._id.toString(), req.params.errors);
            // Return the result of generator back to the user
            res.send({status: 'OK', msg: code});
        // If ProjectConfig was not found - generate the sequence with auto-generated tag names
        } else {
            // Call the generator function with 3 parameters: formatted sequence, null (instead of project ID) and error complexity
            const code = await generateCode2(sequence, null, req.params.errors);
            // Return the result of generator back to the user
            res.send({status: 'OK', msg: code});
        }
    } else {
        // If sequence is invalid return an error instead
        res.send({status: 'Error', msg: sequenceValidator});
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
        // Prepare the user
        const newUser = new User({
            name: name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: passwordHash.generate(password)
        });
        // Save user and send feedback back
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

// Route for profile info retrieval
app.get('/user/get/profile/:uid', async function (req, res) {
    // Extract user ID from the request
    const userID = req.params.uid;

    // Find the user based on the userID provided
    const userData = await User.find({_id: userID}).exec();

    // If user was found
    if (userData.length >= 1) {
        // Prepare the response and send it
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
        // If user was not found, return an error
        res.send({status: 'Error', msg: 'The given user does not exist!'});
    }
});

// Route that allows updating data in the profile
app.post('/user/update/profile', async function (req, res) {
    // Retrieve parameters from the request and assign them to corresponding constants
    const userID = req.body.uid;
    const name = req.body.name;
    const email = req.body.email.toLowerCase(); // Convert to lower case so data in the database is in unified form (important for comparison later)
    const password = req.body.password;
    const password2 = req.body.password2;

    // Find the user based on the user ID provided in the request
    const userData = await User.find({_id: userID}).exec();

    // Find the user based on the email provided in the request, where user ID is not same as the one passed in te request
    // Allows to ensure that user IDs are unique
    const userDataVerify = await User.find({email: email, _id: {$ne: userID}}).exec();

    // If the second query returned results - return an error informing the user that this email address is taken
    if (userDataVerify.length > 0) {
        res.send({status: 'Error', msg: 'Email address is being used by someone else!'});
    // Otherwise, check if the user with the given ID was found
    } else if (userData.length === 1) {
        // If the user was found, prepare updated user object using name and email
        const updatedUser = {name: name, email: email}
        // If password and password2 were provided, attempt to update it
        if (password && password2) {
            // If both passwords are the same, update the password in updatedUser object
            if (password === password2) {
                updatedUser.password = passwordHash.generate(password);
            // If passwords don't match - return an error
            } else {
                res.send({status: 'Error', msg: 'Passwords provided do not match!'});
                return;
            }
        }

        // Update the user in the database using updatedUser object
        const update = await User.updateOne({_id: userID}, updatedUser);

        // If update was successful, return OK, otherwise return an error
        if (update) {
            res.send({status: 'OK', msg: 'Profile has been updated!'});
        } else {
            res.send({status: 'Error', msg: 'An internal error occurred! Please try again later!'});
        }
    } else {
        // If user was not found, return an error
        res.send({status: 'Error', msg: 'User does not exist!'});
    }
});

/**
 * Function that checks if the sequence contains cylinders that start with retraction e.g., A-,A+
 * Will return true for this type of sequences
 *
 * @param sequence processed sequence array (converted to uppercase letters and whitespace removed)
 * @returns {boolean} true if sequence contains any cylinder retracting before extending, false otherwise
 */
function startsWithRetract(sequence) {
    // Regular expression to match actuator
    const actuator = /[A-Z](\+|-)/;

    // Set containing actuators
    const actuators = new Set();

    // Iterates through sequence element by element
    for(let element of sequence) {

        // Remove all brackets
        element = element.replaceAll(/\(/g, '').replaceAll(/\[/g, '');
        // Tries to match a string to the regular expression provided for actuator
        const matchActuator = element.search(actuator);

        // If it matched actuator
        if (matchActuator !== -1 && element.search('T') === -1) {
            // It checks if the action is retraction and the actuator is not known yet (it hasn't extended)
            if(element[1] === '-' && !actuators.has(element[0])) {
                // Breaks the loop and returns true
                return true;
            } else {
                // If the actuator action is extend, it will add it to the set.
                actuators.add(element[0]);
            }
        }
    }

    // If nothing was returned yet, return false
    return false;
}

/**
 * Function that returns an object containing boolean values representing each of the element types i.e.,
 * - Actuator
 * - Timer
 * - Counter
 * - Pressure sensor
 *
 * @param element single action in the sequence such as [(A+ or TS
 * @returns {{timer: boolean, actuator: boolean, counter: boolean, pressure: boolean}}
 */
function getElementType(element) {
    // Prepare response object containing each of the types
    const types = {
        actuator: false,
        timer: false,
        counter: false,
        pressure: false
    }

    // Define regular expressions for each of the element types
    const actuator = /[A-Z](\+|-)/;
    const counter = /\]\^(([1-9]+[0-9]+)|([2-9]))|(\]\^N\+[1-9]+[0-9]*)|(\]\^N)|\]/;
    const timer = /([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])S|TS/;
    const pressure = /([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])BAR/;

    // Tries to match a string to the regular expression provided for actuator
    const matchActuator = element.search(actuator);

    // If the match was found set actuator property of types object to true
    if (matchActuator !== -1 && element.search('T') === -1) {
        types.actuator = true;
    }

    // Tries to match a string to the regular expression provided for counter
    const matchCounter = element.search(counter);

    // If the match was found set counter property of types object to true
    if (matchCounter !== -1) {
        types.counter = true;
    }

    // Tries to match a string to the regular expression provided for timer
    const matchTimer = element.search(timer);

    // If the match was found set timer property of types object to true
    if (matchTimer !== -1) {
        types.timer = true;
    }

    // Tries to match a string to the regular expression provided for pressure sensor
    const matchPressure = element.search(pressure);

    // If the match was found set pressure property of types object to true
    if (matchPressure !== -1) {
        types.pressure = true;
    }

    // Return response
    return types;
}

/**
 * Function that returns a list of all components in the sequence,
 * - for actuators it is going to use it's actual labels e.g., A+ will result in A
 * - anytime it encounters timer it will add Timer_nextIntegerNumber
 * - anytime it encounters counter it will add Counter_nextIntegerNumber
 * - anytime it encounters pressure sensor it will add Pressure_nextIntegerNumber
 *
 * It will return an object containing array of string representing each of the components in the sequence,
 * as well as an array containing all elements together (evaluation property)
 *
 * @param sequence an array containing processed sequence (converted to uppercase and whitespace removed)
 * @returns {{timer: string[], actuator: string[], elements: string[], counter: string[], pressure: string[]}}
 */
const getComponents = (sequence) => {
    // Prepare an array to store all elements of the sequence
    const sequenceElements = [];

    // Iterate through sequence
    for (const element of sequence) {
        // Add each of the elements to the array using name (action in the sequence) and types object generated by getElementType function
        sequenceElements.push({name: element, types: getElementType(element)});
    }

    // Prepare sets (to ensure uniqueness of data) for each of the component type as well as evaluation (all components combined)
    const actuators = new Set();
    const timers = new Set();
    const counters = new Set();
    const pressures = new Set();
    const evaluation = new Set();

    // Iterate through sequenceElements list
    for (const element of sequenceElements) {
        // Prepare an object that stores evaluated element
        const evaluatedElement = {name: element.name};

        // If the current type of element is actuator
        if (element.types.actuator) {
            const match = /[A-Z]/;
            // Use regular expression to extract the label
            const name = element.name[element.name.search(match)];
            // Add element to actuator set
            actuators.add(name);
            // Set actuator property of evaluatedElement object to the label extracted
            evaluatedElement['actuator'] = name;
        }

        // If the current type of element is timer
        if (element.types.timer) {
            // Add element to timer set
            timers.add('Timer_' + (timers.size + 1));
            // Set timer property of evaluatedElement object to the label generated
            evaluatedElement['timer'] = 'Timer_' + (timers.size);
        }

        // If the current type of element is counter
        if (element.types.counter) {
            // Add element to counter set
            counters.add('Counter_' + (counters.size + 1));
            // Set counter property of evaluatedElement object to the label generated
            evaluatedElement['counter'] = 'Counter_' + (counters.size);
        }

        // If the current type of element is pressure sensor
        if (element.types.pressure) {
            // Add element to pressure sensors set
            pressures.add('Pressure_' + (pressures.size + 1));
            // Set pressure property of evaluatedElement object to the label generated
            evaluatedElement['pressure'] = 'Pressure_' + (pressures.size);
        }

        // Add current element to evaluatedElements set
        evaluation.add(evaluatedElement);
    }

    // Return object with all values extracted
    return {
        actuator: Array.from(actuators),
        timer: Array.from(timers),
        counter: Array.from(counters),
        pressure: Array.from(pressures),
        elements: Array.from(evaluation)
    }
}

/**
 * Returns a list of components that do not have configuration defined in the database
 *
 * @param components output of getComponents function for the given sequence
 * @param config corresponding ProjectConfiguration for the given sequence
 * @returns {[]} list containing non configured components
 */
const getUnassignedComponents = (components, config) => {
    // Prepare the empty list to be returned
    const unassignedComponents = [];

    // Define list of possible keys in each of the objects
    const keys = ['actuator', 'timer', 'counter', 'pressure'];

    // Iterate through each of the keys
    for (const key of keys) {
        // Iterate through the list of components matching they key of the current iteration
        for (const element of components[key]) {
            // Check if the configuration exists by searching in assigned_elements of the ProjectConfig using component name
            const unassigned = config.assigned_elements.find((e) => {
                return e.component_name === element;
            });

            // If element was not found, add its corresponding object to the unassignedComponents array
            if (!unassigned) {
                unassignedComponents.push({type: key, label: element});
            }
        }
    }

    // Return the unassignedComponents list
    return unassignedComponents;
}

/**
 * Returns a list of components with existing configuration defined in the database
 *
 * @param components output of getComponents function for the given sequence
 * @param config corresponding ProjectConfiguration for the given sequence
 * @returns {[]} list containing configured components
 */
const getAssignedComponents = (components, config) => {
    // Prepare the empty list to be returned
    const assignedComponents = [];

    // Define list of possible keys in each of the objects
    const keys = ['actuator', 'timer', 'counter', 'pressure'];

    // Iterate through each of the keys
    for (const key of keys) {
        // Iterate through the list of components matching they key of the current iteration
        for (const element of components[key]) {
            // Check if the configuration exists by searching in assigned_elements of the ProjectConfig using component name
            const assigned = config.assigned_elements.find((e) => {
                return e.component_name === element;
            });

            // If element was found, add its corresponding object to the assignedComponents array
            if (assigned) {
                assignedComponents.push({type: key, label: element});
            }
        }
    }

    // Return the assignedComponents list
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
    // - A single letter followed by -
    // - T followed by a letter S
    // - A number followed by a letter S
    // - A number followed by a string BAR
    let regex = /^((((T\+)?(([0-9].[0-9]+)|([1-9]+[0-9]*)|([1-9]+[0-9]*.[0-9]+)))S)|TS)|([A-Z]\+)|([A-Z]-)|([0-9].[0-9]+|[1-9]+[0-9]*.[0-9]+|[0-9])BAR$/;

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

// OLD GENERATED LEFT FOR REFERENCE
// /**
//  * Function responsible for generating PLC code
//  *
//  * @param sequence an array containing initially processed sequence
//  * @param q empty Queue prepared for sequence generation
//  * @param sensors true if sensors are present, false if sensors are not present
//  * @param faults boolean that controls whether to generate correct code or code with errors
//  * @param complexity complexity of faults generated
//  * @returns {string} generated code based on the given sequence
//  */
// function generateCode(sequence, q, sensors, faults, complexity) {
//     // Add all elements from the sequence array to the Queue
//     for (const element of sequence) {
//         q.enqueue(element);
//     }
//
//     // Initial code (sequence setup) that will contain all the setup info e.g. cylinders retracted, timers reset etc
//     let setupCode = [];
//
//     // Create a set for all actuators
//     let actuators = new Set([]);
//
//     // Actual logics code for each of the actions in the sequence
//     let logicCode = [];
//
//     // Create setup code and case 0, so e.g. all cylinders can start in their desired positions
//     setupCode.push('CASE #NEXT OF');
//     setupCode.push('    0:');
//
//     // Defines a validator (Regular expression) for a valid input - currently it is capable of validating the following options:
//     // A-Z -> cylinder to actuate
//     // + -> extend cylinder
//     // - -> retract cylinder
//     // A+ -> valid, A- -> valid, A3 -> invalid
//     const validator = /[A-Z](\+|\-)/i;
//     let invalid = false;
//     let invalidElements = [];
//     let currentCase = 10; // Current case count for actuations
//
//     let actionCount = 0;
//
//     // Keeps iterating until the queue is fully emptied
//     while (!q.isEmpty()) {
//         // Empty the first element in the queue and assign it to element variable
//         const element = q.dequeue();
//         actionCount++;
//         if (element.length !== 2) {
//             invalid = true;
//             invalidElements.push(element);
//             // If element is correct i.e. matches the regular expression given
//         } else if (element.match(validator)) {
//
//             // Checks if actuator is an actuator set, if it's not it's going to add it to the set
//             // and add it's setup action (for now cylinder retracted) to the setup code
//             if (!actuators.has(element[0])) {
//                 actuators.add(element[0]); // Add to set
//                 setupCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
//                 setupCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
//             }
//
//             // Add current case count
//             logicCode.push('    ' + currentCase + ':');
//
//             // Increase case count for the next operation
//             currentCase += 10;
//
//             // Checks if it is extension
//             if (element[1] === '+') {
//                 // Add extension actuation to the logicCode
//                 if (sensors) {
//                     logicCode.push('        IF "Cylinder_' + element[0] + '_Ret_Sensor" THEN');
//                     logicCode.push('            Cylinder_' + element[0] + '_Extend := TRUE;'); // Extend cylinder
//                     logicCode.push('            Cylinder_' + element[0] + '_Retract := FALSE;'); // Extend cylinder
//                     logicCode.push('            #NEXT := ' + currentCase + ';'); // Move to the next case
//                     logicCode.push('        END_IF;<br>'); // Retract cylinder
//                 } else {
//                     logicCode.push('        Cylinder_' + element[0] + '_Extend := TRUE;'); // Extend cylinder
//                     logicCode.push('        Cylinder_' + element[0] + '_Retract := FALSE;'); // Extend cylinder
//                     logicCode.push('        #NEXT := ' + currentCase + ';<br>'); // Move to the next case
//                 }
//                 // Checks if it is retraction
//             } else if (element[1] === '-') {
//                 // Add retraction actuation to the logicCode
//                 if (sensors) {
//                     logicCode.push('        IF "Cylinder_' + element[0] + '_Ext_Sensor" THEN');
//                     logicCode.push('            Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
//                     logicCode.push('            Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
//                     logicCode.push('            #NEXT := ' + currentCase + ';'); // Move to the next case
//                     logicCode.push('        END_IF;<br>'); // Retract cylinder
//                 } else {
//                     logicCode.push('        Cylinder_' + element[0] + '_Extend := FALSE;'); // Retract cylinder
//                     logicCode.push('        Cylinder_' + element[0] + '_Retract := TRUE;'); // Retract cylinder
//                     logicCode.push('        #NEXT := ' + currentCase + ';<br>'); // Move to the next case
//                 }
//             }
//
//             // If current element in the queue is not a valid expression, it will set invalid to true
//             // it will also add the invalid elements in the sequence to the invalidArray, which later on will be
//             // displayed to the user
//         } else {
//             invalid = true;
//             invalidElements.push(element);
//         }
//     }
//
//     // If invalid element was detected, it will return the message with invalid elements in the sequence
//     if (invalid) {
//         return 'The sequence provided is invalid, please check the following part of the sequence "' + invalidElements + '"!';
//     }
//
//     // Add next jump to first actuation case at the end of setup case
//     setupCode.push('        #NEXT := 10;' + '<br>');
//
//     // If sensors are used then it removes second to last element from logicCode array
//     // It will remove #NEXT := case jump as there's no next case (second to last element)
//     // If sensors are not used it will also remove #NEXT := case jump by removing the last element from logicCode array
//     if (sensors) {
//         logicCode.splice(logicCode.length - 2, 1);
//     } else {
//         logicCode.splice(logicCode.length - 1, 1);
//     }
//
//     // After code is generated, the function checks if faults parameter is set to true
//     // If it is it will modify logic code to generate some errors
//     if (faults) {
//
//         // Setting initial value of faultsLimit to 0, it will be amended depending on complexity chosen
//         // Using a formulae from the next set of if - else-if statements
//         let faultsLimit = 0;
//
//         // Current number of errors generated
//         let faultsCount = 0;
//         if (complexity === 'easy') {
//             faultsLimit = Math.ceil(logicCode.length / 5);
//         } else if (complexity === 'medium') {
//             faultsLimit = Math.ceil(logicCode.length / 4);
//         } else if (complexity === 'hard') {
//             faultsLimit = Math.ceil(logicCode.length / 3);
//         }
//
//         // If number of generated faults is less than a limit - it will keep repeating until it generates enough errors
//         while (faultsCount < faultsLimit) {
//
//             // It will keep iterating through logicCode array
//             for (let i = 0; i < logicCode.length; i++) {
//
//                 // Checks if enough faults were generated already, if so - it will break the loop as well as condition
//                 // of the while loop won't be satisfied anymore
//                 if (faultsCount >= faultsLimit) {
//                     break;
//                 }
//
//                 // Generates a pseudo random number between 0 and 10,
//                 // if the number is smaller than 3 (which maps to roughly 30% chances of error being generated in that line)
//                 // it will then generate an error
//                 if (Math.floor(Math.random() * 10) < 3) {
//                     // Generates a random number between 0 and 2 to decide which type of fault to include
//                     // - 0 -> will shift line of code 2 lines forward (for the last 3 lines it will shift them 2 lines backward)
//                     // - 1 -> it will remove up to 3 characters from the end of the string
//                     // - 2 -> it will completely remove the line of code
//                     let faultOption = Math.floor(Math.random() * 3);
//                     switch (faultOption) {
//                         case 0:
//                             let currentElement = logicCode[i];
//                             if (i >= logicCode.length - 3) {
//                                 logicCode[i] = logicCode[i - 2];
//                                 logicCode[i - 2] = currentElement;
//                             } else {
//                                 logicCode[i] = logicCode[i + 2];
//                                 logicCode[i + 2] = currentElement;
//                             }
//                             break;
//                         case 1:
//                             logicCode[i] = logicCode[i].substring(0, logicCode[i].length - Math.ceil(Math.random() * 3));
//                             break;
//                         case 2:
//                             logicCode.splice(i, 1);
//                             break;
//                     }
//
//                     // When the fault was generated increment faultCount
//                     faultsCount++;
//                 }
//             }
//         }
//     }
//
//     // Generate the string containing the code, by joining setupCode array with line breaks followed by one more line break
//     // and logicCode array joined with line breaks
//     let outputCode = setupCode.join('<br>') + '<br>' + logicCode.join('<br>');
//
//     // If there were no errors in the sequence it will return the generated code to the user
//     return outputCode;
// }

/**
 * Function that generates the errors in the correctly generated code.
 *
 * @param code an array containing correctly generated code
 * @param complexity complexity of errors to be generated (easy, medium or hard)
 * @param actuators Set of actuators used in the sequence
 * @returns {array} an array with code with errors generated
 */
function generateErrors(code, complexity, actuators) {
    // Converting set to an array
    actuators = Array.from(actuators);

    // Copying the content of code array to logicCode variable - it is done so it doesn't affect source variable
    let logicCode = [...code];

    // Setting initial value of faultsLimit to 0, it will be amended depending on complexity chosen
    // Using a formulae from the next set of if - else-if statements
    let faultsLimit = 0;

    // Current number of errors generated
    let faultsCount = 0;

    // Depending on the complexity provided it will set faultsLimit using one of the formulas
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
                // - 3 -> it will swap TRUE to FALSE and FALSE to TRUE
                // - 4 -> it will modify the IF statement to be incorrect (missing conditions)
                let faultOption = Math.floor(Math.random() * 6);
                switch (faultOption) {
                    case 0:
                        let currentElement = logicCode[i];
                        // Check if the line of code would be shifted to the index that does not exist
                        // If that would be the case, the line of code is going to be shifted 2 indexes backward
                        // Otherwise the current line will be moved two indexes forward
                        if (i >= logicCode.length - 3) {
                            // Perform shift
                            logicCode[i] = logicCode[i - 2];
                            logicCode[i - 2] = currentElement;
                        } else {
                            // Perform shift
                            logicCode[i] = logicCode[i + 2];
                            logicCode[i + 2] = currentElement;
                        }
                        break;
                    case 1:
                        // Remove random number of characters (between 1 and 3) from the end of the current line
                        logicCode[i] = logicCode[i].substring(0, logicCode[i].length - Math.ceil(Math.random() * 3));
                        break;
                    case 2:
                        // Remove the current line from the array
                        logicCode.splice(i, 1);
                        break;
                    case 3:
                        // Iterate between current index and the end of the array
                        for(let j = i; j < logicCode.length; j++) {
                            // Generate random number to decide whether TRUE should become FALSE or FALSE should become TRUE
                            let opt = Math.round(Math.random());
                            // Try to search for TRUE if opt generated was 0, FALSE if opt generated was 1
                            let currentLine = logicCode[j].search((opt === 0 ? 'TRUE' : 'FALSE'));

                            // If it was found, change TRUE to FALSE or FALSE to TRUE depending on the value of opt
                            if(currentLine !== -1) {
                                logicCode[j] = logicCode[j].replace((opt === 0 ? 'TRUE' : 'FALSE'), (opt === 0 ? 'FALSE' : 'TRUE'));
                                break;
                            }
                        }
                        break;
                    case 4:
                        // Iterate between current index and the end of the array
                        for(let j = i; j < logicCode.length; j++) {
                            // Check if the current line contains IF in the string
                            let currentLine = logicCode[j].search('IF');
                            // If it contains it, remove one of the conditions, otherwise keep iterating
                            if(currentLine !== -1) {
                                // Check if the IF statement has multiple conditions (connected with AND)
                                let next = logicCode[j].search('AND');
                                // If it does, remove one of them, otherwise, try to iterate further
                                if(next !== -1) {
                                    // Remove one of the conditions
                                    logicCode[j] = logicCode[j].substr(0, currentLine + 4) + logicCode[j].substr(next + 4, logicCode[j].length);
                                    break;
                                } else {
                                    continue;
                                }
                            }
                        }
                        break;
                    case 5:
                        // Generate a random number between 0 and length of actuators array
                        // This will be used to perform swap of tags that control actuator
                        let randomActuator = Math.floor(Math.random() * actuators.length);
                        let randomActuator2 = Math.floor(Math.random() * actuators.length);

                        // Keep generating the number until actuators are different, if it generates the same number 10 times
                        // Just proceed to prevent delay
                        let attemptCount = 0;
                        while(randomActuator === randomActuator2) {
                            // Generate number
                            randomActuator2 = Math.floor(Math.random() * actuators.length);
                            // Increment attemptCount
                            attemptCount++;
                            // If attemptCount is greater than 10, stop the loop
                            if(attemptCount > 10) {
                                break;
                            }
                        }

                        // Iterate between the current index and the end of the array to find the actuator to swap
                        for(let j = i; j < logicCode.length; j++) {
                            // Search for actuator in the current line
                            let currentLine = logicCode[j].search('_' + actuators[randomActuator]);
                            // Search the current line for value assignment syntax
                            let currentLineActuator = logicCode[j].search(':=');

                            // If actuator was found and assignment tag was found, swap the actuator and break the loop
                            if(currentLine !== -1 && currentLineActuator !== -1) {
                                logicCode[j] = logicCode[j].replace('_' + actuators[randomActuator], '_' + actuators[randomActuator2]);
                                break;
                            }

                            // If it reached the end and no element was found, restart searching from the beginning of the code
                            if(j === logicCode.length - 1) {
                                j = 0;
                            }
                        }
                        break;
                }

                // When the fault was generated increment faultCount
                faultsCount++;
            }
        }
    }

    // Return code with errors generated
    return logicCode;
}

/**
 * The main generator function that generates the SCL code based on the sequence provided
 *
 * @param sequence an array containing processed sequence (converted to uppercase, whitespace removed)
 * @param projectID ID of the project config in ProjectConfigs database collection
 * @param errors string containing info whether errors should be generated (either '0,none', '1,easy', '1,medium' or '1,hard')
 * @returns an object containing code, incorrect code and XML tags depending on options selected
 */
async function generateCode2(sequence, projectID, errors) {
    // Initial code (sequence setup) that will contain all the setup info e.g. cylinders retracted, timers reset etc
    let setupCode = [];

    // Split errors provided using comma seperator
    errors = errors.split(',');
    // If the first element in errors array is 0, set errorsPresent to false - no errors to generate, otherwise true - generate errors
    const errorsPresent = (errors[0] !== '0');
    // Extract complexity
    const errorsComplexity = errors[1];

    // Create a set for all actuators
    let actuators = new Set([]);

    // Define the types that actuator can have
    const cylinderTypes = ['singleActingSingleTag', 'singleActingDoubleTag', 'doubleActing'];

    // Set initial value of config present to false, it will control whether tag names should be auto generated
    // Or they should be taken from the configuration
    let configPresent = false;

    // Elements of the sequence - used to store configurations retrieved from the database
    let sequenceElements = [];

    // If projectID was provided it will attempt to fetch cylinder configurations from the database
    if (projectID) {
        // Get project configuration from the database
        const projectConfiguration = await ProjectConfig.findOne({_id: projectID.trim()});
        // If it was found, set config present to true
        if (projectConfiguration) {
            configPresent = true;
        } else {
            // If it was not found, return an error and stop execution
            return {code: 'Project does not exist! Please make sure project is configured and exists!'};
        }

        // Get list of unassigned components for the sequence, if any of them was not assigned it will return an error
        const unassigned = getUnassignedComponents(getComponents(sequence), projectConfiguration);

        // If there are unassigned components return an error and stop execution
        if (unassigned.length > 0) {
            return {code: 'Configuration incomplete!', incorrect: ''};
        }

        // For each of the elements assigned fetch the configuration and add it to the sequenceElements array
        for (const element of projectConfiguration.assigned_elements) {
            // If the component is cylinder
            if (cylinderTypes.indexOf(element.component_type) !== -1) {
                // Fetch the configuration from ActuatorConfigs collection
                const elementConfig = await ActuatorConfig.findOne({_id: element.component_id});
                // Push it to the sequence elements array
                sequenceElements.push({type: element.component_type, label: element.component_name, config: elementConfig});
            // If the component is timer
            } else if (element.component_type === 'timer') {
                // Fetch the configuration from TimerConfigs collection
                const elementConfig = await TimerConfig.findOne({_id: element.component_id});
                // Push it to the sequence elements array
                sequenceElements.push({type: 'timer', label: element.component_name, config: elementConfig});
            // If the component is counter
            } else if (element.component_type === 'counter') {
                // Fetch the configuration from CounterConfigs collection
                const elementConfig = await CounterConfig.findOne({_id: element.component_id});
                // Push it to the sequence elements array
                sequenceElements.push({type: 'counter', label: element.component_name, config: elementConfig});
            }
        }
    }

    // Create setup code and case 0, so e.g. all cylinders can start in their desired positions
    setupCode.push('CASE #NEXT OF');
    setupCode.push('    0:');

    // Prepare an empty array to store the generated code
    let logicCode = [];
    // Prepare an empty array to store the code for components that require setup at the end of the code e.g., timers
    let componentsCode = [];
    // Define regex for actuators
    const actuation = /[A-Z](\+|-)/i;
    // Define regex for timers
    const timer = /((((T\+)?(([0-9].[0-9]+)|([1-9]+[0-9]*)|([1-9]+[0-9]*.[0-9]+)))S)|TS)*/i;

    // Create temporary queue that will be storing next actuations (used for concurrent parts of the sequence)
    let tempQueue = new queue();

    // Define starting case number
    let currentCase = 10;
    // Define initial timer count
    let timerCount = 1;
    // Prepare an empty array that will be storing previous actuations, used for generating the right IF statement
    let previousActuations = [];

    // REPEATING SEQUENCE CONFIG VARIABLES
    let repeatingCount = 0; // Target number of elements in repeating sequence
    let currentRepeatingCount = 0; // Current number of elements fulfilled
    let countersCount = 0; // Counter count
    let counters = 0; // Counter count
    let counterCondition = ''; // Condition used by counter
    let isTVarSet = false; // Controls whether T variable should be used (when TS or similar occurs it is set to true)
    let isNVarSet = false; // Controls whether N variable should be used (when n+1 or similar occurs it is set to true)

    let tempSequence = [...sequence]; // Copies the content of the sequence, so it stays unchanged
    let nested = false; // Flag that contains information whether the sequence is nested repeating (whole sequence surrounded with a pair of square brackets)

    // If the first element of the sequence contains opening square bracket and the last element of the sequence contains closing square bracket
    if (tempSequence[0].search(/\[/) !== -1 && tempSequence[tempSequence.length - 1].search(/]/) !== -1) {
        // Remove the first square bracket
        tempSequence[0] = tempSequence[0].replace('[', '');
        // Remove the last square bracket
        tempSequence[tempSequence.length - 1] = tempSequence[tempSequence.length - 1].replace(']', '');
        // If there are any other square brackets within the sequence - set the nested flag to true and break
        for (let i = 0; i < tempSequence.length; i++) {
            if (tempSequence[i].search(/\[/) !== -1) {
                nested = true;
                break;
            }

            if (tempSequence[i].search(/]/) !== -1) {
                nested = false;
                break;
            }
        }
    }

    // If sequence is nested, remove the first and last square bracket
    if (nested) {
        sequence[0] = sequence[0].replace('[', '');
        sequence[sequence.length - 1] = sequence[sequence.length - 1].substr(0, sequence[sequence.length - 1].length - 1);
    }

    // Check if the last element of the sequence does contains counter
    let last = sequence[sequence.length - 1].search(/]\^/) !== -1;
    // Check if the last element of the sequence contains repeating part
    let repeating = sequence[sequence.length - 1].search(/]\^/) !== -1 || sequence[sequence.length - 1].search(/]/) !== -1;
    // Check if the last element of the sequence contains counter and timer
    let lastRepeatingTimer = sequence[sequence.length - 1].search(/]\^/) !== -1 && (sequence[sequence.length - 1].search(/T/) < sequence[sequence.length - 1].search(/S/));

    // Prepare initial content of the XML code to be imported in TIA Portal
    let xmlSetup = '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n' +
        '<Tagtable name=\'ControllerTagsFolder\'>\n';

    // Keeps iterating until the sequence is empty
    while (sequence.length > 0) {
        // Removes the first element from the sequence and assigns it to current variable
        let current = sequence.splice(0, 1)[0];
        // Prepares the array that will store instructions to reset the counter (from the previous case)
        let resetTimer = [];

        // Checks if the current element starts a repeating sequence
        if (current.search(/\[/) !== -1) {
            // Increase count of counters
            countersCount++;
            // Remove the square bracket
            current = current.replace(/\[/, '');

            // Keep iterating through the remaining sequence until closing square bracket is found
            for (let i = 0; i < sequence.length; i++) {
                // Increase the count of steps in the repeating part
                repeatingCount++;
                // If the end of repeating sequence is found
                if (sequence[i].search(/]/) !== -1) {
                    // Check if the current element requires N variable
                    if (sequence[i].search(/]\^N\+/) !== -1) {
                        // If it does add condition containing N variable
                        counterCondition = '(N_VARIABLE + ' + sequence[i].substr(sequence[i].search(/]\^N\+/) + 4) + ')';
                        // Mark N variable flag as true
                        isNVarSet = true;
                        // Increase count of counters
                        counters++;
                        // Remove anything coming after square bracket (including the bracket)
                        sequence[i] = sequence[i].substr(0, sequence[i].search(/]\^N\+/));
                    // Check if the current element of the sequence contains a counter
                    } else if (sequence[i].search(/]\^/) !== -1) {
                        // Set counter condition to the number coming after ]^
                        counterCondition = sequence[i].substr(sequence[i].search(/]\^/) + 2);
                        // Increase count of counter
                        counters++;
                        // Remove anything coming after square bracket (including the bracket)
                        sequence[i] = sequence[i].substr(0, sequence[i].search(/]\^/));
                    } else {
                        // Otherwise set counter condition to null
                        counterCondition = null;
                    }
                    // Break the loop
                    break;
                }
            }
        }

        // Add start of the case to code which corresponds to CASE_NUMBER:
        logicCode.push('    ' + currentCase + ':');
        // Check if there are any actuations from the previous iteration of the loop (which should be added as conditions)
        if (previousActuations.length > 0) {
            // Prepare the condition
            let ifString = '';
            // Keep iterating until there are no more actuations
            while (previousActuations.length > 0) {
                // Remove the current actuation from the previousActuation array and assign it to cur variable
                const cur = previousActuations.splice(0, 1)[0];
                // Prepare the actuator tag
                let actuatorTag = {};
                // If the second character is not ! which corresponds to timer
                if (cur[1] !== '!') {
                    // Check if the configuration was provided
                    if (configPresent) {
                        // Search for configuration of that component
                        const actuatorConfig = sequenceElements.find((e) => {
                            return e.label === cur[0];
                        });
                        // Assign actuator tag with the tags extracted from the component configuration
                        actuatorTag.extSns = actuatorConfig.config.extSnsTag;
                        actuatorTag.retSns = actuatorConfig.config.retSnsTag;
                        actuatorTag.ext = actuatorConfig.config.extTag;

                        // If the component is not single acting cylinder controller with a single tag
                        // assign the retraction tag
                        if(actuatorTag.type !== 'singleActingSingleTag') {
                            actuatorTag.ret = actuatorConfig.config.retTag;
                        }
                    // If configuration was not provided
                    } else {
                        // Auto-generate tag names
                        actuatorTag.extSns = 'Sensor_' + cur[0] + '_Extended';
                        actuatorTag.retSns = 'Sensor_' + cur[0] + '_Retracted';
                        actuatorTag.ext = 'Cylinder_' + cur[0] + '_Extend';
                        actuatorTag.ret = 'Cylinder_' + cur[0] + '_Retract';
                    }
                }

                // If the last actuation was retract, generate corresponding condition to reflect retracted cylinder
                if (cur[1] === '-') {
                    ifString += '((NOT ' + actuatorTag.extSns + ') AND ' + actuatorTag.retSns + ') AND ';
                // If the last actuation was extend, generate corresponding condition to reflect extended cylinder
                } else if (cur[1] === '+') {
                    ifString += '(' + actuatorTag.extSns + ' AND (NOT ' + actuatorTag.retSns + ')) AND ';
                // If the last action was timer
                } else if (cur[1] === '!') {
                    // Prepare timerTag object to store different timer tags
                    let timerTag = {};
                    // If configuration was provided
                    if (configPresent) {
                        // Search for that timer in the configuration
                        const timerConfig = sequenceElements.find((e) => {
                            return e.label === 'Timer_' + cur[2];
                        });
                        // Assign corresponding values to the properties of timerTag object
                        timerTag.completed = timerConfig.config.completedTag;
                        timerTag.power = timerConfig.config.powerTag;
                    } else {
                        // If no configuration was provided, auto-generate tag names
                        timerTag.completed = 'Timer_' + cur[2] + '_Finished';
                        timerTag.power = 'Timer_' + cur[2] + '_Start';
                    }
                    // Add timer condition to the statement
                    ifString += '(' + timerTag.completed + ') AND ';
                    // Add timer reset to resetTimer array (this will be added at the begining of the next case)
                    resetTimer.push('                ' + timerTag.power + ' := FALSE;'); // Retract cylinder
                }
            }
            // Remove additional characters from the end of the ifString (it will remove extra ' AND ' at the end)
            ifString = ifString.substr(0, ifString.length - 5);
            // Add if statement to the logic code
            logicCode.push('        IF ' + ifString + ' THEN ');
            // Reset all timers from the previous case
            while (resetTimer.length > 0) {
                logicCode.push(resetTimer.splice(0, 1)[0]);
            }
        }

        // If current element contains start of the concurrent part of the sequence (multiple actuations simultaneously)
        if (current.search(/\(/) !== -1) {
            // Add the current element to the queue with round bracket remove
            tempQueue.enqueue(current.substr(1, current.length));
            // Keep iterating (it will be stopped when the closing round bracket was found)
            while (true) {
                // Take a note of the current element
                const element = sequence[0];
                // Sanity check to verify element is defined
                if (element) {
                    // Remove one from the repeating count
                    repeatingCount--;
                    // If element is the end of the concurrent part
                    if (element.search(/\)/) !== -1) {
                        // Assign the first element of the sequence to temp
                        const temp = sequence.splice(0, 1)[0];
                        // Add it to the concurrent queue
                        tempQueue.enqueue(temp.substr(0, temp.length - 1));
                        // Stop the loop
                        break;
                    } else {
                        // Remove the first element of the sequence and add it to the queue
                        tempQueue.enqueue(sequence.splice(0, 1)[0]);
                    }
                } else {
                    // If element is empty break the loop
                    break;
                }
            }

            // Take a note of the last index of logicCode
            let lastIndex = logicCode.length - 1;
            // Keep iterating until concurrent queue is empty
            while (!tempQueue.isEmpty()) {
                // Prepare the variable to store conditions for the if statement
                let ifString = '';
                // Remove the current element from the queue and store it in the tempCurrent
                const tempCurrent = tempQueue.dequeue();
                // Match the current element against actuation regular expression
                const actuationMatch = tempCurrent.match(actuation);
                // Match the current element against timer regular expression
                const timerMatch = tempCurrent.match(timer);

                // If the current element is an actuator
                if (actuationMatch && actuationMatch[0] !== '' && !(timerMatch && timerMatch[0] !== '')) {
                    // Get the label and assign it to the actuator constant
                    const actuator = tempCurrent[0];
                    // Get the actuation and assign it to action constant
                    const action = tempCurrent[1];

                    // Prepare the objects to store tags of the current actuator
                    let actuatorTag = {};
                    // If configuration was provided
                    if (configPresent) {
                        // Search for the configuration in sequenceElements array
                        const actuatorConfig = sequenceElements.find((e) => {
                            return e.label === actuator;
                        });

                        // Assign the tags to the right properties of actuatorTag object
                        actuatorTag.extSns = actuatorConfig.config.extSnsTag;
                        actuatorTag.retSns = actuatorConfig.config.retSnsTag;
                        actuatorTag.ext = actuatorConfig.config.extTag;

                        // If the cylinder is not single acting cylinder controlled with a single tag, assign retraction tag
                        if(actuatorConfig.type !== 'singleActingSingleTag') {
                            actuatorTag.ret = actuatorConfig.config.retTag;
                        }
                    } else {
                        // If no configuration was provided, assign auto-generated tag names
                        actuatorTag.extSns = 'Sensor_' + actuator + '_Extended';
                        actuatorTag.retSns = 'Sensor_' + actuator + '_Retracted';
                        actuatorTag.ext = 'Cylinder_' + actuator + '_Extend';
                        actuatorTag.ret = 'Cylinder_' + actuator + '_Retract';
                    }

                    // If the actuator is not in the actuators set, add it to the set and add corresponding setup code
                    if (!actuators.has(actuator)) {
                        actuators.add(actuator); // Add to set
                        setupCode.push('        ' + actuatorTag.ext + ' := FALSE;'); // Retract cylinder
                        // If the retraction tag was defined, set it to true (for cylinders controlled with two tags)
                        if(actuatorTag.ret) {
                            setupCode.push('        ' + actuatorTag.ret + ' := TRUE;'); // Retract cylinder
                        }
                    }

                    // If current action is to retract the cylinder
                    if (action === '-') {
                        // Set its extension tag to FALSE
                        logicCode.push('                ' + actuatorTag.ext + ' := FALSE;'); // Retract cylinder

                        // If the retraction tag was defined, set it to true (for cylinders controlled with two tags)
                        if(actuatorTag.ret) {
                            logicCode.push('                ' + actuatorTag.ret + ' := TRUE;'); // Retract cylinder
                        }
                        // Add the current actuation to the ifstring of the current case
                        ifString = ' AND (' + actuatorTag.extSns + ' AND (NOT ' + actuatorTag.retSns + ')) THEN ';
                    }

                    // If current action is to extend the cylinder
                    if (action === '+') {
                        // If the retraction tag was defined, set it to FALSE (for cylinders controlled with two tags)
                        if(actuatorTag.ret) {
                            logicCode.push('                ' + actuatorTag.ret + ' := FALSE;'); // Extend cylinder
                        }
                        // Set its extension tag to TRUE
                        logicCode.push('                ' + actuatorTag.ext + ' := TRUE;'); // Extend cylinder
                        // Add the current actuation to the ifstring of the current case
                        ifString = ' AND ((NOT ' + actuatorTag.extSns + ') AND ' + actuatorTag.retSns + ') THEN ';
                    }

                    // If the current case is not the first case
                    if (currentCase !== 10) {
                        // Check if the last instruction in the logic code is timer reset
                        if (logicCode[lastIndex].search(':= FALSE') !== -1) {
                            // If it is add if string at lastIndex - 1 (this is the index taken before the loop)
                            logicCode[lastIndex - 1] = logicCode[lastIndex - 1].substr(0, logicCode[lastIndex - 1].length - 6) + ifString;
                        } else {
                            // If the last instruction is if statement add if string at lastIndex (this is the index taken before the loop)
                            logicCode[lastIndex] = logicCode[lastIndex].substr(0, logicCode[lastIndex].length - 6) + ifString;
                        }
                    }
                    // Add current action to previous actions
                    previousActuations.push(tempCurrent);
                }

                // If the current element is a timer
                if (timerMatch && timerMatch[0] !== '') {
                    // Add the current element to the previous actuations
                    previousActuations.push('!!' + timerCount);

                    // Define an object that will store tags controlling the timer
                    let timerTag = {};

                    // If the config was provided
                    if (configPresent) {
                        // Search for the timer in the array
                        const timerConfig = sequenceElements.find((e) => {
                            return e.label === 'Timer_' + timerCount;
                        });

                        // Set the tag using the one from the configuration
                        timerTag.power = timerConfig.config.powerTag;
                    } else {
                        // If no config was provided, auto-generate the tag name
                        timerTag.power = 'Timer_' + timerCount + '_Start';
                    }

                    // Add the action to start the timer
                    logicCode.push('                ' + timerTag.power + ' := TRUE;');

                    // Prepare the value to store the delay
                    let time = '';

                    // Set current time as the current element of the sequence - it will be filtered out to contain number only
                    let currentTime = tempCurrent;

                    // Search the current sequence element to see if the current element contains T+ (T_VARIABLE + offset value)
                    if (tempCurrent.search('T+') !== -1) {
                        // Remove T+ and S from the time to extract the number only
                        currentTime = currentTime.replaceAll('T+', '').replaceAll('S', '');
                        // Set the time delay to the T_VARIABLE + extracted offset
                        time = '("T_VARIABLE" + ' + currentTime + ')';
                        // Set T Variable flag to true
                        isTVarSet = true;
                    // Search the current sequence element to see if it uses T variable, but no offset
                    } else if (tempCurrent.search('T') !== -1) {
                        // Set the time delat to the T_VARIABLE
                        time = '"T_VARIABLE"';
                        // Set T Variable flag to true
                        isTVarSet = true;
                    } else {
                        // Otherwise remove any other string of characters and extract the number only
                        currentTime = currentTime.replaceAll('T', '').replaceAll('+', '').replaceAll(']', '');
                        time = currentTime;
                    }

                    // Define an object that will store tags controlling the timer
                    let timer = {};

                    // If the config was provided
                    if (configPresent) {
                        // Search for the timer in the array
                        const timerConfig = sequenceElements.find((e) => {
                            return e.label === 'Timer_' + timerCount;
                        });
                        // Set corresponding timer tags based on data extracted from the config
                        timer.power = timerConfig.config.powerTag;
                        timer.completed = timerConfig.config.completedTag;
                        timer.elapsedTime = timerConfig.config.elapsedTimeTag;
                    } else {
                        // If no config was provided auto-generate tag names
                        timer.power = 'Timer_' + timerCount + '_Start';
                        timer.completed = 'Timer_' + timerCount + '_Finished';
                        timer.elapsedTime = 'Timer_' + timerCount + '_Elapsed';
                    }

                    // Add setup of the timer to the components code array (that will be appended to the end of code)
                    componentsCode.push('"IEC_Timer_' + (timerCount - 1) + '_DB".TON(IN:="' + timer.power + '",');
                    componentsCode.push('                     PT:=' + (time.startsWith('"T_VAR') ? 'INT_TO_TIME((' + time +') * 1000)' : 't#' + time) +',');
                    componentsCode.push('                     Q=>"' + timer.completed + '",');
                    componentsCode.push('                     ET=>"' + timer.elapsedTime + '");\n');
                    timerCount++;
                }
            }
        // If the sequence element is not within concurrent part of sequence
        } else {
            // Take a note of the last index of the code array
            let lastIndex = logicCode.length - 1;
            // Prepare an empty string that will be used in IF statement
            let ifString = '';

            // Match the current element against actuator regular expression
            const actuationMatch = current.match(actuation);
            // Match the current element against timer regular expression
            const timerMatch = current.match(timer);

            // If the current element matches the actuator, but it does not match the timer
            if (actuationMatch && actuationMatch[0] !== '' && !(timerMatch && timerMatch[0] !== '')) {
                // Get the actuator label from the current sequence element
                const actuator = current[0];
                // Get the actuation type from the current sequence element
                const action = current[1];

                // Prepare an object to store actuator tag configuration
                let actuatorTag = {};

                // If the configuration was provided
                if (configPresent) {
                    // Search for the current actuator in the configuration
                    const actuatorConfig = sequenceElements.find((e) => {
                        return e.label === actuator;
                    });

                    // Extract tags from the configuration and assign them to the actuatorTag object
                    actuatorTag.extSns = actuatorConfig.config.extSnsTag;
                    actuatorTag.retSns = actuatorConfig.config.retSnsTag;
                    actuatorTag.ext = actuatorConfig.config.extTag;

                    // If the actuator is not single acting cylinder controlled with the single tag, assign the retraction tag
                    if(actuatorConfig.type !== 'singleActingSingleTag') {
                        actuatorTag.ret = actuatorConfig.config.retTag;
                    }
                } else {
                    // If no configurations were provided, auto-generate tag names
                    actuatorTag.extSns = 'Sensor_' + actuator + '_Extended';
                    actuatorTag.retSns = 'Sensor_' + actuator + '_Retracted';
                    actuatorTag.ext = 'Cylinder_' + actuator + '_Extend';
                    actuatorTag.ret = 'Cylinder_' + actuator + '_Retract';
                }

                // Check if the current actuator is not in the actuator set
                if (!actuators.has(actuator)) {
                    actuators.add(actuator); // Add to set
                    // Add code to retract cylinder to the setup code
                    setupCode.push('        ' + actuatorTag.ext + ' := FALSE;'); // Retract cylinder
                    // If retraction tag was provided, it means it is a cylinder controlled with two tags, it will set retraction tag to TRUE
                    if(actuatorTag.ret) {
                        setupCode.push('        ' + actuatorTag.ret + ' := TRUE;'); // Retract cylinder
                    }
                }

                // If the current action is to retract the cylinder
                if (action === '-') {
                    // Set extension tag to FALSE
                    logicCode.push('                ' + actuatorTag.ext + ' := FALSE;'); // Retract cylinder
                    // If retraction tag was provided, it means it is a cylinder controlled with two tags, it will set retraction tag to TRUE
                    if(actuatorTag.ret) {
                        logicCode.push('                ' + actuatorTag.ret + ' := TRUE;'); // Retract cylinder
                    }
                    // Add the current cylinder to the if string
                    ifString = ' AND (' + actuatorTag.extSns + ' AND (NOT ' + actuatorTag.retSns + ')) THEN ';
                }

                if (action === '+') {
                    // If retraction tag was provided, it means it is a cylinder controlled with two tags, it will set retraction tag to FALSE
                    if(actuatorTag.ret) {
                        logicCode.push('                ' + actuatorTag.ret + ' := FALSE;'); // Extend cylinder
                    }
                    // Set extension tag to TRUE
                    logicCode.push('                ' + actuatorTag.ext + ' := TRUE;'); // Extend cylinder
                    // Add the current cylinder to the if string
                    ifString = ' AND ((NOT ' + actuatorTag.extSns + ') AND ' + actuatorTag.retSns + ') THEN ';
                }

                // If it is not the first case of logic code
                if (currentCase !== 10) {
                    // Check if the code contains the timer reset at the last element (before it was modified by the current element)
                    if (logicCode[lastIndex].search(':= FALSE') !== -1) {
                        // If it is the timer, it means it should modify the line before the timer rest which should map to an if statement
                        logicCode[lastIndex - 1] = logicCode[lastIndex - 1].substr(0, logicCode[lastIndex - 1].length - 6) + ifString;
                    } else {
                        // If the last line is not a timer, it should modify the last line before any actions were added in the current sequence element
                        logicCode[lastIndex] = logicCode[lastIndex].substr(0, logicCode[lastIndex].length - 6) + ifString;
                    }
                }

                // Add current actuation to the previous actuations list
                previousActuations.push(current);
            }

            // If the current element matched the timer
            if (timerMatch && timerMatch[0] !== '') {
                // Prepare the object to store timer control tags
                let timerTag = {};
                // If the config was provided
                if (configPresent) {
                    // Search for the timer in the sequence elements array
                    const timerConfig = sequenceElements.find((e) => {
                        return e.label === 'Timer_' + timerCount;
                    });

                    // If it was found set it to the corresponding values
                    if(timerConfig) {
                        timerTag.power = timerConfig.config.powerTag;
                        timerTag.completed = timerConfig.config.completedTag;
                        timerTag.elapsedTime = timerConfig.config.elapsedTimeTag;
                    }
                } else {
                    // If no configuration was provided, auto-generate the values
                    timerTag.power = 'Timer_' + timerCount + '_Start';
                    timerTag.completed = 'Timer_' + timerCount + '_Finished';
                    timerTag.elapsedTime = 'Timer_' + timerCount + '_Elapsed';
                }

                // Add current timer to the list of previous actuations
                previousActuations.push('!!' + timerCount);
                // Add instruction to start the timer to the code
                logicCode.push('                ' + timerTag.power + ' := TRUE;');

                // Prepare the variable to store the time delay
                let time = '';
                // Set variable time to false initially
                let variableTime = false;
                // Assign the current sequence element to the currentTime variable
                let currentTime = current;

                // If the timer uses T variable offset by a number
                if (current.startsWith('T+')) {
                    // Set the value of time delay to T_VARIABLE +
                    time = '"T_VARIABLE" + ';
                    // Indicate the T Variable is required
                    isTVarSet = true;
                    // Indicate the timer uses T Variable
                    variableTime = true;
                // If the timer uses T variable which is not offset by a number
                } else if (current.startsWith('T')) {
                    // Set the value of time delay to T_VARIABLE
                    time = '"T_VARIABLE"';
                    // Indicate the T Variable is required
                    isTVarSet = true;
                    // Indicate the timer uses T Variable
                    variableTime = true;
                }

                // If variable was used, extract the offset
                if (variableTime) {
                    // Remove: T, +, S and square bracket to extract a number
                    currentTime = currentTime.replaceAll('T', '').replaceAll('+', '').replaceAll('S', '').replaceAll(']', '');
                }

                // Add extracted number / offset to the time delay
                time += currentTime;

                // Add timer setup code to the components code which will be appended to the end of code generated
                componentsCode.push('"IEC_Timer_' + (timerCount - 1) + '_DB".TON(IN:="' + timerTag.power + '",');
                componentsCode.push('                     PT:=' + (time.startsWith('"T_VAR') ? 'INT_TO_TIME((' + time +') * 1000)' : 't#' + time) +',');
                componentsCode.push('                     Q=>"' + timerTag.completed + '",');
                componentsCode.push('                     ET=>"' + timerTag.elapsedTime + '");\n');
                // Increase the number of timers used
                timerCount++;
            }
        }

        // If its the first iteration
        if (currentCase === 10) {
            // If previous actions are defined
            if (previousActuations.length > 0) {
                // Prepare the ifstring
                let ifString = '';
                // Iterate through previous actions
                for (let i = 0; i < previousActuations.length; i++) {
                    // Assign current iteration element to cur constant
                    const cur = previousActuations[i];
                    // If the action is not a timer
                    if (cur[1] !== '!') {
                        // Prepare an object to store actuator tags
                        let actuatorTag = {};

                        // If configuration was provided
                        if (configPresent) {
                            // Search for the corresponding configuration in sequence elements array
                            const actuatorConfig = sequenceElements.find((e) => {
                                return e.label === cur[0];
                            });

                            // Assign tags extracted to actuator tags object (just sensors required)
                            actuatorTag.extSns = actuatorConfig.config.extSnsTag;
                            actuatorTag.retSns = actuatorConfig.config.retSnsTag;
                        } else {
                            // If no config was provided, auto-generate tag names
                            actuatorTag.extSns = 'Sensor_' + cur[0] + '_Extended';
                            actuatorTag.retSns = 'Sensor_' + cur[0] + '_Retracted';
                        }

                        // Add the actuation to ifstring
                        ifString += '((NOT ' + actuatorTag.extSns + ') AND ' + actuatorTag.retSns + ') AND ';
                    }
                }

                // Remove additional ' AND ' at the end of if string
                ifString = ifString.substr(0, ifString.length - 5);
                // Add condition to the start of logic code
                logicCode[0] = logicCode[0] + '\n' + '        IF ' + ifString + ' THEN ';
            }
        }

        // Increment the case count
        currentCase += 10;
        // If no repeatingCount is defined (no repetition detected)
        if (repeatingCount === 0) {
            // Set the next case
            logicCode.push('                #NEXT := ' + currentCase + ';'); // Move to the next case
        // If repeating count was defined and it reached the last element
        } else if (repeatingCount === currentRepeatingCount) {
            // Calculate the next case using formula below
            let nextCase = currentCase - 10 * repeatingCount - 10;
            // If there was a counter condition defined
            if (counterCondition != null) {
                // Prepare the object to store counter tags
                let counterTag = {};
                // If configuration was provided
                if (configPresent) {
                    // Search for the corresponding configuration in the sequence elements array
                    const counterConfig = sequenceElements.find((e) => {
                        return e.label === 'Counter_' + countersCount;
                    });

                    // Set the counter variable tag to the actual tag provided
                    counterTag.counterVar = counterConfig.config.counterVar;
                } else {
                    // If no config was provided, auto-generate the tag name
                    counterTag.counterVar = 'Counter_' + countersCount + '_Value';
                }

                // Add initial part of the if statement
                logicCode.push('                IF ' + counterTag.counterVar + ' < ' + counterCondition + ' THEN ');
                logicCode.push('                        ' + counterTag.counterVar + ' := ' + counterTag.counterVar + ' + 1;'); // Move to the next case
                logicCode.push('                        #NEXT := ' + nextCase + ';'); // Move to the next case
                // If it is the last element or sequence is nested then add else statement which will loop back to the begining
                if (!last || nested) {
                    logicCode.push('                ELSE');
                    logicCode.push('                        #NEXT := ' + currentCase + ';'); // Move to the next case
                }
                // Finish if statement
                logicCode.push('                END_IF;');
            // If no counter condition was defined, go to the next case
            } else {
                logicCode.push('                #NEXT := ' + nextCase + ';'); // Move to the next case
            }
            // Reset repeating counts
            repeatingCount = 0;
            currentRepeatingCount = 0;
        // If the current case is inside repeating sequence, but it is not the last element set the next case
        } else {
            logicCode.push('                #NEXT := ' + currentCase + ';'); // Move to the next case
            currentRepeatingCount++;
        }
        // Finish if statement
        logicCode.push('        END_IF;\n'); // Move to the next case
    }

    // If sequence is not repeating or nested, remove an extra end if added
    if (!repeating && !nested) {
        logicCode.splice(logicCode.length - 2, 1);
    // If the sequence is nested
    } else if (nested) {
        // Set initial next case index to -1
        let nextCaseIndex = -1;
        // Iterate through the sequence from the end
        for (let i = logicCode.length - 1; i > 0; i--) {
            // Find the first occurrence of NEXT
            if (logicCode[i].search('#NEXT') !== -1) {
                // Take a note of it index
                nextCaseIndex = i;
                break;
            }
        }

        // As the sequence is nested, it should be going back to the start of the sequence, the NEXT value will be set to 0
        logicCode[nextCaseIndex] = logicCode[nextCaseIndex].substr(0, logicCode[nextCaseIndex].search('#NEXT := ')) + '#NEXT := 0;';

        // Prepare ifString
        let ifString = '';

        // Iterate through the list of previous actuations
        for (let i = 0; i < previousActuations.length; i++) {
            // Extract the label from the previous actuation
            const action = previousActuations[i][1];
            // Extract the actuation from the previous actuation
            const actuator = previousActuations[i][0];

            // Prepare the actuator object to store its tag
            let actuatorTag = {};

            // If the current action is not the timer
            if (action !== '!') {
                // If the config was provided
                if (configPresent) {
                    // Search for the actuator config in the sequence elements array
                    const actuatorConfig = sequenceElements.find((e) => {
                        return e.label === actuator;
                    });

                    // Assign the tags extracted from the config to the actuatorTag object properties
                    actuatorTag.extSns = actuatorConfig.config.extSnsTag;
                    actuatorTag.retSns = actuatorConfig.config.retSnsTag;
                } else {
                    // If no config was provided, auto-generated the tag names
                    actuatorTag.extSns = 'Sensor_' + actuator + '_Extended';
                    actuatorTag.retSns = 'Sensor_' + actuator + '_Retracted';
                }
            }

            // If the last action was extend
            if (action === '+') {
                // Amend the condition to correspond to extension action (only if the initial condition is incorrect)
                if (logicCode[0].search('NOT ' + actuatorTag.retSns + '') !== -1) {
                    ifString = 'AND (' + actuatorTag.extSns + ' AND (NOT ' + actuatorTag.retSns + ')) ';
                }
            }

            // If the last action was retract
            if (action === '-') {
                // Amend the condition to correspond to retraction action (only if the initial condition is incorrect)
                if (logicCode[0].search('NOT ' + actuatorTag.extSns + '') !== -1) {
                    ifString = 'AND ((NOT ' + actuatorTag.extSns + ') AND ' + actuatorTag.retSns + ') ';
                }
            }
        }

        // Add the amended ifstring to the very first condition
        logicCode[0] = logicCode[0].replace('THEN', ifString + 'THEN')
    }

    // Add end case at the end
    logicCode.push('END_CASE;')

    // If the sequence contains a timer in the last action of the sequence
    if (lastRepeatingTimer) {
        // Prepare object to store tags of the component
        let timerTag = {};

        // If the configuration was provided
        if (configPresent) {
            // Find the related configuration in the sequence elements array
            const timerConfig = sequenceElements.find((e) => {
                return e.label === 'Timer_' + (timerCount - 1);
            });
            // Assign the tag based on the config
            timerTag.completed = timerConfig.config.completedTag;
        } else {
            // If no config was provided, auto-generate the tag name
            timerTag.completed = 'Timer_' + (timerCount - 1) + '_Finished';
        }
        // Add corresponding condition to the first if statement in case 10
        logicCode[0] = logicCode[0].replace('THEN', 'AND ' + timerTag.completed + ' THEN')
    }

    // Convert the set of actuators to array so it is easier to manage
    const actuatorList = Array.from(actuators);

    let tagCount = 0; // Current bit to assign
    let addr = 0; // Current address space to assign
    let actions = []; // List of tags
    let intCount = 1; // Current count of Memory addresses (words)

    // Iterate through list of actuators and add each of the actuators to the action list with its corresponding type and label
    for (let i = 0; i < actuatorList.length; i++) {
        actions.push({type: 'Bool', txt: 'Cylinder_' + actuatorList[i] + '_Extend'});
        actions.push({type: 'Bool', txt: 'Cylinder_' + actuatorList[i] + '_Retract'});
        actions.push({type: 'Bool', txt: 'Sensor_' + actuatorList[i] + '_Extended'});
        actions.push({type: 'Bool', txt: 'Sensor_' + actuatorList[i] + '_Retracted'});
    }

    // Iterate timerCount times - 1
    for (let i = 0; i < timerCount - 1; i++) {
        // Prepare object to store timer tags
        let timerTag = {};
        // Check if configuration was provided
        if (configPresent) {
            // Find the timer in the configuration
            const timerConfig = sequenceElements.find((e) => {
                return e.label === 'Timer_' + (i + 1);
            });
            // Assign the corresponding tag
            timerTag.power = timerConfig.config.powerTag;
        } else {
            // If no configuration was provided, auto-generate the tag name
            timerTag.power = 'Timer_' + (i + 1) + '_Start';
        }

        // Add each of the timer tags to actions list with its corresponding variable type and label
        actions.push({type: 'Bool', txt: 'Timer_' + (i + 1) + '_Start'});
        actions.push({type: 'Bool', txt: 'Timer_' + (i + 1) + '_Finished'});
        actions.push({type: 'Time', txt: 'Timer_' + (i + 1) + '_Elapsed'});
        // Reset timers in the setup code (all timers start powered off)
        setupCode.push('        ' + timerTag.power + ' := FALSE;');
    }

    // Iterate through the list of all counters
    for (let i = 1; i <= counters; i++) {
        // Prepare object to store counter tags
        let counterTag = {};
        // Check if configuration was provided
        if (configPresent) {
            // Find the counter in the configuration
            const counterConfig = sequenceElements.find((e) => {
                return e.label === 'Counter_' + i;
            });
            // Assign the corresponding tag
            counterTag.counterVar = counterConfig.config.counterVar;
        } else {
            // If no configuration was provided, auto-generate the tag name
            counterTag.counterVar = 'Counter_' + i + '_Value';
        }

        // Add counter variable to actions list with its corresponding variable type and label
        actions.push({type: 'Int', txt: 'Counter_' + i + '_Value'});
        setupCode.push('        ' + counterTag.counterVar + ' := 0;');
    }

    // Iterate through the list of actions for each of the tags add corresponding type, address and name depedning on the state
    // of address control variables following the formula:
    // - If type is bool, address will be addr.tagCount, it will increase tagCount until it reaches 8. If it reaches 8 it will increase value of addr by 1 and reset tagCount to 0
    // - If type is time or int it will assign the Int/Time type, address will be assigned based on intCount * 100 formula, after each iteration it will increase intCount by 1
    for (let i = 0; i < actions.length; i++) {
        if (actions[i].type === 'Bool') {
            xmlSetup += '<Tag type=\'Bool\' hmiVisible=\'True\' hmiWriteable=\'True\' hmiAccessible=\'True\' retain=\'False\' remark=\'\' addr=\'%M' + addr + '.' + tagCount + '\'>' + actions[i].txt + '</Tag>\n';
            tagCount++;
            if (tagCount === 8) {
                addr++;
                tagCount = 0;
            }
        } else if (actions[i].type === 'Time') {
            xmlSetup += '<Tag type=\'Time\' hmiVisible=\'True\' hmiWriteable=\'True\' hmiAccessible=\'True\' retain=\'False\' remark=\'\' addr=\'%MD' + (intCount * 100) + '\'>' + actions[i].txt + '</Tag>\n'
            intCount++;
        } else if (actions[i].type === 'Int') {
            xmlSetup += '<Tag type=\'Int\' hmiVisible=\'True\' hmiWriteable=\'True\' hmiAccessible=\'True\' retain=\'False\' remark=\'\' addr=\'%MW' + (intCount * 100) + '\'>' + actions[i].txt + '</Tag>\n'
            intCount++;
        }
    }

    // If isNVarSet flag (means variable n was used in the sequence) is set to true it will add its corresponding configuration to xmlSetup.
    // Address will be worked out using the following formula:
    // - intCount * 100, after completing intCount will be increased by one
    if (isNVarSet) {
        xmlSetup += '<Tag type=\'Int\' hmiVisible=\'True\' hmiWriteable=\'True\' hmiAccessible=\'True\' retain=\'False\' remark=\'\' addr=\'%MW' + (intCount * 100) + '\'>N_VARIABLE</Tag>\n'
        intCount++;
    }

    // If isTVarSet flag (means T variable delay was used in the sequence) is set to true it will add its corresponding configuration to xmlSetup.
    // Address will be worked out using the following formula:
    // - intCount * 100, after completing intCount will be increased by one
    if (isTVarSet) {
        xmlSetup += '<Tag type=\'Int\' hmiVisible=\'True\' hmiWriteable=\'True\' hmiAccessible=\'True\' retain=\'False\' remark=\'\' addr=\'%MW' + (intCount * 100) + '\'>T_VARIABLE</Tag>\n'
        intCount++;
    }

    // Close the Tagtable tag to match the TIA Portal syntax
    xmlSetup += '</Tagtable>';

    // Add 10: to the setup code (it is only added now as the whole sequence must be evaluated before adding it)
    setupCode.push('        #NEXT := 10;\n');

    // Generate code with errors by concatenating the setupCode array joined using line break, followed by 2 empty line breaks,
    // followed by the output of error generator joined using line breaks
    let codeWithErrors = setupCode.join('\n') + '\n\n' + generateErrors(logicCode, errorsComplexity, actuators).join('\n');

    // Generate final code by concatenating the setupCode array joined using line break, followed by 2 empty line breaks,
    // followed by logicCode array joined using line break, followed by 2 empty line breaks,
    //followed by componentsCode array joined using line break
    let finalCode = setupCode.join('\n') + '\n\n' + logicCode.join('\n') + '\n\n' + componentsCode.join('\n');

    // If configuration was provided, do not send XML setup code
    // the output will be:
    // - If no errors to be generated -> {code: FULL_CODE}
    // - If errors to be generated -> {code: FINAL_CORRECT_CODE, incorrect: CODE_WITH_ERRORS}
    if (configPresent) {
        return (errorsPresent ? {code: finalCode, incorrect: codeWithErrors} : {code: finalCode});
    } else {
        // If configuration was not provided, send XML setup code
        // the output will be:
        // - If no errors to be generated -> {code: FULL_CODE, tags: XML_SETUP_CODE}
        // - If errors to be generated -> {code: FINAL_CORRECT_CODE, incorrect: CODE_WITH_ERRORS, tags: XML_SETUP_CODE}
        return (errorsPresent ? {code: finalCode, incorrect: codeWithErrors, tags: xmlSetup} : {
            code: finalCode,
            tags: xmlSetup
        });
    }
}

module.exports = app
