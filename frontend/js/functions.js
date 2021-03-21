const backend = 'http://localhost:3000';

const signin = () => {
    const username = document.querySelector('#inputUsernameLogin').value;
    const password = document.querySelector('#inputPasswordLogin').value;

    const remember = document.querySelector('#inputRememberLogin').checked;

    const payload = {
        username: username,
        password: password
    };

    if (username === '' || password === '') {
        document.querySelector('#loginError').innerHTML = 'You must provide username and password!';
        return;
    }

    const data = new FormData();
    data.append("json", JSON.stringify(payload));

    fetch(backend + '/user/login', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json())
        .then(res => {
            if (res.status === 'Error') {
                document.querySelector('#loginError').classList.add('error');
                document.querySelector('#loginError').innerHTML = res.msg;
            } else {
                document.querySelector('#loginError').classList.remove('error');
                document.querySelector('#loginError').innerHTML = res.msg;
                if (remember) {
                    setCookie('uid', res.details, 7, 'd');
                    setCookie('username', username, 7, 'd');
                } else {
                    setCookie('uid', res.details, 3, 'h');
                    setCookie('username', username, 3, 'h');
                }
                displayNav();
                $('#signinModal').modal('hide');
                document.querySelector('#signinForm').reset();
                document.querySelector('#loginError').innerHTML = '';
            }
        });
};

const signup = () => {
    const name = document.querySelector('#inputNameReg').value;
    const username = document.querySelector('#inputUsernameReg').value;
    const email = document.querySelector('#inputEmailReg').value;
    const password = document.querySelector('#inputPasswordReg').value;
    const password2 = document.querySelector('#inputRepeatPasswordReg').value;

    const emailValidator = /\S+@\S+\.\S+/;

    if (name === '' || username === '' || password === '' || password2 === '' || email === '') {
        document.querySelector('#regError').innerHTML = 'All form fields are required!';
        return;
    } else if (password !== password2) {
        document.querySelector('#regError').innerHTML = 'Passwords do not match!';
        return;
    } else if (password.length < 5) {
        document.querySelector('#regError').innerHTML = 'Password must contain at least 5 characters!';
        return;
    } else if (!emailValidator.test(email)) {
        document.querySelector('#regError').innerHTML = 'Please provide valid email address!';
        return;
    }

    const payload = {
        name: name,
        username: username,
        password: password,
        password2: password2,
        email: email
    };

    const data = new FormData();
    data.append("json", JSON.stringify(payload));

    fetch(backend + '/user/register', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json())
        .then(res => {
            if (res.status === 'Error') {
                document.querySelector('#regError').classList.add('error');
                document.querySelector('#regError').innerHTML = res.msg;
            } else {
                document.querySelector('#regError').classList.remove('error');
                document.querySelector('#regError').innerHTML = res.msg + '<br>';
                document.querySelector('#regForm').reset();
            }
        });
};

const getProfileData = () => {
    const uid = getCookie('uid');

    fetch(backend + '/user/get/profile/' + uid)
        .then(r => r.json())
        .then(response => {
            if (response.status === 'OK') {
                document.querySelector('#inputNameProfile').value = response.msg.name;
                document.querySelector('#inputUsernameProfile').value = response.msg.username;
                document.querySelector('#inputEmailProfile').value = response.msg.email;
            } else {
                document.querySelector('#profileError').innerHTML = 'An internal error occurred! Please try again later!';
            }
        });
}

const updateProfile = () => {
    const userID = getCookie('uid');

    const nameInput = document.querySelector('#inputNameProfile').value;
    const emailInput = document.querySelector('#inputEmailProfile').value;
    const passwordInput = document.querySelector('#inputPasswordProfile').value;
    const password2Input = document.querySelector('#inputRepeatPasswordProfile').value;

    const payload = {
        uid: userID,
        name: nameInput,
        email: emailInput
    };

    if (passwordInput !== '' && password2Input !== '') {
        if (passwordInput !== password2Input) {
            document.querySelector('#profileError').innerHTML = 'Passwords provided are not the same!';
            return
        }
        payload.password = passwordInput;
        payload.password2 = password2Input
    }

    const data = new FormData();
    data.append("json", JSON.stringify(payload));

    fetch(backend + '/user/update/profile', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json())
        .then(res => {
            if (res.status === 'Error') {
                document.querySelector('#profileError').classList.add('error');
                document.querySelector('#profileError').innerHTML = res.msg;
            } else {
                document.querySelector('#profileError').classList.remove('error');
                document.querySelector('#profileError').innerHTML = res.msg + '<br>';
                document.querySelector('#profileForm').reset();
                getProfileData();
            }
        });

}

const isAuthenticated = () => {
    return getCookie('uid') && getCookie('username');
}

const setup = (route) => {
    const authenticatedRoutes = ['generator', 'validator', 'instructions', 'create-project', 'manage-projects', 'manage-project-components', 'profile'];

    if (authenticatedRoutes.indexOf(route) !== -1 && !isAuthenticated()) {
        window.location = 'index.html';
    } else {
        fetch('./components/modals.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#modals').innerHTML = res;
            });
        fetch('./components/nav.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#nav').innerHTML = res;
                displayNav();
            });
        fetch('./components/footer.html')
            .then(res => res.text())
            .then(res => {
                document.querySelector('#footer').innerHTML = res;
            });

        if (route === 'manage-projects') {
            fetch(backend + '/project/get/user/' + getCookie('uid'))
                .then(r => r.json())
                .then(response => {
                    if (response.status === 'OK') {
                        const container = document.querySelector('#projects');
                        for (const project of response.msg.projects) {
                            let element = '<div class="project-row">';
                            element += '<div class="cell">' + project.project_name + '</div>';
                            element += '<div class="cell">' + project.project_sequence + '</div>';
                            element += '<div class="cell"><a href="manage-project-components.html?pid=' + project._id + '">Manage</a></div>';
                            element += '</div>';
                            container.innerHTML += element;
                        }
                    }
                })
        } else if (route === 'manage-project-components') {
            let params = window.location.search.substr(1);
            if (params.length > 1) {
                params = params.split('&');
                for (const element of params) {
                    const param = element.split('=');
                    if (param[0] === 'pid') {
                        if (param[1] !== '') {
                            fetchProject(param[1]);
                        } else {
                            document.querySelector('#myProjects').innerHTML = 'Project not found';
                        }
                    }
                }
            } else {
                fetch(backend + '/project/get/user/' + getCookie('uid'))
                    .then(r => r.json())
                    .then(response => {
                        if (response.status === 'OK') {
                            const container = document.querySelector('#project');
                            for (const project of response.msg.projects) {
                                container.innerHTML += '<option value="' + project._id + '">' + project.project_name + ' (' + project.project_sequence + ')</option>';
                            }
                        }
                    })
            }
        } else if (route === 'profile') {
            getProfileData();
        }
    }
}

const displayNav = () => {
    if (isAuthenticated()) {
        document.querySelector('#signinLink').classList.add('hidden');
        document.querySelector('#regLink').classList.add('hidden');
        document.querySelector('#profileLink').classList.remove('hidden');
        document.querySelector('#logoutLink').classList.remove('hidden');
        document.querySelector('#projectLinks').classList.remove('hidden');
        document.querySelector('#generatorLink').classList.remove('hidden');
        document.querySelector('#validatorLink').classList.remove('hidden');
        document.querySelector('#instructionsLink').classList.remove('hidden');
    } else {
        document.querySelector('#signinLink').classList.remove('hidden');
        document.querySelector('#regLink').classList.remove('hidden');
        document.querySelector('#profileLink').classList.add('hidden');
        document.querySelector('#logoutLink').classList.add('hidden');
        document.querySelector('#projectLinks').classList.add('hidden');
        document.querySelector('#generatorLink').classList.add('hidden');
        document.querySelector('#validatorLink').classList.add('hidden');
        document.querySelector('#instructionsLink').classList.add('hidden');
    }
}

const logout = () => {
    setCookie('uid', '', -1, 'h');
    setCookie('username', '', -1, 'h');
    displayNav();
    window.location = 'index.html';
}

const setCookie = (name, value, expiry, units) => {
    const exp = new Date();
    if (units === 'd') {
        exp.setTime(exp.getTime() + (expiry * 24 * 60 * 60 * 1000));
    } else {
        exp.setTime(exp.getTime() + (expiry * 60 * 60 * 1000));
    }
    const lifespan = 'expires=' + exp.toUTCString();
    document.cookie = name + '=' + value + ';' + lifespan + ';path=/';
}

const getCookie = (name) => {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
        const parts = cookie.split('=');
        if (parts[0] === name) {
            return parts[1];
        }
    }

    return false;
}

/*
    SEQUENCE GENERATION
 */

const generate = () => {
    const checkbox = (document.getElementById('withSensors').checked ? '1' : '0');
    const errors = document.getElementById('withFaults').value;

    if (document.getElementById('sequence').value === '') {
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to generate!';
        return;
    }

    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';

    fetch(backend + '/sequence/generate/' + document.getElementById('sequence').value + '/' + checkbox + '/' + errors)
        .then(o => o.json())
        .then(response => {
            console.log(response);
            let correct, incorrect;
            if (screen.width < 768) {
                correct = response.correct.toString().replaceAll('    ', ' ');
                incorrect = response.incorrect.toString().replaceAll('    ', ' ');
            } else {
                correct = response.correct.toString();
                incorrect = response.incorrect.toString();
            }
            document.getElementById('solutionButton').innerText = 'Show solution';
            document.getElementById('correct_code').innerHTML = 'SOLUTION:\n\n' + correct;

            if (typeof response.incorrect === 'undefined') {
                document.getElementById('correct_code').style.display = 'inline-block';
                document.getElementById('incorrect_code').style.display = 'none';
                return false;
            }

            if (!(errors === '0,none')) {
                document.getElementById('solutionButton').style.display = 'inline-block';
                document.getElementById('incorrect_code').innerHTML = 'CODE WITH ERRORS:\n\n' + incorrect;
                document.getElementById('correct_code').style.display = 'none';
                document.getElementById('incorrect_code').style.display = 'inline-block';

            } else {
                document.getElementById('correct_code').style.display = 'inline-block';
                document.getElementById('incorrect_code').style.display = 'none';
            }

        });
}

const showSolution = () => {
    if (document.getElementById('correct_code').style.display === 'block') {
        document.getElementById('correct_code').style.display = 'none';
        document.getElementById('solutionButton').innerText = 'Show solution'
    } else {
        document.getElementById('correct_code').style.display = 'block';
        document.getElementById('solutionButton').innerText = 'Hide solution'
    }
}

function validateSequence() {
    if (document.getElementById('sequence').value === '') {
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to validate!';
        return;
    }
    document.getElementById('code').innerHTML = 'Validating...';

    fetch(backend + '/sequence/isValid/' + document.getElementById('sequence').value)
        .then(o => o.json())
        .then(response => {
            console.log(response);
            if (response.length === 0) {
                document.getElementById('code').innerHTML = '\nThe sequence provided is valid!';
            } else {
                document.getElementById('code').innerHTML = '\nThe sequence provided is invalid!\nPlease look at the following parts of the sequence and fix them:';
                for (const element of response) {
                    document.getElementById('code').innerHTML += '\n- ' + element;
                }
            }
        });
}

/*
    PROJECTS
 */

const createProject = () => {
    const userId = getCookie('uid');
    const projectName = document.querySelector('#projectName').value;
    const sequence = document.querySelector('#sequence').value;

    if (projectName === '' || sequence === '') {
        document.querySelector('#sequenceError').innerHTML = 'All fields are required!';
        return;
    }
    console.log(backend + '/project/create/' + userId + '/' + projectName + '/' + sequence);
    fetch(backend + '/project/create/' + userId + '/' + projectName + '/' + sequence)
        .then(r => r.json())
        .then(response => {
            console.log(response);
            if (response.status === 'OK') {
                document.querySelector('#sequenceError').classList.remove('error');
                document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
                document.querySelector('#sequenceError').innerHTML += 'You can configure your new project <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>' + '<br>';
            } else {
                document.querySelector('#sequenceError').classList.add('error');
                document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
                if (response.msg.project_id) {
                    document.querySelector('#sequenceError').innerHTML += 'You can modify it <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>' + '<br>';
                }
            }
        });
}

const editProject = () => {
    const project = document.querySelector('#project').value;
    window.location = 'manage-project-components.html?pid=' + project;
}

const fetchProject = (pid) => {
    const container = document.querySelector('#myProjects');
    container.innerHTML = '';
    fetch(backend + '/project/get/' + pid)
        .then(r => r.json())
        .then(response => {
            let content = '';
            let contentAssigned = '';
            console.log(response);
            container.innerHTML = '<h6>' + response.msg.project_data.project_sequence.replaceAll(',', ', ') +'</h6><br>' +
                '<a class="dropdown-item" href="#" data-toggle="modal" data-target="#sequenceModal" id="seqModal">How sequence got evaluated</a><hr>';

            container.innerHTML += '<label for="existingComponents">Assigned components</label><select id="existingComponents" class="form-control"></select>' +
                '<button class="btn btn-lg btn-primary btn-block" onClick="modifyConfig(\'' + pid +'\')">Modify component configuration</button><hr>' +
                '<label for="components">Unassigned components</label><select id="components" class="form-control"></select>';

            const modalBody = document.querySelector('#sequenceModalBody');
            for(let i = 0; i < response.msg.components.elements.length; i++) {
                const element = response.msg.components.elements[i];

                let sequenceElement = '<div class="elementIdentifier">"' + element.name + '"</div><div class="elementDescription">Assigned with the following types and identifiers: <i>'
                const keys = ['actuator', 'timer', 'counter', 'pressure'];

                for(const key of keys) {
                    if(element[key]) {
                        sequenceElement += key + ' (' + element[key] +'), ';
                    }
                }

                sequenceElement = sequenceElement.substr(0, sequenceElement.length - 2) + '</i>';

                modalBody.innerHTML += sequenceElement+'</div><br>';
            }

            if (response.status === 'OK') {
                for (const element of response.msg.unassignedComponents) {
                    content += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                for (const element of response.msg.assignedComponents) {
                    contentAssigned += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                document.querySelector('#existingComponents').innerHTML = contentAssigned;
                document.querySelector('#components').innerHTML = content;
                container.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="addConfig(\'' + pid +'\')">Add component configuration</button>';
                container.innerHTML += '<div id="options"></div>';
                container.innerHTML += '<div id="detailedOptions"></div>';
                container.innerHTML += '<div id="tagSettings"></div>';
                container.innerHTML += '<div id="btnContainer"></div>';

            } else {
                container.innerHTML = '<b class="error">An error occurred while trying to fetch sequence components!</b>';
            }
        });
}

const addConfig = (pid) => {
    const selected = document.querySelector('#components').value.split('_');
    const options = document.querySelector('#options');

    if (selected[0] === 'actuator') {
        options.innerHTML = '';
        displayCylinderOptions(selected[1], pid);
    } else if (selected[0] === 'timer') {
        options.innerHTML = 'Here will be fields for timer';
    } else if (selected[0] === 'counter') {
        options.innerHTML = 'Here will be fields for counter';
    } else if (selected[0] === 'pressure') {
        options.innerHTML = 'Here will be fields for pressure sensor';
    }
}

const modifyConfig = (pid) => {
    const selected = document.querySelector('#existingComponents').value.split('_');

    console.log('Modifying...');

    if (selected[0] === 'actuator') {
        displayCylinderEditOptions(selected[1], pid);
    } else if (selected[0] === 'timer') {
        options.innerHTML = 'Here will be fields for timer';
    } else if (selected[0] === 'counter') {
        options.innerHTML = 'Here will be fields for counter';
    } else if (selected[0] === 'pressure') {
        options.innerHTML = 'Here will be fields for pressure sensor';
    }
}

const displayCylinderOptions = (label, pid) => {
    const options = document.querySelector('#options');
    const detailedOptions = document.querySelector('#detailedOptions');
    const tagSettings = document.querySelector('#tagSettings');
    const btnContainer = document.querySelector('#btnContainer');
    const cylinderType = '<label for="cylinderType">Actuator type</label>' +
        '<select id="cylinderType" class="form-control">' +
        '<option value="" disabled selected>Please select cylinder type</option>' +
        '<option value="single">Single acting cylinder</option>' +
        '<option value="double">Double acting cylinder</option>' +
        '</select>';
    const tagCount = '<div id="tagOptions">' +
        '<label for="tagCount">Is cylinder using a single tag to control extension and retraction?</label>' +
        '<select id="tagCount" class="form-control">' +
        '<option value="" disabled selected>Please select cylinder type</option>' +
        '<option value="yes">Yes</option>' +
        '<option value="no">No</option>' +
        '</select></div>';
    const extensionTag = '<div id="extTag">' +
        '<label for="tag1">Extension tag</label>' +
        '<input type="text" id="tag1" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    const retractionTag = '<div id="retTag">' +
        '<label for="tag2">Retraction tag</label>' +
        '<input type="text" id="tag2" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    const sensors = '<label for="sensorTag1">Retracted sensor</label>' +
        '<input type="text" id="sensorTag1" class="form-control" placeholder="Tag name" required autofocus>' +
        '<label for="sensorTag2">Extended sensor</label>' +
        '<input type="text" id="sensorTag2" class="form-control" placeholder="Tag name" required autofocus><div class="error" id="componentError"></div>';

    options.innerHTML += cylinderType;

    let currentSelectionType = '';

    document.querySelector('#cylinderType').addEventListener('change', (event) => {
        if (document.querySelector('#retTag')) {
            document.querySelector('#retTag').remove();
        }

        if (document.querySelector('#extTag')) {
            document.querySelector('#extTag').remove();
        }

        if (event.target.value === 'single') {
            if (!document.querySelector('#tagOptions')) {
                detailedOptions.innerHTML += tagCount;
            }
            document.querySelector('#tagCount').addEventListener('change', (e) => {
                console.log('change');
                if (e.target.value === 'no') {
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }
                    if (!document.querySelector('#retTag')) {
                        tagSettings.innerHTML += retractionTag;
                    }
                    currentSelectionType = 'singleActingDoubleTag';
                    btnContainer.innerHTML = sensors;
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType +'\', \'' + label +'\', \'' + pid +'\')">Submit configuration</button>'
                } else if(e.target.value === 'yes') {
                    if (document.querySelector('#retTag')) {
                        document.querySelector('#retTag').remove();
                    }
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }
                    currentSelectionType = 'singleActingSingleTag';

                    btnContainer.innerHTML = sensors;
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType +'\', \'' + label +'\', \'' + pid +'\')">Submit configuration</button>'
                }
            })
        } else {
            if (document.querySelector('#tagOptions')) {
                document.querySelector('#tagOptions').remove();
            }
            if (!document.querySelector('#extTag')) {
                tagSettings.innerHTML += extensionTag;
            }
            if (!document.querySelector('#retTag')) {
                tagSettings.innerHTML += retractionTag;
            }
            currentSelectionType = 'doubleActing';

            btnContainer.innerHTML = sensors;
            btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType +'\', \'' + label +'\', \'' + pid +'\')">Submit configuration</button>'
        }
    });
}

const submitCylinderConfig = (type, label, pid) => {
    const cylinderConfiguration = {};
    cylinderConfiguration.pid = pid;
    cylinderConfiguration.type = type;
    cylinderConfiguration.label = label;

    cylinderConfiguration.extensionTag = document.querySelector('#tag1').value;
    if(type !== 'singleActingSingleTag') {
        cylinderConfiguration.retractionTag = document.querySelector('#tag2').value;
    }
    cylinderConfiguration.extSensorTag = document.querySelector('#sensorTag2').value;
    cylinderConfiguration.retSensorTag = document.querySelector('#sensorTag1').value;

    if(cylinderConfiguration.pid && cylinderConfiguration.type && cylinderConfiguration.label && cylinderConfiguration.extensionTag && cylinderConfiguration.retractionTag && cylinderConfiguration.extSensorTag && cylinderConfiguration.retSensorTag) {
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cylinderConfiguration)
        }).then(res => res.json())
            .then(res => {
                if(res.status === 'OK') {
                    location.reload();
                } else {
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    } else {
        document.querySelector('#componentError').innerHTML = 'All fields are required!';
    }
}

const displayCylinderEditOptions = (label, pid) => {
    console.log(label, pid);
}
