import { Color } from '../color';
import { Mask } from '../mask';
import { Property } from '../property';
import { TimeRange } from '../time-range';
import { Effect, EffectType } from './effect';
export declare class StrokeEffect extends Effect {
    path: Mask | undefined;
    allMasks: boolean;
    strokeSequentially: Property<number> | undefined;
    color: Property<Color> | undefined;
    brushSize: Property<number> | undefined;
    brushHardness: Property<number> | undefined;
    opacity: Property<number> | undefined;
    start: Property<number> | undefined;
    end: Property<number> | undefined;
    spacing: Property<number> | undefined;
    paintStyle: Property<number> | undefined;
    type(): EffectType;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
