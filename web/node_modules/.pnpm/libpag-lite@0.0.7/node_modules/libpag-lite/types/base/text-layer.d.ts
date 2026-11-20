import { Layer, LayerType } from './layer';
import { Property } from './property';
import { TextDocument } from './text-document';
import { TextMoreOptions } from './text/text-more-options';
import { TextPathOptions } from './text/text-path-options';
import { TimeRange } from './time-range';
export declare class TextLayer extends Layer {
    sourceText: Property<TextDocument> | undefined;
    pathOption: TextPathOptions | undefined;
    moreOption: TextMoreOptions | undefined;
    type(): LayerType;
    excludeVaryingRanges(_timeRanges: Array<TimeRange>): void;
    gotoFrame(_time: number): void;
    verify(): boolean;
}
