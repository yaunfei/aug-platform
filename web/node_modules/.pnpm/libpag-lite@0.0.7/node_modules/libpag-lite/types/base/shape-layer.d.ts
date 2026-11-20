import { Layer, LayerType } from './layer';
import { TimeRange } from './time-range';
export declare class ShapeLayer extends Layer {
    private contents;
    type(): LayerType;
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
    verify(): boolean;
}
