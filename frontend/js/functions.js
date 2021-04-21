const backend = 'http://localhost:3000';
const commBackend = 'http://localhost:3005';

let params = window.location.search.substr(1);
const projectDetails = {id: '', sequence: ''};
if (params.length > 1) {
    params = params.split('&');
    for (const element of params) {
        const param = element.split('=');
        if (param[0] === 'pid') {
            projectDetails.id = param[1];
        }
        if (param[0] === 'sequence') {
            projectDetails.sequence = param[1];
        }
    }
}

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

const getPLCs = () => {
    fetch(commBackend + '/plc/get')
        .then(r => r.json())
        .then(response => {
            if (response.status === 'OK') {
                let availablePLCs = '<option value="">Please choose PLC</option>';
                let unavailablePLCs = '<option value="">Please choose PLC</option>';

                for(const plc of response.msg) {
                    if(plc.state) {
                        availablePLCs += '<option value="' + plc.ip +'">' + plc.name + ' (' + plc.ip + ')</option>';
                    } else {
                        unavailablePLCs += '<option value="' + plc.ip +'">' + plc.name + ' (' + plc.ip + ', currently used by ' + plc.currentUser +')</option>';
                    }
                }

                document.getElementById('available').innerHTML = availablePLCs;
                document.getElementById('unavailable').innerHTML = unavailablePLCs;
            } else {
                document.querySelector('#sequenceError').innerHTML = 'An internal error occurred! Please try again later!';
            }
        });
}

const executeSequence = () => {
    const sequence = document.getElementById('sequence').value;
    const plc = document.getElementById('available').value;
    document.querySelector('#plcError').innerHTML = '';

    if(!sequence) {
        document.querySelector('#sequenceError').innerHTML = 'Please provide the sequence!';
        return;
    }

    if(!plc) {
        document.querySelector('#sequenceError').innerHTML = 'Please choose the PLC!';
        return;
    }

    fetch(commBackend + '/sequence/' + sequence + '/' + plc + '/' + getCookie('username'))
        .then(r => r.json())
        .then(response => {
            if(response.status === 'OK') {
                document.querySelector('#sequenceError').classList.remove('error');
                document.querySelector('#sequenceError').innerHTML = 'Executing sequence on ' + plc;
            } else {
                if(response.msg.length > 0) {
                    document.querySelector('#sequenceError').classList.add('error');
                    let errors = '';
                    for(const error of response.msg) {
                        errors += '- ' + error + '<br>';
                    }
                    document.querySelector('#sequenceError').innerHTML = 'Please correct the following errors in the sequence:<br>' + errors;
                }
            }
            getPLCs();
        });
}

const stopPLC = () => {
    const plc = document.getElementById('unavailable').value;
    document.querySelector('#sequenceError').innerHTML = '';

    if(!plc) {
        document.querySelector('#plcError').innerHTML = 'Please choose the PLC!';
        return;
    }

    fetch(commBackend + '/stop/' + plc)
        .then(r => r.json())
        .then(response => {
            if(response.status === 'OK') {
                document.querySelector('#plcError').classList.remove('error');
                document.querySelector('#plcError').innerHTML = 'PLC stop signal sent to ' + plc;
            } else {
                document.querySelector('#plcError').classList.add('error');
                document.querySelector('#plcError').innerHTML = 'An error occurred while trying to stop ' + plc;
            }
            getPLCs();
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
    const authenticatedRoutes = ['generator', 'validator', 'instructions', 'create-project', 'manage-projects', 'manage-project-components', 'profile', 'execute-sequence'];

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
                            element += '<div class="cell"><a class="bgdrop" href="manage-project-components.html?pid=' + project._id + '">Manage</a> <a class="bgdrop" href="generator.html?pid=' + project._id + '&sequence=' + project.project_sequence +'">Generate</a> <a class="bgdrop" href="execute-sequence.html?sequence=' + project.project_sequence +'">Simulate</a></div>';
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
        } else if (route === 'generator') {
            if(projectDetails.id && projectDetails.sequence) {
                document.getElementById('sequence').style.display = 'none';
            }
        } else if (route === 'execute-sequence') {
            let params = window.location.search.substr(1);
            if (params.length > 1) {
                params = params.split('&');
                for (const element of params) {
                    const param = element.split('=');
                    if (param[0] === 'sequence') {
                        document.getElementById('sequence').value = param[1];
                    }
                }
            }
            getPLCs();
            setInterval(() => {
                getPLCs();
            }, 10000);
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
        document.querySelector('#executeLink').classList.remove('hidden');
    } else {
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
    const errors = document.getElementById('withFaults').value;

    if(!projectDetails.id || !projectDetails.sequence) {
        projectDetails.sequence = document.getElementById('sequence').value;
    }


    if (document.getElementById('sequence').value === '' && (!projectDetails.id || !projectDetails.sequence)) {
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to generate!';
        return;
    }

    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';
    document.getElementById('xmlTags').innerText = 'Generating...';

    fetch(backend + '/sequence/generate2/' + projectDetails.sequence + '/' + errors + (projectDetails.id ? '/' + projectDetails.id : ''))
        .then(o => o.json())
        .then(response => {
            if(response.status === 'OK') {
                let correct, incorrect;
                console.log(response);
                if (screen.width < 768) {
                    correct = response.msg.code.toString().replaceAll('    ', ' ');
                    if (errors !== '0,none') {
                        incorrect = response.msg.incorrect.toString().replaceAll('    ', ' ');
                    }
                } else {
                    correct = response.msg.code.toString();
                    if (errors !== '0,none') {
                        incorrect = response.msg.incorrect.toString();
                    }
                }
                document.getElementById('solutionButton').innerText = 'Show solution';
                document.getElementById('correct_code').innerHTML = 'SOLUTION:\n\n' + correct;

                if (response.msg.tags) {
                    document.getElementById('xmlTags').style.display = 'inline-block';
                    document.getElementById('xmlTagsBtn').style.display = 'inline-block';
                    document.getElementById('xmlTags').innerText = response.msg.tags.toString();
                } else {
                    document.getElementById('xmlTags').style.display = 'none';
                    document.getElementById('xmlTagsBtn').style.display = 'none';
                }

                if (errors === '0,none') {
                    document.getElementById('correct_code').style.display = 'inline-block';
                    document.getElementById('correctCodeBtn').style.display = 'inline-block';
                    document.getElementById('incorrect_code').style.display = 'none';
                    document.getElementById('incorrectCodeBtn').style.display = 'none';
                    return false;
                }

                if (!(errors === '0,none')) {
                    document.getElementById('solutionButton').style.display = 'inline-block';
                    document.getElementById('incorrect_code').innerHTML = 'CODE WITH ERRORS:\n\n' + incorrect;
                    document.getElementById('correct_code').style.display = 'none';
                    document.getElementById('correctCodeBtn').style.display = 'none';
                    document.getElementById('incorrect_code').style.display = 'inline-block';
                    document.getElementById('incorrectCodeBtn').style.display = 'inline-block';
                }
            } else {
                alert(response.msg.status);
            }
        });
}

const showSolution = () => {
    if (document.getElementById('correct_code').style.display === 'block') {
        document.getElementById('correct_code').style.display = 'none';
        document.getElementById('correctCodeBtn').style.display = 'none';
        document.getElementById('solutionButton').innerText = 'Show solution'
    } else {
        document.getElementById('correct_code').style.display = 'block';
        document.getElementById('correctCodeBtn').style.display = 'block';
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
    fetch(backend + '/project/create/' + userId + '/' + projectName + '/' + sequence)
        .then(r => r.json())
        .then(response => {
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

let projectSettings = {};

const fetchProject = (pid) => {
    const container = document.querySelector('#myProjects');
    container.innerHTML = '';
    fetch(backend + '/project/get/' + pid)
        .then(r => r.json())
        .then(response => {
            if (response.status === 'OK') {
                let content = '';
                let contentAssigned = '';
                container.innerHTML = '<h6>' + response.msg.project_data.project_sequence.replaceAll(',', ', ') + '</h6><br>' +
                    '<a class="dropdown-item" href="#" data-toggle="modal" data-target="#sequenceModal" id="seqModal">How sequence got evaluated</a><hr>';
                container.innerHTML += '<label for="existingComponents">Assigned components</label><select id="existingComponents" class="form-control"></select>' +
                    '<button class="btn btn-lg btn-primary half-width" onClick="viewConfig(\'' + pid + '\')" data-toggle="modal" data-target="#componentModal">View configuration</button>' +
                    '<button class="btn btn-lg btn-primary half-width" onClick="deleteConfig(\'' + pid + '\')">Delete configuration</button><hr>' +
                    '<label for="components">Unassigned components</label><select id="components" class="form-control"></select>';

                const modalBody = document.querySelector('#sequenceModalBody');
                projectSettings = response.msg.components.elements;
                for (let i = 0; i < response.msg.components.elements.length; i++) {
                    const element = response.msg.components.elements[i];

                    let sequenceElement = '<div class="elementIdentifier">"' + element.name + '"</div><div class="elementDescription">Assigned with the following types and identifiers: <i>'
                    const keys = ['actuator', 'timer', 'counter', 'pressure'];

                    for (const key of keys) {
                        if (element[key]) {
                            sequenceElement += key + ' (' + element[key] + '), ';
                        }
                    }

                    sequenceElement = sequenceElement.substr(0, sequenceElement.length - 2) + '</i>';

                    modalBody.innerHTML += sequenceElement + '</div><br>';
                }

                for (const element of response.msg.unassignedComponents) {
                    content += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                for (const element of response.msg.assignedComponents) {
                    contentAssigned += '<option value="' + element.type + '_' + element.label + '">' + element.label + ' (' + element.type + ')</option>';
                }

                document.querySelector('#existingComponents').innerHTML = contentAssigned;
                document.querySelector('#components').innerHTML = content;
                container.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="addConfig(\'' + pid + '\')">Add component configuration</button>';
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
        displayTimerOptions(selected[1] + '_' + selected[2], pid);
    } else if (selected[0] === 'counter') {
        displayCounterOptions(selected[1] + '_' + selected[2], pid);
    } else if (selected[0] === 'pressure') {
        options.innerHTML = 'Here will be fields for pressure sensor';
    }
}

const deleteConfig = (pid) => {
    const component = document.querySelector('#existingComponents').value;
    fetch(backend + '/project/config/delete', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({pid: pid, component: component})
    }).then(res => res.json())
        .then(res => {
            if (res.status === 'OK') {
                location.reload();
            } else {
                document.querySelector('#componentError').innerHTML = res.msg;
            }
        });
}

const viewConfig = (pid) => {
    const component = document.querySelector('#existingComponents').value;

    fetch(backend + '/project/config/get', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({pid: pid, component: component})
    }).then(res => res.json())
        .then(res => {
            if (res.status === 'OK') {
                const modalBody = document.querySelector('#componentModalBody');
                modalBody.classList.remove('error');
                let response = '';
                const data = res.msg[0];
                const type = res.msg[0].label.split('_')[0];
                if (type === 'Timer') {
                    response += '<b>Type:</b> Timer<br>';
                    response += '<b>Power tag:</b> ' + data.powerTag + '<br>';
                    response += '<b>Timer completed tag:</b> ' + data.completedTag + '<br>';
                    response += '<b>Elapsed time tag:</b> ' + data.elapsedTimeTag + '<br>';
                } else if (type === 'Counter') {
                    response += '<b>Type:</b> Counter<br>';
                    response += '<b>Counter variable:</b> ' + data.counterVar + '<br>';
                } else {
                    if (data.type === 'singleActingSingleTag') {
                        response += '<b>Type:</b> Single acting cylinder controlled with one tag <br>';
                        response += '<b>Extension tag:</b> ' + data.extTag + '<br>';
                    } else if (data.type === 'singleActingDoubleTag') {
                        response += '<b>Type:</b> Single acting cylinder controlled with two tags';
                        response += '<b>Extension tag:</b> ' + data.extTag + '<br>';
                        response += '<b>Retraction tag:</b> ' + data.retTag + '<br>';

                    } else {
                        response += '<b>Type:</b> Double acting cylinder<br>';
                        response += '<b>Extension </b> ' + data.extTag + '<br>';
                        response += '<b>Retraction tag:</b> ' + data.retTag + '<br>';
                    }
                    response += '<b>Extended sensor:</b> ' + data.extSnsTag + '<br>';
                    response += '<b>Retracted sensor:</b> ' + data.retSnsTag + '<br>';
                }
                modalBody.innerHTML = response;
            } else {
                document.querySelector('#componentModalBody').innerHTML = res.msg;
                document.querySelector('#componentModalBody').classList.add('error');
            }
        });
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
        '<input type="text" id="tag2" class="form-control" placeholder="Tag name" required>' +
        '</div>';
    const sensors = '<label for="sensorTag1">Retracted sensor</label>' +
        '<input type="text" id="sensorTag1" class="form-control" placeholder="Tag name" required>' +
        '<label for="sensorTag2">Extended sensor</label>' +
        '<input type="text" id="sensorTag2" class="form-control" placeholder="Tag name" required>';

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
                if (e.target.value === 'no') {
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }
                    if (!document.querySelector('#retTag')) {
                        tagSettings.innerHTML += retractionTag;
                    }
                    currentSelectionType = 'singleActingDoubleTag';
                    btnContainer.innerHTML = sensors;
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
                } else if (e.target.value === 'yes') {
                    if (document.querySelector('#retTag')) {
                        document.querySelector('#retTag').remove();
                    }
                    if (!document.querySelector('#extTag')) {
                        tagSettings.innerHTML += extensionTag;
                    }
                    currentSelectionType = 'singleActingSingleTag';

                    btnContainer.innerHTML = sensors;
                    btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
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
            btnContainer.innerHTML += '<button class="btn btn-lg btn-primary btn-block" onClick="submitCylinderConfig(\'' + currentSelectionType + '\', \'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
        }
    });
}

const displayTimerOptions = (label, pid) => {
    const options = document.querySelector('#options');
    const btnContainer = document.querySelector('#btnContainer');
    options.innerHTML = '';
    const resetTag = '<div id="resetTagContainer">' +
        '<label for="resetTag">Power tag</label>' +
        '<input type="text" id="powerTag" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    const completedTag = '<div id="resetTagContainer">' +
        '<label for="completedTag">Timer completed tag</label>' +
        '<input type="text" id="completedTag" class="form-control" placeholder="Tag name" required>' +
        '</div>';
    const elapsedTimeTag = '<div id="resetTagContainer">' +
        '<label for="completedTag">Elapsed time tag</label>' +
        '<input type="text" id="elapsedTimeTag" class="form-control" placeholder="Tag name" required>' +
        '</div>';
    options.innerHTML += resetTag;
    options.innerHTML += completedTag;
    options.innerHTML += elapsedTimeTag;
    btnContainer.innerHTML = '<button class="btn btn-lg btn-primary btn-block" onClick="submitTimerConfig(\'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
}

const displayCounterOptions = (label, pid) => {
    const options = document.querySelector('#options');
    const btnContainer = document.querySelector('#btnContainer');
    options.innerHTML = '';
    const counterVar = '<div id="resetTagContainer">' +
        '<label for="resetTag">Counter variable</label>' +
        '<input type="text" id="counterVar" class="form-control" placeholder="Tag name" required autofocus>' +
        '</div>';
    options.innerHTML += counterVar;
    btnContainer.innerHTML = '<button class="btn btn-lg btn-primary btn-block" onClick="submitCounterConfig(\'' + label + '\', \'' + pid + '\')">Submit configuration</button>'
}

const submitCylinderConfig = (type, label, pid) => {
    const cylinderConfiguration = {};
    cylinderConfiguration.pid = pid;
    cylinderConfiguration.type = type;
    cylinderConfiguration.label = label;

    cylinderConfiguration.extensionTag = document.querySelector('#tag1').value;
    if (type !== 'singleActingSingleTag') {
        cylinderConfiguration.retractionTag = document.querySelector('#tag2').value;
    }
    cylinderConfiguration.extSensorTag = document.querySelector('#sensorTag2').value;
    cylinderConfiguration.retSensorTag = document.querySelector('#sensorTag1').value;


    const conditionSingle = cylinderConfiguration.pid && cylinderConfiguration.type === 'singleActingSingleTag' && cylinderConfiguration.label && cylinderConfiguration.extensionTag && cylinderConfiguration.extSensorTag && cylinderConfiguration.retSensorTag;
    const conditionDouble = (cylinderConfiguration.type === 'singleActingDoubleTag' || cylinderConfiguration.type === 'doubleActing') && (cylinderConfiguration.pid && cylinderConfiguration.label && cylinderConfiguration.extensionTag && cylinderConfiguration.retractionTag && cylinderConfiguration.extSensorTag && cylinderConfiguration.retSensorTag);
    if (conditionSingle || conditionDouble) {
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cylinderConfiguration)
        }).then(res => res.json())
            .then(res => {
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    } else {
        document.querySelector('#componentError').innerHTML = 'All fields are required!';
    }
}

const submitTimerConfig = (label, pid) => {
    const timerConfiguration = {};
    timerConfiguration.pid = pid;
    timerConfiguration.type = 'timer';
    timerConfiguration.label = label;
    timerConfiguration.powerTag = document.querySelector('#powerTag').value;
    timerConfiguration.completedTag = document.querySelector('#completedTag').value;
    timerConfiguration.elapsedTimeTag = document.querySelector('#elapsedTimeTag').value;

    if (timerConfiguration.pid && timerConfiguration.label && timerConfiguration.powerTag && timerConfiguration.completedTag && timerConfiguration.elapsedTimeTag) {
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(timerConfiguration)
        }).then(res => res.json())
            .then(res => {
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    }
}

const submitCounterConfig = (label, pid) => {
    const counterConfiguration = {};
    counterConfiguration.pid = pid;
    counterConfiguration.type = 'counter';
    counterConfiguration.label = label;
    counterConfiguration.counterVar = document.querySelector('#counterVar').value;

    if (counterConfiguration.pid && counterConfiguration.label && counterConfiguration.counterVar) {
        fetch(backend + '/project/config/add', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(counterConfiguration)
        }).then(res => res.json())
            .then(res => {
                if (res.status === 'OK') {
                    location.reload();
                } else {
                    document.querySelector('#componentError').innerHTML = res.msg;
                }
            });
    }
}

function copyText(id) {
    let range = document.createRange();
    range.selectNode(document.getElementById(id));
    window.getSelection().removeAllRanges(); // clear current selection
    window.getSelection().addRange(range); // to select text
    document.execCommand("copy");
    window.getSelection().removeAllRanges();// to deselect
}
