import { VideoReader as Reader } from '../view/video-reader';
import type { VideoSequence } from '../base/video-sequence';
import type { VideoDecoder } from './types';
type K = keyof HTMLVideoElementEventMap;
export interface FrameData {
    id: number;
    data: ArrayBuffer;
    width: number;
    height: number;
}
export declare class VideoReader extends Reader {
    static create(videoSequence: VideoSequence): {
        videoReader: VideoReader;
        debugData: {
            createDir: number;
            coverMP4: number;
            writeFile: number;
            createDecoder: number;
        };
    };
    videoDecoder: VideoDecoder | undefined;
    private started;
    private mp4Path;
    private loadedPromise;
    private frameDataBuffers;
    private getFrameDataLooping;
    private getFrameDataCallback;
    private getFrameDataLoopTimer;
    private currentFrame;
    private seeking;
    getVideoElement(): HTMLVideoElement;
    progress(): number;
    duration(): number;
    currentTime(): number;
    start(): Promise<void>;
    pause(): void;
    seek(time: number): Promise<void>;
    getFrameData(callback: (frameData: FrameData) => void): void;
    addListener(event: K, handler: (this: HTMLVideoElement, ev: HTMLVideoElementEventMap[K]) => void): void;
    removeAllListeners(): void;
    destroy(): void;
    clearCallback(): void;
    protected load(videoSequence: VideoSequence): {
        createDir: number;
        coverMP4: number;
        writeFile: number;
        createDecoder: number;
    };
    private startGetFrameDataLoop;
    private getFrameDataLoop;
    private clearFrameDataLoop;
}
export {};
