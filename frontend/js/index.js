function generate() {
    document.getElementById('code').innerHTML = 'Generating...';
    const checkbox = (document.getElementById('withSensors').checked ? '1' : '0');
    fetch('http://localhost:3000/generateSequence/' + document.getElementById('sequence').value + '/' + checkbox)
        .then(o => o.text())
        .then(response => {
            document.getElementById('code').innerHTML = '\n' + response;
        });
}
