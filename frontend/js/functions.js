const signin = () => {
    const username = document.querySelector('#inputUsernameLogin').value;
    const password = document.querySelector('#inputPasswordLogin').value;

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
                setCookie('uid', res.details, 3, 'h');
                setCookie('username', username, 3, 'h');
                displayNav();
            }
        });
};

const signup = () => {
    const name = document.querySelector('#inputNameReg').value;
    const username = document.querySelector('#inputUsernameReg').value;
    const email = document.querySelector('#inputEmailReg').value;
    const password = document.querySelector('#inputPasswordReg').value;
    const password2 = document.querySelector('#inputRepeatPasswordReg').value;

    if(name === '' || username === '' || password === '' || password2 === '' || email === '') {
        document.querySelector('#regError').innerHTML = 'All form fields are required!';
        return;
    } else if(password !== password2) {
        document.querySelector('#regError').innerHTML = 'Passwords do not match!';
        return;
    } else if(password.length < 5) {
        document.querySelector('#regError').innerHTML = 'Password must contain at least 5 characters!';
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
                document.querySelector('#regError').innerHTML = 'You can now <a data-toggle="modal" data-target="#signinModal">login</a>';

            }
        });
};

const isAuthenticated = () => {
    return getCookie('uid') && getCookie('username');
}

const setup = (route) => {
    const authenticatedRoutes = ['generator', 'validator'];

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
                document.getElementById('code').innerHTML = '\nThe sequence provided is invalid!\nPlease look at the following part of the sequence and fix them:';
                for(const element of response) {
                    document.getElementById('code').innerHTML += '\n- ' + element;
                }
            }
        });
}
