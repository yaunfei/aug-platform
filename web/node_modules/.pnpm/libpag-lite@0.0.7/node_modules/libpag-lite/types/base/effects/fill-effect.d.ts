import { Color } from '../color';
import { Mask } from '../mask';
import { Property } from '../property';
import { TimeRange } from '../time-range';
import { Effect, EffectType } from './effect';
export declare class FillEffect extends Effect {
    fillMask: Mask | undefined;
    allMasks: boolean;
    color: Property<Color> | undefined;
    invert: Property<boolean> | undefined;
    horizontalFeather: Property<number> | undefined;
    verticalFeather: Property<number> | undefined;
    opacity: Property<number> | undefined;
    type(): EffectType;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
