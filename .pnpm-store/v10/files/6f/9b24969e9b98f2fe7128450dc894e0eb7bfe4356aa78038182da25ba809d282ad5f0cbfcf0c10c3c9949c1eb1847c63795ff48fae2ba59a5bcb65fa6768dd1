import { CompositionType } from '../codec/types';
import { Composition } from './composition';
import { Layer } from './layer';
import { TimeRange } from './time-range';
export declare class VectorComposition extends Composition {
    layers: Array<Layer>;
    private staticTimeRanges;
    private staticTimeRangeUpdated;
    type(): CompositionType;
    /**
     * Returns the static time ranges of this composition.
     */
    getStaticTimeRanges(): Array<TimeRange>;
    verify(): boolean;
    private updateStaticTimeRanges;
}
