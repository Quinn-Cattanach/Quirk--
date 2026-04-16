export type Complex = {
    re: number;
    im: number;
};

export function complexAbs(z: Complex): number {
    return Math.hypot(z.re, z.im);
}

export function complexArg(z: Complex): number {
    return Math.atan2(z.im, z.re);
}

export function complexMul(a: Complex, b: Complex): Complex {
    return {
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re,
    };
}

export function expi(theta: number): Complex {
    return { re: Math.cos(theta), im: Math.sin(theta) };
}

export function normalize([a, b]: [Complex, Complex]): [Complex, Complex] {
    const norm = Math.sqrt(complexAbs(a) ** 2 + complexAbs(b) ** 2);
    if (norm === 0) throw new Error("Zero state");
    return [
        { re: a.re / norm, im: a.im / norm },
        { re: b.re / norm, im: b.im / norm },
    ];
}
