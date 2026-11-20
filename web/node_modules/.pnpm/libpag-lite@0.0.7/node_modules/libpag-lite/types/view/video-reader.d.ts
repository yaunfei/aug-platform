import type { VideoSequence } from '../base/video-sequence';
declare global {
    interface Window {
        WeixinJSBridge?: any;
    }
}
type K = keyof HTMLVideoElementEventMap;
export declare class VideoReader {
    static create(videoSequence: VideoSequence): {
        videoReader: VideoReader;
        debugData: any;
    };
    protected destroyed: boolean;
    protected frameRate: number;
    private _duration;
    private videoElement;
    constructor(videoSequence: VideoSequence);
    getVideoElement(): HTMLVideoElement;
    progress(): number;
    duration(): number;
    currentTime(): number;
    start(): Promise<void>;
    pause(): void;
    seek(time: number): Promise<void>;
    addListener(event: K, handler: (this: HTMLVideoElement, ev: HTMLVideoElementEventMap[K]) => void): void;
    removeAllListeners(): void;
    getFrameData(callback: any): any;
    clearCallback(): void;
    destroy(): void;
    protected load(videoSequence: VideoSequence): any;
}
export {};
