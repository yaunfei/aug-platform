import { Color } from '../base/color';
import { Composition } from '../base/composition';
import { Keyframe } from '../base/keyframe';
import { Layer } from '../base/layer';
import { Point } from '../base/point';
import { Ratio } from '../base/ratio';
import { AttributeFlag, AttributeType, BaseAttribute } from './attribute-helper';
import { ByteArray } from './utils/byte-array';
export interface BaseAttributeConfig<T> {
    newKeyframe: (flag: AttributeFlag) => Keyframe<T>;
}
export declare class FloatAttributeConfig extends BaseAttribute implements BaseAttributeConfig<number> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): number;
    readValueList(byteArray: ByteArray, list: Array<number>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<number>;
}
export declare class BOOLAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Boolean> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): boolean;
    readValueList(byteArray: ByteArray, list: Array<boolean>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<boolean>;
}
export declare class Uint8AttributeConfig extends BaseAttribute implements BaseAttributeConfig<number> {
    constructor(key: string, attributeType: AttributeType, defaultValue: number);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): number;
    readValueList(byteArray: ByteArray, list: Array<number>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<number>;
}
export declare class AttributeConfigUint32 extends BaseAttribute implements BaseAttributeConfig<number> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): number;
    readValueList(byteArray: ByteArray, list: Array<number>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<number>;
}
export declare class TimeAttributeConfig extends BaseAttribute implements BaseAttributeConfig<number> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): number;
    readValueList(byteArray: ByteArray, list: Array<number>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<number>;
}
export declare class PointAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Point> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): Point;
    readValueList(byteArray: ByteArray, list: Array<Point>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<Point>;
}
export declare class ColorAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Color> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): Color;
    readValueList(byteArray: ByteArray, list: Array<Color>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<Color>;
}
export declare class RatioAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Ratio> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): Ratio;
    readValueList(byteArray: ByteArray, list: Array<Ratio>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<Ratio>;
}
export declare class StringAttributeConfig extends BaseAttribute implements BaseAttributeConfig<string> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): string;
    readValueList(byteArray: ByteArray, list: Array<string>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<string>;
}
export declare class LayerAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Layer> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): Layer;
    readValueList(byteArray: ByteArray, list: Array<Layer>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<Layer>;
}
export declare class CompositionAttributeConfig extends BaseAttribute implements BaseAttributeConfig<Composition> {
    constructor(key: string, attributeType: AttributeType, defaultValue: any);
    readAttribute(byteArray: ByteArray, flag: AttributeFlag, targetClass: object, target: string): void;
    readValue(byteArray: ByteArray): Composition;
    readValueList(byteArray: ByteArray, list: Array<Composition>, count: number): void;
    dimensionality(): number;
    newKeyframe(_flag: AttributeFlag): Keyframe<Composition>;
}
