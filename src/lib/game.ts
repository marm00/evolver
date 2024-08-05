import { Vector2 } from "./vector2";
import { Shape, Circle, OrientedRect, Rect } from "./shape";
import { Pool } from "./pool";
import { _Math } from "./mathUtils";
import { Matrix3 } from "./matrix3";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

const AUTO_AIM = true;
const AUTO_ATTACK = true;

/** Pixels per second: 5m/s (avg run speed) * 73pixels/m (128px=1.75meters) = 365pixels/s. */
const HUMAN_VELOCITY = 365*1;
const HUMAN_VELOCITY_DIAGONAL = HUMAN_VELOCITY * Math.SQRT1_2;

/** Pixels per second: a spear throw is n times faster than human running speed. */
const SPEAR_VELOCITY = HUMAN_VELOCITY * 4;

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

// TODO: make this a proper function and load player/spritesheet sprites better
async function loadImage(src: string) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
}

export async function createGame(strategy: string): Promise<Game> {
    const world = new SingleCell();
    const player = new Player();

    const tor = new OrientedRect(new Vector2(128, 0), new Vector2(0, 0), new Vector2(0, 0), 37, 71, 0);
    tor.setAngle(_Math.TAU*.34);
    tor.updateVertices();
    world.insert(tor);

    world.insert(player);
    world.insert(new Circle(new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 0), 64));
    world.insert(new Rect(new Vector2(128, 128), new Vector2( 0, 0), new Vector2(0, 0), 128, 128));
    world.insert(new Rect(new Vector2(0, 256), new Vector2( 0, 0), new Vector2(0, 0), 512, 512));
    world.insert(new Circle(new Vector2(-64, -128), new Vector2(Math.SQRT1_2, Math.SQRT1_2), new Vector2(0, 0), 64));
    return { world, player, canvasCenterX: 0, canvasCenterY: 0 };
}

const m3Pool = new Pool<Matrix3>(Matrix3.identity);
const v2Pool = new Pool<Vector2>(Vector2.zero);
const oRectPool = new Pool<OrientedRect>(OrientedRect.zero);
const spearPool = new Pool<OrientedRect>(OrientedRect.zero, 0);

/**
 * 
 * @param target Position of the target in world space.
 */
export function attack(target: Vector2, player: Player, world: PartitionStrategy) {
    const spear = spearPool.alloc();
    spear.center.copy(player.center);
    const targetTemp = v2Pool.alloc();
    spear.velocity.copy(targetTemp.copy(target).sub(spear.center).normalize().scale(SPEAR_VELOCITY));
    v2Pool.free(targetTemp);
    player.attackPos.copy(spear.center);
    world.insert(spear);
    // TODO: lifetime, set rotation, reuse spear instance on lifetime end
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, elapsedTime: number, deltaTime: number) {
    const cx = gameState.canvasCenterX, cy = gameState.canvasCenterY;
    const pp = gameState.player.center, pv = gameState.player.velocity;
    const mp = gameState.player.mousePosition;
    // TODO: maybe floor/round mouse position when the canvas center is not an integer (but ends on .5)
    // Project the canvas mouse position to the world coordinate system
    mp.set(pp.x - gameState.player.mouseCanvasDX, pp.y + gameState.player.mouseCanvasDY);

    // Update player position
    const pvTemp = v2Pool.alloc();
    pp.add(pvTemp.copy(pv).scale(deltaTime));
    v2Pool.free(pvTemp);

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

    ctx.clearRect(0, 0, gameState.canvasCenterX * 2, gameState.canvasCenterY * 2);
    ctx.drawImage(sprite, 128 * imageOffset[0]!, 128 * imageOffset[1]!, gameState.player.displayWidth, gameState.player.displayHeight, dx, dy, gameState.player.displayWidth, gameState.player.displayHeight);
    ctx.save();
    ctx.transform(
        1, 0,                           // Horizontal scaling and skewing
        0, -1,                          // Vertical scaling and skewing
        gameState.canvasCenterX - pp.x, // Horizontal translation to center player x
        gameState.canvasCenterY + pp.y  // Vertical translation to center player y
    );
    for (const thing of thingsToRender) {
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
            thing.setDimensions(thing.width + deltaTime * 3, thing.height + deltaTime * 1.5, thing.angle + deltaTime * 2);
            thing.updateVertices();
            const vertices = thing.vertices;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(vertices[i]!.x, vertices[i]!.y);
                ctx.lineTo(vertices[(i + 1) % 4]!.x, vertices[(i + 1) % 4]!.y);
                ctx.stroke();
            }
        }
    }
    ctx.beginPath();

    // Draw line from player to mouse position
    ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
    ctx.closePath();

    // TODO: this temporary draws attack pos, remove it
    ctx.beginPath();
    ctx.lineTo(mp.x, mp.y);
    ctx.fillStyle = '#fbff00';
    ctx.arc(gameState.player.attackPos.x, gameState.player.attackPos.y, 10, 0, _Math.TAU);
    ctx.fill();
    ctx.closePath();

    // Actually draw the player
    ctx.restore();
}
interface Game {
    world: PartitionStrategy;
    player: Player;
    canvasCenterX: number;
    canvasCenterY: number;
}

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

/** Represents the player (main character) in the game. */
class Player extends Rect {
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

    pressingUp = false;
    pressingDown = false;
    pressingLeft = false;
    pressingRight = false;
    idle = () => this.playerDirection === DIR_9.Idle;

    attackPos: Vector2;

    constructor() {
        super(new Vector2(128, 128), new Vector2(0, 0), new Vector2(0, 0), 64, 128);
        void this.loadSprite();
        this.attackPos = new Vector2(0, 0);
    }

    async loadSprite() {
        this.sprite = await loadImage('Nomad_Atlas.webp');
    }
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
}

// Spatial Grid, BVH, QuadTree