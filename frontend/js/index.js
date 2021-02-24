function generate() {
    const checkbox = (document.getElementById('withSensors').checked ? '1' : '0');
    const errors = document.getElementById('withFaults').value;
    document.getElementById('correct_code').innerHTML = 'Generating...';
    document.getElementById('incorrect_code').innerHTML = 'Generating...';
    fetch('http://localhost:3000/sequence/generate/' + document.getElementById('sequence').value + '/' + checkbox + '/' + errors)
        .then(o => o.json())
        .then(response => {
            document.getElementById('solutionButton').style.display = 'block';
            document.getElementById('correct_code').innerHTML = '\n' + response.correct.toString();
            document.getElementById('incorrect_code').innerHTML = '\n' + response.incorrect.toString();

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
    document.getElementById('incorrect_code').style.display = 'block';
}
