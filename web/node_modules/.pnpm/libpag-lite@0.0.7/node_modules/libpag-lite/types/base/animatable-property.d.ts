import { Keyframe } from './keyframe';
import { Property } from './property';
import { TimeRange } from './time-range';
export declare class AnimatableProperty<T> extends Property<T> {
    keyframes: Array<Keyframe<T>>;
    private lastKeyframeIndex;
    constructor(keyframes: Array<Keyframe<T>>);
    animatable(): boolean;
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
}
