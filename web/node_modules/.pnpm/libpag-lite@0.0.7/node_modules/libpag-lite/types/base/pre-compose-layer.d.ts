import { Composition } from './composition';
import { Layer, LayerType } from './layer';
import { TimeRange } from './time-range';
export declare class PreComposeLayer extends Layer {
    static wrap(composition: Composition): PreComposeLayer;
    /**
     * composition reference
     */
    composition: Composition | undefined;
    /**
     * Indicates when the first frame of the composition shows in the layer's timeline. It could be a negative value.
     */
    compositionStartTime: number;
    private staticTimeRanges;
    private staticTimeRangeUpdated;
    type(): LayerType;
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
    verify(): boolean;
    private updateStaticTimeRanges;
}
