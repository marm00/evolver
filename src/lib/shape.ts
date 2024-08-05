import { Matrix2 } from "./matrix2";
import { Matrix3 } from "./matrix3";
import { Pool, type Resettable } from "./pool";
import { Vector2 } from "./vector2";

type Vertices4 = [Vector2, Vector2, Vector2, Vector2];

/**
 * A shape is an object in 2D space, like a player hitbox (rectangle) or a projectile (circle).
 * 
 * @example
 * // Converting/transforming a vector in world space to the shape's local space
 * const matrixPool = new Pool<Matrix3>(Matrix3.identity);
 * const matrix = matrixPool.alloc();
 * const circle = new Circle(Vector2.zero(), Vector2.zero(), Vector2.zero(), 64);
 * const vector = new Vector2(0, 256);
 * const transformed = vector.matmul(matrix.setShape(circle));
 * // The transformed vector is 256 (y) units above the circle's center
 * matrixPool.free(matrix);
 */
export abstract class Shape implements Resettable {
    center: Vector2;
    /** Half-width (x) and half-height (y) of the bounding box that maximally encloses the shape. */
    extents: Vector2;
    /** Direction and speed (as magnitude) in pixels per second. */
    velocity: Vector2;
    /** Acceleration in pixels per second squared, used for physics like gravity. */
    acceleration: Vector2;

    /** Abstract constructor for a {@link Shape}. */
    constructor(center: Vector2, extents: Vector2, velocity: Vector2, acceleration: Vector2) {
        this.center = center;
        this.extents = extents;
        this.velocity = velocity;
        this.acceleration = acceleration;
    }

    /** Sets the given transformation matrix to the shape. */
    abstract setMatrix3(m: Matrix3): void;

    reset(): void {
        this.center.reset();
        this.extents.reset();
        this.velocity.reset();
        this.acceleration.reset();
    }

    /** Broad collision check: returns true if the given point is inside the AABB shape. See {@link extents}. */
    aabbContains(point: Vector2): boolean {
        return (Math.abs(this.center.x - point.x) <= this.extents.x) &&
            (Math.abs(this.center.y - point.y) <= this.extents.y);
    }

    /** Broad collision check: returns true if the given shape intersects with this AABB shape. See {@link extents}. */
    aabbIntersects(s: Shape): boolean {
        return (Math.abs(this.center.x - s.center.x) <= (this.extents.x + s.extents.x)) &&
            (Math.abs(this.center.y - s.center.y) <= (this.extents.y + s.extents.y));
    }

    // TODO: SAT collision support for narrow phase
    // abstract getVertices(): Vector2[];
    // abstract getNormals(): Vector2[];
}

/** Axis-aligned rectangle. */
export class Rect extends Shape {
    width: number;
    height: number;

    constructor(center: Vector2, velocity: Vector2, acceleration: Vector2, width: number, height: number) {
        super(center, new Vector2(width / 2, height / 2), velocity, acceleration);
        this.width = width;
        this.height = height;
    }

    static zero(this: void): Rect {
        return new Rect(Vector2.zero(), Vector2.zero(), Vector2.zero(), 0, 0);
    }

    reset(): void {
        super.reset();
        this.width = 0;
        this.height = 0;
    }

    setMatrix3(m: Matrix3): void {
        // TODO: scale or not?
        m.translate(this.center).scale(this.extents);
    }

    /** Updates the extents and dimensions. */
    setDimensions(width: number, height: number): this {
        this.extents.set(width / 2, height / 2);
        this.width = width;
        this.height = height;
        return this;
    }
}

/** Oriented rectangle. */
export class OrientedRect extends Shape {
    width: number;
    height: number;
    angle: number;
    rotationMatrix: Matrix2;
    vertices: Vertices4;

    constructor(center: Vector2, velocity: Vector2, acceleration: Vector2, width: number, height: number, angle: number) {
        const maxExtents = Math.max(width, height) / 2;
        super(center, new Vector2(maxExtents, maxExtents), velocity, acceleration);
        this.width = width;
        this.height = height;
        this.angle = angle;
        this.rotationMatrix = Matrix2.identity();
        this.vertices = [Vector2.zero(), Vector2.zero(), Vector2.zero(), Vector2.zero()];
    }

    static zero(this: void): OrientedRect {
        return new OrientedRect(Vector2.zero(), Vector2.zero(), Vector2.zero(), 0, 0, 0);
    }

    reset(): void {
        super.reset();
        this.width = 0;
        this.height = 0;
        this.angle = 0;
        this.rotationMatrix.reset();
        for (const v of this.vertices) {
            v.reset();
        }
    }

    setMatrix3(m: Matrix3): void {
        // TODO: scale or not?
        m.translate(this.center).rotate(this.angle).scale(this.extents);
    }

    /** Updates the extents and dimensions. */
    setDimensions(width: number, height: number, angle: number): this {
        const maxExtents = Math.max(width, height) / 2;
        this.extents.set(maxExtents, maxExtents);
        this.width = width;
        this.height = height;
        this.setAngle(angle);
        return this;
    }

    updateVertices(): void {
        const v = this.vertices, m = this.rotationMatrix, c = this.center;
        const halfWidth = this.width / 2, halfHeight = this.height / 2;
        const negHalfWidth = -halfWidth, negHalfHeight = -halfHeight;
        v[0].set(negHalfWidth, negHalfHeight).matmul2(m).add(c);
        v[1].set(halfWidth, negHalfHeight).matmul2(m).add(c);
        v[2].set(halfWidth, halfHeight).matmul2(m).add(c);
        v[3].set(negHalfWidth, halfHeight).matmul2(m).add(c);
    }

    setAngle(angle: number): this {
        this.angle = angle;
        this.rotationMatrix.setRotationAngle(angle);
        return this;
    }
}

export class Circle extends Shape {
    radius: number;

    constructor(center: Vector2, velocity: Vector2, acceleration: Vector2, radius: number) {
        super(center, new Vector2(radius, radius), velocity, acceleration);
        this.radius = radius;
    }

    static zero(this: void): Circle {
        return new Circle(Vector2.zero(), Vector2.zero(), Vector2.zero(), 0);
    }

    reset(): void {
        super.reset();
        this.radius = 0;
    }

    setMatrix3(m: Matrix3): void {
        // TODO: scale or not?
        m.translate(this.center).scale(this.extents);
    }

    /** Updates the extents and dimensions. */
    setDimensions(radius: number): this {
        this.extents.set(radius, radius);
        this.radius = radius;
        return this;
    }

    radialContains(point: Vector2): boolean {
        return this.center.distanceToSquared(point) <= (this.radius * this.radius);
    }

}

