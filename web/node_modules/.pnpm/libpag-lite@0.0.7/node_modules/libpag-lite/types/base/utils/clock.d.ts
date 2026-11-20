export declare class Clock {
    private startTime;
    private markers;
    constructor();
    reset(): void;
    mark(key: string): void;
    measure(makerFrom: string, makerTo: string): number;
}
