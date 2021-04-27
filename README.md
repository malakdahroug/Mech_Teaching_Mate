# Mechatronics Teaching Mate
This is a repository containing my final project code for the Mechatronics Teaching Mate.

## Instructions
To run the code on your device you have to have the following tools installed:
- Node.js
- Git CLI

If all the dependencies are installed, run the following in the terminal / command line:  
`git clone malakdahroug/Mech_Teaching_Mate`  
`cd repository_location`  
`npm install`

#### Frontend
`cd frontend`  
`node index.js`  

#### Backend
`cd backend`  
`npm install`  
`node start.js`  

#### Communication stack
`cd commstack`  
`npm install`  
`node index.js`

#### Automated tests
To run automated tests on the code downloaded before 1.0.2b release additional packages are required. Please follow the steps
below to be able to execute automated tests.
`cd repository_location`  
`git pull origin master`  
`npm install`  
`npm run test`  

There are 51 tests in total (1 testing suite test, 1 endpoint test, 24 'correct sequence' tests and 25 'incorrect sequence' tests).

## Current release
##### Backend
Current version 7.0.2  

##### Frontend
Current version 1.0.2

##### Communication stack
Current Version 2.0.3

## Roadmap
### Backend
- **Stage 1 - Simple sequences**
    - Break the sequence down - *v. 1.0.0*
    - Implement simple code generation - *v. 1.0.1*
    - Detect type of sequence(simple, concurrent, repetitive or timed) - **v. 1.0.1**
    - Validate the sequence using regular expressions - **v. 1.0.2b**
    - Implement simple error generation - **v. 1.0.3a**
- **Stage 2 - User sessions & projects**  - **CURRENT v. 2.0.2**
    - Implement registration & login system that will be using a database to store user data e.g. user projects - **v. 2.0.0**
    - Create routes and backend procedures for the following:  - **v. 2.0.1**
        - login
        - registration
        - project operations - expected in v. 2.0.3*
        - sequence generation history -  expected in v. 2.0.3*
        - others that will be identified during the development
    - Add user ability to create project.  
    - Add user ability to configure project (e.g. define tag names or types of cylinders).
- **Stage 3 - Concurrent sequences**
    - Correctly detect sequence type.
    - Generate code for basic concurrent sequences i.e. 2 actuations at once.
    - Generate code for more complicated concurrent sequences i.e. unlimited number of actuations.
- **Stage 4 - Repetitive sequences & counters**
    - Correctly detect sequence type.
    - Implement counter.
    - Generate code for simple repetitive sequences i.e. perform set of operations twice.
    - Generate code for more complicated repetitive sequences i.e. unlimited number of repetitions.
- **Stage 5 - Timed sequences**
    - Correctly detect sequence type.
    - Implement timer.
    - Generate code for timed sequences.
- **Stage 6 - Combined sequences**
    - Combine timed sequences with concurrent sequences.
    - Combine timed sequences with repetitive sequences.
    - Combine concurrent sequences with repetitive sequences.
    - Combine all types of sequences together.
 - **Stage 7 - Error generation**
    - Investigate possible error generation strategies.
    - Implement error strategies in generated code.
    - Adjust the backend to accommodate for this.

### Frontend
- **Stage 1 - Website - CURRENT v. 1.0.1**
    - Create a simple user interface using web technologies - **v. 1.0.0**
    - ~~Incorporate basic sequence validation against regular expression in frontend~~ - **removed <sup>1</sup>**
    - Create pages for the following: - **v. 1.0.1**
        - login - **v. 1.0.1**
        - registration - **v. 1.0.1**
        - project operations - **(partial implementation) v. 1.0.1**
        - sequence generation history - expected in v. 1.0.2*
        - others that will be identified during the development - expected in v. 1.0.2*
    - Improve the general looks of the website to make it more user-friendly - **v. 1.0.1**
- **Stage 2 - GUI Application**
    - Create a simple user interface using GUI. (TBD)
    - Incorporate basic sequence validation against a regular expression. <sup>1</sup>
    - Create pages for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Improve user experience by improving the looks of the application.
    
- **Stage 3 - Mobile application**
    - Create a simple user interface using mobile development technology. (TBD)
    - Incorporate basic sequence validation against a regular expression in the application<sup>1</sup>
    - Create pages for the following:
        - login
        - registration
        - project operations
        - sequence generation history
        - others that will be identified during the development
    - Improve the general looks of the application to make it more user-friendly.
    
### Communication stack
- **Stage 1 - Communication stacks for the SERVER - PLC communication**
    - Investigate existing PLC communication protocols.
    - Try various PLC Comm solutions.
- **Stage 2 - Own communication solution**
    - Investigate requirements of the PLC comm stack.
    - OPTIONAL: Implement a tailored comm stack if it can address issues discovered in the existing Communication Stack - Stage 1 (if there should be any).

Double sequence validation (validation occurring in both the backend and the frontend) <sup>1</sup> - it was identified that the sequence validation requires more than the regular expression validation alone. As a result validation is only done in the backend to keep the frontend logics simple.
## Changelog frontend
### Version 1.0.2
- Finalised the frontend design.
- Added Simulated PLC page.
- Added instructions on each of the pages.

### Version 1.0.1
- Developed a user-friendly, responsive frontend base.
- Added various aspects of the frontend including:
    - User routes (login / registration /logout).
    - Project routes (create, manage projects, project setting page is still pending).
    - Generator for sequences that are not created using projects.
    - Validator for sequences - it allows to just validate the sequence and identify errors.

### Version 1.0.0
- Added a simple frontend to test the backend routes.

## Changelog backend
### Version 7.0.2
- Fixed bugs found.
- Added checks to detect sequences that start with extended actuators.
- Added a new error message for sequences that start with extended actuators.

### Version 7.0.1
- Implemented more advanced options in the error generator such as:
- swapping true with false 
- removing one of the conditions within an IF statement

### Version 7.0.0
- Implemented error generation by reusing the previous error generator logics.

---

### Version 6.0.3
- Implemented the ability for the system to support users using predefined tag names for sequence components.

### Version 6.0.2
- Implemented an option for the user to generate an XML file for auto-generated tag names that can be imported to TIA Portal.

### Version 6.0.1
- Implemented the ability for the system to support nested repetitive sequences (single depth of nesting sequences must start and end with square brackets).
- example: [A+,A-[B+,B-]^2]

### Version 6.0.0
- Implemented the ability for the system to support combined sequences (repetitive, concurrent and timed).

---

### Version 5.0.0
- Implemented an option to generate code for sequences that contain repetitive parts (no nesting).
- Manually tested the generation of repetitive sequences.

---

### Version 4.0.0
- Implemented an option to generate code for sequences that contain timers.
- Manually tested the generation of timed sequences.
---

### Version 3.0.0
- Implemented an option to generate code for sequences that contain concurrent parts.
- Manually tested the generation of concurrent sequences. 

---

### Version 2.0.3
- Added an option to configure project components.
- Added project management options.
- Added an option to delete project components.

### Version 2.0.2
- Defined Schemas for 'Projects' and 'ProjectConfigs' to be stored in MongoDB.
- Added backend GET route to fulfill the 'project creation' functionality.
- Projects will only be created for sequences that were not attempted by the same user previously.

### Version 2.0.1
- Added database connections
- Defined a Schema for 'User objects' to be stored in MongoDB. 
- Fulfilled login and registration functionalities through POST backend routes.

---

### Version 2.0.0
- Added a simple login / registration system using a local array.

---

### Version 1.0.3a
- Added a simple error generator
- All complexities include the same type of errors, different complexities will control how many errors to include wihtin the code.
- Improved the frontend page to allow users to select if code should be generated with errors as well as added minor features e.g. the ability for the user to see the correct soloution when they generates code with errors for them to solve. 
- Commented various parts of code that were not documented properly.

### Version 1.0.2b - BUGFIX & TEST RELEASE
- Added a set of automated API tests to verify the correctness of the API.
- Identified and addressed various bugs found within looping sequences (where the whole sequence is surrounded with square brackets).
- As a temporary solution the 'isValid' function checks if the sequence starts and ends with square brackets, if so it ignores them.
- Added additional options for valid sequences, now timers and repeating sequences with variables will get validated correctly.
- the 'isValid' function gets tested against 24 valid sequences and 25 invalid sequences. More sequences will be added in the next releases.

### Version 1.0.2
- Added sequence validation - the function created in [backend/index.js](/frontend/legacy/validate.html) returns an empty array if there are no errors in the sequence, if there are any errors it will return an array containing the list of errors.
- Added a new backend route that enables the system to validate the sequence provided as a GET parameter http://localhost:3000/sequence/isValid/(Sequence).
- Added a frontend page [frontend/validate.html](/frontend/legacy/validate.html) that allows the system to validate the given sequence.
- Sequences that can be validated are concurrent, repeating, simple and timed sequences.

### Version 1.0.1
- Added a code generator (actual attempt to allow the system to generate SCL code). Program will try to generate code based on the given simple sequence (just includes actuations + and -, without timers, counters or sequence concurrency) - for any other sequence it will result in an error.
- Modified the way a sequence is converted to code - now it adds each code line to two separate arrays that later are joined together using HTML line break tags.
- Added an option for the user to generate code with sensors present (it will check if the actuator is in the given position before performing the actuation)
- Added regular expressions to check if a given sequence contains the following (if it contains any of the following an error will be returned):
    - Concurrent actions
    - Repetitive actions
    - Timers
- Fixed a bug where incorrect entries of simple sequences would get validated correctly (now it checks if each entry is 2 characters long for simple sequences).
- Added a simple frontend for testing purposes, user is able to provide a sequence and will be displayed with either an error message or the correct sequence code if it can be generated.
- Updated the documentation for the code, and added comments. 

### Version 1.0.0
- Added Stack and Queue classes to store the sequence to be processed. FIFO model seemed to be more suitable as the sequence has
to be processed left to right.
- Added an initial 'generateSequence' route that takes the given sequence as a URL GET parameter, converts it to uppercase letters
and splits it using commas.
- Added a PROOF OF CONCEPT 'generateCode' function that takes an array of operations and generates the mockup of it's future
code. It is capable of validating a serial sequence of actuator actions (retractions and extensions).

## Changelog communication stack
### Version 2.0.3
- fixed bugs found.
- Added checks to prevent sequences starting with extended actuators from executing.

### Version 2.0.2
- Implemented a set of routes to interact with the PLC from the frontend. the lsit includes:
    - Get list of available PLCs
    - Stop sequence execution
    - Start sequence execution

### Version 2.0.1
- Implemented a set of checks to ensure that a PLC that is executing a sequence cannot be connected to by other users.
- Implemented a stopping mechanism for a PLC that is executing a sequence.

### Version 2.0.0
- Added an option for users to connect to various PLCs.

---

### Version 1.0.5
- Fixed bugs found. 

### Version 1.0.4
- Implemented the ability for the Simulated PLC' to support repetitive sequences.

### Version 1.0.3
- Implemented the ability for the 'Simulated PLC' to support concurrent sequences. 

### Version 1.0.2
- Implemented the ability for the 'Simulated PLC' to support timed sequences.

### Version 1.0.1
- Implemented logics for the 'simulated PLC' to execute simple sequences (without counters, timers and concurrent executions).

### Version 1.0.0
- Investigated connectivity options for the communication stack
- Implemented a simple 'proof of concept' connector to connect to the OPC UA server of the PLC.
