import { TimeRange } from './time-range';
import { VectorComposition } from './vector-composition';
import { Ratio } from './ratio';
import { BlendMode } from '../constant';
import { Transform2D } from './transform-2d';
import { Property } from './property';
import { Mask } from './mask';
import { Effect } from './effects/effect';
import { Point } from './point';
export declare const enum LayerStyleType {
    Unknown = 0,
    DropShadow = 1,
    Stroke = 2
}
export declare class LayerStyle {
    type(): LayerStyleType;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
export declare const enum TrackMatteType {
    None = 0,
    Alpha = 1,
    AlphaInverted = 2,
    Luma = 3,
    LumaInverted = 4
}
export declare const enum LayerType {
    Unknown = 0,
    undefined = 1,
    Solid = 2,
    Text = 3,
    Shape = 4,
    Image = 5,
    PreCompose = 6
}
export declare class Layer {
    /**
     * Te id of the layer.
     */
    id: number;
    /**
     * The parent of this layer.
     */
    parent: Layer | undefined;
    containingComposition: VectorComposition | undefined;
    /**
     * The time stretch percentage of the layer.
     */
    stretch: Ratio;
    /**
     * The start time of the layer, indicates the start position of the visible range. It could be a negative value.
     */
    startTime: number;
    /**
     * The duration of the layer, indicates the length of the visible range.
     */
    duration: number;
    /**
     * When true, the layer' automatic orientation is enabled.
     */
    autoOrientation: boolean;
    /**
     * The transformation of the layer.
     */
    transform: Transform2D | undefined;
    /**
     * When false, the layer should be skipped during the rendering loop.
     */
    isActive: boolean;
    /**
     * The blending mode of the layer.
     */
    blendMode: BlendMode;
    /**
     * If layer has a track matte, specifies the way it is applied.
     */
    trackMatteType: TrackMatteType;
    trackMatteLayer: Layer | undefined;
    timeRemap: Property<number> | undefined;
    masks: Array<Mask> | undefined;
    effects: Array<Effect> | undefined;
    layerStyles: Array<LayerStyle> | undefined;
    layerCache: Cache | undefined;
    private maxScale;
    type(): LayerType;
    excludeVaryingRanges(timeRanges: Array<TimeRange>): void;
    gotoFrame(frame: number): void;
    verify(): boolean;
    getMaxScaleFactor(): Point;
}
