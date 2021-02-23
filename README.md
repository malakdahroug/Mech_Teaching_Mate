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

#### Sequence generation
Navigate to http://localhost:3000/generateSequence/A+,A-,B+,B- to test the application. You are more than welcome to try
different sequences, but currently (as of version 1.0.0) the program is only capable of mocking up code for generating
serial sequences only. 

E.g. A+, B+, C+, D+, D-, B-, C-, A- will be a correct sequence to generate.

You can test validating sequence by providing incorrect sequence e.g. A3, B+, A-, B-.

Sequence steps have to be satisfying the following regular expression to be correct `/[A-Z](\+|\-)/`

Examples of URLs to test sequence validation:  
- http://localhost:3000/generateSequence/A+,A-,B+,B- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A-,A+,B+,C+,D+,D-,B-,C-,A- (valid)
- http://localhost:3000/generateSequence/A+,B+,C+,D+,D-,B-,C-,A-,A+,B+,Ca,D+,D-,B-,C-,A- (invalid)
- http://localhost:3000/generateSequence/A3,B+,A-,B- (invalid)

#### Sequence validation
Application is capable of validating various sequences (concurrent, serial, repeating, timed) as of version 1.0.2. Validation can be done
by calling the backend on the following URL: http://localhost:3000/sequence/isValid/SEQUENCE

SEQUENCE have to be substituted by the actual sequence to validate. Set of tests will be added to the validation function
in the next release.

#### Automated tests
To run automated tests on the code downloaded before 1.0.2b release additional packages are required. Please follow the steps
below to be able to execute automated tests.
`cd repository_location`  
`git pull origin master`  
`npm install`  
`npm run test`  

There are 51 tests in total (1 testing suite test, 1 endpoint test, 24 correct sequence tests and 25 incorrect sequence tests).

## Current release
##### Backend
Current version 1.0.2b  

##### Frontend
Current version 1.0.0

##### Communication stack
Not available yet.

## Roadmap
### Backend
- **Stage 1 - Simple sequences - CURRENT v. 1.0.2b**
    - Break the sequence down - *v. 1.0.0*
    - Implement simple code generation - *v. 1.0.1*
    - Detect type of sequence(simple, concurrent, repetitive or timed) - **v. 1.0.1**
    - Validate the sequence using regular expressions<sup>1</sup> - **CURRENT v. 1.0.2b**
- **Stage 2 - User sessions & projects**
    - Implement registration & login system that will be using database to store user data e.g. user projects
    - Create routes and backend procedures for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Add user ability to create project
    - Add user ability to configure project (e.g. define tag names or types of cylinders)
- **Stage 3 - Concurrent sequences**
    - Correctly detect sequence type
    - Generate basic concurrent sequences i.e. 2 actuations at once
    - Generate more complicated concurrent sequences i.e. unlimited number of actuations
- **Stage 4 - Repetitive sequences & counters**
    - Correctly detect sequence type
    - Implement counter
    - Generate simple repetitive sequences i.e. perform set of operations twice
    - Generate more complicated repetitive sequences i.e. unlimited number of repetitions
- **Stage 5 - Timed sequences**
    - Correctly detect sequence type
    - Implement timer
    - Generate timed sequences
- **Stage 6 - Combined sequences**
    - Combine timed sequences with concurrent sequences
    - Combine timed sequences with repetitive sequences
    - Combine concurrent sequences with repetitive sequences
    - Combine all type of sequences together
 - **Stage 7 - Error generation**
    - Investigate possible error generation strategies
    - Implement error strategies in generated code
    - Adjust the backend to accommodate for this

### Frontend
- **Stage 1 - Website - CURRENT v. 1.0.0**
    - Create a simple user interface using web technologies - **CURRENT v. 1.0.0**
    - Incorporate basic sequence validation against regular expression in frontend<sup>1</sup>
    - Create pages for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Improve the general looks of the website to make it more user-friendly
- **Stage 2 - GUI Application**
    - Create a simple user interface using GUI (TBD)
    - Incorporate basic sequence validation against regular expression<sup>1</sup>
    - Create pages for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Improve user experience by improving the looks of the application
    
- **Stage 3 - Mobile application**
    - Create a simple user interface using mobile development technology (TBD)
    - Incorporate basic sequence validation against regular expression in application<sup>1</sup>
    - Create pages for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Improve the general looks of the application to make it more user-friendly
        
*Double sequence validation using regular expression<sup>1</sup> - sequence is validated both in backend and frontend to improve user experience. It will not create a backend request if the sequence is invalid. It is additionally validated in the backend to ensure code can be generated (in case someone uses unsupported client application or maliciously modifies the code).*
### Communication stack
- **Stage 1 - Communication stacks for the SERVER - PLC communication**
    - Investigate existing PLC communication protocols
    - Try various PLC Comm solutions
- **Stage 2 - Own communication solution**
    - Investigate requirements of the PLC comm stack
    - OPTIONAL: Implement own comm stack if it can address issues discovered in Communication Stack - Stage 1 (if there should be any)

## Changelog
### Version 1.0.2b - BUGFIX & TEST RELEASE
- Added a set of automated API tests to verify correctness of the API.
- Identified and addressed various bugs especially for looping sequences (where the whole sequence is surrounded with square brackets).
- As a temporary solution isValid function checks if the sequence starts and ends with square brackets, if so it ignores them.
- Added additional options for valid sequences, now timers and repeating sequences with variables will get validated correctly.
- isValid function gets tested against 24 valid sequences and 25 invalid sequences. More sequences will be added in the next releases.

### Version 1.0.2
- Added sequence validation - the function created in [backend/index.js](/frontend/validate.html) returns an empty array if there are no errors in the sequence, if there are any errors it will return an array containing the list of errors
- Added a new backend route that allows to validate the sequence provided as a GET parameter http://localhost:3000/sequence/isValid/(Sequence).
- Added a frontend page [frontend/validate.html](/frontend/validate.html) which allows to validate the given sequence
- Sequences that can be validated are concurrent, repeating, simple and timed sequences

### Version 1.0.1
- Added code generation (actual attempt to generate SCL code). Program will try to generate code based on the given simple sequence (just includes actuations + and -, without timers, counters or concurrency) - for any other sequence it will result in an error.
- Modified the way sequence is converted to the code - now it adds each code line to two separate arrays that later on are joined together using HTML line break tags.
- Added option to generate code with sensors present (it will check if the actuator is in the given position before performing actuation)
- Added regular expressions to check if sequence contains the following (if it contains any of the following an error will be returned):
    - Concurrent actions
    - Repetitive actions
    - Timers
- Fixed a bug where incorrect entries in the simple sequences would get validated correctly (now it checks if each entry is 2 characters long for simple sequences)
- Added simple frontend for testing purposes, user is able to provide sequence and will be displayed either an error message or correct sequence code if it can be generated.
- Updated the documentation for the code, added comments, cleaned it up a bit.

### Version 1.0.0
- Added Stack and Queue classes to store sequence to process. FIFO model seems to be more suitable as the sequence has
to be processed left to right.
- Added initial generateSequence route that takes the given sequence as a URL GET parameter, converts it to uppercase
and splits it using commas.
- Added PROOF OF CONCEPT generateCode function that takes an array of operations and generates the mockup of the future
code. It is capable of validating a serial sequence of cylinder actions (retractions and extensions).
