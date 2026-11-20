import { PAGFile } from '../pag-file';
import { RenderOptions } from './context';
import { View } from './view';
export declare class PAGWebGLView extends View {
    protected gl: WebGLRenderingContext;
    protected scale: {
        x: number;
        y: number;
    };
    private program;
    private positionLocation;
    private texcoordLocation;
    private alphaStartLocation;
    private scaleLocation;
    private resolutionLocation;
    private positionBuffer;
    private texcoordBuffer;
    private originalVideoTexture;
    private renderingTexture;
    private renderingFbo;
    constructor(pagFile: PAGFile, canvas: HTMLCanvasElement, options: RenderOptions);
    protected loadContext(): void;
    protected draw(): void;
    protected clearRender(): void;
    protected detectWebGLContext(): boolean;
    protected texImage2D(): void;
    private setRectangle;
}
