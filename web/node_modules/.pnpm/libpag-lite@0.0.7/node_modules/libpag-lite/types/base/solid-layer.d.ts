import { Color } from './color';
import { Layer, LayerType } from './layer';
import { TimeRange } from './time-range';
export declare class SolidLayer extends Layer {
    solidColor: Color;
    width: number;
    height: number;
    type(): LayerType;
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
    verify(): boolean;
}
