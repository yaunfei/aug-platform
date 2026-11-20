import { PAGFile } from '../pag-file';
import { RenderOptions } from './context';
import { View } from './view';
export declare class PAG2dView extends View {
    private context;
    private renderCanvas2D;
    private renderCanvas2DContext;
    constructor(pagFile: PAGFile, canvas: HTMLCanvasElement, options: RenderOptions);
    protected draw(): void;
    protected clearRender(): void;
}
