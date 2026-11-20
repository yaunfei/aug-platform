import { Context, RenderOptions } from './context';
import type { PAGFile } from '../pag-file';
import { VideoReader } from './video-reader';
import { VideoSequence } from '../base/video-sequence';
declare global {
    interface Window {
        WeixinJSBridge?: any;
    }
}
export declare const playVideoElement: (videoElement: HTMLVideoElement) => Promise<void>;
export declare class View extends Context {
    protected videoReader: VideoReader;
    protected fpsBuffer: number[];
    protected currentFrame: number;
    protected needSeek: boolean;
    constructor(pagFile: PAGFile, canvas: HTMLCanvasElement, options: RenderOptions);
    /**
     * 开始播放
     */
    play(): Promise<void>;
    /**
     * 暂停播放
     */
    pause(): void;
    /**
     * 停止播放
     */
    stop(): void;
    /**
     * 销毁播放实例
     */
    destroy(): void;
    /**
     * 返回当前播放进度位置，取值范围为 0.0 到 1.0。
     */
    getProgress(): number;
    /**
     * 设置播放进度位置，取值范围为 0.0 到 1.0。
     */
    setProgress(progress: number): void;
    /**
     * 渲染当前进度画面
     */
    flush(): Promise<void>;
    protected draw(): void;
    protected createVideoReader(videoSequence: VideoSequence): VideoReader;
    protected repeat(): Promise<boolean>;
    protected flushLoop(): Promise<void>;
    protected clearTimer(): void;
    protected updateFPS(): void;
    protected flushInternal(sync: boolean): Promise<void>;
}
