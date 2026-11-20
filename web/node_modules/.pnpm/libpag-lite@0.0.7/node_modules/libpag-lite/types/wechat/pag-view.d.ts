import { VideoReader } from './video-reader';
import { PAGWebGLView } from '../view/pag-webgl-view';
import { PAGFile } from '../pag-file';
import type { VideoSequence } from '../base/video-sequence';
export declare class PAGView extends PAGWebGLView {
    static init(data: ArrayBuffer, canvas: HTMLCanvasElement): PAGView;
    private flushBaseTime;
    private frameData;
    private needGetFrame;
    constructor(pagFile: PAGFile, canvas: HTMLCanvasElement);
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    destroy(): void;
    updateSize(): void;
    setProgress(progress: number): void;
    protected flushInternal(): Promise<void>;
    protected flushLoop(): Promise<void>;
    protected detectWebGLContext(): boolean;
    protected createVideoReader(videoSequence: VideoSequence): VideoReader;
    protected texImage2D(): void;
    protected repeat(): Promise<boolean>;
    protected clearTimer(): void;
    private seekToStart;
}
