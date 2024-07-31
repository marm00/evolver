import { type Resettable } from "./pool";
import { Matrix3 } from "./matrix3";


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
    setLength(length: number): this {
        return this.normalize().scale(length);
    }

    /** 
     * Sets the coordinates of the vector from polar coordinates. 
     * 
     * @param direction The direction or angle in radians.
     * @param magnitude The {@link Vector2.magnitude} or length of the vector.
     */
    setPolar(direction: number, magnitude = 1): this {
        this.x = Math.cos(direction) * magnitude;
        this.y = Math.sin(direction) * magnitude;
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
     * The 2D cross product returns a scalar unlike a vector in 3D. If this vector is on the right-hand side of vector v,
     * the cross product will be negative, left-hand = positive. Parallel/anti-parallel vectors have a zero cross product.
     */
    cross(v: Vector2): number {
        return this.x * v.y - this.y * v.x;
    }

    /** Normalizes the vector to have a magnitude of 1 (unit or direction vector). Zero vectors are ignored. */
    normalize(): this {
        const length = this.magnitude();
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
    scaleInverse(scalar: number): this {
        return this.scale(1 / scalar);
    }

    /** Rotates the vector direction by the given angle in radians around the origin. */
    rotate(angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = this.x * cos - this.y * sin;
        const ny = this.x * sin + this.y * cos;
        this.x = nx;
        this.y = ny;
        return this;
    }

    /** 
     * Rotates the vector by the given angle around the given vector.
     *  
     * @param v The vector to rotate around.
     * @param angle The angle in radians to rotate by.
     */
    rotateAround(v: Vector2, angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        this.x = dx * cos - dy * sin;
        this.y = dx * sin + dy * cos;
        return this;
    }

    /** Squared magnitude from this to the given vector. */
    distanceToSquared(v: Vector2): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }

    /** Magnitude from this to the given vector. */
    distanceTo(v: Vector2): number {
        return Math.sqrt(this.distanceToSquared(v));
    }

    /** Manhatten magnitude from this to the given vector. */
    distanceToManhattan(v: Vector2): number {
        return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
    }

    // TODO: Easing functions
    /** 
     * Incremental linear interpolation, resulting in a vector between this and the given vector at the given time. 
     * 
     * @param v The vector to interpolate towards.
     * @param t The time value or scalar, between 0 and 1, representing the interpolation progress.
     */
    lerp(v: Vector2, t: number): this {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    /** Squared magnitude or Euclidean distance from the origin (Pythagorean theorem). */
    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    /** Magnitude or Euclidean distance from the origin (Pythagorean theorem). */
    magnitude(): number {
        return Math.sqrt(this.magnitudeSquared());
    }

    /** Returns the Manhatten distance from the origin (sum of the absolute values of the coordinates). */
    magnitudeManhattan(): number {
        return Math.abs(this.x) + Math.abs(this.y);
    }

    /** Direction or angle of the vector in radians. */
    direction(): number {
        return Math.atan2(this.y, this.x);
    }

    /** Direction or angle of the vector in radians from this to the given vector. Returns 180 degrees if a zero vector is given. */
    directionTo(v: Vector2): number {
        /** Magnitude as the cosine denominator. */
        const denominator = Math.sqrt(this.magnitudeSquared() * v.magnitudeSquared());

        /** Treat zero vectors as having the default direction (180 degrees), preventing further null checks. */
        if (denominator === 0) {
            return Math.PI;
        }

        /** Cosine of the angle between the two vectors. */
        const theta = this.dot(v) / denominator;

        /** Cosine clamped to the range [-1, 1] to handle floating point errors. */
        const clampedTheta = Math.max(-1, Math.min(1, theta));

        /** Return the angle in radians. */
        return Math.acos(clampedTheta);
    }

    /** Sets this vector to the normalized direction from this vector to the given vector. */
    directionVectorTo(v: Vector2): this {
        return this.sub(v).normalize();
    }

    /** Reverses the direction of the vector. */
    negate() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    /** Applies a matrix transformation to the vector. */
    matmul(m: Matrix3): this {
        const x = this.x, y = this.y;
        const a = m.elements;
        this.x = a[0]! * x + a[1]! * y + a[2]!;
        this.y = a[3]! * x + a[4]! * y + a[5]!;
        return this;
    }

    /** Polar coordinates of the vector. */
    polar(): { direction: number, magnitude: number } {
        return { direction: this.direction(), magnitude: this.magnitude() };
    }

    /** Returns true if the vector has the same coordinates as the given vector. */
    equals(v: Vector2): boolean {
        return this.x === v.x && this.y === v.y;
    }

    /** Returns true if the vector is a zero vector (both components are zero). */
    isZero(): boolean {
        return this.x === 0 && this.y === 0;
    }
}