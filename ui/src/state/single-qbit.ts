import {
    normalize,
    complexAbs,
    complexArg,
    complexMul,
    type Complex,
    expi,
} from "../math";
export class SingleQbitState {
    #globalPhase: number;
    #localPhase: number;

    #computationalCoefficients: [Complex, Complex];

    constructor(coeffs: [Complex, Complex]) {
        const [a, b] = normalize(coeffs);

        const phaseA = complexArg(a);
        const phaseB = complexArg(b);

        this.#globalPhase = phaseA;
        this.#localPhase = phaseB - phaseA;

        this.#computationalCoefficients = [a, b];
    }

    get computationalCoefficients(): [Complex, Complex] {
        return this.#computationalCoefficients;
    }

    set computationalCoefficients(v: [Complex, Complex]) {
        const [a, b] = normalize(v);

        const phaseA = complexArg(a);
        const phaseB = complexArg(b);

        this.#globalPhase = phaseA;
        this.#localPhase = phaseB - phaseA;

        this.#computationalCoefficients = [a, b];
    }

    get globalPhase(): number {
        return this.#globalPhase;
    }

    set globalPhase(phi: number) {
        this.#globalPhase = phi;
        this.#rebuildFromPhases();
    }

    get localPhase(): number {
        return this.#localPhase;
    }

    set localPhase(phi: number) {
        this.#localPhase = phi;
        this.#rebuildFromPhases();
    }

    #rebuildFromPhases() {
        const [a, b] = this.#computationalCoefficients;

        const magA = complexAbs(a);
        const magB = complexAbs(b);

        const global = expi(this.#globalPhase);
        const local = expi(this.#localPhase);

        const newA = complexMul({ re: magA, im: 0 }, global);
        const newB = complexMul({ re: magB, im: 0 }, complexMul(global, local));

        this.#computationalCoefficients = [newA, newB];
    }
}
