import { ByteData } from './byte-data';
import { Sequence } from './sequence';
import { TimeRange } from './time-range';
import { VideoFrame } from './video-frame';
export declare class VideoSequence extends Sequence {
    alphaStartX: number;
    alphaStartY: number;
    frames: Array<VideoFrame>;
    headers: Array<ByteData>;
    staticTimeRanges: Array<TimeRange>;
    verify(): boolean;
    getVideoWidth(): number;
    getVideoHeight(): number;
}
