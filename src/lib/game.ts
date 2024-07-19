// function that takes in a canvasrenderingcontext and draws a rectangle

import { Vector2 } from "./vector2";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

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
        position: new Vector2(0, 0),
        direction: 0,
        velocity: new Vector2(0, 0)
    });
    const player = new Player();
    return { world, player };
}

export async function updateGame(ctx: CanvasRenderingContext2D, gameState: Game, time: number, deltaTime: number) {
    // TODO: project the viewport to the world and fix code

    // game.insert({width: 128, height: 128, position: new Vector2(0, 0), direction: 0, velocity: new Vector2(0, 0)});
    // console.log(game.query(0,0)[0])
    const sprite: HTMLImageElement | null = gameState.player.sprite;
    if (!sprite) return;

    const dx = (ctx.canvas.width - gameState.player.displayWidth) / 2;
    const dy = (ctx.canvas.height - gameState.player.displayHeight) / 2;

    ctx.drawImage(sprite, 0, 0, gameState.player.displayWidth, gameState.player.displayHeight, dx, 
        dy, gameState.player.displayWidth, gameState.player.displayHeight);
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
}

class Player implements Bbox {
    sprite: HTMLImageElement | null = null;
    width = 64;
    height = 128;
    position = new Vector2(248, 248);
    direction = Math.PI;
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
    query(x: number, y: number): Bbox[];
}

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

    /** All bboxes are contained in the same cell, so the entire list is returned. */
    query(_x = 0, _y = 0): Bbox[] {
        return this.bboxes;
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