import { TagCode } from '../types';
import type { Context } from '../context';
import type { ByteArray } from '../utils/byte-array';
export declare function readTagsOfFile(byteArray: ByteArray, code: TagCode, context: Context): void;
