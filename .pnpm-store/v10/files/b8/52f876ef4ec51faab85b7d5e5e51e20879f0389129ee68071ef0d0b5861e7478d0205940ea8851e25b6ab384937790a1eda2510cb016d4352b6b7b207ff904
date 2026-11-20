import { Composition } from './composition';
import { CompositionType } from '../codec/types';
import { TimeRange } from './time-range';
import { VideoSequence } from './video-sequence';
export declare class VideoComposition extends Composition {
    hasAlpha: boolean;
    sequences: Array<VideoSequence>;
    private staticTimeRanges;
    private staticTimeRangeUpdated;
    type(): CompositionType;
    getStaticTimeRanges(): Array<TimeRange>;
    updateStaticTimeRanges(): void;
    hasImageContent(): boolean;
    verify(): boolean;
}
