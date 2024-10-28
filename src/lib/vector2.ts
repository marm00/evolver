import { type Resettable } from "./pool";
import { Matrix3 } from "./matrix3";
import { _Math } from "./mathUtils";
import { Matrix2 } from "./matrix2";


/**
 * A vector class representing a point in 2D space.
 */
export class Vector2 implements Resettable {
    /** Cartesian x-coordinate. */
    x: number;
    /** Cartesian y-coordinate. */
    y: number;

    /** Constructs a new vector in 2D space (zero by default). */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /** Returns a new zero vector. */
    static zero(this: void): Vector2 {
        return new Vector2(0, 0);
    }

    /** Returns a new Cartesian vector based on the given direction/angle in radians and magnitude. */
    static fromPolar(direction: number, magnitude = 1): Vector2 {
        return new Vector2(Math.cos(direction) * magnitude, Math.sin(direction) * magnitude);
    }

    /** Turns the vector into a zero vector. */
    reset(): void {
        this.x = 0;
        this.y = 0;
    }

    /** Returns a new vector with the same coordinates. */
    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    /** Copies the coordinates from the given vector into this vector. */
    copy(v: Vector2): this {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    /** Sets the cartesian coordinates of the vector. */
    set(x: number, y: number): this {
        this.x = x;
        this.y = y;
        return this;
    }

    /** Sets the length of the vector via normalization and scaling. */
    setLen(length: number): this {
        return this.norm().scale(length);
    }

    /** 
     * Sets the coordinates of the vector from polar coordinates. 
     * 
     * @param direction The direction or angle in radians.
     * @param magnitude The {@link Vector2.len} or length of the vector.
     */
    setPolar(direction: number, magnitude = 1): this {
        this.x = Math.cos(direction) * magnitude;
        this.y = Math.sin(direction) * magnitude;
        return this;
    }

    /** Applies a {@link Matrix2} transformation to the vector, transforming this direction by the matrix. */
    matmul2(m: Matrix2): this {
        const x = this.x, y = this.y;
        const a = m.elements;
        this.x = a[0]! * x + a[2]! * y;
        this.y = a[1]! * x + a[3]! * y;
        return this;
    }

    /** Applies a {@link Matrix3} transformation to the vector, transforming this direction by the matrix. */
    matmul3(m: Matrix3): this {
        const x = this.x, y = this.y;
        const a = m.elements;
        this.x = a[0]! * x + a[1]! * y + a[2]!;
        this.y = a[3]! * x + a[4]! * y + a[5]!;
        return this;
    }

    /** Element-wise addition. Visually duplicates B tail onto A head (and vice versa) to form an intersection (sum by parallelogram law). */
    add(v: Vector2): this {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    /** Element-wise subtraction. Difference is equivalent to {@link Vector2.add} with the second vector negated. */
    sub(v: Vector2): this {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    /** Element-wise multiplication resulting in the Hadamard product. */
    mul(v: Vector2): this {
        this.x *= v.x;
        this.y *= v.y;
        return this;
    }

    /** Element-wise division resulting in the inverse Hadamard product of {@link Vector2.mul}. */
    div(v: Vector2): this {
        this.x /= v.x;
        this.y /= v.y;
        return this;
    }

    /** 
     * Dot or scalar product of vectors. Both normalized: 0 = orthoganal or perpendicular, 1 = parallel, -1 = anti-parallel. 
     * Perpendicularly projects vector B onto vector A, resulting in the extended coordinate along the direction of vector A.
     * This example only certainly works when one of the vectors is normalized, because it gets scaled otherwise.
     */
    dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * The determinant or 2D cross product returns a scalar unlike a vector in 3D, If `this` vector is on the right-hand side of vector `v`,
     * the cross product will be negative, left-hand = positive. Parallel/anti-parallel vectors have a zero cross product. Returns 0 if a zero
     * vector is given, since there is no meaningful area and the vectors are (anti-)parallel in a way.
     */
    detNorm(v: Vector2): number {
        /** Magnitude as the sine demonimator. */
        const denominator = Math.sqrt(this.lenSq() * v.lenSq());

        // Return 0 in case of zero vector(s).
        if (denominator === 0) {
            return 0;
        }

        // Normalize and return the determinant or signed area.
        return (this.x * v.y - this.y * v.x) / denominator;
    }

    /** 
    * The determinant or 2D cross product returns a scalar unlike a vector in 3D, representing the signed area for normalized vectors.
    * Variant of {@link Vector2.detNorm} that processes the vectors 'as is' and therefore does not normalize. Given two normalized 
    * vectors, the determinant is the signed area of the parallelogram formed by the vectors equal to sin(theta). 
    */
    det(v: Vector2): number {
        return this.x * v.y - this.y * v.x;
    }

    /** Normalizes the vector to have a magnitude of 1 (unit or direction vector). Zero vectors are ignored. */
    norm(): this {
        const length = this.len();
        if (length > 0) {
            this.x /= length;
            this.y /= length;
        }
        return this;
    }

    /** Multiplies the vector by a scalar, resulting in a vector with the same (or negated) direction but different magnitude. */
    scale(scalar: number): this {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    /** Divides the vector by a scalar, resulting in a vector with the same (or negated) direction but different magnitude. */
    invScale(scalar: number): this {
        return this.scale(1 / scalar);
    }

    /** Rotates the vector direction by the given angle in radians around the origin. */
    rot(angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x, y = this.y;
        this.x = x * cos - y * sin;
        this.y = x * sin + y * cos;
        return this;
    }

    /** 
     * Rotates the vector by the given angle around the given vector.
     *  
     * @param v The vector to rotate around.
     * @param angle The angle in radians to rotate by.
     */
    rotAround(v: Vector2, angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        this.x = dx * cos - dy * sin;
        this.y = dx * sin + dy * cos;
        return this;
    }

    /** Rotates the vector 90 degrees clockwise. */
    rot90(): this {
        const x = this.x;
        this.x = this.y;
        this.y = -x;
        return this;
    }

    /** Rotates the vector 90 degrees counterclockwise. */
    rot90Counter(): this {
        const x = this.x;
        this.x = -this.y;
        this.y = x;
        return this;
    }

    /** Squared magnitude from this to the given vector. */
    distToSq(v: Vector2): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    /** Magnitude from this to the given vector. */
    distTo(v: Vector2): number {
        return Math.sqrt(this.distToSq(v));
    }

    /** Manhatten magnitude from this to the given vector. */
    distToMD(v: Vector2): number {
        return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
    }

    /** 
     * Incremental linear interpolation, resulting in a vector between this and the given vector at the given time, unclamped.
     * 
     * @param v The vector to interpolate towards.
     * @param t The time value or scalar, between 0 and 1, representing the interpolation progress.
     */
    lerp(v: Vector2, t: number): this {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    /** 
     * Incremental linear interpolation, resulting in a vector between v1 and v2 at the given time, unclamped.
     * 
     * @param v1 The first vector where t = 0.
     * @param v2 The second vector to interpolate towards where t = 1.
     * @param t The time value or scalar, between 0 and 1, representing the interpolation progress.
     */
    lerpVectors(v1: Vector2, v2: Vector2, t: number): this {
        this.x = v1.x + (v2.x - v1.x) * t;
        this.y = v1.y + (v2.y - v1.y) * t;
        return this;
    }

    /** Squared magnitude or Euclidean distance from the origin (Pythagorean theorem). */
    lenSq(): number {
        return this.x * this.x + this.y * this.y;
    }

    /** Magnitude or Euclidean distance from the origin (Pythagorean theorem). */
    len(): number {
        return Math.sqrt(this.lenSq());
    }

    /** Returns the Manhatten distance from the origin (sum of the absolute values of the coordinates). */
    lenMD(): number {
        return Math.abs(this.x) + Math.abs(this.y);
    }

    /** Direction or angle of the vector in radians. Normalized to the range [0, 2π]. */
    dir(): number {
        return Math.atan2(-this.y, -this.x) + Math.PI;  
    }

    /** 
     * Direction or angle of the vector in radians from this to the given vector. Returns {@link _Math.TAU} radians (or 0 or 360 degrees) 
     * if a zero vector is given. Automatically normalizes and clamps the dot product for a meaningful acosine result. 
     */
    dirToNorm(v: Vector2): number {
        /** Magnitude as the cosine denominator. */
        const denominator = Math.sqrt(this.lenSq() * v.lenSq());

        // Treat zero vectors as having the default direction (tau radians or 0 or 360 degrees), preventing further null checks.
        if (denominator === 0) {
            return _Math.TAU;
        }

        /** Angle between the two normalized vectors. */
        const theta = this.dot(v) / denominator;

        /** Normalized and clamped dot product. Cosine clamped to the range [-1, 1] to handle floating point errors. */
        const clampedTheta = _Math.clamp(theta, -1, 1);

        // Return the angle in radians.
        return Math.acos(clampedTheta);
    }

    /** 
     * Direction or angle of the vector in radians from this to the given vector.
     * Variant of {@link Vector2.dirToNorm} that assumes the vectors are normalized (and therefore does not normalize). 
     */
    dirTo(v: Vector2): number {
        return Math.acos(_Math.clamp(this.dot(v), -1, 1));
    }

    /** Sets this vector to the normalized direction from this vector to the given vector. */
    dirVectorTo(v: Vector2): this {
        return this.sub(v).norm();
    }

    /** Clamps the vector to the given vector. */
    clamp(v: Vector2): this {
        this.x = Math.max(-v.x, Math.min(v.x, this.x));
        this.y = Math.max(-v.y, Math.min(v.y, this.y));
        return this;
    }

    /** Reverses the direction of the vector. */
    neg() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    /** Polar coordinates of the vector. */
    polar(): { direction: number, magnitude: number } {
        return { direction: this.dir(), magnitude: this.len() };
    }

    /** Returns true if the vector has the same coordinates as the given vector. */
    isEq(v: Vector2): boolean {
        return this.x === v.x && this.y === v.y;
    }

    /** Returns true if the vector is a zero vector (both components are zero). */
    isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }
}