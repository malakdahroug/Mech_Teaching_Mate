/**
 * Stack class that operates in FILO model -> first to come will be the last to leave
 */
class Stack {
    /**
     * Default constructor that will be called when the class is instantiated.
     * It initializes and empty array containing the Stack
     */
    constructor() {
        this.stack = [];
    }

    /**
     * Push function that adds an element to the stack
     *
     * @param element element to be pushed to the stack
     */
    push(element) {
        this.stack.push(element);
    }

    /**
     * Pop function that removes an element from the end of the stack, if stack is empty it will return -1
     *
     * @returns {number|*} element removed from the stack or -1 if stack is empty
     */
    pop() {
        if(!this.isEmpty()) {
            return this.stack.pop();
        } else {
            return -1;
        }
    }


    /**
     * Top function that returns the last element from the stack or -1 if stack is empty
     *
     * @returns {number|*} last element in the stack or -1 if the stack is empty
     */
    top() {
        if(!this.isEmpty()) {
            return this.stack[this.stack.length - 1];
        } else {
            return -1;
        }
    }

    /**
     * isEmpty function that returns true if stack is empty, if it has elements it will return false
     *
     * @returns {boolean} containing state of the stack
     */
    isEmpty() {
        return this.stack.length === 0;
    }
}

module.exports = Stack
