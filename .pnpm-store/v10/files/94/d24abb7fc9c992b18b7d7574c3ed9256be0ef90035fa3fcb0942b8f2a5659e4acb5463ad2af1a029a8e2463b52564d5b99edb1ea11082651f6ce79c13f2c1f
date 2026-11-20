import { ByteArray } from './codec/utils/byte-array';
import { Composition } from './base/composition';
export declare const verifyAndMake: (compositions: Array<Composition>) => void;
/**
 * 将Layer里面的compositionID标识换成真正的Composition
 */
export declare function installReference(compositions: Array<Composition>): void;
export declare class PAGCodec {
    static maxSupportedTagLevel(): number;
}
/**
 * Decode PAG File from bytes
 */
export declare const decode: (byteArray: ByteArray) => {
    compositions: Composition[];
    tagLevel: number;
};
export declare const readBodyBytes: (byteArray: ByteArray) => ByteArray;
