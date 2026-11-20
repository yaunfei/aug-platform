import { TagCode } from '../types';
import type { ByteArray } from '../utils/byte-array';
export interface TagHeader {
    code: TagCode;
    length: number;
}
export declare const readTagHeader: (byteBuffer: ByteArray) => TagHeader;
export declare function readTags<T>(byteArray: ByteArray, parameter: T, reader: Function): void;
