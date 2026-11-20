export type Listener = (...payload: any) => void;
export declare class EventManager {
    private listenersMap;
    constructor();
    on(eventName: string, listener: Listener): void;
    off(eventName: string, listener?: Listener): void;
    emit(eventName: string, ...payload: any): boolean;
}
