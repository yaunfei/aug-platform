import { Mask } from '../mask';
import { Property } from '../property';
import { TimeRange } from '../time-range';
export declare const enum EffectType {
    Unknown = 0,
    Tint = 1,
    Fill = 2,
    Stroke = 3,
    Tritone = 4,
    DropShadow = 5,
    RadialWipe = 6,
    DisplacementMap = 7
}
export declare class Effect {
    effectOpacity: Property<number> | undefined;
    maskReferences: Array<Mask> | undefined;
    type(): EffectType;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
