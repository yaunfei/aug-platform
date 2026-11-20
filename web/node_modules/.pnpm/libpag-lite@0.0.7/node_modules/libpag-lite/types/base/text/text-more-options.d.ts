import { Point } from '../point';
import { Property } from '../property';
import { TimeRange } from '../time-range';
declare enum AnchorPointGrouping {
    Character = 0,
    Word = 1,
    Line = 2,
    All = 3
}
export declare class TextMoreOptions {
    anchorPointGrouping: AnchorPointGrouping;
    groupingAlignment: Property<Point> | undefined;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
export {};
