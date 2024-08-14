import { _Math } from "./mathUtils";
import { Matrix2 } from "./matrix2";
import { Vector2 } from "./vector2";

// Using classes over objects for better memory management (*n* method definitions vs prototype)


export class Spear {
    center: Vector2;
    vertices: [Vector2, Vector2, Vector2, Vector2];
    axes: [Vector2, Vector2];
    rotationMatrix: Matrix2;

    velocity: Vector2;
    lifetime: number;
    // acceleration: Vector2;
    // sprite: HTMLImageElement | null;

    constructor(cx: number, cy: number, halfWidth: number, halfHeight: number, rotation: number, vx: number, vy: number, lifetime: number) {
        this.center = new Vector2(cx, cy);
        this.velocity = new Vector2(vx, vy);
        this.lifetime = lifetime;
        const center = this.center;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        this.rotationMatrix = new Matrix2(
            cos, sin,  // col 1
            -sin, cos, // col 2
        );;
        const m = this.rotationMatrix;
        this.vertices = [
            new Vector2(-halfWidth, halfHeight).matmul2(m).add(center),
            new Vector2(halfWidth, -halfHeight).matmul2(m).add(center),
            new Vector2(halfWidth, halfHeight).matmul2(m).add(center),
            new Vector2(-halfWidth, halfHeight).matmul2(m).add(center)
        ];
        this.axes = [
            new Vector2(cos, sin),
            new Vector2(cos + _Math.HALF_PI, sin + _Math.HALF_PI)
        ];
    }

    set(cx: number, cy: number, halfWidth: number, halfHeight: number, rotation: number, vx: number, vy: number, lifetime: number): this {
        this.center.set(cx, cy);
        this.velocity.set(vx, vy);
        this.lifetime = lifetime;
        const center = this.center;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const m = this.rotationMatrix;
        m.set(
            cos, sin,  // col 1
            -sin, cos, // col 2
        );
        const v = this.vertices;
        v[0].set(-halfWidth, halfHeight).matmul2(m).add(center);
        v[1].set(halfWidth, -halfHeight).matmul2(m).add(center);
        v[2].set(halfWidth, halfHeight).matmul2(m).add(center);
        v[3].set(-halfWidth, halfHeight).matmul2(m).add(center);
        const a = this.axes;
        a[0].set(cos, sin);
        a[1].set(cos + _Math.HALF_PI, sin + _Math.HALF_PI);
        return this;
    }

}

// TODO: circular object: meteorite
class Meteorite {
    center: Vector2;
    radius: number;
    radiusSqr: number;

    // lifetime: number; // TODO: this is not directly relevant for Meteorite

    constructor(center: Vector2, radius: number) {
        this.center = center;
        this.radius = radius;
        this.radiusSqr = radius * radius;
    }

    set(center: Vector2, radius: number): this {
        this.center = center;
        this.radius = radius;
        this.radiusSqr = radius * radius;
        return this;
    }

}

// TODO: AABB object: icicle
// class Icicle {
//     center: Vector2;
//     halfWidth: number;
//     halfHeight: number;

// }