import { Composition } from './base/composition';
import { TimeRange } from './base/time-range';
export declare class PAGFile {
    static fromArrayBuffer(arrayBuffer: ArrayBuffer): PAGFile;
    tagLevel: number;
    mainComposition: Composition;
    compositions: Array<Composition>;
    numLayers: number;
    duration: number;
    implDuration: number;
    scaledTimeRange: TimeRange;
    constructor(compositions: Array<Composition>, tagLevel: number);
    getVideoSequence(): import("./base/video-sequence").VideoSequence;
}
