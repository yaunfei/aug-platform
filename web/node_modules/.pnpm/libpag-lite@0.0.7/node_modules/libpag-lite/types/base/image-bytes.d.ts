export declare class ImageBytes {
    /**
     * A unique identifier for this image bytes.
     */
    id: number;
    /**
     * The width of the image. It is set when the image is stripped of its transparent border,
     * otherwise the value would be 0.
     */
    width: number;
    /**
     * The height of the image. It is set when the image is stripped of its transparent border,
     * otherwise the value would be 0.
     */
    height: number;
    /**
     * The anchor x of the image. It is set when the image is stripped of its transparent border.
     */
    anchorX: number;
    /**
     * The anchor y of the image. It is set when the image is stripped of its transparent border.
     */
    anchorY: number;
    /**
     * The scale factor of image, ranges from 0.0 to 1.0.
     */
    scaleFactor: number;
    /**
     * The file data of this image bytes.
     */
    fileBytes: ArrayBuffer | undefined;
    cacheID: number;
    constructor();
    verify(): boolean;
}
