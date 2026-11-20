import { Point } from './point';
import { Property } from './property';
import type { TimeRange } from './time-range';
export declare class Transform2D {
    static createDefaultTransform2D(): Transform2D;
    anchorPoint: Property<Point>;
    position: Property<Point>;
    xPosition: Property<number>;
    yPosition: Property<number>;
    scale: Property<Point>;
    rotation: Property<number>;
    opacity: Property<number>;
    constructor();
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
    verify(): boolean;
}
