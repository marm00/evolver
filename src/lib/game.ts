import { Vector2 } from "./vector2";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

// type PlayerDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** 0b0001 = Up Direction */
const NORTH_BIT = 1;
/** 0b0010 = Down Direction */
const SOUTH_BIT = 2;
/** 0b0100 = Left Direction */
const WEST_BIT = 4;
/** 0b1000 = Right Direction */
const EAST_BIT = 8;

// TODO: could map this to a vector and/or sprite, or change the enum to vector type
/** 8-directional movement direction (e.g. NorthEast), plus 'idle' state. */  
enum Direction {
    Idle,
    N,       // Up 
    NE,   // UpRight
    E,        // Right
    SE,   // DownRight
    S,       // Down
    SW,   // DownLeft
    W,        // Left
    NW    // UpLeft
}

/** Maps a {@link Direction} to a unit vector. */
const directionVectorMap: Record<Direction, Vector2> = {
    [Direction.Idle]: new Vector2(0, 0),
    [Direction.N]: new Vector2(0, 1),
    [Direction.NE]: new Vector2(Math.SQRT1_2, Math.SQRT1_2),
    [Direction.E]: new Vector2(1, 0),
    [Direction.SE]: new Vector2(Math.SQRT1_2, -Math.SQRT1_2),
    [Direction.S]: new Vector2(0, -1),
    [Direction.SW]: new Vector2(-Math.SQRT1_2, -Math.SQRT1_2),
    [Direction.W]: new Vector2(-1, 0),
    [Direction.NW]: new Vector2(-Math.SQRT1_2, Math.SQRT1_2)
};

async function loadImage(src: string) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
}

export async function createGame(strategy: string): Promise<Game> {
    const world = new SingleCell();
    world.insert({
        width: 128,
        height: 128,
        position: new Vector2(-300, 500),
        direction: 0,
        velocity: new Vector2(0, 0)
    });
    world.insert({
        width: 128,
        height: 128,
        position: new Vector2(0, 0),
        direction: 0,
        velocity: new Vector2(0, 0)
    });
    world.insert({ // Not rendered because it's too far away
        width: 128,
        height: 128,
        position: new Vector2(2000, 2000),
        direction: 0,
        velocity: new Vector2(0, 0)
    });
    world.insert({ // player
        width: 64,
        height: 128,
        position: new Vector2(248, 248),
        direction: Math.PI,
        velocity: new Vector2(0, 0),
    })
    // world.insert({
    //     width: 128,
    //     height: 128,
    //     position: new Vector2(500, 500),
    //     direction: 0,
    //     velocity: new Vector2(0, 0)
    // })
    const player = new Player();
    return { world, player, canvasBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, time: number, deltaTime: number) {
    // game.insert({width: 128, height: 128, position: new Vector2(0, 0), direction: 0, velocity: new Vector2(0, 0)});
    // console.log(game.query(0,0)[0])
    const sprite: HTMLImageElement | null = gameState.player.sprite;
    if (!sprite) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const dx = (ctx.canvas.width - gameState.player.displayWidth) / 2;
    const dy = (ctx.canvas.height - gameState.player.displayHeight) / 2;


    const thingsToRender = gameState.world.query(gameState.canvasBounds.minX, gameState.canvasBounds.minY, gameState.canvasBounds.maxX, gameState.canvasBounds.maxY);
    let imageOffset: number[] = [0, 0];

    // We probably dont want to update the player direction directly here, maybe use a separate vector or scalar
    gameState.player.playerDirection = updatePlayerDirection(gameState.player);
    const prev = gameState.player.position.clone();
    if (gameState.player.playerDirection !== Direction.Idle) {
        if (gameState.player.playerDirection === Direction.N) {
            gameState.player.position.add(new Vector2(0, 1).scale(1.1));
            imageOffset = [3, 2];
        }
        if (gameState.player.playerDirection === Direction.S) {
            gameState.player.position.add(new Vector2(0, -1).scale(1.1));
            imageOffset = [2, 3];
        }
        if (gameState.player.playerDirection === Direction.W) {
            gameState.player.position.add(new Vector2(-1, 0).scale(1.1));
            imageOffset = [3, 3];
        }
        if (gameState.player.playerDirection === Direction.E) {
            gameState.player.position.add(new Vector2(1, 0).scale(1.1));
            imageOffset = [0, 2];
        }
        if (gameState.player.playerDirection === Direction.NW) {
            gameState.player.position.add(new Vector2(-1, 1).scale(1.1));
            imageOffset = [2, 2];
        }
        if (gameState.player.playerDirection === Direction.NE) {
            gameState.player.position.add(new Vector2(1, 1).scale(1.1));
            imageOffset = [1, 2];
        }
        if (gameState.player.playerDirection === Direction.SW) {
            gameState.player.position.add(new Vector2(-1, - 1).scale(1.1));
            imageOffset = [1, 3];
        }
        if (gameState.player.playerDirection === Direction.SE) {
            gameState.player.position.add(new Vector2(1, -1).scale(1.1));
            imageOffset = [0, 3];
        }
    }

    ctx.drawImage(sprite, 128 * imageOffset[0]!, 128 * imageOffset[1]!, gameState.player.displayWidth, gameState.player.displayHeight, dx, dy, gameState.player.displayWidth, gameState.player.displayHeight);

    // console.log('Player direction:',gameState.player.direction);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.scale(1, -1);
    ctx.translate(-(gameState.player.position.x), -(gameState.player.position.y));
    // ctx.transform(1, 0, 0, -1, -ctx.canvas.width, ctx.canvas.height);
    for (const thing of [...thingsToRender, gameState.player]) {
        const directionRadius = 64;
        // const exampleDirection = new Vector2(0.3, -1);
        const exampleDirection = directionVectorMap[gameState.player.playerDirection].clone();
        const direction = thing.position.clone().add(exampleDirection.setLength(directionRadius));

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

    // Actually draw the player
    // const newPlayerPos = gameState.player.position.clone().add(new Vector2(1, -1).scale(gameState.player.width/2));
    // ctx.strokeRect(gameState.player.position.x - (gameState.player.width /2), gameState.player.position.y - (gameState.player.height /2), gameState.player.width, gameState.player.height);
    ctx.restore();
}

export async function updateGame2(ctx: CanvasRenderingContext2D) {
    const GAME_CELL = 64;
    const GAME_FACTOR = 100;
    const GAME_WIDTH = GAME_CELL * GAME_FACTOR;
    const GAME_HEIGHT = GAME_CELL * GAME_FACTOR;
    // console.log(ctx.canvas.width, ctx.canvas.height);
    const cy = ctx.canvas.height / 2;
    const cx = ctx.canvas.width / 2;
    // console.log(ctx);
    // ctx.drawImage(await loadImage('grass.png'), 0, 0);
    const rnd: number[] = [0, 128, 256, 384, 512];
    // get random
    // const a = rnd[Math.floor(Math.random() * rnd.length)] ?? 0;
    // const b = rnd[Math.floor(Math.random() * rnd.length)] ?? 0;
    const sx = 256;
    const sy = 256;
    ctx.drawImage(await loadImage('Nomad_Atlas.webp'), sx, sy, 128, 128, cx - GAME_CELL, cy - GAME_CELL, 128, 128);
    // ctx.drawImage(await loadImage('Nomad_Atlas.webp'), sx, sy, 128, 128, cx, cy, 128, 128); 
    // draw rectangle
    // ctx.fillStyle = '#00ff00';
    // ctx.fillRect(cx-GAME_CELL, cy-GAME_CELL, GAME_CELL*2, GAME_CELL*2);
}

async function collision() {
    // We want to exclude static objects from spatial partitioning
    // Broad phase

    // Narrow phase
    return;
}

interface Game {
    world: PartitionStrategy;
    player: Player;
    canvasBounds: Bounds;
}

/** Maps a [bitmask](https://en.wikipedia.org/wiki/Mask_(computing)) to the corresponding {@link Direction} state. */
const bitmaskDirectionMap: Record<number, Direction> = {
    0b0000: Direction.Idle,
    0b0001: Direction.N,
    0b1001: Direction.NE,
    0b1000: Direction.E,
    0b1010: Direction.SE,
    0b0010: Direction.S,
    0b0110: Direction.SW,
    0b0100: Direction.W,
    0b0101: Direction.NW
};

/** 
 * TODO: Currently, this gets called every frame. It should only be called/executed keyboard input changes
 * 
 * Translates the player's 8-directional keyboard input into a {@link Direction} using a bitmask.
 */
function updatePlayerDirection(player: Player): Direction {
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

    return bitmaskDirectionMap[bitmask] ?? Direction.Idle;
}

class Player implements Bbox {
    sprite: HTMLImageElement | null = null;
    width = 64;
    height = 128;
    position = new Vector2(248, 248);
    direction = Math.PI;
    idle = true;
    mousePosition = new Vector2(0, 0);
    pressingUp = false;
    pressingDown = false;
    pressingLeft = false;
    pressingRight = false;
    playerDirection = Direction.Idle;
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

interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
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