import { Vector2 } from "./vector2";
import { Shape, Circle, OrientedRect, Rect } from "./shape";
import { Pool, Pool2 } from "./pool";
import { _Math } from "./mathUtils";
import { Matrix3 } from "./matrix3";
import { Meteorite, Obsidian, RESOURCE_STATE, Spear, Spirit } from "./spear";

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
const METEORITE_LIFETIME = 2;

// TODO: pickup radius should be stored on the player not resources
/** Pick-up radius of an obsidian. */
const OBSIDIAN_RADIUS = 32;
/** In pixels per second. */
const OBSIDIAN_VELOCITY = 12;
const OBSIDIAN_ACCELERATION = 1 + (6 / 100);
/** Threshold for finishing a lerp to a target in pixels. */
const OBSIDIAN_THRESHOLD = 4;
const OBSIDIAN_JUMP_DISTANCE = OBSIDIAN_RADIUS * 5;

const SPIRIT_RADIUS = 26;
const SPIRIT_VELOCITY = HUMAN_VELOCITY * 0.9;

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
    spirit: Spirit;
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
    const meteoritePool = new Pool<Meteorite>((ox = 0, oy = 0, tx = 0, ty = 0, radius = 0,
        lifetime = 0) => new Meteorite(ox, oy, tx, ty, radius, lifetime), 0);
    const obsidianPool = new Pool<Obsidian>((cx = 0, cy = 0, radius = 0, velocityScalar = 0) => new Obsidian(cx, cy, radius, velocityScalar), 0);

    const world = new SingleCell();
    const player = new Player();
    // world.insert(player); // TODO: player to world?
    const spirit = new Spirit(0, 0, SPIRIT_RADIUS);

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
    return { world, player, m3Pool, v2Pool, v2Pool2, oRectPool, spearPool, spears: [], meteoritePool, meteorites: [], obsidianPool, obsidians: [], spirit };
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
    const meteorite = meteoritePool.alloc(target.x, target.y, origin.x, origin.y, METEORITE_RADIUS, METEORITE_LIFETIME);
    meteorites.push(meteorite);
}

export function dropObsidian(target: Vector2, obsidianPool: Pool<Obsidian>, obisidians: Obsidian[]) {
    const obsidian = obsidianPool.alloc(target.x, target.y, OBSIDIAN_RADIUS, OBSIDIAN_VELOCITY);
    obisidians.push(obsidian);
}

export function spawnSpirit(target: Vector2, spirit: Spirit) {
    if (!spirit.active) {
        spirit.center.copy(target);
        spirit.active = true;
    }
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, elapsedTime: number, deltaTime: number) {
    const cx = gameState.player.canvasCenterX, cy = gameState.player.canvasCenterY;
    const pp = gameState.player.center, pv = gameState.player.velocity;
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
        t = t * t; // Ease in with a quadratic time factor, cheaper than true physics simulation
        meteorite.center.lerpVectors(meteorite.origin, meteorite.target, t);
        const displayRadius = _Math.lerp(0.2, 1, t) * meteorite.radius;

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
                if (c.distanceToSqr(pp) <= obsidian.radiusSqr) {
                    jump.copy(c).sub(pp).normalize().scale(OBSIDIAN_JUMP_DISTANCE).add(c);
                    obsidian.resourceState = RESOURCE_STATE.Jumping;
                }
                break;
            }
            case RESOURCE_STATE.Jumping: {
                c.lerp(jump, _Math.clamp(OBSIDIAN_VELOCITY * deltaTime, 0, 1));
                if (c.distanceToSqr(jump) < OBSIDIAN_THRESHOLD) {
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
                obsidian.velocityScalar *= OBSIDIAN_ACCELERATION;
                c.lerp(pp, _Math.clamp(obsidian.velocityScalar * deltaTime * deltaTime, 0, 1));
                if (c.distanceToSqr(pp) < OBSIDIAN_THRESHOLD) {
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

    // Move spirit
    const spirit = gameState.spirit;
    if (spirit.active) {
        const sc = spirit.center;
        const p_sv = gameState.v2Pool.alloc(pp.x, pp.y);
        sc.add(p_sv.sub(sc).normalize().scale(SPIRIT_VELOCITY * deltaTime));
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff44';
        ctx.arc(spirit.center.x, spirit.center.y, spirit.radius, 0, _Math.TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
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
    radiusSqr = this.radius * this.radius;

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
