/**
 * A vector class representing a point in 2D space.
 */
export class Vector2 {
    /** cartesian x-coordinate. */
    x: number;
    /** cartesian y-coordinate. */
    y: number;

    /** Constructs a new vector in 2D space. */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
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

    /** Sets the coordinates of the vector from polar coordinates. */
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

    /** Dot or scalar product of vectors. Normalized: 0 = orthoganal or perpendicular, 1 = parallel, -1 = anti-parallel. */
    dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y;
    }

    /** Normalizes the vector to have a magnitude of 1 (unit or direction vector). */
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

    /** Rotates the vector direction by the given angle around the origin. */
    rotate(angle: number): this {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = this.x * cos - this.y * sin;
        const ny = this.x * sin + this.y * cos;
        this.x = nx;
        this.y = ny;
        return this;
    }

    /** Rotates the vector by the given angle around the given vector. */
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
    /** Incremental linear interpolation, resulting in a vector between this and the given vector at the given time. */
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

    /** Direction or angle of the vector in radians from this to the given vector. Returns 90 degrees if a zero vector is given. */
    directionTo(v: Vector2): number {
        /** Magnitude as the cosine denominator. */
        const denominator = Math.sqrt(this.magnitudeSquared() * v.magnitudeSquared());

        /** Treat zero vectors as having the default direction (90 degrees), preventing further null checks. */
        if (denominator === 0) {
            return Math.PI / 2;
        }

        /** Cosine of the angle between the two vectors. */
        const theta = this.dot(v) / denominator;

        /** Cosine clamped to the range [-1, 1] to handle floating point errors. */
        const clampedTheta = Math.max(-1, Math.min(1, theta));

        /** Return the angle in radians. */
        return Math.acos(clampedTheta);
    }

    /** Reverses the direction of the vector. */
    negate() {
        this.x = -this.x;
        this.y = -this.y;
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
}