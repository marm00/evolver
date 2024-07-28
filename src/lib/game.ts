import { Vector2 } from "./vector2";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

const AUTO_AIM = true;
const AUTO_ATTACK = true;

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

/** Maps a {@link Dir9} to a unit vector. */
const dir9VectorMap: Record<Dir9, Vector2> = {
    [DIR_9.Idle]: new Vector2(0, 0),
    [DIR_9.N]: new Vector2(0, 1),
    [DIR_9.NE]: new Vector2(Math.SQRT1_2, Math.SQRT1_2),
    [DIR_9.E]: new Vector2(1, 0),
    [DIR_9.SE]: new Vector2(Math.SQRT1_2, -Math.SQRT1_2),
    [DIR_9.S]: new Vector2(0, -1),
    [DIR_9.SW]: new Vector2(-Math.SQRT1_2, -Math.SQRT1_2),
    [DIR_9.W]: new Vector2(-1, 0),
    [DIR_9.NW]: new Vector2(-Math.SQRT1_2, Math.SQRT1_2)
}

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
    world.insert(player);
    world.insert({
        width: 128,
        height: 128,
        position: new Vector2(-300, 500),
        direction: 90 * Math.PI / 180,
        velocity: new Vector2(0, 0)
    });
    world.insert({
        width: 64,
        height: 64,
        position: new Vector2(0, 0),
        direction: 0 * Math.PI / 180,
        velocity: new Vector2(0, 0)
    });
    world.insert({ // Not rendered because it's too far away
        width: 128,
        height: 128,
        position: new Vector2(2000, 2000),
        direction: 270 * Math.PI / 180,
        velocity: new Vector2(0, 0)
    });
    world.insert({
        width: 128,
        height: 128,
        position: new Vector2(248, 248),
        direction: 0 * Math.PI / 180,
        velocity: new Vector2(0, 0)
    })
    return { world, player, canvasCenterX: 0, canvasCenterY: 0 };
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, time: number, deltaTime: number) {
    const cx = gameState.canvasCenterX;
    const cy = gameState.canvasCenterY;
    const pp = gameState.player.position;
    const mp = gameState.player.mousePosition;
    // Project the canvas mouse position to the world coordinate system
    mp.set(pp.x - gameState.player.mouseCanvasDX, pp.y + gameState.player.mouseCanvasDY);

    const thingsToRender = gameState.world.query(pp.x - cx, pp.y - cy, pp.x + cx, pp.y + cy);

    const sprite: HTMLImageElement | null = gameState.player.sprite;
    if (!sprite) return;
    const dx = (ctx.canvas.width - gameState.player.displayWidth) / 2;
    const dy = (ctx.canvas.height - gameState.player.displayHeight) / 2;
    let imageOffset: number[] = [0, 0];

    // We probably dont want to update the player direction directly here, maybe use a separate vector or scalar
    if (gameState.player.playerDirection !== DIR_9.Idle) {
        if (gameState.player.playerDirection === DIR_9.N) {
            pp.add(new Vector2(0, 1).scale(1.1));
            imageOffset = [3, 2];
        }
        if (gameState.player.playerDirection === DIR_9.S) {
            pp.add(new Vector2(0, -1).scale(1.1));
            imageOffset = [2, 3];
        }
        if (gameState.player.playerDirection === DIR_9.W) {
            pp.add(new Vector2(-1, 0).scale(1.1));
            imageOffset = [3, 3];
        }
        if (gameState.player.playerDirection === DIR_9.E) {
            pp.add(new Vector2(1, 0).scale(1.1));
            imageOffset = [0, 2];
        }
        if (gameState.player.playerDirection === DIR_9.NW) {
            pp.add(new Vector2(-1, 1).scale(1.1));
            imageOffset = [2, 2];
        }
        if (gameState.player.playerDirection === DIR_9.NE) {
            pp.add(new Vector2(1, 1).scale(1.1));
            imageOffset = [1, 2];
        }
        if (gameState.player.playerDirection === DIR_9.SW) {
            pp.add(new Vector2(-1, - 1).scale(1.1));
            imageOffset = [1, 3];
        }
        if (gameState.player.playerDirection === DIR_9.SE) {
            pp.add(new Vector2(1, -1).scale(1.1));
            imageOffset = [0, 3];
        }
    }

    ctx.clearRect(0, 0, gameState.canvasCenterX*2, gameState.canvasCenterY*2);
    ctx.drawImage(sprite, 128 * imageOffset[0]!, 128 * imageOffset[1]!, gameState.player.displayWidth, gameState.player.displayHeight, dx, dy, gameState.player.displayWidth, gameState.player.displayHeight);
    ctx.save();
    ctx.translate(gameState.canvasCenterX, gameState.canvasCenterY); // Move origin to center of canvas
    ctx.scale(1, -1); // Invert Y axis
    ctx.translate(-pp.x, -pp.y); // Translate based on player position
    gameState.player.direction = dir9VectorMap[gameState.player.playerDirection].direction();
    for (const thing of [...thingsToRender]) {
        const directionRadius = 64;
        const ng = Vector2.fromPolar(thing.direction, directionRadius);
        const direction = thing.position.clone().add(ng);

        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.fillStyle = '#00ff00';
        ctx.arc(thing.position.x, thing.position.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(thing.position.x, thing.position.y, directionRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.moveTo(thing.position.x, thing.position.y);
        ctx.lineTo(direction.x, direction.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const angle = Math.atan2(direction.y - thing.position.y, direction.x - thing.position.x);
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

        ctx.strokeStyle = '#ff0000';
        ctx.strokeRect(thing.position.x - (thing.width / 2), thing.position.y - (thing.height / 2), thing.width, thing.height);

        ctx.beginPath();
        ctx.fillStyle = '#00a2ff';
        ctx.arc(direction.x, direction.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
    }
    ctx.beginPath();

    ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(mp.x, mp.y);
    ctx.stroke();
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

/** Maps a [bitmask](https://en.wikipedia.org/wiki/Mask_(computing)) to the corresponding {@link Dir9} state. */
const bitmaskDir9Map: Record<number, Dir9> = {
    0b0000: DIR_9.Idle,
    0b0001: DIR_9.N,
    0b1001: DIR_9.NE,
    0b1000: DIR_9.E,
    0b1010: DIR_9.SE,
    0b0010: DIR_9.S,
    0b0110: DIR_9.SW,
    0b0100: DIR_9.W,
    0b0101: DIR_9.NW
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

    player.playerDirection = bitmaskDir9Map[bitmask] ?? DIR_9.Idle;
}

/** Represents the player (main character) in the game. */
class Player implements Bbox {
    sprite: HTMLImageElement | null = null;
    width = 64;
    height = 128;
    position = new Vector2(248, 248);
    direction = Math.PI;
    idle = true;
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
    playerDirection: Dir9 = DIR_9.Idle;
    velocity = new Vector2(0, 0);
    displayWidth = 128;
    displayHeight = 128;

    constructor() {
        void this.loadSprite();
    }

    async loadSprite() {
        this.sprite = await loadImage('Nomad_Atlas.webp');
    }
}

/** 
 * TODO: we want some sort of way to get the vertices (to rotate it correctly on the canvas)
 * 
 * The `Bbox` interface defines a bounding box for a game object in 2D space.
 * 
 * @property width - The width of the bbox in absolute pixels.
 * @property height - The height of the bbox in absolute pixels.
 * @property position - The position of the bbox defined as a 2D vector.
 * @property direction - The angle or direction the bbox is facing, in 360 degrees (radians).
 * @property velocity - The control vector of the bbox, representing its movement in 2D space.
 */
interface Bbox {
    width: number;
    height: number;
    position: Vector2;
    direction: number;
    velocity: Vector2;
}

/**
 * The `PartitionStrategy` interface defines a spatial partitioning algorithm that
 * models the game objects. The goal is to divide the world into smaller regions
 * based on the positions of objects in 2D space. This allows us to perform efficient spatial 
 * queries to find adjacent elements, aiding e.g. the *broad phase* of collision detection.
 */
interface PartitionStrategy {
    // insert(bbox: Bbox, layer: number): void;
    insert(bbox: Bbox): void;
    remove(bbox: Bbox): void;
    update(bbox: Bbox): void;
    query(minX: number, minY: number, maxX: number, maxY: number): Bbox[];
}

/** Naive spatial partitioning strategy that divides the world into a single cell. */
class SingleCell implements PartitionStrategy {

    private bboxes: Bbox[] = [];

    insert(bbox: Bbox): void {
        this.bboxes.push(bbox);
    }
    remove(bbox: Bbox): void {
        this.bboxes = this.bboxes.filter(b => b !== bbox);
    }
    update(bbox: Bbox): void {
        this.bboxes = this.bboxes.map(b => b === bbox ? bbox : b);
    }
    query(minX: number, minY: number, maxX: number, maxY: number): Bbox[] {
        const result: Bbox[] = [];

        for (const bbox of this.bboxes) {
            if (bbox.position.x >= minX && bbox.position.x <= maxX && bbox.position.y >= minY && bbox.position.y <= maxY) {
                result.push(bbox);
            }
        }

        return result;
    }
}

class SpatialHashGrid implements PartitionStrategy {
    insert(bbox: Bbox): void {
        throw new Error("Method not implemented.");
    }
    remove(bbox: Bbox): void {
        throw new Error("Method not implemented.");
    }
    update(bbox: Bbox): void {
        throw new Error("Method not implemented.");
    }
    query(x: number, y: number): Bbox[] {
        throw new Error("Method not implemented.");
    }
}

// Spatial Grid, BVH, QuadTree, AABB, OBB
// SAT