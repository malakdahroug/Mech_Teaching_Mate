# Mechatronics Teaching Mate
This is a repository containing my final project code for the Mechatronics Teaching Buddy. The repository contains code for the 
backend of the application. It deals with Web/Application HTTP requests.

User is able to provide a sequence, and it will generate corresponding SCL code.

## Instructions
To run the code on your device you have to have the following tools installed:
- Node.js
- Git CLI

If all the dependencies are installed run the following in the terminal / command line:  
`git clone malakdahroug/Mech_Teaching_Mate`  
`cd repository_location`  
`npm install`  
`node index.js`

Navigate to http://localhost:3000/generateSequence/A+,A-,B+,B- to test the application. You are more than welcome to try
different sequences, but currently (as of version 1.0.0) the program is only capable of mocking up code for generating
serial sequences. 

E.g. A+, B+, C+, D+, D-, B-, C-, A- will be a correct sequence to generate.

You can test validating sequence by providing incorrect sequence e.g. A3, B+, A-, B-.

Sequence steps have to be satisfying the following regular expression to be correct `/[A-Z](\+|\-)/`

Examples of URLs to test sequence validation:  
- http://localhost:3000/generateSequence/A+,A-,B+,B- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A-,A+,B+,C+,D+,D-,B-,C-,A- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A-,A+,B+,Ca,D+,D-,B-,C-,A- (invalid)
- http://localhost:3000/generateSequence/A3,B+,A-,B- (invalid)


## Changelog
### Version 1.0.0
- Added Stack and Queue classes to store sequence to process. FIFO model seems to be more suitable as the sequence has
to be processed left to right.
- Added initial generateSequence route that takes the given sequence as a URL GET parameter, converts it to uppercase
and splits it using commas.
- Added PROOF OF CONCEPT generateCode function that takes an array of operations and generates the mockup of the future
code. It is capable of validating a serial sequence of cylinder actions (retractions and extensions).
