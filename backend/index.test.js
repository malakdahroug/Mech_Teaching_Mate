const app = require('./index'); // Import main code
const supertest = require('supertest') // Import supertest module
const request = supertest(app) // Instantiate supertest with main code (test endpoints)

// Array containing correct sequences for testing
const validSequences = [
    'A+,A-,B+,B-',
    'C+,B+,TS,A+,B-,C-,A-',
    'A+,B+,(A-,B-),(C+,B+),C-',
    'A+,(B+,2S),A-,B-',
    '[A+,(B+,2S),A-,B-]',
    'A+,B+,[A-,B-,C+,B+,C-,A+]^2',
    'A+,B+,[A-,B-,C+,B+,C-,A+]^n+2',
    'A+,B+,[(A-,B-),C+,(B+,C-),A+]^20 ',
    '[A+,B+,C+,D+,[(A-,B-),A+,(A-,B+)]^3,D-,B-]',
    '[A+,B+,C+,D+,A-,B-,C-,D-,[(A+,C+),A-,(C-,B+),B-]^3,B+,D+,D-,B-]',
    'A+,B+,B-,A-',
    'A+,A-,B-,B+,B-',
    'A-,B-,C+,C-,3S,A+,A-',
    'A+,B-,(A-,B+),(C+,B-),C-',
    'A+,(B+,4.2bar),A-,B-',
    'A+,B-,1S,(A-,B+),(C+,B-),2S,C-',
    'A+,B-,[A-,B+,C+,B-,C-]^2',
    'A+,B-,[(A-,B+),C+,(B-,C-)]^20',
    'A+,B-,3S,[(A-,B+),C+,(B-,C-)]^24',
    'A+,B-,[(A-,B+),(C+,4.0bar),(B-,C-)]^2',
    '[A+,B-,3S]^2,2S,[(A-,B+),C+,(B-,C-)]^3',
    'A+,B+,C+,D+,[(A-,B-),A+,(A-,B+)]^3,D-,B-',
    '[A+,B+,C+,D+,[(A-,B-),A+,(A-,B+),A+]^3,D-,B-]',
    '[A+,B+,C+,D+,A-,B-,C-,D-,[(A+,C+),A-,(C-,B+)]^3,D-,B-]',
    'V+,(A-,B-),1S,[(A+,B+),1S,(A-,B-),1S]^n,[(V-,B+),1S,(V+,B-),1S]^n+1,V-',
    '(V+,4.3bar),(A-,B-),1S,[(A+,B+),1S,(A-,B-),1.5S]^n,[(V-,B+),1S,(V+,B-),1S]^n+1,V-',
    '[(V+,A+,B+),(A-,V-),2S,A+,[(B+,A-),TS,(V+,A+,B-),V-]^n,V+,1S,B+,[(A-,B-),TS,(A+,B+)]^n+1,(V-,A-,B-)]',
    '[(A+,B-),1S,(A-,B+),B-,[(A+,V-),TS,(A-,V+)]^n,V+,1S,A+,[(V-,A-),TS,(V+,A+)]^n+1,(V-,A-,B+)]',
    '[(A+,B+),2S,(A-,B-),[(V+,B+),TS,(V-,B-),V-]^n,A+,[(V+,B+),TS,(V-,B-)]^n+2,A-]',
    '[(A+,B-),1S,(A-,B+)]^2,B-,[(A+,V-),TS,(A-,V+)]^n,V+,1S,A+,[(V-,A-),TS,(V+,A+)]^n+1,(V-,A-,B+)'
];

// Array containing incorrect sequences for testing
const invalidSequences = [
'A+A-B+B-',
'A+B+,B-,A-',
'A+,A-,B-,B+-,B-',
'A-,B-,C+C-,3s,A+,A--',
'C+,B+,s,A+,B-,C-,A-',
'A+,B-,A-,B+),(C+,B-),C-',
'A+,(B+,4.2),A-,B-',
'A+(B+,S),A-,B-',
'A+,B-,1s,(A-,B+),(C+-,B-),2,C-',
'[A+,(B+,2SS),A-,B-]',
'A+,B-,[A-,B+,C+,B-,C-]^0.4',
'A+,B-,[(A-,B+),C+,(B-,C-)]20',
'A+,B-3s,[(A-,B+,C+,(B-,C-)]^24',
'A+,B-,[(A-,B+),(C+,bar),(B-,C-)]^2',
'[A+,B-,3s]^,2s,[(A-,B+),C+,(B-,C-)]^3',
'A+,B+,C+,D+,[(A-,B-),A,(A-,B+)]^3,D-,B-',
'[A+,B+,C+,D+,[(A-,B-),A+,(A-,B+]^3,D-,B-]',
'[A+,B+,C+,D+,A-,B-,C-,D-,[(A+,C+),A-,(C-,B+)^3,D-,B-]',
'V+,(A-,B-),1s,[(A+,BA+),1s,(A-B-),1s]^n,[(V-,B+),1s,(V+,B-),1s]^nn+1,V-',
'(V+,4.3bar),(A-,-),1s,[(A+,B+),1s,(A-B-),1.5s]^n,[(V-,B+),1s,(V+,B-),1s]^n+1,V-',
'[(V+,A+,B+),(A-,V-),2s,A+,[(B+A-),Ts,(V+,A+,B-),V-]^n,V+,1s,B+,[(A-B-),Ts,(A+B+)]^n+1+1,(V-A-B-)]',
'[(A+,B-),1s(A-,B++),B-,[(A+,V-),Ts,(A-,V+)]^n,V+,1s,A+,[(V-A-),Ts,(V+A+)]^n+1,(V-A-B+)]',
'[(A+,B+),2s,(A-,B-),[(V+B+),s,(V-,B-,V-]^n,A+-,[(V+,B+),Ts,(V-,B-)]^n+2,A-]',
'(A-,B-),1s,[(A+,B+),1s,(A-B-,1s]^n,V+,[(V-,B+),1s,(V+,B-),1s]^n+1,V-]^70',
'[(A+,B-),1s(A-,B+)]^2,B-,[(A+,V-),Ts,(A-,V+]^n,V+,1s,A+,[(V-A-),Ts,(V+A+)]^+1,(V-A-B+)'
];

// Test to test testing suite
it('GET /sequence/isValid/A+ - test endpoint', async done => {
    // Try to access endpoint
    const res = await request.get('/sequence/isValid/A+');
    done();
})

// Test to test testing suite
it('GET /sequence/isValid/A+ - A+ is a valid sequence', async done => {
    // Get the response for a simple sequence A+
    const response = await request.get('/sequence/isValid/A+');

    // Expect HTTP status to be 200
    expect(response.status).toBe(200);
    // Expect JSON response
    expect(response.type).toBe("application/json");
    // Expect response to be an array
    expect(Array.isArray(response.body)).toBeTruthy()
    // Expect an array of length 0
    expect(response.body.length).toBe(0);
    done();
});


// Iterate through array of valid sequences
// They should all return an empty array to be PASSED
for(const element of validSequences) {
    // Create test
    it('GET /sequence/isValid/' + element +' - ' + element +' is a valid sequence', async done => {
        // Get the response from backend
        const response = await request.get('/sequence/isValid/' + element);

        // Expect HTTP status to be 200
        expect(response.status).toBe(200);
        // Expect JSON response
        expect(response.type).toBe("application/json");
        // Expect response to be an array
        expect(Array.isArray(response.body)).toBeTruthy()
        // Expect an array of length 0
        expect(response.body.length).toBe(0);
        done();
    });
}


// Iterate through array of invalid sequences
// They should all return an array with elements to be PASSED
for(const element of invalidSequences) {
    // Create test
    it('GET /sequence/isValid/' + element +' - ' + element +' is NOT a valid sequence', async done => {
        // Get the response from backend
        const response = await request.get('/sequence/isValid/' + element);

        // Expect HTTP status to be 200
        expect(response.status).toBe(200);
        // Expect JSON response
        expect(response.type).toBe("application/json");
        // Expect response to be an array
        expect(Array.isArray(response.body)).toBeTruthy()
        // Expect an array of length other than 0
        expect(response.body.length).not.toBe(0);
        done();
    });
}


