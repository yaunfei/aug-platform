import { RenderingMode, EventName, ScaleMode } from '../types';
import { EventManager, Listener } from '../base/utils/event-manager';
import type { PAGFile } from '../pag-file';
import type { VideoParam, DebugData } from '../types';
import type { VideoSequence } from '../base/video-sequence';
export interface RenderOptions {
    renderingMode?: RenderingMode;
    useScale?: boolean;
}
export declare class Context {
    protected canvas: HTMLCanvasElement | null;
    protected canvasSize: {
        width: number;
        height: number;
    };
    protected eventManager: EventManager;
    protected playing: boolean;
    protected videoParam: VideoParam;
    protected viewportSize: {
        x: number;
        y: number;
        width: number;
        height: number;
        scaleX: number;
        scaleY: number;
    };
    protected destroyed: boolean;
    protected videoSequence: VideoSequence;
    protected renderTimer: number | null;
    protected repeatCount: number;
    private renderingMode;
    private viewScaleMode;
    private debugData;
    constructor(pagFile: PAGFile, canvas: HTMLCanvasElement, options: RenderOptions);
    /**
     * 是否播放中
     */
    isPlaying(): boolean;
    /**
     * 是否已经销毁
     */
    isDestroyed(): boolean;
    /**
     * 动画持续时间
     */
    duration(): number;
    /**
     * 动画持续时间
     */
    frameRate(): number;
    /**
     * 设置动画重复的次数。默认值为 1，只播放一次。如为 0 动画则无限播放。
     */
    setRepeatCount(repeatCount?: number): void;
    /**
     * 增加事件监听
     */
    addListener(eventName: EventName, listener: Listener): void;
    /**
     * 移除事件监听
     */
    removeListener(eventName: EventName, listener?: Listener): void;
    /**
     * 返回当前缩放模式
     */
    scaleMode(): ScaleMode;
    /**
     * 指定缩放内容的模式
     */
    setScaleMode(scaleMode?: ScaleMode): void;
    updateSize(useScale?: boolean): void;
    getDebugData(): DebugData;
    setDebugData(data: DebugData): void;
    protected loadContext(): void;
    protected clearRender(): void;
}
