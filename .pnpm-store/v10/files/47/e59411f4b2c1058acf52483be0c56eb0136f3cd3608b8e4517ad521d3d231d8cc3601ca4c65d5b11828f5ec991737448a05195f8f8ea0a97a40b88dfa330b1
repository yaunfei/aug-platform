import { TagCode } from './types';
import { ByteArray } from './utils/byte-array';
import { Keyframe } from '../base/keyframe';
export declare const enum AttributeType {
    Value = 0,
    FixedValue = 1,
    SimpleProperty = 2,
    DiscreteProperty = 3,
    MultiDimensionProperty = 4,
    SpatialProperty = 5,
    BitFlag = 6,
    Custom = 7
}
export interface AttributeFlag {
    /**
     * Indicates whether or not this value is exist.
     */
    exist: boolean;
    /**
     * Indicates whether or not the size of this property's keyframes is greater than zero.
     */
    animatable: boolean;
    /**
     * Indicates whether or not this property has spatial values.
     */
    hasSpatial: boolean;
}
export declare const readTagBlock: <T>(byteArray: ByteArray, parameter: T, blockConfig: BlockConfig) => T;
export declare class BlockConfig {
    tagCode: TagCode;
    configs: Array<BaseAttribute>;
    constructor(tagCode: TagCode);
}
export declare class BaseAttribute {
    attributeType: AttributeType;
    defaultValue: any;
    key: string;
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(_byteArray: ByteArray, _flag: AttributeFlag, _targetClass: object, _target: string): void;
    readValue(_byteArray: ByteArray): any;
    readValueList(_byteArray: ByteArray, _list: Array<any>, _count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<any>;
}
export declare const readAttribute: (byteArray: ByteArray, flag: AttributeFlag, targetClass: {
    [key: string]: any;
}, target: string, config: BaseAttribute) => void;
export declare const readProperty: <T>(byteArray: ByteArray, config: BaseAttribute, flag: AttributeFlag) => any;
export declare const readValue: (byteArray: ByteArray, config: BaseAttribute, flag: AttributeFlag) => any;
export declare const readAttributeFlag: (byteArray: ByteArray, config: BaseAttribute) => AttributeFlag;
export declare const readKeyframes: <T>(byteArray: ByteArray, config: BaseAttribute, flag: AttributeFlag) => Keyframe<T>[];
