
export class Gate {
    #latexString: string;
    set latexString(newValue: string) {
        this.#latexString = this.#latexString;
        //
    }

    svg: SVGElement; // store the MathJax
    bitmapBuffer: ImageBitmap; // so we don't have to re-rasterize on every update, just on change to the scale.
}