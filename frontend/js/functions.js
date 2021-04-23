// Link to the backend
const backend = 'https://mtm.dahroug.tech/backend';

// Link to the commstack
const commBackend = 'https://mtm.dahroug.tech/comm';

// Extracting URL parameters (used on the generator page)
let params = window.location.search.substr(1);
// Preparing object that will be storing project ID and sequence
const projectDetails = {id: '', sequence: ''};
// If there are parameters prvided
if (params.length > 1) {
    // Split them using &
    params = params.split('&');
    // Iterate through an array of parameters
    for (const element of params) {
        // Split it using = separator
        const param = element.split('=');
        // If the key is pid, assign the value to id property of the projectDetails object
        if (param[0] === 'pid') {
            projectDetails.id = param[1];
        }

        // If the key is sequence, assign the value to sequence property of the projectDetails object
        if (param[0] === 'sequence') {
            projectDetails.sequence = param[1];
        }
    }
}

/**
 * Function that is responsible for user sign ins
 */
const signin = () => {
    // Extract data from the login form fields
    const username = document.querySelector('#inputUsernameLogin').value;
    const password = document.querySelector('#inputPasswordLogin').value;
    const remember = document.querySelector('#inputRememberLogin').checked;

    // Define a message that will be sent to the server
    const payload = {
        username: username,
        password: password
    };

    // If password or username is blank, set an error in the loginError element and return
    if (username === '' || password === '') {
        document.querySelector('#loginError').innerHTML = 'You must provide username and password!';
        return;
    }

    // Prepare form for submission
    const data = new FormData();
    // Convert the data to JSON string, and append it to data
    data.append("json", JSON.stringify(payload));

    // Create backend call to POST /user/login route, send extracted form data in the request
    fetch(backend + '/user/login', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json()) // Convert response to JSON format
        .then(res => {
            // If status of the response is an error, display it in the loginError element
            if (res.status === 'Error') {
                // Add error CSS class to the loginError element
                document.querySelector('#loginError').classList.add('error');
                // Set loginError element to the content of the message received
                document.querySelector('#loginError').innerHTML = res.msg;
            } else {
                // If the status was not error

                // Remove error class from the loginError field
                document.querySelector('#loginError').classList.remove('error');
                // Display the content of the message in the form
                document.querySelector('#loginError').innerHTML = res.msg;

                // If remember was set, set length of the user session to 7 days by setting corresponding cookies
                if (remember) {
                    // Set UID and username cookie based on the details received with 7 day expiry time
                    setCookie('uid', res.details, 7, 'd');
                    setCookie('username', username, 7, 'd');
                } else {
                    // Set UID and username cookie based on the details received with 3 hour expiry
                    setCookie('uid', res.details, 3, 'h');
                    setCookie('username', username, 3, 'h');
                }
                // Display site navigation
                displayNav();
                // Hide the login modal
                $('#signinModal').modal('hide');

                // Reset the form to its initial state
                document.querySelector('#signinForm').reset();
                document.querySelector('#loginError').innerHTML = '';
            }
        });
};

/**
 * Function that fulfills user registration
 */
const signup = () => {
    // Extract all the data from the form
    const name = document.querySelector('#inputNameReg').value;
    const username = document.querySelector('#inputUsernameReg').value;
    const email = document.querySelector('#inputEmailReg').value;
    const password = document.querySelector('#inputPasswordReg').value;
    const password2 = document.querySelector('#inputRepeatPasswordReg').value;

    // Define regular expression to validate email address
    const emailValidator = /\S+@\S+\.\S+/;

    // If any of the form fields is blank, display an error and return
    if (name === '' || username === '' || password === '' || password2 === '' || email === '') {
        document.querySelector('#regError').innerHTML = 'All form fields are required!';
        return;
    } else if (password !== password2) {
        // If passwords are not the same, display an error and return
        document.querySelector('#regError').innerHTML = 'Passwords do not match!';
        return;
    } else if (password.length < 5) {
        // If password is shorter than 5 characters, display an error and return
        document.querySelector('#regError').innerHTML = 'Password must contain at least 5 characters!';
        return;
    } else if (!emailValidator.test(email)) {
        // If email is not in the correct format, display an error and return
        document.querySelector('#regError').innerHTML = 'Please provide valid email address!';
        return;
    }

    // Prepare the message that will be sent with a request to the backend
    const payload = {
        name: name,
        username: username,
        password: password,
        password2: password2,
        email: email
    };

    // Prepare form for submission
    const data = new FormData();
    // Convert the data to JSON string, and append it to data
    data.append("json", JSON.stringify(payload));

    // Create backend call to POST /user/register route, send extracted form data in the request
    fetch(backend + '/user/register', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json()) // Convert response to JSON
        .then(res => {
            // If status of the response is error
            if (res.status === 'Error') {
                // Add error CSS class to regError element
                document.querySelector('#regError').classList.add('error');
                // Display error in the regError element
                document.querySelector('#regError').innerHTML = res.msg;
            } else {
                // Remove error CSS class to regError element
                document.querySelector('#regError').classList.remove('error');
                // Display registration confirmation in the regError element
                document.querySelector('#regError').innerHTML = res.msg + '<br>';
                // Reset the form
                document.querySelector('#regForm').reset();
            }
        });
};

/**
 * Function that retrieves the user details from the backend
 */
const getProfileData = () => {
    // Extract userID from the cookies
    const uid = getCookie('uid');

    // Send GET request to the GET /user/get/profile/:uid route in the backend
    fetch(backend + '/user/get/profile/' + uid)
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK, fill in the form on the Profile page with data retrieved
            if (response.status === 'OK') {
                document.querySelector('#inputNameProfile').value = response.msg.name;
                document.querySelector('#inputUsernameProfile').value = response.msg.username;
                document.querySelector('#inputEmailProfile').value = response.msg.email;
            } else {
                // Otherwise, display an error in the profileError element
                document.querySelector('#profileError').innerHTML = 'An internal error occurred! Please try again later!';
            }
        });
}

/**
 * Function that retrieves all available and unavailable PLCs in the Simulated PLC section
 */
const getPLCs = () => {
    // Send GET request to the GET /plc/get route in the comm stack
    fetch(commBackend + '/plc/get')
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK, extract PLCs and add them to the corresponding option fields
            if (response.status === 'OK') {
                // Prepare default option for available PLCs
                let availablePLCs = '<option value="">Please choose PLC</option>';
                // Prepare default option for unavailable PLCs
                let unavailablePLCs = '<option value="">Please choose PLC</option>';

                // Iterate through the list of PLCs
                for(const plc of response.msg) {
                    // If PLC state is TRUE it means the PLC is available
                    if(plc.state) {
                        // Prepare an option for the PLC - it will be in the name (IP) format
                        availablePLCs += '<option value="' + plc.ip +'">' + plc.name + ' (' + plc.ip + ')</option>';
                    } else {
                        // If PLC state is FALSE it means the PLC unavailable
                        // Prepare option for the PLC - it will be in the name (IP, currently used by user) format
                        unavailablePLCs += '<option value="' + plc.ip +'">' + plc.name + ' (' + plc.ip + ', currently used by ' + plc.currentUser +')</option>';
                    }
                }

                // Add all available and unavailable PLCs to the corresponding SELECT element
                document.getElementById('available').innerHTML = availablePLCs;
                document.getElementById('unavailable').innerHTML = unavailablePLCs;
            } else {
                // If status of the message is not OK, display an error
                document.querySelector('#sequenceError').innerHTML = 'An internal error occurred! Please try again later!';
            }
        });
}

/**
 * Function that is responsible for sending signal to the comm stack to execute the sequence
 */
const executeSequence = () => {
    // Extract the sequence from the sequence form field
    const sequence = document.getElementById('sequence').value;
    // Get the currently selected PLC from the list
    const plc = document.getElementById('available').value;

    // Reset error field
    document.querySelector('#plcError').innerHTML = '';

    // If the sequence field is empty, display an error and return
    if(!sequence) {
        document.querySelector('#sequenceError').innerHTML = 'Please provide the sequence!';
        return;
    }

    // If the PLC is not selected, display an error and return
    if(!plc) {
        document.querySelector('#sequenceError').innerHTML = 'Please choose the PLC!';
        return;
    }

    // Send GET request to the GET /sequence/:sequence/:plc/:user route in the comm stack
    fetch(commBackend + '/sequence/' + sequence + '/' + plc + '/' + getCookie('username'))
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK, display confirmation
            if(response.status === 'OK') {
                // Remove the error CSS class from the sequenceError element
                document.querySelector('#sequenceError').classList.remove('error');
                // Display confirmation in the sequenceError element
                document.querySelector('#sequenceError').innerHTML = 'Executing sequence on ' + plc;
            } else {
                // If response status is not OK

                // If the length of response msg property is greater than 0 (means there are sequence errors)
                if(response.msg.length > 0) {
                    // Add CSS class to sequenceError element
                    document.querySelector('#sequenceError').classList.add('error');
                    // Prepare the variable to store error
                    let errors = '';

                    // Iterate through the array sent in the response
                    for(const error of response.msg) {
                        // Add each of the errors to the errors variable
                        errors += '- ' + error + '<br>';
                    }

                    // Display message to the user informing about the errors
                    document.querySelector('#sequenceError').innerHTML = 'Please correct the following errors in the sequence:<br>' + errors;
                }
            }
            // Refresh the list of available PLCs
            getPLCs();
        });
}

/**
 * Function responsible for stopping execution of the selected PLC
 */
const stopPLC = () => {
    // Extract currently selected PLC in the unavailable SELECT field
    const plc = document.getElementById('unavailable').value;

    // Reset sequenceError element
    document.querySelector('#sequenceError').innerHTML = '';

    // If PLC was not selected, ask user to select the PLC
    if(!plc) {
        document.querySelector('#plcError').innerHTML = 'Please choose the PLC!';
        return;
    }

    // Send GET request to the GET /stop/:plc route in the comm stack
    fetch(commBackend + '/stop/' + plc)
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK, inform user PLC signal was sent
            if(response.status === 'OK') {
                // Remove error CSS class from the plcError element
                document.querySelector('#plcError').classList.remove('error');
                // Display feedback to the user
                document.querySelector('#plcError').innerHTML = 'PLC stop signal sent to ' + plc;
            } else {
                // If status is not OK

                // Add error CSS class to the plcError element
                document.querySelector('#plcError').classList.add('error');
                // Display an error
                document.querySelector('#plcError').innerHTML = 'An error occurred while trying to stop ' + plc;
            }
            // Refresh the list of PLCs
            getPLCs();
        });
}

/**
 * Function that is called when user attempts to update the user profile
 */
const updateProfile = () => {
    // Get cookie containing userID
    const userID = getCookie('uid');

    // Extract data from the form
    const nameInput = document.querySelector('#inputNameProfile').value;
    const emailInput = document.querySelector('#inputEmailProfile').value;
    const passwordInput = document.querySelector('#inputPasswordProfile').value;
    const password2Input = document.querySelector('#inputRepeatPasswordProfile').value;

    // Prepare the message that will be sent with the backend request
    const payload = {
        uid: userID,
        name: nameInput,
        email: emailInput
    };

    // If password fields are not empty
    if (passwordInput !== '' && password2Input !== '') {
        // If passwords are not the same, display an error and return
        if (passwordInput !== password2Input) {
            document.querySelector('#profileError').innerHTML = 'Passwords provided are not the same!';
            return
        }
        // If no errors occurred, set password and password2 properties of payload object to values extracted from the form
        payload.password = passwordInput;
        payload.password2 = password2Input
    }

    // Prepare the data structure to be sent with the request
    const data = new FormData();

    // Convert the payload to JSON string and append it to form data structure
    data.append("json", JSON.stringify(payload));

    // Send POST request to the POST /user/update/profile route in the backend
    fetch(backend + '/user/update/profile', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json()) // Convert the response to JSON
        .then(res => {
            // If response status is Error, display error message
            if (res.status === 'Error') {
                // Add error CSS class to the profileError element
                document.querySelector('#profileError').classList.add('error');
                // Display the error message in the profileError element
                document.querySelector('#profileError').innerHTML = res.msg;
            } else {
                // If status is not Error

                // Remove error CSS class from the profileError element
                document.querySelector('#profileError').classList.remove('error');
                // Display feedback to the user
                document.querySelector('#profileError').innerHTML = res.msg + '<br>';
                // Reset the form
                document.querySelector('#profileForm').reset();

                // Fetch updated data and put it in the form
                getProfileData();
            }
        });

}

/**
 * Function that returns true if both of user cookies are set (uid and username), otherwise it displays false
 * @returns {boolean} true if user cookies are set, otherwise false
 */
const isAuthenticated = () => {
    return getCookie('uid') && getCookie('username');
}

/**
 * Function responsible for setting up the right components to be loaded and fetching the right data depending on the route
 * @param route a string containing the route, it will be used to load the corresponding component
 */
const setup = (route) => {
    // List of routes that require user to be authenticated
    const authenticatedRoutes = ['generator', 'validator', 'instructions', 'create-project', 'manage-projects', 'manage-project-components', 'profile', 'execute-sequence'];

    // Checks if the route provided is within authenticated routes and user is not authenticated, if so the user will be
    // redirected to the home poage
    if (authenticatedRoutes.indexOf(route) !== -1 && !isAuthenticated()) {
        window.location = 'index.html';
    } else {
        // Load all modals (pop ups)
        fetch('./components/modals.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#modals').innerHTML = res;
            });
        // Load navigation and call displayNav function which controls which options should be included
        fetch('./components/nav.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#nav').innerHTML = res;
                displayNav();
            });
        // Load footer
        fetch('./components/footer.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#footer').innerHTML = res;
            });

        // Depending on the route provided, load different component
        if (route === 'manage-projects') {
            // If manage project route was selected, fetch user projects and display them in the table with their corresponding options
            fetch(backend + '/project/get/user/' + getCookie('uid'))
                .then(r => r.json()) // Convert the response to JSON
                .then(response => {
                    // If response status is OK
                    if (response.status === 'OK') {
                        // Get the container (#projects)
                        const container = document.querySelector('#projects');
                        // For each of the project in user projects
                        for (const project of response.msg.projects) {
                            // Prepare the row
                            let element = '<div class="project-row">';
                            // Add project name cell
                            element += '<div class="cell">' + project.project_name + '</div>';
                            // Add project sequence cell
                            element += '<div class="cell">' + project.project_sequence + '</div>';
                            // Add options cell
                            element += '<div class="cell"><a class="bgdrop" href="manage-project-components.html?pid=' + project._id + '">Manage</a> <a class="bgdrop" href="generator.html?pid=' + project._id + '&sequence=' + project.project_sequence +'">Generate</a> <a class="bgdrop" href="execute-sequence.html?sequence=' + project.project_sequence +'">Simulate</a></div>';
                            element += '</div>';
                            // Add row to the container
                            container.innerHTML += element;
                        }
                    }
                })
        } else if (route === 'manage-project-components') {
            // If manage project components route was selected

            // Attempt to extract URL parameters and see if PID is provided
            let params = window.location.search.substr(1);
            // If params length is greater than 1
            if (params.length > 1) {
                // Split it using ampersand symbol
                params = params.split('&');
                // For each of the parameters extracted from the URL
                for (const element of params) {
                    // Split the current parameter using equal symbol
                    const param = element.split('=');
                    // If the key is PID
                    if (param[0] === 'pid') {
                        // If value is not empty
                        if (param[1] !== '') {
                            // Fetch the project with the value extracted
                            fetchProject(param[1]);
                        } else {
                            // If parameter is empty, display an error
                            document.querySelector('#myProjects').innerHTML = 'Project not found';
                        }
                    }
                }
            } else {
                // If no parameters were provided, it means user accessed the route using a direct link or an option in the
                // nav bar, user will be asked to select the project to be configured

                // Send GET request to GET /project/get/user/:uid backend route
                fetch(backend + '/project/get/user/' + getCookie('uid'))
                    .then(r => r.json()) // Convert the response to JSON
                    .then(response => {
                        // If the response status is OK
                        if (response.status === 'OK') {
                            // Get the container ('#project)
                            const container = document.querySelector('#project');
                            // Display list of all user projects
                            for (const project of response.msg.projects) {
                                container.innerHTML += '<option value="' + project._id + '">' + project.project_name + ' (' + project.project_sequence + ')</option>';
                            }
                        }
                    })
            }
        } else if (route === 'profile') {
            // If profile route is selected it calls getProfileData function
            getProfileData();
        } else if (route === 'generator') {
            // If generator route was accessed and projectDetails object has both id and sequence properties setup,
            // hide the sequence field
            // This will be only in the situation where user accesses the generator from the Manage projects section
            if(projectDetails.id && projectDetails.sequence) {
                document.getElementById('sequence').style.display = 'none';
            }
        } else if (route === 'execute-sequence') {
            // If execute sequence route was accessed through the Manage projects section, it will prefill
            // the sequence form field in the Simulated PLC section

            // Extract URL parameters
            let params = window.location.search.substr(1);
            // If the length of parameters is greater than 1
            if (params.length > 1) {
                // Split the parameters using ampersand symbol as a separator
                params = params.split('&');
                // Iterate through the list of parameters
                for (const element of params) {
                    // Split the current parameter using equal symbol as a separator
                    const param = element.split('=');
                    // If the key is sequence
                    if (param[0] === 'sequence') {
                        // Set the sequence form field in the Simulated PLC section to the value of the parameter
                        document.getElementById('sequence').value = param[1];
                    }
                }
            }
            // Refresh the list of PLCs
            getPLCs();
            // Set function that will be refreshing the list of PLC every 60 seconds
            setInterval(() => {
                getPLCs();
            }, 60000);
        }
    }
}

/**
 * Function that controls what authenticated and non-authenticated users should see in the navigation
 */
const displayNav = () => {
    // If user is authenticated, hide the signin link and reglink, set all other links to visible
    if (isAuthenticated()) {
        document.querySelector('#signinLink').classList.add('hidden');
        document.querySelector('#regLink').classList.add('hidden');
        document.querySelector('#profileLink').classList.remove('hidden');
        document.querySelector('#logoutLink').classList.remove('hidden');
        document.querySelector('#projectLinks').classList.remove('hidden');
        document.querySelector('#generatorLink').classList.remove('hidden');
        document.querySelector('#validatorLink').classList.remove('hidden');
        document.querySelector('#instructionsLink').classList.remove('hidden');
        document.querySelector('#executeLink').classList.remove('hidden');
    } else {
        // If user is authenticated, show the signin link and reglink, set all other links to hidden
        document.querySelector('#signinLink').classList.remove('hidden');
        document.querySelector('#regLink').classList.remove('hidden');
        document.querySelector('#profileLink').classList.add('hidden');
        document.querySelector('#logoutLink').classList.add('hidden');
        document.querySelector('#projectLinks').classList.add('hidden');
        document.querySelector('#generatorLink').classList.add('hidden');
        document.querySelector('#validatorLink').classList.add('hidden');
        document.querySelector('#instructionsLink').classList.add('hidden');
        document.querySelector('#executeLink').classList.add('hidden');
    }
}

/**
 * Function that logs user out, it will destroy all the cookies, refresh the nav and redirect user to the home page
 */
const logout = () => {
    // Destroy UID cookie
    setCookie('uid', '', -1, 'h');
    // Destroy username cookie
    setCookie('username', '', -1, 'h');
    // Refresh navigation
    displayNav();
    // Redirect user to the homepage
    window.location = 'index.html';
}

/**
 * Function that eases the process of setting cookies
 *
 * @param name a string that cookie should be identified with
 * @param value a value that cookie should have
 * @param expiry integer number of hours of days from now (this controls cookie expiry date)
 * @param units a string either h or d, for h it will set a cookie's expiry date to 'expiry' hours, for d it will set the expiry date to 'expiry' days
 */
const setCookie = (name, value, expiry, units) => {
    // Get the current time
    const exp = new Date();
    // If units provided is days
    if (units === 'd') {
        // Set the date of exp to current time + expiry * days (in milliseconds)
        exp.setTime(exp.getTime() + (expiry * 24 * 60 * 60 * 1000));
    } else {
        // If any other unit is provided

        // Set the date of exp to current time + expiry * hours (in milliseconds)
        exp.setTime(exp.getTime() + (expiry * 60 * 60 * 1000));
    }
    // Create a string containing cookie expiry date
    const lifespan = 'expires=' + exp.toUTCString();
    // Set the new cookie based on parameters passed
    document.cookie = name + '=' + value + ';' + lifespan + ';path=/';
}

/**
 * Function that eases the process of cookie retrieval
 * ]
 * @param name string containing cookie name
 * @returns {string|boolean} either value of the cookie or false if cookie does not exist
 */
const getCookie = (name) => {
    // Get string of semicolon separated cookies and split it using semicolon separator
    const cookies = document.cookie.split('; ');

    // Iterate through the list of cookies
    for (const cookie of cookies) {
        // Split the cookie using equal sign separator
        const parts = cookie.split('=');
        // If the cookie name matches the name passed in the parameter return it
        if (parts[0] === name) {
            return parts[1];
        }
    }

    // If cookie was not found return false
    return false;
}


/**
 * Function that is called when Generate button is pressed on the Generator page
 * It processes the input, send a request to the backend and processes the output
 */
const generate = () => {
    // Extract type of errors from the select field
    const errors = document.getElementById('withFaults').value;

    // Check if and of the properties of the projectDetails object is not set, if so it will extract the sequence from the form field
    if(!projectDetails.id || !projectDetails.sequence) {
        projectDetails.sequence = document.getElementById('sequence').value;
    }

    // If sequence form field is empty and any of the properties of the projectDetails object is empty
    if (document.getElementById('sequence').value === '' && (!projectDetails.id || !projectDetails.sequence)) {
        // Display an error and return
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to generate!';
        return;
    }

    // Set all fields to generating while the backend request and response are processed
    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';
    document.getElementById('xmlTags').innerText = 'Generating...';

    // Send GET request to the GET /sequence/generate2/:sequence/:errors/:projectID? to the backend
    fetch(backend + '/sequence/generate2/' + projectDetails.sequence + '/' + errors + (projectDetails.id ? '/' + projectDetails.id : ''))
        .then(o => o.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK
            if(response.status === 'OK') {
                // Reset the sequenceError element
                document.getElementById('sequenceError').innerHTML = '';
                // Remove error CSS class from the sequenceError element
                document.getElementById('sequenceError').classList.remove('error');

                // Prepare variables to store correct and incorrect versions of the code retrieved from the backend response
                let correct, incorrect;
                // Checks if screen width is smaller than 768, if so it will reduce number of whitespace used in code indentation
                if (screen.width < 768) {
                    // Replace 4 spaces with a single space for all instructions in the correct code
                    correct = response.msg.code.toString().replaceAll('    ', ' ');
                    // If errors were set to be generated
                    if (errors !== '0,none') {
                        // Replace 4 spaces with a single space for all instructions in the incorrect code
                        incorrect = response.msg.incorrect.toString().replaceAll('    ', ' ');
                    }
                } else {
                    // If screen width is greater than or equal to 768
                    // Set correct variable to the code received in the response
                    correct = response.msg.code.toString();
                    // If errors were set to be generated
                    if (errors !== '0,none') {
                        // Set incorrect variable to the incorrect code received in the response
                        incorrect = response.msg.incorrect.toString();
                    }
                }
                // Show the solution button
                document.getElementById('solutionButton').innerText = 'Show solution'
                // Display the solution in the correct_code element
                document.getElementById('correct_code').innerHTML = 'SOLUTION:\n\n' + correct;

                // If XML list of tags was sent in the response
                if (response.msg.tags) {
                    // Display the xmlTags element
                    document.getElementById('xmlTags').style.display = 'inline-block';
                    // Display the xmlTags copy button
                    document.getElementById('xmlTagsBtn').style.display = 'inline-block';
                    // Set content of xmlTags element to the list of tags received in the response
                    document.getElementById('xmlTags').innerText = response.msg.tags.toString();
                } else {
                    // If no XML tags were sent, display xmlTags element and its copy button
                    document.getElementById('xmlTags').style.display = 'none'; // xmlTags container
                    document.getElementById('xmlTagsBtn').style.display = 'none'; // copy button for xmlTags
                }

                // If the code is generated with no errors
                if (errors === '0,none') {
                    // Display the correct_code container and its copy button, hide the incorrect_code container and its copy button, return to prevent further execution
                    document.getElementById('correct_code').style.display = 'inline-block'; // correct_code container
                    document.getElementById('correctCodeBtn').style.display = 'inline-block'; // copy button for correct code
                    document.getElementById('incorrect_code').style.display = 'none'; // incorrect_code container
                    document.getElementById('incorrectCodeBtn').style.display = 'none'; // copy button for incorrect code
                    return false;
                }

                // If the code was generated with errors
                if (!(errors === '0,none')) {
                    // Display solution button
                    document.getElementById('solutionButton').style.display = 'inline-block';
                    // Add the generated incorrect to incorrect_code container
                    document.getElementById('incorrect_code').innerHTML = 'CODE WITH ERRORS:\n\n' + incorrect;
                    // Hide the solution
                    document.getElementById('correct_code').style.display = 'none';
                    // Hide the solution copy button
                    document.getElementById('correctCodeBtn').style.display = 'none';
                    // Display incorrect_code container
                    document.getElementById('incorrect_code').style.display = 'inline-block';
                    // Display incorrect code copy button
                    document.getElementById('incorrectCodeBtn').style.display = 'inline-block';
                }
            } else {
                // If response status is not OK, it means sequence contains errors

                // Add error CSS class to sequenceError element
                document.getElementById('sequenceError').classList.add('error');
                // Prepare the string to store errors
                let errorString = '';
                // If the sequence is incorrect (rather than being correct, but having any cylinder starting in non-retracted position)
                if(!response.retraction) {
                    // Add initial text to errorString
                    errorString = 'The sequence contains errors, please fix them before generating the code:<br>';
                    // Iterate through the list of errors and add each of the errors in the new line to the errorString
                    for(const element of response.msg) {
                        errorString += element + '<br>';
                    }
                } else {
                    // If the sequence is correct, but it starts with a cylinder in non-retracted position

                    // Hide all solution containers (correct, incorrect, xmlTags)
                    document.getElementById('solutionButton').style.display = 'none'; // Solution button
                    document.getElementById('correct_code').style.display = 'none'; // Correct code container
                    document.getElementById('correctCodeBtn').style.display = 'none'; // Correct code copy code button
                    document.getElementById('incorrect_code').style.display = 'none'; // Incorrect code container
                    document.getElementById('incorrectCodeBtn').style.display = 'none'; // Incorrect code copy code button
                    document.getElementById('xmlTags').style.display = 'none'; // XML Tags container
                    document.getElementById('xmlTagsBtn').style.display = 'none'; // XML Tags copy button
                    // Set error string to the message received from the backend
                    errorString = response.msg;
                }

                // Display the error in sequenceError container
                document.getElementById('sequenceError').innerHTML = errorString;
            }
        });
}

/**
 * Function that toggles display of the correct code when the Show solution button is pressed
 */
const showSolution = () => {
    // If the element is currently displayed, hide it
    if (document.getElementById('correct_code').style.display === 'block') {
        document.getElementById('correct_code').style.display = 'none'; // Hide the correct code container
        document.getElementById('correctCodeBtn').style.display = 'none'; // Hide the correct code copy button
        document.getElementById('solutionButton').innerText = 'Show solution'; // Set button text to Show solution
    } else {
        document.getElementById('correct_code').style.display = 'block'; // Display the correct code container
        document.getElementById('correctCodeBtn').style.display = 'block'; // Display the correct code copy button
        document.getElementById('solutionButton').innerText = 'Hide solution'; // Set button text to Hide solution
    }
}

/**
 * Function that calls the validation route of the backend, it is used on the Validator page
 */
function validateSequence() {
    // Check if the sequence form field is empty
    if (document.getElementById('sequence').value === '') {
        // Display an error and return
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to validate!';
        return;
    }

    // Set the text of code container to Validating... while the backend request is created and fulfilled
    document.getElementById('code').innerHTML = 'Validating...';

    // Send GET request to GET /sequence/isValid/:sequence backend route
    fetch(backend + '/sequence/isValid/' + document.getElementById('sequence').value)
        .then(o => o.json()) // Convert the response to JSON
        .then(response => {
            // If the length of the response is 0 it means the sequence is correct
            if (response.length === 0) {
                // Display message saying that sequence provided is correct
                document.getElementById('code').innerHTML = '\nThe sequence provided is valid!';
            } else {
                // If the length of the response is not 0, it means it contains errors

                // Display an error message to the user
                document.getElementById('code').innerHTML = '\nThe sequence provided is invalid!\nPlease look at the following parts of the sequence and fix them:';

                // Iterate through the array received in the response and add each of the errors to the code container
                for (const element of response) {
                    document.getElementById('code').innerHTML += '\n- ' + element;
                }
            }
        });
}

/**
 * Function responsible for project creation
 */
const createProject = () => {
    // Get userID cookie
    const userId = getCookie('uid');

    // Extract data from the form
    const projectName = document.querySelector('#projectName').value;
    const sequence = document.querySelector('#sequence').value;

    // If projectName or sequence are empty, display an error and return
    if (projectName === '' || sequence === '') {
        // Display an error
        document.querySelector('#sequenceError').innerHTML = 'All fields are required!';
        return;
    }

    // Send GET request to GET /project/create/:userID/:projectName backend route
    fetch(backend + '/project/create/' + userId + '/' + projectName + '/' + sequence)
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If the response status is OK
            if (response.status === 'OK') {
                // Remove error CSS class from the sequenceError element
                document.querySelector('#sequenceError').classList.remove('error');
                // Add response to the sequenceError element
                document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
                // Display an option to go directly to the project
                document.querySelector('#sequenceError').innerHTML += 'You can configure your new project <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>' + '<br>';
            } else {
                // If there was an error

                // Add error CSS class to the sequenceError element
                document.querySelector('#sequenceError').classList.add('error');
                // Display error message to the user
                document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
                if (response.msg.project_id) {
                    document.querySelector('#sequenceError').innerHTML += 'You can modify it <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>' + '<br>';
                }
            }
        });
}

/**
 * Function that configures edit project route
 */
const editProject = () => {
    // Get the value of the project field
    const project = document.querySelector('#project').value;
    // Go to manage components route with the projectID defined
    window.location = 'manage-project-components.html?pid=' + project;
}

// An object storing settings of the project (it will be modified once the data is fetched)
let projectSettings = {};

/**
 * Function that fetches the project configuration based on the project ID provided
 * @param pid id of the project
 */
const fetchProject = (pid) => {
    // Prepare the container
    const container = document.querySelector('#myProjects');
    // Reset content of the container
    container.innerHTML = '';

    // Send GET request to GET /project/get/:pid route
    fetch(backend + '/project/get/' + pid)
        .then(r => r.json()) // Convert the response to JSON
        .then(response => {
            // If response status is OK
            if (response.status === 'OK') {
                // Prepare an empty variable to store the list of components without project configuration
                let content = '';

                // Prepare an empty variable to store the list of components with existing project configuration
                let contentAssigned = '';

                // Display the current sequence in the heading, add an option to open a modal with the sequence evaluation process
                container.innerHTML = '<h6>' + response.msg.project_data.project_sequence.replaceAll(',', ', ') + '</h6><br>' +
                    '<a class="dropdown-item" href="#" data-toggle="modal" data-target="#sequenceModal" id="seqModal">How sequence got evaluated</a><hr>';
                // Add the field to display components with configuration assigned, buttons to view and delete configuration and the field to display components without configuration assigned
                container.innerHTML += '<label for="existingComponents">Assigned components</label><select id="existingComponents" class="form-control"></select>' +
                    '<button class="btn btn-lg btn-primary half-width" onClick="viewConfig(\'' + pid + '\')" data-toggle="modal" data-target="#componentModal">View configuration</button>' +
                    '<button class="btn btn-lg btn-primary half-width" onClick="deleteConfig(\'' + pid + '\')">Delete configuration</button><hr>' +
                    '<label for="components">Unassigned components</label><select id="components" class="form-control"></select>';

                // Get the modal (pop up)
                const modalBody = document.querySelector('#sequenceModalBody');
                // Set projectSettings variable to the list of components retrieved in the response
                projectSettings = response.msg.components.elements;

                // Iterate through all components - it will fill the sequence evaluation modal with the evaluation info
                for (let i = 0; i < response.msg.components.elements.length; i++) {
                    // Assign the element from the current iteration of the loop to the element constant
                    const element = response.msg.components.elements[i];

                    // Prepare the entry for the current element
                    let sequenceElement = '<div class="elementIdentifier">"' + element.name + '"</div><div class="elementDescription">Assigned with the following types and identifiers: <i>';
                    // Define list of available keys (types)
                    const keys = ['actuator', 'timer', 'counter', 'pressure'];

                    // Iterate through the keys and see what type of component the current element has
                    for (const key of keys) {
                        // Check if the current element has an entry at the given property i.e., see if element['actuator'] = true, if so it means it is an acutator
                        if (element[key]) {
                            // Add the current element to the entry
                            sequenceElement += key + ' (' + element[key] + '), ';
                        }
                    }

                    // Remove the trailing space and comma
                    sequenceElement = sequenceElement.substr(0, sequenceElement.length - 2) + '</i>';

                    // Add the current element to the sequence evaluation modal
                    modalBody.innerHTML += sequenceElement + '</div><br>';
                }

                // Iterate through the list of unassigned components
                for (const element of response.msg.unassignedComponents) {
                    // Add the current component to the unassigned components field
                    content += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                // Iterate through the list of assigned components
                for (const element of response.msg.assignedComponents) {
                    // Add the current component to the assigned components field
                    contentAssigned += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                // Display all options for assigned components
                document.querySelector('#existingComponents').innerHTML = contentAssigned;
                // Display all options for unassigned components
                document.querySelector('#components').innerHTML = content;
                // Add the button to add component configuration to the container
                container.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="addConfig(\'' + pid + '\')">Add component configuration</button>';
                // Add an empty div to the container - this div will be displaying possible types for the component
                container.innerHTML += '<div id="options"></div>';
                // Add an empty div to the container - this div will be displaying detailed options for the component
                container.innerHTML += '<div id="detailedOptions"></div>';
                // Add an empty div to the container - this div will be displaying tag configuration options for the component
                container.innerHTML += '<div id="tagSettings"></div>';
                // Add an empty div to the container - this div will be displaying control buttons for the component configuration form
                container.innerHTML += '<div id="btnContainer"></div>';
            } else {
                // If an error occurred while fetching the data from the backend, display an error
                container.innerHTML = '<b class="error">An error occurred while trying to fetch sequence components!</b>';
            }
        });
}

/**
 * Function that controls which configuration function should be called depending on the component type
 *
 * @param pid ID of the project to configure component for
 */
const addConfig = (pid) => {
    // Extract a currently selected option in the unassigned component select field and split it using underscore separator
    const selected = document.querySelector('#components').value.split('_');
    // Get the options container
    const options = document.querySelector('#options');

    // If type of component is actuator
    if (selected[0] === 'actuator') {
        // Empty options container
        options.innerHTML = '';
        // Call displayCylinderOptions function which controls actuator configuration
        displayCylinderOptions(selected[1], pid);
    } else if (selected[0] === 'timer') {
        // If type of component is timer, call displayTimerOptions function which controls timer configuration
        displayTimerOptions(selected[1] + '_' + selected[2], pid);
    } else if (selected[0] === 'counter') {
        // If type of component is counter, call displayCounterOptions function which controls counter configuration
        displayCounterOptions(selected[1] + '_' + selected[2], pid);
    } else if (selected[0] === 'pressure') {
        // If type of component is pressure sensor
        options.innerHTML = 'Pressure sensors are not supported yet!';
    }
}

/**
 * Function responsible for deleting component configuration
 *
 * @param pid ProjectID of the current project
 */
const deleteConfig = (pid) => {
    // Extract the currently selected cylinder from the assigned components select field
    const component = document.querySelector('#existingComponents').value;

    // Send POST request to POST /project/config/delete backend route
    fetch(backend + '/project/config/delete', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({pid: pid, component: component}) // Prepare the JSON data containing project ID and currently selected component and convert it to JSON string
    }).then(res => res.json()) // Convert the response to JSON
        .then(res => {
            // If status of the response is OK, reload the page
            if (res.status === 'OK') {
                location.reload();
            } else {
                // If status is not OK, display an error
                document.querySelector('#componentError').innerHTML = res.msg;
            }
        });
}

/**
 * Function responsible for fetching and displaying component configuration in the dropdown
 * @param pid ProjectID of the current project
 */
const viewConfig = (pid) => {
    // Extract the currently selected cylinder from the assigned components select field
    const component = document.querySelector('#existingComponents').value;

    // Send POST request to POST /project/config/get backend route
    fetch(backend + '/project/config/get', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({pid: pid, component: component}) // Prepare the JSON data containing project ID and currently selected component and convert it to JSON string
    }).then(res => res.json()) // Convert the response to JSON
        .then(res => {
            // If status of the response is OK, reload the page
            if (res.status === 'OK') {
                // Get the modal responsible for displaying the component configuration
                const modalBody = document.querySelector('#componentModalBody');
                // Remove the error CSS class from the modalBody
                modalBody.classList.remove('error');

                // Prepare an empty variable to store component configuration
                let response = '';
                // Get the first element from the response array
                const data = res.msg[0];
                // Split the label using underscore separator to extract the component type
                const type = res.msg[0].label.split('_')[0];

                // If type is timer
                if (type === 'Timer') {
                    // Display configurations for the timer
                    response += '<b>Type:</b> Timer<br>';
                    response += '<b>Power tag:</b> ' + data.powerTag + '<br>';
                    response += '<b>Timer completed tag:</b> ' + data.completedTag + '<br>';
                    response += '<b>Elapsed time tag:</b> ' + data.elapsedTimeTag + '<br>';
                } else if (type === 'Counter') {
                    // Display configurations for the counter
                    response += '<b>Type:</b> Counter<br>';
                    response += '<b>Counter variable:</b> ' + data.counterVar + '<br>';
                } else {
                    // If the type of the current element is single acting cylinder controlled with a single tag, display only extension tag
                    if (data.type === 'singleActingSingleTag') {
                        response += '<b>Type:</b> Single acting cylinder controlled with one tag <br>';
                        response += '<b>Extension tag:</b> ' + data.extTag + '<br>';
                    } else if (data.type === 'singleActingDoubleTag') {
                        // If the type of the current element is single acting cylinder controlled with two tags, display both extension and retraction tags
                        response += '<b>Type:</b> Single acting cylinder controlled with two tags';
                        response += '<b>Extension tag:</b> ' + data.extTag + '<br>';
                        response += '<b>Retraction tag:</b> ' + data.retTag + '<br>';
                    } else {
                        // Otherwise it means it is a double acting cylinder, display both extension and retraction tags
                        response += '<b>Type:</b> Double acting cylinder<br>';
                        response += '<b>Extension </b> ' + data.extTag + '<br>';
                        response += '<b>Retraction tag:</b> ' + data.retTag + '<br>';
                    }
                    // Display the sensor tags
                    response += '<b>Extended sensor:</b> ' + data.extSnsTag + '<br>';
                    response += '<b>Retracted sensor:</b> ' + data.retSnsTag + '<br>';
                }
                // Add the response variable to the modalBody
                modalBody.innerHTML = response;
            } else {
                // If error occurred, display it and add error CSS class to the componentModalBody
                document.querySelector('#componentModalBody').innerHTML = res.msg;
                document.querySelector('#componentModalBody').classList.add('error');
            }
        });
}

/**
 * Function responsible for displaying configuration options for various types of cylinders
 *
 * @param label component label
 * @param pid ProjectID of the current project
 */
const displayCylinderOptions = (label, pid) => {
    // Get the options container
    const options = document.querySelector('#options');
    // Get the detailed options container
    const detailedOptions = document.querySelector('#detailedOptions');
    // Get the tag settings container
    const tagSettings = document.querySelector('#tagSettings');
    // Get the button container
    const btnContainer = document.querySelector('#btnContainer');

    // Prepare the select field to display all possible cylinder options
    const cylinderType = '<label for="cylinderType">Actuator type</label>' +
        '<select id="cylinderType" class="form-control">' +
        '<option value="" disabled selected>Please select cylinder type</option>' +
        '<option value="single">Single acting cylinder</option>' +
        '<option value="double">Double acting cylinder</option>' +
        '</select>';
    // Prepare the select field to display options controlling if cylinder is using one or two tags to control its actuations
    const tagCount = '<div id="tagOptions">' +
        '<label for="tagCount">Is cylinder using a single tag to control extension and retraction?</label>' +
        '<select id="tagCount" class="form-control">' +
        '<option value="" disabled selected>Please select cylinder type</option>' +
        '<option value="yes">Yes</option>' +
        '<option value="no">No</option>' +
        '</select></div>';
    // Prepare the field for extension tag (contained within extTag container)
    const extensionTag = '<div id="extTag">' +
        '<label for="tag1">Extension tag</label>' +
        '<input type="text" id="tag1" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    // Prepare the field for retraction tag (contained within retTag container)
    const retractionTag = '<div id="retTag">' +
        '<label for="tag2">Retraction tag</label>' +
        '<input type="text" id="tag2" class="form-control" placeholder="Tag name" required>' +
        '</div>';
    // Prepare the fields for cylinder sensor tags
    const sensors = '<label for="sensorTag1">Retracted sensor</label>' +
        '<input type="text" id="sensorTag1" class="form-control" placeholder="Tag name" required>' +
        '<label for="sensorTag2">Extended sensor</label>' +
        '<input type="text" id="sensorTag2" class="form-control" placeholder="Tag name" required>';

    // Add cylinder type select field to options
    options.innerHTML += cylinderType;

    // Reset the value of current selection type
    let currentSelectionType = '';

    // Add change event listener to cylinderType select field
    document.querySelector('#cylinderType').addEventListener('change', (event) => {
        // If retTag container exists, remove it
        if (document.querySelector('#retTag')) {
            document.querySelector('#retTag').remove();
        }

        // If extTag container exists, remove it
        if (document.querySelector('#extTag')) {
            document.querySelector('#extTag').remove();
        }

        // If option selected is single
        if (event.target.value === 'single') {
            // Display tag options (controls if one or two tags are used for cylinder actuations)
            if (!document.querySelector('#tagOptions')) {
                detailedOptions.innerHTML += tagCount;
            }

            // Add event listener to tagCount select that listens for the value change
            document.querySelector('#tagCount').addEventListener('change', (e) => {
                // If no was selected (two tags are used)
                if (e.target.value === 'no') {
                    // Display the extTag container (if it doesn't exist yet)
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }
                    // Display the retTag container (if it doesn't exist yet)
                    if (!document.querySelector('#retTag')) {
                        tagSettings.innerHTML += retractionTag;
                    }

                    // Set the current selection type to single acting cylinder controlled with two tags
                    currentSelectionType = 'singleActingDoubleTag';
                    // Display configuration options for sensor cylinders
                    btnContainer.innerHTML = sensors;
                    // Display the button to submit cylinder configuration
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
                } else if (e.target.value === 'yes') {
                    // If yes was selected (one tag is used)

                    // If retTag container exists, remove it
                    if (document.querySelector('#retTag')) {
                        document.querySelector('#retTag').remove();
                    }

                    // Display the extTag container (if it doesn't exist yet)
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }

                    // Set the current selection type to single acting cylinder controlled with one tag
                    currentSelectionType = 'singleActingSingleTag';

                    // Display configuration options for sensor cylinders
                    btnContainer.innerHTML = sensors;
                    // Display the button to submit cylinder configuration
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
                }
            })
        } else {
            // If the double acting cylinder was selected

            // Remove tag options container if it exists
            if (document.querySelector('#tagOptions')) {
                document.querySelector('#tagOptions').remove();
            }

            // Display the extTag container (if it doesn't exist yet)
            if (!document.querySelector('#extTag')) {
                tagSettings.innerHTML += extensionTag;
            }

            // Display the retTag container (if it doesn't exist yet)
            if (!document.querySelector('#retTag')) {
                tagSettings.innerHTML += retractionTag;
            }

            // Set the current selection type to double acting cylinder
            currentSelectionType = 'doubleActing';

            // Display configuration options for sensor cylinders
            btnContainer.innerHTML = sensors;
            // Display the button to submit cylinder configuration
            btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
        }
    });
}

/**
 * Function responsible for displaying configuration options for timers
 *
 * @param label component label
 * @param pid ProjectID of the current project
 */
const displayTimerOptions = (label, pid) => {
    // Getting the container to display tag configuration options
    const options = document.querySelector('#options');
    // Getting the container to display the buttons
    const btnContainer = document.querySelector('#btnContainer');

    // Resetting content of options container
    options.innerHTML = '';

    // Preparing the field for reset tag
    const resetTag = '<div id="resetTagContainer">' +
        '<label for="resetTag">Power tag</label>' +
        '<input type="text" id="powerTag" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    // Preparing the field for completed tag
    const completedTag = '<div id="resetTagContainer">' +
        '<label for="completedTag">Timer completed tag</label>' +
        '<input type="text" id="completedTag" class="form-control" placeholder="Tag name" required>' +
        '</div>';
    // Preparing the field for elapsed time tag
    const elapsedTimeTag = '<div id="resetTagContainer">' +
        '<label for="completedTag">Elapsed time tag</label>' +
        '<input type="text" id="elapsedTimeTag" class="form-control" placeholder="Tag name" required>' +
        '</div>';

    // Adding all fields to options container
    options.innerHTML += resetTag;
    options.innerHTML += completedTag;
    options.innerHTML += elapsedTimeTag;
    // Adding a button to submit the timer configuration
    btnContainer.innerHTML = '<button class="btn btn-lg btn-primary btn-block" onClick="submitTimerConfig(\'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
}

/**
 * Function responsible for displaying configuration options for counters
 *
 * @param label component label
 * @param pid ProjectID of the current project
 */
const displayCounterOptions = (label, pid) => {
    // Getting the container to display tag configuration options
    const options = document.querySelector('#options');
    // Getting the container to display the buttons
    const btnContainer = document.querySelector('#btnContainer');

    // Resetting content of options container
    options.innerHTML = '';

    // Preparing the field for counter variable tag
    const counterVar = '<div id="resetTagContainer">' +
        '<label for="resetTag">Counter variable</label>' +
        '<input type="text" id="counterVar" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';

    // Adding the field to options container
    options.innerHTML += counterVar;

    // Adding a button to submit the counter configuration
    btnContainer.innerHTML = '<button class="btn btn-lg btn-primary btn-block" onClick="submitCounterConfig(\'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
}

/**
 * Function responsible for submitting cylinder configuration to the backend
 *
 * @param type cylinder type
 * @param label cylinder label
 * @param pid ProjectID of the current project
 */
const submitCylinderConfig = (type, label, pid) => {
    // Prepare an object to store configuration of the cylinder, it will be send with a request to the backend
    const cylinderConfiguration = {};
    cylinderConfiguration.pid = pid; // Setting project ID
    cylinderConfiguration.type = type; // Setting cylinder type
    cylinderConfiguration.label = label; // Setting cylinder label

    // Extracting extension tag from the form
    cylinderConfiguration.extensionTag = document.querySelector('#tag1').value;

    // If cylinder type corresponds to the cylinder using retraction tag, extract it from the form
    if (type !== 'singleActingSingleTag') {
        cylinderConfiguration.retractionTag = document.querySelector('#tag2').value;
    }

    // Extract sensor tags from the form
    cylinderConfiguration.extSensorTag = document.querySelector('#sensorTag2').value;
    cylinderConfiguration.retSensorTag = document.querySelector('#sensorTag1').value;

    // Define which form fields are required for the corresponding cylinder types (depending on options selected by the user)
    const conditionSingle = cylinderConfiguration.pid && cylinderConfiguration.type === 'singleActingSingleTag' && cylinderConfiguration.label && cylinderConfiguration.extensionTag && cylinderConfiguration.extSensorTag && cylinderConfiguration.retSensorTag;
    const conditionDouble = (cylinderConfiguration.type === 'singleActingDoubleTag' || cylinderConfiguration.type === 'doubleActing') && (cylinderConfiguration.pid && cylinderConfiguration.label && cylinderConfiguration.extensionTag && cylinderConfiguration.retractionTag && cylinderConfiguration.extSensorTag && cylinderConfiguration.retSensorTag);

    // If any of the conditions is true, send the request to the backend
    if (conditionSingle || conditionDouble) {

        // Send POST request to the post /project/config/add backend route
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cylinderConfiguration) // Convert the data to JSON string
        }).then(res => res.json()) // Convert the response to JSON
            .then(res => {
                // If response status is OK, reload the page
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    // If the status is not okay, display an error
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    } else {
        // If conditions are not met, display an error informing user that all fields are required
        document.querySelector('#componentError').innerHTML = 'All fields are required!';
    }
}

/**
 * Function responsible for submitting timer configuration to the backend
 *
 * @param label timer label
 * @param pid ProjectID of the current project
 */
const submitTimerConfig = (label, pid) => {
    // Prepare an object to store configuration of the timer, it will be send with a request to the backend
    const timerConfiguration = {};
    timerConfiguration.pid = pid; // Setting project ID
    timerConfiguration.type = 'timer'; // Setting element type to timer
    timerConfiguration.label = label; // Setting element label
    timerConfiguration.powerTag = document.querySelector('#powerTag').value; // Extracting power tag from the form and setting the corresponding object property
    timerConfiguration.completedTag = document.querySelector('#completedTag').value; // Extracting completed tag from the form and setting the corresponding object property
    timerConfiguration.elapsedTimeTag = document.querySelector('#elapsedTimeTag').value; // Extracting elapsed time tag from the form and setting the corresponding object property

    // If all parameters are defined send a backend call to add the project config
    if (timerConfiguration.pid && timerConfiguration.label && timerConfiguration.powerTag && timerConfiguration.completedTag && timerConfiguration.elapsedTimeTag) {
        // Send POST request to POST /project/config/add backend route
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(timerConfiguration) // Convert the timer data to JSON string
        }).then(res => res.json()) // Convert the response to JSON
            .then(res => {
                // If response status is OK, reload the page
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    // If status is not OK, display an error
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    }
}

/**
 * Function responsible for submitting counter configuration to the backend
 *
 * @param label counter label
 * @param pid ProjectID of the current project
 */
const submitCounterConfig = (label, pid) => {
    // Prepare an object to store configuration of the counter, it will be send with a request to the backend
    const counterConfiguration = {};
    counterConfiguration.pid = pid; // Setting project ID
    counterConfiguration.type = 'counter'; // Setting element type to counter
    counterConfiguration.label = label; // Setting element label
    counterConfiguration.counterVar = document.querySelector('#counterVar').value; // Extracting counter variable tag from the form and setting the corresponding object property

    // If all properties are set, send a request to the backend
    if (counterConfiguration.pid && counterConfiguration.label && counterConfiguration.counterVar) {
        // Send POST request to POST /project/config/add backend route
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(counterConfiguration) // Convert the counter data to JSON string
        }).then(res => res.json()) // Convert the response to JSON
            .then(res => {
                // If the response status is OK, reload the page
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    // If the status is not OK, display an error
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    }
}

/**
 * Function that copies the content of the element provided to user's clipboard
 *
 * @param id HTML ID of an element
 */
function copyText(id) {
    // Prepare range to select
    let range = document.createRange();
    range.selectNode(document.getElementById(id)); // Select the content of the element with the given ID
    window.getSelection().removeAllRanges(); // Clear current selection
    window.getSelection().addRange(range); // Select the text from the previously defined range
    document.execCommand("copy"); // Copy the content of the range to clipboard
    window.getSelection().removeAllRanges();// Clear current selection
}
