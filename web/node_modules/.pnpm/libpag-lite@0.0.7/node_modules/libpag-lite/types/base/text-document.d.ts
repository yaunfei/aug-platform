import { ParagraphJustification } from '../constant';
import { Color } from './color';
import { Point } from './point';
export declare class TextDocument {
    /**
     * When true, the text layer shows a fill.
     */
    applyFill: boolean;
    /**
     * When true, the text layer shows a stroke.
     */
    applyStroke: boolean;
    baselineShift: number;
    /**
     * When true, the text layer is paragraph (bounded) text.
     */
    boxText: boolean;
    boxTextPos: Point;
    /**
     * For box text, the pixel dimensions for the text bounds.
     */
    boxTextSize: Point;
    firstBaseLine: number;
    fauxBold: boolean;
    fauxItalic: boolean;
    /**
     * The text layer’s fill color.
     */
    fillColor: Color;
    /**
     * A string with the name of the font family.
     **/
    fontFamily: string;
    /**
     * A string with the style information — e.g., “bold”, “italic”.
     **/
    fontStyle: string;
    /**
     * The text layer’s font size in pixels.
     */
    fontSize: number;
    /**
     * The text layer’s stroke color.
     */
    strokeColor: Color;
    /**
     * Indicates the rendering order for the fill and stroke of a text layer.
     */
    strokeOverFill: boolean;
    /**
     * The text layer’s stroke thickness.
     */
    strokeWidth: number;
    /**
     * The text layer’s Source Text value.
     */
    text: string;
    /**
     * The paragraph justification for the text layer.
     */
    justification: ParagraphJustification;
    /**
     * The space between lines, 0 indicates 'auto', which is fontSize * 1.2
     */
    leading: number;
    /**
     * The text layer’s spacing between characters.
     */
    tracking: number;
}
