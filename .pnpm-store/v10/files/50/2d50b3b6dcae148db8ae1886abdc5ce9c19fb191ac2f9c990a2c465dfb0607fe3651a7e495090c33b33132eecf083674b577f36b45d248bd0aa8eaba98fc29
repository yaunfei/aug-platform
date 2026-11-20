import { Color } from './color';
import { CompositionType } from '../codec/types';
import { TimeRange } from './time-range';
export declare class Composition {
    private static cacheIDCount;
    /**
     * A unique identifier for this item.
     */
    id: number;
    /**
     * The width of the Composition.
     */
    width: number;
    /**
     * The height of the item.
     */
    height: number;
    /**
     * The total duration of the item.
     */
    duration: number;
    /**
     * The frame rate of the Composition.
     */
    frameRate: number;
    /**
     * The background color of the composition.
     */
    backgroundColor: Color;
    cacheID: number;
    constructor();
    /**
     * The type of the Composition.
     */
    type(): CompositionType;
    /**
     * Returns the static time ranges of this composition.
     */
    getStaticTimeRanges(): Array<TimeRange>;
    verify(): boolean;
}
