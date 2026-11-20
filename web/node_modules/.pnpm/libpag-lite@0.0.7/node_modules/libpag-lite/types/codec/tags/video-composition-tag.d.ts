import { VideoComposition } from '../../base/video-composition';
import { TagCode } from '../types';
import { ByteArray } from '../utils/byte-array';
export declare const readVideoComposition: (byteArray: ByteArray) => VideoComposition;
export declare const ReadTagsOfVideoComposition: (byteArray: ByteArray, code: TagCode, parameter: {
    composition: VideoComposition;
    hasAlpha: boolean;
}) => void;
