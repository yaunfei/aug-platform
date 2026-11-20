import { Path } from './path';
import { Property } from './property';
import { TimeRange } from './time-range';
export declare const enum MaskMode {
    None = 0,
    Add = 1,
    Subtract = 2,
    Intersect = 3,
    Lighten = 4,
    Darken = 5,
    Difference = 6,
    Accum = 7
}
export declare class Mask {
    id: number;
    inverted: boolean;
    maskMode: MaskMode;
    maskPath: Property<Path> | undefined;
    maskOpacity: Property<number> | undefined;
    maskExpansion: Property<number> | undefined;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_frame: number): void;
    verify(): boolean;
}
