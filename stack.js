class Stack {
    constructor() {
        this.stack = [];
    }

    push(element) {
        this.stack.push(element);
    }

    pop() {
        if(this.stack.length > 0) {
            return this.stack.pop();
        } else {
            return {id: -1};
        }
    }

    peek() {
        if(this.stack.length > 0) {
            return this.stack[this.stack.length - 1];
        } else {
            return {id: -1};
        }
    }

    isEmpty() {
        return this.stack.length === 0;
    }
}

module.exports = Stack
