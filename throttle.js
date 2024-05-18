// throttle: parallelize function execution up to some limit
module.exports =
    class Throttle {
	constructor(limit) {
	    this.todo = [];
	    this.running = 0;
	    this.limit = limit ? limit : 2;

	}

	enqueue = (f) => {
	    this.todo.push(f);
	    this.run();

	}

	dequeue = () => this.todo.shift();

	isEmpty = () => this.todo.length == 0;

	length = () => this.todo.length;

	run = async () => {
	    if (this.running < this.limit) {
		this.running++;
		await this.dequeue()();
		this.running--;
		if (!this.isEmpty())
		    this.run();

	    }

	};

    };
