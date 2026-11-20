const UPDATE_INTERVAL_MS = 100;
export class TaskProgress {
    constructor(project) {
        this.project = project;
        this.lastCompleted = -1;
        this.lastLineLength = 0;
        this.baseline = project.getCompletedTaskCount();
    }
    start(label) {
        this.label = label;
        this.lastCompleted = -1;
        this.render();
        if (process.stdout.isTTY) {
            this.timer = setInterval(() => this.render(), UPDATE_INTERVAL_MS);
            this.timer.unref();
        }
    }
    stop() {
        const current = this.project.getCompletedTaskCount();
        const completed = (current - this.baseline) >>> 0;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        if (this.label && process.stdout.isTTY) {
            process.stdout.write(`\r${" ".repeat(this.lastLineLength)}\r`);
        }
        this.label = undefined;
        this.lastCompleted = -1;
        this.lastLineLength = 0;
        this.baseline = current;
        return completed;
    }
    render() {
        if (!this.label) {
            return;
        }
        const current = this.project.getCompletedTaskCount();
        const completed = (current - this.baseline) >>> 0;
        if (completed === this.lastCompleted) {
            return;
        }
        this.lastCompleted = completed;
        const message = `${this.label}... (${formatTaskCount(completed)} completed)`;
        if (process.stdout.isTTY) {
            process.stdout.write(`\r${message.padEnd(this.lastLineLength, " ")}`);
            this.lastLineLength = message.length;
        }
        else {
            console.log(message);
        }
    }
}
export function formatDuration(durationMs) {
    return durationMs > 2000
        ? `${Math.round(durationMs / 100) / 10}s`
        : `${durationMs}ms`;
}
export function formatTaskCount(taskCount) {
    return `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;
}
