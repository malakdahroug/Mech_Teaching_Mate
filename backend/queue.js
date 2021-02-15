/**
 * Queue class that operates in FIFO model -> first to come will be the first to leave
 */
class Queue {
    /**
     * Default constructor that will be called when the class is instantiated.
     * It initializes and empty array containing the Queue
     */
    constructor() {
        this.queue = [];
    }

    /**
     * Enqueue function that adds an element to the end of the queue
     *
     * @param element to be pushed to the queue
     */
    enqueue(element) {
        this.queue.push(element);
    }

    /**
     * Dequeue function that removes the first element from the Queue and returns it. If the queue is empty -1 will be returned
     *
     * @returns {number|*} element removed or -1 if Queue is empty
     */
    dequeue() {
        if(!this.isEmpty()) {
            return this.queue.splice(0, 1)[0];
        } else {
            return -1;
        }
    }

    /**
     * Front function returns the first element of the Queue
     *
     * @returns {number|*} first element in the queue
     */
    front() {
        if(!this.isEmpty()) {
            return this.queue[0];
        } else {
            return -1;
        }
    }

    /**
     * isEmpty function that returns true if Queue is empty, if it has elements it will return false
     *
     * @returns {boolean} containing state of the Queue
     */
    isEmpty() {
        return this.queue.length === 0;
    }
}

module.exports = Queue
