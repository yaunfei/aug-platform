import { KeyframeInterpolationType } from '../constant';
import { Point } from './point';
export declare class Keyframe<T> {
    startValue: T | undefined;
    endValue: T | undefined;
    startTime: number;
    endTime: number;
    interpolationType: KeyframeInterpolationType;
    bezierOut: Array<Point>;
    bezierIn: Array<Point>;
    spatialOut: Point;
    spatialIn: Point;
    initialize(): void;
    getValue(_time: number): any;
    containsTime(time: number): boolean;
}
