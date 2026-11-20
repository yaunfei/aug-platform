import { Layer } from '../../base/layer';
import { TagCode } from '../types';
import { ByteArray } from '../utils/byte-array';
export declare const readLayer: (byteArray: ByteArray) => Layer;
export declare const readTagsOfLayer: (byteArray: ByteArray, code: TagCode, layer: Layer) => void;
