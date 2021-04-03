function generate() {
    const checkbox = (document.getElementById('withSensors').checked ? '1' : '0');
    const errors = document.getElementById('withFaults').value;
    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';
    fetch('http://localhost:3000/sequence/generate/' + document.getElementById('sequence').value + '/' + checkbox + '/' + errors)
        .then(o => o.json())
        .then(response => {
            document.getElementById('solutionButton').innerText = 'Show solution';
            document.getElementById('correct_code').innerHTML = '\nSOLUTION:\n\n' + response.correct.toString();
            document.getElementById('correct_code').style.float = 'left';
            
            if(typeof response.incorrect === 'undefined') {
                document.getElementById('correct_code').style.display = 'inline-block';
                document.getElementById('incorrect_code').style.display = 'none';
                return false;
            }

            if(!(errors === '0,none')) {
                document.getElementById('solutionButton').style.display = 'inline-block';
                document.getElementById('incorrect_code').innerHTML = '\n\nCODE WITH ERRORS:\n\n' + response.incorrect.toString();
                document.getElementById('correct_code').style.float = 'left';
                document.getElementById('incorrect_code').style.float = 'left';
                document.getElementById('correct_code').style.display = 'none';
                document.getElementById('incorrect_code').style.display = 'inline-block';

            } else {
                document.getElementById('correct_code').style.display = 'inline-block';
                document.getElementById('incorrect_code').style.display = 'none';
            }

        });
}

function validateSequence() {
    document.getElementById('code').innerHTML = 'Validating...';
    fetch('http://localhost:3000/sequence/isValid/' + document.getElementById('sequence').value)
        .then(o => o.text())
        .then(response => {
            document.getElementById('code').innerHTML = '\n' + response;
        });
}

function showSolution() {
    if( document.getElementById('correct_code').style.display === 'block') {
        document.getElementById('correct_code').style.display = 'none';
        document.getElementById('solutionButton').innerText = 'Show solution'
    } else {
        document.getElementById('correct_code').style.display = 'block';
        document.getElementById('solutionButton').innerText = 'Hide solution'
    }
}

function generate2() {
    const checkbox = (document.getElementById('withSensors').checked ? '1' : '0');
    const errors = document.getElementById('withFaults').value;
    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';
    fetch('http://localhost:3000/sequence/generate2/' + document.getElementById('sequence').value + '/1')
        .then(o => o.json())
        .then(response => {
            document.getElementById('solutionButton').innerText = 'Show solution';
            document.getElementById('correct_code').innerHTML = '\nSOLUTION:\n\n' + response.msg.toString();
            document.getElementById('correct_code').style.float = 'left';
            document.getElementById('correct_code').style.display = 'inline-block';
        });
}