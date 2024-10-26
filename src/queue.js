const QueueState = {
    None:         0,
    Loading:      1,
    Retrying:     2,
    WaitingTasks: 3
};

const RETRIES        = 5;
const DELAY_ON_ERROR = 5000;

class CMTTError extends Error {
    constructor(data) {
        super(data.message);

        this.data = data;
    }
}

export class Queue {
    tasks  = [];
    state  = QueueState.None;
    timer  = null;
    period = 100;

    constructor({period}) {
        this.period = period;

        this.start();
    }

    delay = async (delay) => {
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    startTask = async (task) => {
        let tries = 0;
        let lastError;
        while (tries < RETRIES) {
            try {
                const response = await task.run();

                if (response.status >= 400 && response.status < 600) {
                    throw new CMTTError({
                        message: 'Bad response from server: ' + response.statusText,
                        code:    response.status
                    });
                }

                switch (this.state) {
                    case QueueState.Retrying:
                        this.state = QueueState.Loading;
                        break;
                }

                return response.json();
            } catch (e) {
                lastError  = e;
                if(e.data.code == 401){ // if not authorized don't retry
                    tries = RETRIES;
                }
                else {
                this.state = QueueState.Retrying;

                await this.delay(DELAY_ON_ERROR);
                tries++;
                }
            }
        }

        this.state = QueueState.Loading;

        throw lastError;
    }

    checkTasks = () => {
        if (!this.tasks.length) {
            this.state = QueueState.WaitingTasks;

            return;
        }

        switch (this.state) {
            case QueueState.Retrying:
                return;
            case QueueState.WaitingTasks:
                this.state = QueueState.Loading;
                break;
        }

        const task = this.tasks.splice(0, 1)[0];

        this.startTask(task.task)
            .then(task.onComplete)
            .catch(task.onError);
    }

    addTask = (task) => {
        return new Promise((resolve, reject) => {
            const t = {
                task:       task,
                onComplete: (res) => {
                    resolve(res);
                },
                onError:    reject
            };

            this.tasks.push(t);
        });
    }

    start = () => {
        this.timer = setInterval(() => this.checkTasks(), this.period);
    }

    stop = () => {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    clear = () => {
        this.stop();
        this.tasks = [];
    }

    resume = (force = false) => {
        if (this.timer) {
            if (force)
                this.stop()
            else
                return;
        }

        this.start();
    }
}