import { Mask } from '../mask';
import { Property } from '../property';
import { TimeRange } from '../time-range';
export declare class TextPathOptions {
    path: Mask | undefined;
    reversedPath: Property<boolean> | undefined;
    perpendicularToPath: Property<boolean> | undefined;
    forceAlignment: Property<boolean> | undefined;
    firstMargin: Property<number> | undefined;
    lastMargin: Property<number> | undefined;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
