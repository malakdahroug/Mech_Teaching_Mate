const signin = () => {
    const username = document.querySelector('#inputUsernameLogin').value;
    const password = document.querySelector('#inputPasswordLogin').value;

    const remember = document.querySelector('#inputRememberLogin').checked;

    const payload = {
      username: username,
      password: password
    };

    if(username === '' || password === '') {
        document.querySelector('#loginError').innerHTML = 'You must provide username and password!';
        return;
    }

    const data = new FormData();
    data.append("json", JSON.stringify(payload));

    fetch('http://localhost:3000/user/login', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json())
        .then(res => {
            if(res.status === 'Error') {
                document.querySelector('#loginError').classList.add('error');
                document.querySelector('#loginError').innerHTML = res.msg;
            } else {
                document.querySelector('#loginError').classList.remove('error');
                document.querySelector('#loginError').innerHTML = res.msg;
                if(remember) {
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

    if(name === '' || username === '' || password === '' || password2 === '' || email === '') {
        document.querySelector('#regError').innerHTML = 'All form fields are required!';
        return;
    } else if(password !== password2) {
        document.querySelector('#regError').innerHTML = 'Passwords do not match!';
        return;
    } else if(password.length < 5) {
        document.querySelector('#regError').innerHTML = 'Password must contain at least 5 characters!';
        return;
    } else if(!emailValidator.test(email)) {
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

    fetch('http://localhost:3000/user/register', {
        method: 'post',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    }).then(res => res.json())
        .then(res => {
            if(res.status === 'Error') {
                document.querySelector('#regError').classList.add('error');
                document.querySelector('#regError').innerHTML = res.msg;
            } else {
                document.querySelector('#regError').classList.remove('error');
                document.querySelector('#regError').innerHTML = res.msg + '<br>';
                document.querySelector('#regForm').reset();
            }
        });
};

const isAuthenticated = () => {
    return getCookie('uid') && getCookie('username');
}

const setup = (route) => {
    const authenticatedRoutes = ['generator', 'validator', 'instructions', 'create-project', 'manage-projects', 'manage-project-components'];

    if(authenticatedRoutes.indexOf(route) !== -1 && !isAuthenticated()) {
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

        if(route === 'manage-projects') {
            fetch('http://localhost:3000/project/get/user/' + getCookie('uid'))
                .then(r => r.json())
                .then(response => {
                    if(response.status === 'OK') {
                        const container = document.querySelector('#projects');
                        for(const project of response.msg.projects) {
                            let element = '<div class="project-row">';
                            element += '<div class="cell">' + project.project_name + '</div>';
                            element += '<div class="cell">' + project.project_sequence + '</div>';
                            element += '<div class="cell"><a href="manage-project-components.html?pid=' + project._id +'">Manage</a></div>';
                            element += '</div>';
                            container.innerHTML += element;
                        }
                    }
                })
        } else if(route === 'manage-project-components') {
            let params = window.location.search.substr(1);
            if(params.length > 1) {
                params = params.split('&');
                for(const element of params) {
                    const param = element.split('=');
                    if(param[0] === 'pid') {
                        if(param[1] !== '') {
                            document.querySelector('#mockContent').innerHTML = 'Fetch that project info';
                        } else {
                            document.querySelector('#mockContent').innerHTML = 'Project not found';
                        }
                    }
                }
            } else {
                document.querySelector('#mockContent').innerHTML = 'Fetch all projects';
            }
        }
    }
}

const displayNav = () => {
    if(isAuthenticated()) {
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
}

const setCookie = (name, value, expiry, units) => {
    const exp = new Date();
    if(units === 'd') {
        exp.setTime(exp.getTime() + (expiry*24*60*60*1000));
    } else {
        exp.setTime(exp.getTime() + (expiry*60*60*1000));
    }
    const lifespan = 'expires=' + exp.toUTCString();
    document.cookie = name + '=' + value + ';' + lifespan + ';path=/';
}

const getCookie = (name) => {
    const cookies = document.cookie.split('; ');
    for(const cookie of cookies) {
        const parts = cookie.split('=');
        if(parts[0] === name) {
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

    if(document.getElementById('sequence').value === '') {
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to generate!';
        return;
    }

    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';

    fetch('http://localhost:3000/sequence/generate/' + document.getElementById('sequence').value + '/' + checkbox + '/' + errors)
        .then(o => o.json())
        .then(response => {
            console.log(response);
            let correct, incorrect;
            if(screen.width < 768) {
                correct = response.correct.toString().replaceAll('    ', ' ');
                incorrect = response.incorrect.toString().replaceAll('    ', ' ');
            } else {
                correct = response.correct.toString();
                incorrect = response.incorrect.toString();
            }
            document.getElementById('solutionButton').innerText = 'Show solution';
            document.getElementById('correct_code').innerHTML = 'SOLUTION:\n\n' + correct;

            if(typeof response.incorrect === 'undefined') {
                document.getElementById('correct_code').style.display = 'inline-block';
                document.getElementById('incorrect_code').style.display = 'none';
                return false;
            }

            if(!(errors === '0,none')) {
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
    if( document.getElementById('correct_code').style.display === 'block') {
        document.getElementById('correct_code').style.display = 'none';
        document.getElementById('solutionButton').innerText = 'Show solution'
    } else {
        document.getElementById('correct_code').style.display = 'block';
        document.getElementById('solutionButton').innerText = 'Hide solution'
    }
}

function validateSequence() {
    if(document.getElementById('sequence').value === '') {
        document.getElementById('sequenceError').innerHTML = 'You need to provide sequence to validate!';
        return;
    }
    document.getElementById('code').innerHTML = 'Validating...';

    fetch('http://localhost:3000/sequence/isValid/' + document.getElementById('sequence').value)
        .then(o => o.json())
        .then(response => {
            console.log(response);
            if(response.length === 0) {
                document.getElementById('code').innerHTML = '\nThe sequence provided is valid!';
            } else {
                document.getElementById('code').innerHTML = '\nThe sequence provided is invalid!\nPlease look at the following parts of the sequence and fix them:';
                for(const element of response) {
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

    if(projectName === '' || sequence === '') {
        document.querySelector('#sequenceError').innerHTML = 'All fields are required!';
        return;
    }
    console.log('http://localhost:3000/project/create/' + userId + '/' + projectName + '/' + sequence);
    fetch('http://localhost:3000/project/create/' + userId + '/' + projectName + '/' + sequence)
        .then(r => r.json())
        .then(response => {
            console.log(response);
           if(response.status === 'OK') {
               document.querySelector('#sequenceError').classList.remove('error');
               document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
               document.querySelector('#sequenceError').innerHTML += 'You can configure your new project <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>'+ '<br>';
           } else {
               document.querySelector('#sequenceError').classList.add('error');
               document.querySelector('#sequenceError').innerHTML = response.msg.data + '<br><br>';
               if(response.msg.project_id) {
                   document.querySelector('#sequenceError').innerHTML += 'You can modify it <a href="manage-project-components.html?pid=' + response.msg.project_id + '">here</a>'+ '<br>';
               }
           }
        });
}
