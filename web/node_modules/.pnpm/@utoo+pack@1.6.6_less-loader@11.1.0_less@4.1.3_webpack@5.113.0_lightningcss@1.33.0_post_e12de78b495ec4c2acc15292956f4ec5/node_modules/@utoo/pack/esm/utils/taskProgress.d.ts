import type { Project } from "../core/types";
export declare class TaskProgress {
    private readonly project;
    private baseline;
    private label;
    private timer;
    private lastCompleted;
    private lastLineLength;
    constructor(project: Pick<Project, "getCompletedTaskCount">);
    start(label: string): void;
    stop(): number;
    private render;
}
export declare function formatDuration(durationMs: number): string;
export declare function formatTaskCount(taskCount: number): string;
