export interface _Math {
    /** The mathematical constant τ (tau) or 2 * π (two pi). */
    readonly TAU: number;
    /** The conversion factor from degrees to radians as the mathemetical constant π/180 (pi over 180). */
    readonly DEG_TO_RAD: number;
    /** The conversion factor from radians to degrees as the mathemetical constant 180/π (180 over pi). */
    readonly RAD_TO_DEG: number;
    /** 
     * Returns the angle of the numeric argument in radians.
     * @param degrees A numeric expression representing the angle in radians.
     */
    degToRad(degrees: number): number;
    /** 
     * Returns the angle of the numeric argument in degrees.
     * @param radians A numeric expression representing the angle in degrees.
     */
    radToDeg(radians: number): number;
}

export const _Math: _Math = {
    TAU: Math.PI * 2,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    degToRad(degrees: number): number {
        return degrees * this.DEG_TO_RAD;
    },
    radToDeg(radians: number): number {
        return radians * this.RAD_TO_DEG;
    }
};
