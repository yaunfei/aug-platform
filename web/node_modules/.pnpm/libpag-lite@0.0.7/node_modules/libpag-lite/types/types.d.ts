export interface VideoParam {
    width: number;
    height: number;
    MP4Width: number;
    MP4Height: number;
    sequenceWidth: number;
    sequenceHeight: number;
    hasAlpha: boolean;
    alphaStartX: number;
    alphaStartY: number;
}
export declare enum RenderingMode {
    Canvas2D = "2d",
    WebGL = "WebGL"
}
export declare enum EventName {
    /**
     * Notifies the start of the animation.
     */
    onAnimationStart = "onAnimationStart",
    /**
     * Notifies the end of the animation.
     */
    onAnimationEnd = "onAnimationEnd",
    /**
     * Notifies the cancellation of the animation.
     */
    onAnimationCancel = "onAnimationCancel",
    /**
     * Notifies the repetition of the animation.
     */
    onAnimationRepeat = "onAnimationRepeat",
    /**
     * Notifies the update of the animation.
     */
    onAnimationUpdate = "onAnimationUpdate",
    /**
     * Notifies the play of the animation.
     */
    onAnimationPlay = "onAnimationPlay",
    /**
     * Notifies the pause of the animation.
     */
    onAnimationPause = "onAnimationPause"
}
export declare enum ScaleMode {
    None = "None",
    /**
     * 拉伸内容到适应画布
     */
    Stretch = "Stretch",
    /**
     * 根据原始比例缩放内容
     */
    LetterBox = "LetterBox",
    /**
     * 根据原始比例被缩放适应，一个轴会被裁剪
     */
    Zoom = "Zoom"
}
export interface DebugData {
    FPS?: number;
    decodePAGFile?: number;
    createDir?: number;
    coverMP4?: number;
    writeFile?: number;
    createDecoder?: number;
    getFrame?: number;
    draw?: number;
}
