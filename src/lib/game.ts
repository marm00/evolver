import { Vector2 } from "./vector2";
import { Shape, Circle, OrientedRect, Rect } from "./shape";
import { Pool, Pool2 } from "./pool";
import { _Math } from "./mathUtils";
import { Matrix3 } from "./matrix3";
import { Lion, Meteorite, Obsidian, Orb, RESOURCE_STATE, Spear, Thunderstorm, Wall } from "./spear";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

const AUTO_AIM = true;
const AUTO_ATTACK = true;

const METER_TO_PIXELS = 73.14;

/** Pixels per second: 5m/s (avg run speed) * 73pixels/m (128px=1.75meters) = 365pixels/s. */
const HUMAN_VELOCITY = 365;
const HUMAN_VELOCITY_DIAGONAL = HUMAN_VELOCITY * Math.SQRT1_2;
const HUMAN_HEIGHT = 128;
const HUMAN_WIDTH = 64;

/** Distance a spear travels in meters to pixels. */
const SPEAR_DISTANCE = 25 * METER_TO_PIXELS;
/** Lifetime of a spear in seconds. */
const SPEAR_LIFETIME = 1;
/** Height of a spear in pixels, n times the height of a human. */
const SPEAR_HEIGHT = HUMAN_HEIGHT * 1.14;
const SPEAR_HALF_HEIGHT = SPEAR_HEIGHT / 2;
/** Width of a spear in pixels, n times the width of a human. */
const SPEAR_WIDTH = HUMAN_WIDTH * 0.11;
const SPEAR_HALF_WIDTH = SPEAR_WIDTH / 2;

const METEORITE_RADIUS = 64;
const METEORITE_DISPLAY_RADIUS = METEORITE_RADIUS * 0.5;
const METEORITE_LIFETIME = 2;

// TODO: pickup radius should be stored on the player not resources
/** Pick-up radius of an obsidian. */
const OBSIDIAN_RADIUS = 32;
const OBSIDIAN_DISPLAY_RADIUS = OBSIDIAN_RADIUS;
/** In pixels per second. */
const OBSIDIAN_VELOCITY = 12;
const OBSIDIAN_ACCELERATION = 1 + (6 / 100);
/** Threshold for finishing a lerp to a target in pixels. */
const OBSIDIAN_THRESHOLD = 4;
const OBSIDIAN_JUMP_DISTANCE = OBSIDIAN_RADIUS * 5;

const THUNDERSTORM_RADIUS = 96;
/** Y-axis offset for the center of the cloud above the shadow. */
const THUNDERSTORM_OFFSET = THUNDERSTORM_RADIUS * 3;
/** Factor for when easing starts, where `n * collision distance` is the starting point. */
const THUNDERSTORM_VELOCITY = HUMAN_VELOCITY * 1.5;
const THUNDERSTORM_EASING_FACTOR = _Math.pow2(2);
/** Threshold for stopping storm movement in pixels (edge-to-edge collision). */
const THUNDERSTORM_THRESHOLD = 1;

const ORB_RADIUS = 16;
const ORB_OFFSET = 256;
const ORB_CIRCUMFERENCE = ORB_OFFSET * _Math.TAU;
/** Pixels per second. */
const ORB_VELOCITY = ORB_CIRCUMFERENCE / 6;

const LION_RADIUS = 16;
const LION_VELOCITY = HUMAN_VELOCITY / 2;

// TODO: the game contains lists for different things (like spears), pools, and the partinioning contains references
interface Game {
    world: PartitionStrategy;
    player: Player;
    m3Pool: Pool2<Matrix3>;
    v2Pool: Pool<Vector2>;
    v2Pool2: Pool2<Vector2>;
    oRectPool: Pool2<OrientedRect>;
    spearPool: Pool<Spear>;
    spears: Spear[] // TODO: different data structure?
    meteoritePool: Pool<Meteorite>;
    meteorites: Meteorite[]; // TODO: different data structure?
    obsidianPool: Pool<Obsidian>;
    obsidians: Obsidian[]; // TODO: different data structure?
    thunderstorm: Thunderstorm;
    orb: Orb;
    walls: Wall[]; // TODO: different data structure?
    lionPool: Pool<Lion>;
    lions: Lion[]; // TODO: different data structure?
}

/**
 * The `PartitionStrategy` interface defines a spatial partitioning algorithm that
 * models the game objects. The goal is to divide the world into smaller regions
 * based on the positions of objects in 2D space. This allows us to perform efficient spatial 
 * queries to find adjacent elements, aiding e.g. the *broad phase* of collision detection.
 */
interface PartitionStrategy {
    // insert(bbox: Bbox, layer: number): void;
    insert(shape: Shape): void;
    remove(shape: Shape): void;
    update(shape: Shape): void;
    query(minX: number, minY: number, maxX: number, maxY: number): Shape[];
    all(): Shape[]; // TODO: use an iterator for spatial partiioning or memory references (like array for spears)
    // TODO: perhaps an AABB tree per partition
    // TODO: duplicate partitions once the player is close to the edge of the world
}

/** 0b0001 = Up Direction */
const NORTH_BIT = 1;
/** 0b0010 = Down Direction */
const SOUTH_BIT = 2;
/** 0b0100 = Left Direction */
const WEST_BIT = 4;
/** 0b1000 = Right Direction */
const EAST_BIT = 8;

/** An enum-like object for 8-directional clockwise movement or idle (North = First, Northeast = Second, etc.). */
const DIR_9 = {
    /** Idle state, no movement. */
    Idle: 0,
    /** North or up. */
    N: 1,
    /** Northeast or up-right. */
    NE: 2,
    /** East or right. */
    E: 3,
    /** Southeast or down-right. */
    SE: 4,
    /** South or down. */
    S: 5,
    /** Southwest or down-left. */
    SW: 6,
    /** West or left. */
    W: 7,
    /** Northwest or up-left. */
    NW: 8
} as const;

type ObjectValues<T> = T[keyof T];

/** A value mapping onto a {@link DIR_9} key, representing idle or one of eight possible directions. */
type Dir9 = ObjectValues<typeof DIR_9>;

type DirectionAction = (player: Player) => void;

/** Maps a [bitmask](https://en.wikipedia.org/wiki/Mask_(computing)) to the corresponding {@link DirectionAction}. */
const bitmaskActionMap: Record<number, DirectionAction> = {
    0b0000: (p) => { p.velocity.set(0, 0); p.playerDirection = DIR_9.Idle; },
    0b0001: (p) => { p.velocity.set(0, HUMAN_VELOCITY); p.playerDirection = DIR_9.N; },
    0b1001: (p) => { p.velocity.set(HUMAN_VELOCITY_DIAGONAL, HUMAN_VELOCITY_DIAGONAL); p.playerDirection = DIR_9.NE; },
    0b1000: (p) => { p.velocity.set(HUMAN_VELOCITY, 0); p.playerDirection = DIR_9.E; },
    0b1010: (p) => { p.velocity.set(HUMAN_VELOCITY_DIAGONAL, -HUMAN_VELOCITY_DIAGONAL); p.playerDirection = DIR_9.SE; },
    0b0010: (p) => { p.velocity.set(0, -HUMAN_VELOCITY); p.playerDirection = DIR_9.S; },
    0b0110: (p) => { p.velocity.set(-HUMAN_VELOCITY_DIAGONAL, -HUMAN_VELOCITY_DIAGONAL); p.playerDirection = DIR_9.SW; },
    0b0100: (p) => { p.velocity.set(-HUMAN_VELOCITY, 0); p.playerDirection = DIR_9.W; },
    0b0101: (p) => { p.velocity.set(-HUMAN_VELOCITY_DIAGONAL, HUMAN_VELOCITY_DIAGONAL); p.playerDirection = DIR_9.NW; }
};

export async function createGame(strategy: string): Promise<Game> {
    const m3Pool = new Pool2<Matrix3>(Matrix3.identity);
    const v2Pool = new Pool<Vector2>((x = 0, y = 0) => new Vector2(x, y), 20);
    const v2Pool2 = new Pool2<Vector2>(() => new Vector2());
    const oRectPool = new Pool2<OrientedRect>(OrientedRect.zero, 5);
    const spearPool = new Pool<Spear>((cx = 0, cy = 0, halfWidth = 0, halfHeight = 0,
        rotation = 0, vx = 0, vy = 0, lifetime = 0) => new Spear(cx, cy, halfWidth, halfHeight, rotation, vx, vy, lifetime), 0);
    const meteoritePool = new Pool<Meteorite>((ox = 0, oy = 0, tx = 0, ty = 0, radius = 0, lifetime = 0, displayRadius = 0) =>
        new Meteorite(ox, oy, tx, ty, radius, lifetime, displayRadius), 0);
    const obsidianPool = new Pool<Obsidian>((cx = 0, cy = 0, radius = 0, velocityScalar = 0, displayRadius = 0) =>
        new Obsidian(cx, cy, radius, velocityScalar, displayRadius), 0);
    const lionPool = new Pool<Lion>((cx = 0, cy = 0, radius = 0, velocity = 0, maxSpeed = 0) =>
        new Lion(cx, cy, radius, velocity, maxSpeed), 0);

    const world = new SingleCell();
    const player = new Player();
    // world.insert(player); // TODO: player to world?
    const thunderstorm = new Thunderstorm(0, 0, THUNDERSTORM_RADIUS, THUNDERSTORM_OFFSET);
    const orb = new Orb(0, 0, ORB_RADIUS, ORB_OFFSET, ORB_VELOCITY);
    const walls = [new Wall(300, 100, 50, 100, _Math.TAU * (2 / 3))];
    // const walls = [new Wall(300, 100, 50, 100, _Math.TAU)];

    const angle = _Math.TAU * .33;
    const tor0 = OrientedRect.zero().setDimensions(32, 64, angle);
    tor0.center.set(128, 0);
    tor0.velocity.setPolar(angle, 64);
    world.insert(tor0);

    const tor1 = new OrientedRect(new Vector2(0, 0), Vector2.fromPolar(angle, 64), new Vector2(0, 0), 32, 64, _Math.TAU);
    world.insert(tor1);

    const tor11 = new OrientedRect(new Vector2(-128, 0), Vector2.fromPolar(angle, 64), new Vector2(0, 0), 64, 32, _Math.TAU);
    world.insert(tor11);

    const tor2 = OrientedRect.zero().setDimensions(128, 35, new Vector2(-10, 3.3).direction());
    tor2.center.set(-20, -20);
    tor2.velocity.set(-10, 3.3)
    world.insert(tor2);

    world.insert(new Circle(new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0), 64));
    world.insert(new Rect(new Vector2(128, 128), new Vector2(0, 0), new Vector2(0, 0), 128, 128));
    world.insert(new Rect(new Vector2(0, 256), new Vector2(0, 0), new Vector2(0, 0), 512, 512));
    world.insert(new Circle(new Vector2(-64, -128), new Vector2(Math.SQRT1_2, Math.SQRT1_2), new Vector2(0, 0), 64));
    return {
        world, player, m3Pool, v2Pool, v2Pool2, oRectPool, spearPool, spears: [],
        meteoritePool, meteorites: [], obsidianPool, obsidians: [], thunderstorm, orb, walls,
        lionPool, lions: []
    };
}

/**
 * 
 * @param target Position of the target in world space.
 */
export function attack(target: Vector2, player: Player, world: PartitionStrategy, oRectPool: Pool2<OrientedRect>, v2Pool2: Pool2<Vector2>, v2Pool: Pool<Vector2>, spearPool: Pool<Spear>, spears: Spear[]) {
    // const p_spear = oRectPool.alloc();
    // const p_target = v2Pool2.alloc();
    // p_spear.center.copy(player.center);
    // p_spear.velocity.copy(p_target.copy(target).sub(p_spear.center).normalize().scale(SPEAR_VELOCITY));
    // p_spear.setDimensions(SPEAR_WIDTH, SPEAR_HEIGHT, p_spear.velocity.direction());
    // v2Pool2.free(p_target);
    // world.insert(p_spear);
    const p_velocity = v2Pool.alloc(target.x, target.y).sub(player.center).normalize().scale(SPEAR_DISTANCE);
    const cx = player.center.x, cy = player.center.y;
    const spear = spearPool.alloc(cx, cy, SPEAR_HALF_WIDTH, SPEAR_HALF_HEIGHT, p_velocity.direction() - _Math.HALF_PI, p_velocity.x, p_velocity.y, SPEAR_LIFETIME);
    spears.push(spear);
    // world.insert(spear);
    v2Pool.free(p_velocity);
    // TODO: lifetime, reuse spear instance on lifetime end
}

export function launchMeteorite(target: Vector2, origin: Vector2, meteoritePool: Pool<Meteorite>, meteorites: Meteorite[]) {
    const meteorite = meteoritePool.alloc(target.x, target.y, origin.x, origin.y, METEORITE_RADIUS, METEORITE_LIFETIME, METEORITE_DISPLAY_RADIUS);
    meteorites.push(meteorite);
}

export function dropObsidian(target: Vector2, obsidianPool: Pool<Obsidian>, obisidians: Obsidian[]) {
    const obsidian = obsidianPool.alloc(target.x, target.y, OBSIDIAN_RADIUS, OBSIDIAN_VELOCITY, OBSIDIAN_DISPLAY_RADIUS);
    obisidians.push(obsidian);
}

export function spawnThunderstorm(target: Vector2, thunderstorm: Thunderstorm) {
    if (!thunderstorm.active) {
        thunderstorm.center.copy(target);
        thunderstorm.active = true;
    }
}

export function spawnOrb(orb: Orb) {
    if (!orb.active) {
        orb.active = true;
    } else {
        orb.centers.push(new Vector2());
    }
}

export function spawnLion(target: Vector2, lionPool: Pool<Lion>, lions: Lion[]) {
    const randVelocty = Math.random() * (LION_VELOCITY * 0.5) + (LION_VELOCITY * 1.5);
    const lion = lionPool.alloc(target.x, target.y, LION_RADIUS, randVelocty, 350); // TODO: manage max speed var
    lions.push(lion);
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, elapsedTime: number, deltaTime: number) {
    const cx = gameState.player.canvasCenterX, cy = gameState.player.canvasCenterY;
    const pp = gameState.player.center, pv = gameState.player.velocity;
    const pr = gameState.player.radius, prSq = gameState.player.radiusSq;
    const mp = gameState.player.mousePosition;
    // TODO: maybe floor/round mouse position when the canvas center is not an integer (but ends on .5)
    // Project the canvas mouse position to the world coordinate system
    mp.set(pp.x - gameState.player.mouseCanvasDX, pp.y + gameState.player.mouseCanvasDY);

    // Update player position
    // const p_pv = v2Pool2.alloc();
    // pp.add(p_pv.copy(pv).scale(deltaTime));
    // v2Pool2.free(p_pv);

    const thingsToRender = gameState.world.query(pp.x - cx, pp.y - cy, pp.x + cx, pp.y + cy);

    const sprite: HTMLImageElement | null = gameState.player.sprite;
    if (!sprite) return;
    const dx = (ctx.canvas.width - gameState.player.displayWidth) / 2;
    const dy = (ctx.canvas.height - gameState.player.displayHeight) / 2;
    let imageOffset: number[] = [0, 0];

    // We probably dont want to update the player direction directly here, maybe use a separate vector or scalar
    if (gameState.player.playerDirection !== DIR_9.Idle) {
        if (gameState.player.playerDirection === DIR_9.N) {
            imageOffset = [3, 2];
        }
        if (gameState.player.playerDirection === DIR_9.S) {
            imageOffset = [2, 3];
        }
        if (gameState.player.playerDirection === DIR_9.W) {
            imageOffset = [3, 3];
        }
        if (gameState.player.playerDirection === DIR_9.E) {
            imageOffset = [0, 2];
        }
        if (gameState.player.playerDirection === DIR_9.NW) {
            imageOffset = [2, 2];
        }
        if (gameState.player.playerDirection === DIR_9.NE) {
            imageOffset = [1, 2];
        }
        if (gameState.player.playerDirection === DIR_9.SW) {
            imageOffset = [1, 3];
        }
        if (gameState.player.playerDirection === DIR_9.SE) {
            imageOffset = [0, 3];
        }
    }

    // TODO: how to iterate over all shapes in the world, use an Iterator for spatial partiioning or separate arrays, or just over partitions
    const allShapes = gameState.world.all();
    for (const thing of allShapes) {
        const tc = thing.center, tv = thing.velocity;
        if (!tv.isZero()) {
            const p_tv = gameState.v2Pool2.alloc();
            tc.add(p_tv.copy(tv).scale(deltaTime));
            gameState.v2Pool2.free(p_tv);
            if (thing instanceof OrientedRect) {
                thing.update();
            }
        }
    }

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // ctx.drawImage(sprite, 128 * imageOffset[0]!, 128 * imageOffset[1]!, gameState.player.displayWidth, gameState.player.displayHeight, dx, dy - gameState.player.displayHeight/2, gameState.player.displayWidth, gameState.player.displayHeight);

    ctx.save();
    ctx.transform(
        1, 0,      // Horizontal scaling and skewing
        0, -1,     // Vertical scaling and skewing
        cx - pp.x, // Horizontal translation to center player x
        cy + pp.y  // Vertical translation to center player y
    );
    // TODO: use off screen canvas/ctx for rendering even the dev mode elements

    // Move player
    const p_pv = gameState.v2Pool.alloc(pv.x, pv.y);
    pp.add(p_pv.scale(deltaTime));
    ctx.beginPath();
    ctx.strokeStyle = '#00ccff';
    ctx.arc(pp.x, pp.y, gameState.player.radius, 0, _Math.TAU);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';

    if (true) {
        // TODO: replace this with image data manipulation and backImageData putting
        // TODO: replace player sprites with 3D ones
        ctx.translate(pp.x, pp.y + gameState.player.displayHeight / 2);
        ctx.scale(1, -1);
        ctx.drawImage(
            sprite,
            (128 * imageOffset[0]!),
            (128 * imageOffset[1]!),
            gameState.player.displayWidth,
            gameState.player.displayHeight,
            -gameState.player.displayWidth / 2,
            -gameState.player.displayHeight / 2 + 10,
            gameState.player.displayWidth,
            gameState.player.displayHeight
        );
        ctx.restore();
        ctx.save();
        ctx.transform(
            1, 0,      // Horizontal scaling and skewing
            0, -1,     // Vertical scaling and skewing
            cx - pp.x, // Horizontal translation to center player x
            cy + pp.y  // Vertical translation to center player y
        );
    }


    // Move all spears
    const p_previousCenter = gameState.v2Pool.alloc(0, 0);
    const p_velocity = gameState.v2Pool.alloc(0, 0);
    for (const spear of gameState.spears) {
        spear.lifetime -= deltaTime;
        if (spear.lifetime <= 0) {
            gameState.spears.splice(gameState.spears.indexOf(spear), 1);
            gameState.spearPool.free(spear);
            // TODO: remove from world
            continue;
        }
        p_previousCenter.copy(spear.center);
        // TODO: is spear.velocity needed on the class instance?
        spear.center.add(p_velocity.copy(spear.velocity).scale(deltaTime));
        p_velocity.set(spear.center.x - p_previousCenter.x, spear.center.y - p_previousCenter.y);
        const v = spear.vertices;
        v[0].add(p_velocity);
        v[1].add(p_velocity);
        v[2].add(p_velocity);
        v[3].add(p_velocity);
        // TODO: collision checks and stuff after every object position is updated
        // TODO: only draw if in view
        ctx.beginPath();
        ctx.moveTo(v[0].x, v[0].y);
        ctx.lineTo(v[1].x, v[1].y);
        ctx.lineTo(v[2].x, v[2].y);
        ctx.lineTo(v[3].x, v[3].y);
        ctx.stroke();
    }
    gameState.v2Pool.free(p_previousCenter);
    gameState.v2Pool.free(p_velocity);

    // Move all meteorites
    for (const meteorite of gameState.meteorites) {
        meteorite.lifetime -= deltaTime;
        if (meteorite.lifetime <= 0) {
            gameState.meteorites.splice(gameState.meteorites.indexOf(meteorite), 1);
            gameState.meteoritePool.free(meteorite);
            // TODO: remove from world
            // TODO: explode
            continue;
        }

        let t = 1 - (meteorite.lifetime / meteorite.duration); // Normalize to [0, 1] range where 1 = target
        t = _Math.easeOutQuad(t);
        meteorite.center.lerpVectors(meteorite.origin, meteorite.target, t);
        const displayRadius = _Math.lerp(0.5, 1, t) * METEORITE_DISPLAY_RADIUS;

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.moveTo(meteorite.origin.x, meteorite.origin.y);
        ctx.lineTo(meteorite.target.x, meteorite.target.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = '#ff7b00';
        ctx.arc(meteorite.center.x, meteorite.center.y, displayRadius, 0, _Math.TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.arc(meteorite.target.x, meteorite.target.y, meteorite.radius, 0, _Math.TAU);
        ctx.stroke();
    }

    // Collect/move obsidians
    // TODO: only jump if in view, and use partition system for uncollected obsidians
    for (const obsidian of gameState.obsidians) {
        const c = obsidian.center, jump = obsidian.jump;
        switch (obsidian.resourceState) {
            case RESOURCE_STATE.Uncollected: {
                if (c.distanceToSq(pp) <= obsidian.radiusSq) {
                    jump.copy(c).sub(pp).normalize().scale(OBSIDIAN_JUMP_DISTANCE).add(c);
                    obsidian.resourceState = RESOURCE_STATE.Jumping;
                }
                break;
            }
            case RESOURCE_STATE.Jumping: {
                c.lerp(jump, _Math.clamp(OBSIDIAN_VELOCITY * deltaTime, 0, 1));
                if (c.distanceToSq(jump) < OBSIDIAN_THRESHOLD) {
                    obsidian.resourceState = RESOURCE_STATE.Collecting;
                }
                ctx.strokeStyle = '#47ff5f';
                ctx.beginPath();
                ctx.arc(jump.x, jump.y, obsidian.displayRadius, 0, _Math.TAU);
                ctx.stroke();
                ctx.closePath();
                ctx.strokeStyle = '#ffffff';
                break;
            }
            case RESOURCE_STATE.Collecting: {
                // There could be a cheaper way to move while still not visually overshooting the target
                obsidian.acceleration *= OBSIDIAN_ACCELERATION;
                c.lerp(pp, _Math.clamp(obsidian.acceleration * deltaTime * deltaTime, 0, 1));
                if (c.distanceToSq(pp) < OBSIDIAN_THRESHOLD) {
                    gameState.obsidians.splice(gameState.obsidians.indexOf(obsidian), 1);
                    gameState.obsidianPool.free(obsidian);
                    // TODO: add resource to player
                }
                ctx.strokeStyle = '#bc75ff';
                break;
            }
        }
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.arc(c.x, c.y, obsidian.displayRadius, 0, _Math.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
    }

    // Move thunderstorm
    if (gameState.thunderstorm.active) {
        const storm = gameState.thunderstorm;
        const c = storm.center, v = storm.velocity, r = storm.radius;
        const dist = c.distanceTo(pp);
        const radii = r + pr;
        if (dist > radii + THUNDERSTORM_THRESHOLD) {
            const easingStart = radii * THUNDERSTORM_EASING_FACTOR;
            let deceleration = _Math.clamp((dist - radii) / (easingStart - radii), 0, 1);
            deceleration = _Math.easeOutQuad(deceleration);
            c.add(v.copy(pp).sub(c).normalize().scale(THUNDERSTORM_VELOCITY * deceleration * deltaTime));
        }
        ctx.beginPath();
        ctx.strokeStyle = '#141313f8';
        ctx.arc(c.x, c.y, r, 0, _Math.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff44';
        ctx.beginPath();
        ctx.arc(c.x, c.y + storm.offset, r, 0, _Math.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
    }

    // Move orbs
    if (gameState.orb.active) {
        const orb = gameState.orb;
        const step = orb.velocity / orb.offset;
        orb.angle += step * deltaTime;
        const o = orb.offset;
        const tauStep = _Math.TAU / orb.centers.length;
        for (const c of orb.centers) {
            // TODO: probably some optimization possible (reduce trig?)
            orb.angle += tauStep;
            c.set(Math.cos(orb.angle), Math.sin(orb.angle)).scale(o).add(pp);
            ctx.strokeStyle = '#b3ff00';
            ctx.beginPath();
            ctx.arc(c.x, c.y, orb.radius, 0, _Math.TAU);
            ctx.stroke();
        }
        orb.angle %= _Math.TAU; // Normalize radians to range [0, 2π)
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, o, 0, _Math.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
    }

    // Check walls
    for (const wall of gameState.walls) {
        ctx.beginPath();
        ctx.strokeStyle = '#fa8585';
        const vertices = wall.vertices;
        const colorArray = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = colorArray[i % 4]!;
            ctx.beginPath();
            ctx.moveTo(vertices[i]!.x, vertices[i]!.y);
            ctx.arc(vertices[i]!.x, vertices[i]!.y, 4, 0, _Math.TAU);
            ctx.fill();
            ctx.closePath();
            ctx.lineTo(vertices[(i + 1) % 4]!.x, vertices[(i + 1) % 4]!.y);
            ctx.stroke();
        }
        const p_axis = gameState.v2Pool.alloc(0, 0);
        for (let i = 0; i < 2; i++) {
            const a = wall.axes[i]!;
            p_axis.copy(a).scale(40).add(wall.center);
            ctx.strokeStyle = colorArray[i]!;
            ctx.beginPath();
            ctx.moveTo(wall.center.x, wall.center.y);
            ctx.lineTo(p_axis.x, p_axis.y);
            ctx.stroke();
        }
        gameState.v2Pool.free(p_axis);
    }
    ctx.strokeStyle = '#ffffff';

    // // Move lions
    // /** Transformed circle center to obb space. */
    // // const p_transformed = gameState.v2Pool.alloc(0, 0)
    // /** Closest point on obb to circle center. */
    // // const p_closest = gameState.v2Pool.alloc(0, 0);
    // /** Distance from closest point to circle center. */
    // // const p_offset = gameState.v2Pool.alloc(0, 0);
    // /** Transformed velocity to obb space. */
    // // const p_vtransformed = gameState.v2Pool.alloc(0, 0);
    // /** Normal vector of the obb closest to the circle center */
    // // const p_normal = gameState.v2Pool.alloc(0, 0);
    // /** Center of lion transformed to wall local space, as raycasting origin. */
    // const p_clocal = gameState.v2Pool.alloc(0, 0);
    // /** Velocity of lion transformed to wall local space, as raycasting direction. */
    // const p_vlocal = gameState.v2Pool.alloc(0, 0);
    // /** The closest point on the wall to the lion. */
    // const p_collision = gameState.v2Pool.alloc(0, 0);
    // /** Center of the player transformed to wall local space. */
    // const p_pplocal = gameState.v2Pool.alloc(0, 0);
    // const p_repulsion = gameState.v2Pool.alloc(0, 0);
    // const p_neighbor = gameState.v2Pool.alloc(0, 0);
    // const p_obstacle = gameState.v2Pool.alloc(0, 0);
    // for (let i = 0; i < gameState.lions.length; i++) {
    //     // TODO: separate lions (collision avoidance) such that they don't collide with each other
    //     const lion = gameState.lions[i]!;
    //     const c = lion.center;
    //     // if (c.distanceToSq(pp) <= lion.radiusSq) continue;
    //     const wall = gameState.walls[0]!;
    //     const wc = wall.center, halfWidth = wall.halfWidth, halfHeight = wall.halfHeight;
    //     // TODO: broad phase first, maybe bounding circle for initial collision check
    //     p_clocal.copy(c).sub(wc).matmul2(wall.inverseRotation);
    //     const clx = p_clocal.x, cly = p_clocal.y;
    //     // TODO: reduce max call?
    //     const dx = Math.max(Math.abs(clx) - halfWidth, 0);
    //     const dy = Math.max(Math.abs(cly) - halfHeight, 0);
    //     // const distSq = dx * dx + dy * dy;
    //     // const dist = Math.sqrt(distSq);
    //     p_repulsion.set(0, 0);
    //     for (let j = 0; j < gameState.lions.length; j++) {
    //         if (i === j) continue;
    //         const lion2 = gameState.lions[j]!;
    //         const c2 = lion2.center;
    //         const rdistSq = c.distanceToSq(c2);
    //         /** Approximate condition summing precomputed squared radii. */
    //         // const rradiiSq = lion.radiusSq + lion2.radiusSq;
    //         const rradiiSq = (lion.radius + lion2.radius) ** 2;
    //         // const rradiiSq = lion.radiusSq + 2 * lion.radius + lion2.radius + lion2.radiusSq;
    //         if (rdistSq > rradiiSq) continue;
    //         p_neighbor.copy(c).sub(c2);
    //         p_repulsion.add(p_neighbor);
    //     }
    //     p_repulsion.scale(1);
    //     p_velocity.copy(pp).sub(c);
    //         p_velocity.scale(1);
    //         p_velocity.add(p_repulsion);

    //     if (dx === 0 && dy === 0) {
    //         p_obstacle.copy(c).sub(wc);
    //         p_obstacle.scale(1);
    //         p_velocity.add(p_obstacle);
    //         // TODO: instantly stop velocity and different repulsion?
    //         // TODO: combine obstacle and repulsion without overthrowing
    //         // p_velocity.copy(c).sub(wc);
    //         // p_velocity.scale(1);
    //         // p_velocity.add(p_repulsion);
    //     } else {

    //     }

    //     // Random between 0.5 lion velocity and 1.5 lion velocity
    //     c.add(p_velocity.normalize().scale(lion.velocityScalar * deltaTime));

    //     // Below is for local space visualization, functionally irrelevant
    //     if (i !== 0) {
    //         ctx.beginPath();
    //         ctx.arc(c.x, c.y, lion.radius, 0, _Math.TAU);
    //         ctx.stroke();
    //         continue;
    //     }
    //     const vertices = wall.vertices;
    //     p_pplocal.copy(pp).sub(wc).matmul2(wall.inverseRotation);
    //     p_vlocal.copy(p_pplocal).sub(p_clocal).normalize().scale(lion.velocityScalar);
    //     p_collision.set(
    //         Math.min(Math.max(clx, -halfWidth), halfWidth),
    //         Math.min(Math.max(cly, -halfHeight), halfHeight)
    //     );
    //     p_vlocal.add(p_clocal); // Translate to local origin
    //     const colorArray = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    //     const vertices2 = [];
    //     for (let i = 0; i < 4; i++) {
    //         vertices2[i] = vertices[i]!.clone().sub(wc).matmul2(wall.inverseRotation);
    //     }
    //     for (let i = 0; i < 4; i++) {
    //         ctx.fillStyle = colorArray[i % 4]!;
    //         ctx.beginPath();
    //         ctx.moveTo(vertices2[i]!.x, vertices2[i]!.y);
    //         ctx.arc(vertices2[i]!.x, vertices2[i]!.y, 4, 0, _Math.TAU);
    //         ctx.fill();
    //         ctx.closePath();
    //         ctx.lineTo(vertices2[(i + 1) % 4]!.x, vertices2[(i + 1) % 4]!.y);
    //         ctx.stroke();
    //     }
    //     ctx.beginPath();
    //     ctx.fillStyle = '#000000';
    //     ctx.arc(0, 0, 10, 0, _Math.TAU);
    //     ctx.fill();
    //     ctx.beginPath();
    //     ctx.fillStyle = '#b46b0b';
    //     ctx.arc(p_clocal.x, p_clocal.y, 10, 0, _Math.TAU);
    //     ctx.fill();
    //     ctx.beginPath();
    //     ctx.fillStyle = '#00ff00';
    //     ctx.arc(p_collision.x, p_collision.y, 10, 0, _Math.TAU);
    //     ctx.fill();
    //     ctx.fillStyle = '#ffffff';
    //     ctx.beginPath();
    //     ctx.fillStyle = '#ff0000';
    //     ctx.strokeStyle = '#ff0000';
    //     ctx.moveTo(p_clocal.x, p_clocal.y);
    //     ctx.lineTo(p_vlocal.x, p_vlocal.y);
    //     ctx.stroke();
    //     ctx.arc(p_vlocal.x, p_vlocal.y, 10, 0, _Math.TAU);
    //     ctx.fill();
    //     ctx.beginPath();
    //     ctx.strokeStyle = '#91ff00';
    //     ctx.moveTo(p_clocal.x, p_clocal.y);
    //     ctx.lineTo(p_pplocal.x, p_pplocal.y);
    //     ctx.stroke();
    //     ctx.fillStyle = '#00ffd5';
    //     ctx.beginPath();
    //     ctx.arc(p_pplocal.x, p_pplocal.y, 10, 0, _Math.TAU);
    //     ctx.fill();
    //     ctx.strokeStyle = '#ffffff';
    //     ctx.fillStyle = '#ffffff';

    //     // Below is an unfinished raycasting implementation
    //     // v.copy(pp).sub(c).normalize().scale(LION_VELOCITY);
    //     // // TODO: check if either point is in the aabb (after obb rotation) to simplify
    //     // p_clocal.copy(c).sub(wc).matmul2(wall.inverseRotation);
    //     // p_vlocal.copy(v).matmul2(wall.inverseRotation);
    //     // const vlx = p_vlocal.x, vly = p_vlocal.y;
    //     // const inverseVlx = vlx === 0 ? 0 : 1 / vlx;
    //     // const inverseVly = vly === 0 ? 0 : 1 / vly;
    //     // const t1 = (-he.x - p_clocal.x) * inverseVlx;
    //     // const t2 = (he.x - p_clocal.x) * inverseVlx;
    //     // const t3 = (-he.y - p_clocal.y) * inverseVly;
    //     // const t4 = (he.y - p_clocal.y) * inverseVly;
    //     // const tminx = Math.min(t1, t2), tminy = Math.min(t3, t4);
    //     // const tmin = Math.max(tminx, tminy);
    //     // const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));
    //     // const t = tmin < 0 ? tmax : tmin;
    //     // if (tmax < 0 || tmin > tmax || tmin > 1) {
    //     //     // Lion velocity is not facing the wall or too far away
    //     //     c.add(v.scale(deltaTime));
    //     // } else {
    //     //     // Lion velocity is facing an edge of the wall
    //     //     // Move to collision point defined by intersection time t
    //     //     // Find nearest vertex in local space
    //     //     const nearestVertex = new Vector2(
    //     //         Math.sign(p_clocal.x) * (he.x),
    //     //         Math.sign(p_clocal.y) * (he.y)
    //     //     );
    //     //     // Calculate direction to nearest vertex
    //     //     const direction = new Vector2(
    //     //         nearestVertex.x - p_clocal.x,
    //     //         nearestVertex.y - p_clocal.y
    //     //     );
    //     //     direction.normalize().scale(LION_VELOCITY * deltaTime).matmul2(wall.rotation);
    //     //     c.add(v.scale(deltaTime).add(direction));
    //     // }

    //     // Below is an unfinished 'closest vertex' implementation
    //     // p_transformed.copy(c).sub(wc).matmul2(wall.inverseRotation);
    //     // p_closest.copy(p_transformed).clamp(wall.halfExtents);
    //     // p_offset.copy(p_transformed).sub(p_closest);
    //     // const squaredDistance = p_offset.magnitudeSq();
    //     // if (squaredDistance <= lion.radiusSq) {
    //     //     // Lion is intersecting the wall
    //     //     p_vtransformed.copy(v).matmul2(wall.inverseRotation);
    //     //     p_normal.set(
    //     //         Math.abs(p_offset.x) > Math.abs(p_offset.y) ? Math.sign(p_offset.x) : 0,
    //     //         Math.abs(p_offset.y) > Math.abs(p_offset.x) ? Math.sign(p_offset.y) : 0
    //     //     );
    //     //     if (p_vtransformed.dot(p_normal) < 0) {
    //     //         // Lion is facing the wall
    //     //         v.copy(p_normal.matmul2(wall.rotation));
    //     //         console.log(true)
    //     //     } else {
    //     //         console.log(false)
    //     //         // Lion is not facing the wall
    //     //     }
    //     // } else {
    //     //     console.log(' not intersecting')
    //     //     // Lion is not intersecting the wall
    //     // }
    //     // c.add(v.scale(LION_VELOCITY * deltaTime));
    //     ctx.beginPath();
    //     ctx.arc(c.x, c.y, lion.radius, 0, _Math.TAU);
    //     ctx.stroke();
    // }
    // // gameState.v2Pool.free(p_transformed);
    // // gameState.v2Pool.free(p_closest);
    // // gameState.v2Pool.free(p_offset);
    // // gameState.v2Pool.free(p_vtransformed);
    // // gameState.v2Pool.free(p_normal);
    // gameState.v2Pool.free(p_clocal);
    // gameState.v2Pool.free(p_vlocal);
    // gameState.v2Pool.free(p_collision);
    // gameState.v2Pool.free(p_pplocal);
    // gameState.v2Pool.free(p_repulsion);
    // gameState.v2Pool.free(p_neighbor);
    // gameState.v2Pool.free(p_obstacle);

    type Constraint = { direction: Vector2, point: Vector2 };

    function ORCA1(current: number, lines: Constraint[], maxSpeedSq: number, directionOpt: boolean, optVelocity: Vector2, result: Vector2): boolean {
        const { direction: n, point: v } = lines[current]!;
        const alignment = v.dot(n);
        const discriminantSq = alignment * alignment + maxSpeedSq - v.magnitudeSq();
        if (discriminantSq < 0) {
            // Failure: maximum speed does not intersect with feasible line region
            return false;
        }
        const discriminant = Math.sqrt(discriminantSq);
        // Define the segment of the line within the maximum speed circle
        let tLeft = -alignment - discriminant;
        let tRight = -alignment + discriminant;
        for (let i = 0; i < current; i++) {
            // Adjust above line segment to satisfy all previous constraints
            const constraintPrev = lines[i]!;
            const nPrev = constraintPrev.direction, vPrev = constraintPrev.point;
            const denominator = n.det(nPrev);
            const numerator = nPrev.det(v.clone().sub(vPrev));
            if (Math.abs(denominator) < _Math.EPSILON) {
                // Lines are parallel or nearly parallel
                if (numerator < 0) {
                    // Current constraint line is on the wrong side (right) of previous
                    return false;
                }
                continue;
            }
            /** The intersection point along the current constraint line. */
            const t = numerator / denominator;
            if (denominator > 0) {
                // Previous line bounds current line on the right
                tLeft = Math.min(tRight, t);
            } else {
                // Previous line bounds current line on the left
                tRight = Math.max(tLeft, t);
            }
            if (tLeft > tRight) {
                // Feasible interval along the constraint line is empty
                return false;
            }
        }
        if (directionOpt) {
            // Optimize direction
            if (optVelocity.dot(n) > 0) {
                // Take rightmost point
                result.copy(v).add(n.clone().scale(tRight));
            } else {
                // Take leftmost point
                result.copy(v).add(n.clone().scale(tLeft));
            }
        } else {
            // Optimize closest point
            /** Project preferred velocity onto constraint line, the value (distance) to minimize. */
            const t = n.dot(optVelocity.clone().sub(v));
            if (t < tLeft) {
                result.copy(v).add(n.clone().scale(tLeft));
            } else if (t > tRight) {
                result.copy(v).add(n.clone().scale(tRight));
            } else {
                result.copy(v).add(n.clone().scale(t));
            }
        }
        return true;
    }

    function ORCA2(lines: Constraint[], maxSpeed: number, maxSpeedSq: number, directionOpt: boolean, optVelocity: Vector2, result: Vector2): number {
        if (directionOpt) {
            // Optimize direction with velocity as a unit vector
            result.copy(optVelocity).scale(maxSpeed);
        } else if (optVelocity.magnitudeSq() > maxSpeedSq) {
            // Outside circle, optimize closest point
            result.copy(optVelocity).normalize().scale(maxSpeed);
        } else {
            // Inside circle, optimize closest point
            result.copy(optVelocity);
        }
        for (let i = 0; i < lines.length; i++) {
            // Objective:   Minimize f(v) = ||v - vPref||^2
            // Constraints: (v-vPref) * n >= 0
            //              ||v|| <= vMax
            //              ORCA lines
            // ORCA2
            const constraint = lines[i]!;
            if (constraint.direction.det(constraint.point.clone().sub(result)) > 0) {
                // Optimal velocity is on the wrong side (left) of the ORCA constraint
                // Next linear program
                const temp = result.clone();
                if (!ORCA1(i, lines, maxSpeedSq, directionOpt, optVelocity, result)) {
                    result.copy(temp);
                    return i;
                }
            }
        }
        return lines.length;
    }

    // ORCA Move Lions
    // Obstacle Reciprocal Collision Avoidance inspired by https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
    // TODO: parallelize and obviously different data structure (k-d tree partitioning, etc.)
    /** Time horizon (steps) for the ORCA algorithm. */
    const timeHorizon = 5;
    const inverseTimeHorizon = 1 / timeHorizon;
    // TODO: replace dot/det with unchecked versions where possible
    for (let i = 0; i < gameState.lions.length - 1; i++) {
        const lionA = gameState.lions[i]!;
        const pA = lionA.center, rA = lionA.radius, vA = lionA.velocity;
        const maxSpeed = lionA.maxSpeed, maxSpeedSq = lionA.maxSpeedSq;
        /** Initial velocity to be used in linear program. */
        const optVelocity = vA.clone();
        if (optVelocity.magnitudeSq() > maxSpeedSq) {
            // Current velocity is above maximum speed, clamping it
            optVelocity.normalize().scale(maxSpeed);
        }
        // TODO: compute k-nearest neighbors, naive = compare distances of all neighbors less than sensing radius
        // TODO: actually compute optimal velocities instead of using current velocities, using linear program
        const kNN = gameState.lions.length - 1;
        const constraints: { direction: Vector2, point: Vector2 }[] = [];
        for (let j = i + 1; j < gameState.lions.length; j++) {
            const lionB = gameState.lions[j]!;
            const pB = lionB.center, rB = lionB.radius, vB = lionB.velocity;
            const pRel = pB.clone().sub(pA);
            const vRel = vA.clone().sub(vB);
            const distSq = pRel.magnitudeSq();
            const r = rA + rB;
            const rSq = r * r;
            /** Apex of the VO (truncated) cone or origin of relative velocity space. */
            const apex = new Vector2();
            /** The smallest change in relative velocity required to resolve the collision. */
            const u = new Vector2();
            /** Normal vector n (or direction) of minimal change. */
            const direction = new Vector2();
            /** Represents the line on which to adjust velocity for reciprocal avoidance. */
            const point = new Vector2();
            if (distSq > rSq) {
                // No observed collision or overlap
                apex.copy(vRel).sub(pRel.clone().scale(inverseTimeHorizon));
                const apexLengthSq = apex.magnitudeSq();
                const angle = apex.dot(vRel);
                const imminentAngle = angle < 0;
                const imminentCollision = angle * angle > rSq * apexLengthSq;
                if (imminentAngle && imminentCollision) {
                    /** Project on cut-off circle. */
                    const apexLength = Math.sqrt(apexLengthSq);
                    direction.copy(apex).scale(1 / apexLength).rotate90Deg();
                    u.copy(direction).scale(r * inverseTimeHorizon - apexLength);
                } else {
                    /** No imminent collision, project velocity on nearest leg. */
                    const leg = Math.sqrt(distSq - rSq);
                    const pX = pRel.x, pY = pRel.y;
                    if (pRel.detUnchecked(apex) > 0) {
                        // 2D cross product is positive, project on left leg
                        direction.set(pX * leg - pY * r, pX * r + pY * leg).scale(1 / distSq);
                    } else {
                        // 2D cross product is negative, project on right leg
                        direction.set(pX * leg + pY * r, -pX * r + pY * leg).negate().scale(1 / distSq);
                    }
                    // Find shortest vector (adjusted velocity) on the ORCA constraint line
                    u.copy(direction).scale(vRel.dot(direction)).sub(vRel);
                }
            } else {
                // Lions are on top of each other, define VO as entire plane
                // Apex is now defined as the cutoff center to relative velocity
                apex.copy(vRel).sub(pRel.clone().scale(inverseTimeHorizon));
                const apexLength = apex.magnitude();
                direction.copy(apex).scale(1 / apexLength).rotate90Deg();
                u.copy(direction).scale(r * inverseTimeHorizon - apexLength);
            }
            // ORCA constraint (half-plane) is now defined by n (direction off of u) and vA+halfU (point)
            // Where halfU is the reciprocal (shared half effort) of the smallest change
            point.copy(vA).add(u.clone().scale(0.5));
            constraints.push({ direction, point });
        }
        // Linear programming to find new optimal velocity satisfying constraints
        const result = optVelocity.clone();
        const lineCount = ORCA2(constraints, maxSpeed, maxSpeedSq, false, optVelocity, result);
        // Final linear program: ORCA3
        if (lineCount < constraints.length) {
            let distance = 0;
            const numObstLines = 0; // TODO: solve ORCA for Obstacles (not just other Lions)
            const projectedLines = constraints.slice(0, numObstLines);
            for (let i = lineCount; i < constraints.length; i++) {
                const constraint = constraints[i]!;
                const n = constraint.direction, v = constraint.point;
                if (n.det(v.clone().sub(result)) > distance) {
                    // Velocity does not satisfy constraint of the current line
                    for (let j = numObstLines; j < i; j++) {
                        const newLine = { direction: new Vector2(), point: new Vector2() };
                        const constraintPrev = projectedLines[j]!;
                        const nPrev = constraintPrev.direction, vPrev = constraintPrev.point;
                        const denominator = n.det(nPrev);
                        if (Math.abs(denominator) <= _Math.EPSILON) {
                            // Lines are parallel
                            if (n.dot(nPrev) > 0) {
                                // Lines are in the same direction
                                continue;
                            }
                            newLine.point.copy(v.clone().add(vPrev)).scale(0.5);
                        } else {
                            newLine.point.copy(v).add(n.clone().scale(nPrev.det(v.clone().sub(vPrev)) / denominator));
                        }
                        newLine.direction.copy(nPrev).sub(n).normalize();
                        projectedLines.push(newLine);
                    }
                    const temp = result.clone();
                    if (ORCA2(projectedLines, maxSpeed, maxSpeedSq, true, n.clone().rotate180Deg(), result) < projectedLines.length) {
                        result.copy(temp);
                    }
                    distance = n.det(v.clone().sub(result));
                }
            }
        }
    }

    for (const thing of [...thingsToRender, gameState.player]) {
        // TODO: obviously dont update velocity here, but rather in the game loop
        // thing.center.add(thing.velocity.setLength(HUMAN_VELOCITY).clone().scale(deltaTime));
        const direction = thing.center.clone().add(thing.velocity);

        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.fillStyle = '#00ff00';
        ctx.arc(thing.center.x, thing.center.y, 4, 0, _Math.TAU);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(thing.center.x, thing.center.y, thing.velocity.magnitude(), 0, _Math.TAU);
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.moveTo(thing.center.x, thing.center.y);
        ctx.lineTo(direction.x, direction.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.atan2(direction.y - thing.center.y, direction.x - thing.center.x);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(direction.x, direction.y);
        ctx.lineTo(
            direction.x - arrowSize * Math.cos(angle - Math.PI / 6),
            direction.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            direction.x - arrowSize * Math.cos(angle + Math.PI / 6),
            direction.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        if (thing instanceof Rect) {
            ctx.strokeRect(thing.center.x - (thing.width / 2), thing.center.y - (thing.height / 2), thing.width, thing.height);
        } else if (thing instanceof Circle) {
            ctx.arc(thing.center.x, thing.center.y, thing.radius, 0, _Math.TAU);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.fillStyle = '#00a2ff';
        ctx.arc(direction.x, direction.y, 4, 0, _Math.TAU);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';

        if (thing instanceof OrientedRect) {
            // thing.setDimensions(thing.width + deltaTime * 3, thing.height + deltaTime * 1.5, thing.angle + deltaTime * 2);
            // thing.updateVertices();
            const vertices = thing.vertices;
            const colorArray = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(vertices[i]!.x, vertices[i]!.y);
                ctx.fillStyle = colorArray[i % 4]!;
                ctx.arc(vertices[i]!.x, vertices[i]!.y, 4, 0, _Math.TAU);
                ctx.fill();
                ctx.lineTo(vertices[(i + 1) % 4]!.x, vertices[(i + 1) % 4]!.y);
                ctx.stroke();
            }
            ctx.moveTo(thing.center.x, thing.center.y);
            ctx.arc(thing.center.x, thing.center.y, 1, 0, _Math.TAU);
            ctx.fill();
        }
    }
    ctx.beginPath();

    // Draw line from player to mouse position
    ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    ctx.closePath();

    ctx.restore();
}

/** Represents the player (main character) in the game. */
class Player {
    center = new Vector2(150, 300);
    velocity = new Vector2(0, 0);
    acceleration = new Vector2(0, 0);
    radius = 25;
    radiusSq = this.radius * this.radius;

    playerDirection: Dir9 = DIR_9.Idle;
    sprite: HTMLImageElement | null = null;
    displayWidth = 128;
    displayHeight = 128;

    /** Horizontal difference between the mouse position and the center of the canvas. */
    mouseCanvasDX = 0;
    /** Vertical difference between the mouse position and the center of the canvas. */
    mouseCanvasDY = 0;
    /** The mouse position in world coordinates. */
    mousePosition = new Vector2(0, 0);
    canvasCenterX = 0;
    canvasCenterY = 0;

    pressingUp = false;
    pressingDown = false;
    pressingLeft = false;
    pressingRight = false;
    idle = () => this.playerDirection === DIR_9.Idle;

    constructor() {
        // super(new Vector2(128, 128), new Vector2(0, 0), new Vector2(0, 0), 64, 128);
        void this.loadSprite();
    }

    async loadSprite() {
        // TODO: webp vs avif (vs png?)
        this.sprite = await loadImage('Nomad_Atlas.webp');
    }
}

// TODO: flip the bits on keyboard input instead?
/** Translates the player's 8-directional keyboard input into a {@link Dir9} using a bitmask.*/
export function updatePlayerDirection(player: Player) {
    let bitmask = 0;

    // Set bits based on input
    bitmask |= player.pressingUp ? NORTH_BIT : 0;
    bitmask |= player.pressingDown ? SOUTH_BIT : 0;
    bitmask |= player.pressingLeft ? WEST_BIT : 0;
    bitmask |= player.pressingRight ? EAST_BIT : 0;

    // Cancel out conflicting directions
    if ((bitmask & NORTH_BIT) && (bitmask & SOUTH_BIT)) {
        // Clear both UP and DOWN bits (vertical movement canceled out)
        bitmask &= ~NORTH_BIT;
        bitmask &= ~SOUTH_BIT;
    }
    if ((bitmask & WEST_BIT) && (bitmask & EAST_BIT)) {
        // Clear both LEFT and RIGHT bits (horizontal movement canceled out)
        bitmask &= ~WEST_BIT;
        bitmask &= ~EAST_BIT;
    }

    console.assert([0b0000, 0b0001, 0b1001, 0b1000, 0b1010, 0b0010, 0b0110, 0b0100, 0b0101].includes(bitmask));
    // Execute the action for the player direction, asserting idle as a default
    (bitmaskActionMap[bitmask] ?? bitmaskActionMap[0b0000])!(player);
}




/** Naive spatial partitioning strategy that divides the world into a single cell. */
class SingleCell implements PartitionStrategy {

    private shapes: Shape[] = [];

    insert(shape: Shape): void {
        this.shapes.push(shape);
    }
    remove(shape: Shape): void {
        this.shapes = this.shapes.filter(b => b !== shape);
    }
    update(shape: Shape): void {
        this.shapes = this.shapes.map(b => b === shape ? shape : b);
    }
    query(minX: number, minY: number, maxX: number, maxY: number): Shape[] {
        const result: Shape[] = [];

        for (const shape of this.shapes) {
            if (shape.center.x >= minX && shape.center.x <= maxX && shape.center.y >= minY && shape.center.y <= maxY) {
                result.push(shape);
            }
        }

        return result;
    }
    all(): Shape[] {
        return this.shapes;
    }
}

class SpatialHashGrid implements PartitionStrategy {
    insert(shape: Shape): void {
        throw new Error("Method not implemented.");
    }
    remove(shape: Shape): void {
        throw new Error("Method not implemented.");
    }
    update(shape: Shape): void {
        throw new Error("Method not implemented.");
    }
    query(minX: number, minY: number, maxX: number, maxY: number): Shape[] {
        throw new Error("Method not implemented.");
    }
    all(): Shape[] {
        throw new Error("Method not implemented.");
    }
}

// Spatial Grid, BVH, QuadTree

// TODO: make this a proper function and load player/spritesheet sprites better
async function loadImage(src: string) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
}
