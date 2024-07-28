import { Pool, type Resettable } from "./pool";
import { Vector2 } from "./vector2";

export abstract class Shape implements Resettable {
    /** The center position of the shape. */
    center: Vector2;
    /** The `extents` represents the half-width and half-height of the bounding box that fully encloses the shape. */
    extents: Vector2;

    /** 
     * Constructs a new shape with the given center and extents. 
     * 
     * @param center The center position of the shape.
     * @param extents The half-width and half-height of the bounding box that fully encloses the shape.
     */
    constructor(center: Vector2, extents: Vector2) {
        this.center = center;
        this.extents = extents;
    }

    reset(): void {
        this.center.reset();
        this.extents.reset();
    }

    /** Broad collision check: returns true if the given point is inside the shape. */
    aabbContains(point: Vector2): boolean {
        return (Math.abs(this.center.x - point.x) <= this.extents.x) &&
            (Math.abs(this.center.y - point.y) <= this.extents.y);
    }

    /** Broad collision check: returns true if the given shape intersects with this shape. */
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

    constructor(center: Vector2, width: number, height: number) {
        super(center, new Vector2(width / 2, height / 2));
        this.width = width;
        this.height = height;
    }

    static zero(this: void): Rect {
        return new Rect(Vector2.zero(), 0, 0);
    }

    reset(): void {
        super.reset();
        this.width = 0;
        this.height = 0;
    }
}

/** Oriented rectangle. */
export class OrientedRect extends Shape {
    width: number;
    height: number;
    direction: number;

    constructor(center: Vector2, width: number, height: number, direction: number) {
        const maxExtents = Math.max(width, height) / 2;
        super(center, new Vector2(maxExtents, maxExtents));
        this.width = width;
        this.height = height;
        this.direction = direction;
    }

    static zero(this: void): OrientedRect {
        return new OrientedRect(Vector2.zero(), 0, 0, 0);
    }

    reset(): void {
        super.reset();
        this.width = 0;
        this.height = 0;
        this.direction = 0;
    }
}

export class Circle extends Shape {
    radius: number;

    constructor(center: Vector2, radius: number) {
        super(center, new Vector2(radius, radius));
        this.radius = radius;
    }

    static zero(this: void): Circle {
        return new Circle(Vector2.zero(), 0);
    }

    reset(): void {
        super.reset();
        this.radius = 0;
    }

    radialIntersects(point: Vector2): boolean {
        return this.center.distanceToSquared(point) <= (this.radius * this.radius);
    }

}