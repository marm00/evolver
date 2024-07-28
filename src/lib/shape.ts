import { type Vector2 } from "./vector2";

// Architecture: decide on abstractions, compatible with pooling

interface Shape {
    /** The center position of the shape. */
    center: Vector2;
    /** The resulting `extents` represents the half-width and half-height of the bounding box that fully encloses the shape. */
    getAABB(): Vector2;
    /** Broad collision check: returns true if the given point is inside the shape. */
    contains(point: Vector2): boolean;
    /** Broad collision check: returns true if the given shape intersects with this shape. */
    intersects(shape: Shape): boolean;
    
    // TODO: SAT collision support for narrow phase
    getVertices(): Vector2[];
    getNormals(): Vector2[];
}