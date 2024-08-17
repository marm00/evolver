export interface _Math {
    /** The mathematical constant τ (tau) or 2 * π (two pi). */
    readonly TAU: number;

    /** The mathematical constant π/2 (pi over 2). */
    readonly HALF_PI: number;

    /** The conversion factor from degrees to radians as the mathemetical constant π/180 (pi over 180). */
    readonly DEG_TO_RAD: number;

    /** The conversion factor from radians to degrees as the mathemetical constant 180/π (180 over pi). */
    readonly RAD_TO_DEG: number;

    /** The gravitational constant (G). */
    readonly GRAVITY: number;

    /** 
     * Returns the angle of the numeric argument in radians.
     * 
     * @param degrees A numeric expression representing the angle in radians.
     */
    degToRad(degrees: number): number;

    /** 
     * Returns the angle of the numeric argument in degrees.
     * 
     * @param radians A numeric expression representing the angle in degrees.
     */
    radToDeg(radians: number): number;

    /** 
     * Clamps the value between the supplied min and max bounds.
     * 
     * @param value A numeric expression.
     * @param min The minimum value to clamp the expression to.
     * @param max The maximum value to clamp the expression to.
     */
    clamp(value: number, min: number, max: number): number;

    /**
     * Linearly interpolates ([lerp](https://en.wikipedia.org/wiki/Linear_interpolation)) precisely between two values, unclamped.
     * 
     * @param a The start or initial value.
     * @param b The end or final value.
     * @param t The interpolation factor or time value, between 0 and 1.
     * @returns The interpolated value between `a` and `b`.
     */
    lerp(a: number, b: number, t: number): number;

    /**
     * Inversely linearly interpolates ({@link _Math.lerp}) the given value between the given start and end values, unclamped.
     * 
     * @param a The start or initial value.
     * @param b The end or final value.
     * @param v The value between `a` and `b`.
     * @returns The interpolation factor or time value, based on the position of `v` between `a` and `b`.
     */
    inverseLerp(a: number, b: number, v: number): number;

    /**
     * Remaps the given value from the range of `fromMin` to `fromMax` to the range of `toMin` to `toMax`.
     * Uses {@link _Math.lerp} to interpolate between `to` with interpolation factor *t* as {@link _Math.inverseLerp} of `from`.
     * 
     * @param fromMin The start or initial value of `from`.
     * @param fromMax The end or final value of `from`.
     * @param toMin The start or initial value of `to`.
     * @param toMax The end or final value of `to`.
     * @param value The value to remap.
     * @returns The interpolated value between `toMin` and `toMax` with interpolation factor *t* as inverse lerp of `from`.
     */
    remap(fromMin: number, fromMax: number, toMin: number, toMax: number, value: number): number;

    /** Returns the power of 2 of the given number. */
    pow2(x: number): number;

    /** Cubic ease-out function. */
    easeOutCubic(x: number): number;
    /** Quadratic ease-out function. */
    easeOutQuad(x: number): number;
    /** Exponential ease-out function. */
    easeOutExpo(x: number): number;
    /** Circular ease-out function. */
    easeOutCirc(x: number): number;
    /** Quartic ease-out function. */
    easeOutQuart(x: number): number;
    /** Back ease-out function. */
    easeOutBack(x: number): number;
    /** Cubic ease-in-out function. */
    easeInOutCubic(x: number): number;
}

/** An object that provides additional mathematics functionality and constants beyond the built-in {@link Math} object. */
export const _Math: _Math = {
    TAU: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    GRAVITY: 9.81,
    degToRad(degrees: number): number {
        return degrees * this.DEG_TO_RAD;
    },
    radToDeg(radians: number): number {
        return radians * this.RAD_TO_DEG;
    },
    clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    },
    lerp(a: number, b: number, t: number): number {
        return (1 - t) * a + b * t;
    },
    inverseLerp(a: number, b: number, v: number): number {
        return a === b ? 0 : (v - a) / (b - a);
    },
    remap(fromMin: number, fromMax: number, toMin: number, toMax: number, value: number): number {
        return this.lerp(toMin, toMax, this.inverseLerp(fromMin, fromMax, value));
    },
    pow2(x: number): number {
        return Math.pow(x, 2);
    },
    easeOutCubic(x: number): number {
        return 1 - Math.pow(1 - x, 3);
    },
    easeOutQuad(x: number): number {
        return 1 - (1 - x) * (1 - x);
    },
    easeOutExpo(x: number): number {
        return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    },
    easeOutCirc(x: number): number {
        return Math.sqrt(1 - Math.pow(x - 1, 2));
    },
    easeOutQuart(x: number): number {
        return 1 - Math.pow(1 - x, 4);
    },
    easeOutBack(x: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;

        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    easeInOutCubic(x: number): number {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
};
