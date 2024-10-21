import { _Math } from "./mathUtils";
import { Matrix2 } from "./matrix2";
import { Vector2 } from "./vector2";

// Using classes over objects for better memory management (*n* method definitions vs prototype)
// TODO: transform unsettable classes to objects?


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
            new Vector2(halfWidth, halfHeight).matmul2(m).add(center),
            new Vector2(halfWidth, -halfHeight).matmul2(m).add(center),
            new Vector2(-halfWidth, -halfHeight).matmul2(m).add(center)
        ];
        this.axes = [
            new Vector2(cos, sin),
            new Vector2(sin, -cos)
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
        v[1].set(halfWidth, halfHeight).matmul2(m).add(center);
        v[2].set(halfWidth, -halfHeight).matmul2(m).add(center);
        v[3].set(-halfWidth, -halfHeight).matmul2(m).add(center);
        const a = this.axes;
        a[0].set(cos, sin);
        a[1].set(sin, -cos);
        return this;
    }

}

export class Wall {
    center: Vector2;
    vertices: [Vector2, Vector2, Vector2, Vector2];
    axes: [Vector2, Vector2];
    halfExtents: Vector2;
    cos: number;
    sin: number;
    inverseRotation: Matrix2;
    rotation: Matrix2;
    halfWidth: number;
    halfHeight: number;

    constructor(cx: number, cy: number, halfWidth: number, halfHeight: number, rotation: number) {
        this.halfWidth = halfWidth;
        this.halfHeight = halfHeight;
        this.center = new Vector2(cx, cy);
        this.halfExtents = new Vector2(halfWidth, halfHeight);
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        this.cos = cos;
        this.sin = sin;
        this.vertices = [
            new Vector2(-halfWidth, halfHeight),
            new Vector2(halfWidth, halfHeight),
            new Vector2(halfWidth, -halfHeight),
            new Vector2(-halfWidth, -halfHeight)
        ];
        for (const v of this.vertices) {
            // TODO: use negation/flipping over matmul for all  
            const x = v.x, y = v.y;
            v.x = cx + x * cos + y * -sin;
            v.y = cy + x * sin + y * cos;
        }
        this.axes = [
            new Vector2(cos, sin),
            new Vector2(sin, -cos)
        ];
        this.rotation = new Matrix2(
            cos, sin,  // col 1
            -sin, cos, // col 2
        );;
        this.inverseRotation = new Matrix2(
            cos, -sin,  // col 1
            sin, cos, // col 2
        );;
    }
}

// TODO: create a polygon class (natural objects are convex obstacles not rectangular)
export class Obstacle {
    direction: Vector2;
    point: Vector2;
    next: Obstacle;
    prev: Obstacle;
    isConvex: boolean;

    constructor(direction: Vector2, point: Vector2, next: Obstacle, prev: Obstacle, isConvex: boolean) {
        this.direction = direction;
        this.point = point;
        this.next = next;
        this.prev = prev;
        this.isConvex = isConvex;
    }
}

export class Lion {
    center: Vector2;
    velocity: Vector2;
    prefVelocity: Vector2;
    radius: number;
    radiusSq: number;
    maxSpeed: number;
    maxSpeedSq: number;
    id: number;
    // velocityScalar: number;
    // acceleration: Vector2;
    // preferredVelocity: Vector2;
    // optimalVelocity: Vector2;
    // TODO: maximum speed and preferred velocity (not a velocity scalar)
    // ORCA wants position, radius, preferred velocity
    // Where the optimal of each disc is generally its current velocity,
    // with the exception of high density areas (estimates have to be made)
    // TODO: clean up lion class

    constructor(cx: number, cy: number, radius: number, maxSpeed: number) {
        this.center = new Vector2(cx, cy);
        this.velocity = new Vector2();
        this.prefVelocity = new Vector2();
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.maxSpeed = maxSpeed;
        this.maxSpeedSq = maxSpeed * maxSpeed;
        this.id = Math.random(); // TODO: better id generation
        // this.velocityScalar = velocityScalar;
        // this.acceleration = new Vector2();
        // this.preferredVelocity = new Vector2();
        // this.optimalVelocity = new Vector2();
    }

    set(cx: number, cy: number, radius: number, maxSpeed: number): this {
        this.center.set(cx, cy);
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.maxSpeed = maxSpeed;
        this.maxSpeedSq = maxSpeed * maxSpeed;
        // this.velocityScalar = velocityScalar;
        return this;
    }
}

export class Meteorite {
    // The meteor pathing should be straight and origin should be randomized
    // Acceleration should be used (gravity)
    // The size of the sprite should be the distance between the center and the target (higher distance = smaller)
    // TODO: The sprite should innately rotate around its center
    center: Vector2;
    origin: Vector2;
    target: Vector2;
    radius: number;
    // radiusSq: number;

    duration: number;
    lifetime: number;
    displayRadius: number;

    constructor(ox: number, oy: number, tx: number, ty: number, radius: number, duration: number, displayRadius: number) {
        this.center = new Vector2(ox, oy);
        this.origin = new Vector2(ox, oy);
        this.target = new Vector2(tx, ty);
        this.radius = radius;
        // this.radiusSq = radius * radius;
        this.duration = duration;
        this.lifetime = duration;
        this.displayRadius = displayRadius;
    }

    set(ox: number, oy: number, tx: number, ty: number, radius: number, duration: number, displayRadius: number): this {
        this.center.set(ox, oy);
        this.origin.set(ox, oy);
        this.target.set(tx, ty);
        this.radius = radius;
        // this.radiusSq = radius * radius;
        this.duration = duration;
        this.lifetime = duration;
        this.displayRadius = displayRadius;
        return this;
    }

}

export const RESOURCE_STATE = {
    /** The resource is not collected and checks the distance to the player. */
    Uncollected: 0,
    /** The resource is in an isotropic (rotation-invariant duration) jumping animation before moving towards the player. */
    Jumping: 1,
    /** The resource is moving towards the player with acceleration. */
    Collecting: 2,
} as const;

type ObjectValues<T> = T[keyof T];

type ResourceState = ObjectValues<typeof RESOURCE_STATE>;

export class Obsidian {
    center: Vector2;
    radius: number;
    radiusSq: number;
    displayRadius: number;
    resourceState: ResourceState;
    /** The target to jump to for an animation, before moving towards the player. */
    jump: Vector2;
    acceleration: number;

    constructor(cx: number, cy: number, radius: number, acceleration: number, displayRadius: number) {
        this.center = new Vector2(cx, cy);
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.displayRadius = displayRadius;
        this.resourceState = RESOURCE_STATE.Uncollected;
        this.jump = new Vector2(0, 0);
        this.acceleration = acceleration;
    }

    set(cx: number, cy: number, radius: number, acceleration: number, displayRadius: number): this {
        this.center.set(cx, cy);
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.displayRadius = displayRadius;
        this.resourceState = RESOURCE_STATE.Uncollected;
        this.jump.set(0, 0);
        this.acceleration = acceleration;
        return this;
    }
}

export class Thunderstorm {
    // The thunderstorm has 2 distinct positions: the center (shadow circle on the ground) and a Y offset (cloud)
    // The cloud exists for visual purposes only, and is the origin for lightning strikes onto the shadow circle or center
    // The center chases the player
    // TODO: periodically make it stand still and strike lightning faster
    center: Vector2;
    velocity: Vector2;
    radius: number;
    radiusSq: number;
    offset: number;
    active = false;

    constructor(cx: number, cy: number, radius: number, offset: number) {
        this.center = new Vector2(cx, cy);
        this.velocity = new Vector2();
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.offset = offset;
    }
}


export class Orb {
    centers: Vector2[];
    radius: number;
    radiusSq: number;
    offset: number;
    velocity: number;
    angle = _Math.TAU;
    active = false;

    constructor(px: number, py: number, radius: number, offset: number, velocity: number) {
        this.centers = [new Vector2(px, py)];
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.offset = offset;
        this.velocity = velocity;
    }
}

interface Tree {
    center: Vector2;
    radius: number;
    // image: HTMLImageElement | null;
}

function createTree(cx: number, cy: number, radius: number): Tree {
    return {
        center: new Vector2(cx, cy),
        radius
    };
};
