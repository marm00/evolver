import { Vector2 } from "./vector2";
import { Shape, Circle, OrientedRect, Rect } from "./shape";
import { Pool, Pool2 } from "./pool";
import { _Math } from "./mathUtils";
import { Matrix3 } from "./matrix3";
import { defaultFissure, Lion, Meteorite, Obsidian, Orb, Rectangle, RESOURCE_STATE, Rupture, Spear, Thunderstorm, Wall } from "./spear";
import { AgentWorker, Obstacle, addObstacle, KdTree, addCircle } from "./orca";

const GAME_WIDTH = 6400;
const GAME_HEIGHT = 6400;

const AUTO_AIM = true;
const AUTO_ATTACK = true;

const METER_TO_PIXELS = 73.14;

/** Pixels per second: 5m/s (avg run speed) * 73pixels/m (128px=1.75meters) = 365pixels/s. */
const HUMAN_VELOCITY = 384; // TODO: was 365, changed to divisible by 64
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
const OBSIDIAN_THRESHOLD = 4; // TODO: replace with epsilon?
const OBSIDIAN_JUMP_DISTANCE = OBSIDIAN_RADIUS * 5;

const THUNDERSTORM_RADIUS = 96;
/** Y-axis offset for the center of the cloud above the shadow. */
const THUNDERSTORM_OFFSET = THUNDERSTORM_RADIUS * 3;
/** Factor for when easing starts, where `n * collision distance` is the starting point. */
const THUNDERSTORM_VELOCITY = HUMAN_VELOCITY * 1.5;
const THUNDERSTORM_EASING_FACTOR = _Math.pow2(2);
/** Threshold for stopping storm movement in pixels (edge-to-edge collision). */
const THUNDERSTORM_THRESHOLD = 1; // TODO: replace with epsilon?

const ORB_RADIUS = 16;
const ORB_OFFSET = 256;
const ORB_CIRCUMFERENCE = ORB_OFFSET * _Math.TAU;
/** Pixels per second. */
const ORB_VELOCITY = ORB_CIRCUMFERENCE / 6;

const LION_RADIUS = 16;
const LION_VELOCITY = HUMAN_VELOCITY / 2;
const TEMPLION1_MAXSPEED = LION_VELOCITY * 1;
const TEMPLIONX_MAXSPEED = TEMPLION1_MAXSPEED * 1.0;
const LION_MAX_NEIGHBORS = 10;
const LION_NEIGHBOR_DIST_SQ = _Math.pow2(50);

// TODO: settle on a low time/obst time horizon (given unusually high velocity-normally unit vectors)
// const TIME_HORIZON = 0.05;
const TIME_HORIZON = 0.05;
const INV_TIME_HORIZON = 1 / TIME_HORIZON;
const OBST_TIME_HORIZON = 3;
const INV_OBST_TIME_HORIZON = 1 / OBST_TIME_HORIZON;

// NOTE: as fissure count grows, the width and max (step) delta will eventually
// cause the fissures to overlap. This is probably a desired behavior, as
// decreasing the width is unintuitive
const RUPTURE_COOLDOWN = 1; // sec
const FISSURE_COUNT = 1;
const FISSURE_WIDTH = 25;
const FISSURE_STEP_LENGTH = 45;
const FISSURE_MAX_LENGTH = 300;
const FISSURE_INTERVAL = 1 / 7; // sec
/** Maximum (abs) difference between step angles in radians. */
const FISSURE_MAX_DELTA = _Math.degToRad(30);

const SIMULATION_POSITIONS = [new Vector2(0, 0), new Vector2(300, 300)];
let simulationIndex = 0;

// TODO: the game contains lists for different things (like spears), pools, and the partinioning contains references
export interface Game {
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
    rupture: Rupture;
    walls: Wall[]; // TODO: different data structure?
    lionPool: Pool<Lion>;
    lions: Lion[]; // TODO: different data structure?
    agentWorker: AgentWorker;
    obstacles: Obstacle[];
    kdTree: KdTree;
    simulationCycle: () => void;
    assets: Assets;
    sprites: Sprite[];
}


type Asset = ImageData;

type Assets = Map<string, Asset>;
interface Sprite {
    asset: Asset;
    position: Vector2;
}

export interface Display {
    ctx: CanvasRenderingContext2D;
    backCtx: OffscreenCanvasRenderingContext2D;
    backImageData: ImageData;
}

export function createDisplay(ctx: CanvasRenderingContext2D, width: number, height: number): Display {
    const backImageData = new ImageData(width, height);
    backImageData.data.fill(255);
    const backCanvas = new OffscreenCanvas(width, height);
    const backCtx = backCanvas.getContext('2d');
    if (backCtx === null) throw new Error('2D context not found');
    backCtx.imageSmoothingEnabled = false;
    return {
        ctx,
        backCtx,
        backImageData
    };
}

export function resizeDisplay(display: Display, newWidth: number, newHeight: number) {
    const newBackImageData = new ImageData(newWidth, newHeight);
    // bg-blue-950 tailwind
    for (let i = 0; i < newBackImageData.data.length; i += 4) {
        newBackImageData.data[i + 0] = 23;
        newBackImageData.data[i + 1] = 37;
        newBackImageData.data[i + 2] = 85;
        newBackImageData.data[i + 3] = 255;
    }
    display.backImageData = newBackImageData;
    const offscreenCanvas = display.backCtx.canvas;
    offscreenCanvas.width = newWidth;
    offscreenCanvas.height = newHeight;
    display.backCtx.imageSmoothingEnabled = false;
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
    const lionPool = new Pool<Lion>((cx = 0, cy = 0, radius = 0, maxSpeed = 0, maxNeighbors = 0, neighborDistSq = 0) =>
        new Lion(cx, cy, radius, maxSpeed, maxNeighbors, neighborDistSq), 0);


    const world = new SingleCell();
    const player = new Player();
    // world.insert(player); // TODO: player to world?
    const thunderstorm = new Thunderstorm(0, 0, THUNDERSTORM_RADIUS, THUNDERSTORM_OFFSET);
    const orb = new Orb(0, 0, ORB_RADIUS, ORB_OFFSET, ORB_VELOCITY);
    const rupture = new Rupture(FISSURE_COUNT, FISSURE_STEP_LENGTH, FISSURE_WIDTH, FISSURE_MAX_LENGTH, FISSURE_INTERVAL, RUPTURE_COOLDOWN);
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

    const tor2 = OrientedRect.zero().setDimensions(128, 35, new Vector2(-10, 3.3).dir());
    tor2.center.set(-20, -20);
    tor2.velocity.set(-10, 3.3)
    world.insert(tor2);

    world.insert(new Circle(new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0), 64));
    world.insert(new Rect(new Vector2(128, 128), new Vector2(0, 0), new Vector2(0, 0), 128, 128));
    world.insert(new Rect(new Vector2(0, 256), new Vector2(0, 0), new Vector2(0, 0), 512, 512));
    world.insert(new Circle(new Vector2(-64, -128), new Vector2(Math.SQRT1_2, Math.SQRT1_2), new Vector2(0, 0), 64));

    const tempLion1 = new Lion(-200, 0, LION_RADIUS, TEMPLION1_MAXSPEED, LION_MAX_NEIGHBORS, LION_NEIGHBOR_DIST_SQ);
    // tempLion1.prefVelocity.set(200, 0).normalize().scale(TEMPLION1_MAXSPEED);
    const tempLion2 = new Lion(200, 0, LION_RADIUS, TEMPLIONX_MAXSPEED, LION_MAX_NEIGHBORS, LION_NEIGHBOR_DIST_SQ);
    // tempLion2.prefVelocity.set(-200, 0).normalize().scale(TEMPLIONX_MAXSPEED);
    const tempLion3 = new Lion(-200, 200, LION_RADIUS, TEMPLIONX_MAXSPEED, LION_MAX_NEIGHBORS, LION_NEIGHBOR_DIST_SQ);
    // tempLion3.prefVelocity.set(200, 200).normalize().scale(TEMPLIONX_MAXSPEED);
    const tempLion4 = new Lion(200, 200, LION_RADIUS, TEMPLIONX_MAXSPEED, LION_MAX_NEIGHBORS, LION_NEIGHBOR_DIST_SQ);
    // tempLion4.prefVelocity.set(-200, 200).normalize().scale(TEMPLIONX_MAXSPEED);

    const lions = [tempLion1, tempLion2, tempLion3, tempLion4];
    const vertices: Vector2[] = [
        new Vector2(-10, 40),
        new Vector2(-40, 40),
        new Vector2(-40, 10),
        new Vector2(-10, 10)
    ];
    const vertices2: Vector2[] = [
        new Vector2(-40, 140),
        new Vector2(-140, 140),
        new Vector2(-140, 40),
        new Vector2(-40, 40)
    ];

    const obstacles: Obstacle[] = [];
    addObstacle(vertices, obstacles);
    addObstacle(vertices2, obstacles);
    addCircle(new Vector2(0, 500), 60, 8, obstacles);
    addCircle(new Vector2(500, 600), 60, 12, obstacles);

    const kdTree = new KdTree(null, lions, obstacles);
    kdTree.buildObstacleTree();

    // TODO: try parallelization with web workers and shared buffers
    const agentWorker = new AgentWorker(kdTree, lions, obstacles, TIME_HORIZON, OBST_TIME_HORIZON);

    function simulationCycle() {
        const newPosition = SIMULATION_POSITIONS[(++simulationIndex % SIMULATION_POSITIONS.length)]!;
        player.center.copy(newPosition);
        return;
    }

    const [playerSprites] = await Promise.all([
        loadImageAtlas('Nomad_Atlas.webp', 'Nomad_Atlas_Webp.json'),
        loadImageDataFrame('Nomad_Atlas.webp', {
            w: 128,
            h: 128,
            x: 0,
            y: 0
        }),
        loadImageData('grass.png'),
        loadAtlas('Nomad_Atlas_Webp.json')
    ]);

    const assets = new Map<string, Asset>();
    playerSprites.forEach((asset, name) => assets.set(name, asset));
    const sprites = [] as Sprite[];

    return {
        world, player, m3Pool, v2Pool, v2Pool2, oRectPool, spearPool, spears: [],
        meteoritePool, meteorites: [], obsidianPool, obsidians: [], thunderstorm, orb, rupture, walls,
        lionPool,
        // lions: [tempLion1, tempLion2, tempLion3, tempLion4]
        lions,
        agentWorker,
        obstacles,
        kdTree,
        simulationCycle,
        assets,
        sprites
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
    const p_velocity = v2Pool.alloc(target.x, target.y).sub(player.center).norm().scale(SPEAR_DISTANCE);
    const cx = player.center.x, cy = player.center.y;
    const spear = spearPool.alloc(cx, cy, SPEAR_HALF_WIDTH, SPEAR_HALF_HEIGHT, p_velocity.dir() - _Math.HALF_PI, p_velocity.x, p_velocity.y, SPEAR_LIFETIME);
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

export function spawnRupture(rupture: Rupture) {
    if (!rupture.active) {
        rupture.active = true;
    } else {
        rupture.fissuresToAdd++;
    }
}

export function spawnLion(target: Vector2, lionPool: Pool<Lion>, lions: Lion[]) {
    const randMaxSpeed = Math.random() * (LION_VELOCITY * 0.5) + (LION_VELOCITY * 1.5);
    const lion = lionPool.alloc(target.x, target.y, LION_RADIUS, randMaxSpeed, LION_MAX_NEIGHBORS, LION_NEIGHBOR_DIST_SQ); // TODO: manage max speed var
    lions.push(lion);
}

export async function updateGame(display: Display, gameState: Game, elapsedTime: number, deltaTime: number, timer: number, uiCtx: CanvasRenderingContext2D) {
    renderUi(uiCtx, timer);
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

    const ctx = display.ctx;
    const inverseDeltaTime = 1 / deltaTime;
    const thingsToRender = gameState.world.query(pp.x - cx, pp.y - cy, pp.x + cx, pp.y + cy);
    const dx = (ctx.canvas.width - gameState.player.displayWidth) / 2;
    const dy = (ctx.canvas.height - gameState.player.displayHeight) / 2;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // TODO: refactor
    if (true) {
        const dir9 = gameState.player.playerDirection;
        const assetName = dir9 === 0 ? 'Nomad_Idle_5_01' : `Nomad_StartRun_${dir9}_01`;
        const sprite = {
            asset: gameState.assets.get(assetName),
            position: new Vector2(cx, cy)
        }
        const asset = sprite.asset!;
        const src = asset.data;
        const dest = display.backImageData.data;
        const width = asset.width;
        const height = asset.height;
        const sx = sprite.position.x * 2 - width / 2;
        const sy = sprite.position.y - height;
        
        // Standard way to render image data on pixel basis, should be supported by other pixels for congruity
        // for (let y = 0; y < height; y++) {
        //     for (let x = 0; x < width; x++) {
        //         const srcPosition = (y * width + x) * 4;
        //         const bx = sx + x;
        //         const by = sy + y;
        //         const destPosition = (by * display.backImageData.width + bx) * 4;
        //         const alpha = src[srcPosition + 3]! / 255;
        //         dest[destPosition + 0] = dest[destPosition + 0]! * (1 - alpha) + src[srcPosition + 0]! * alpha;
        //         dest[destPosition + 1] = dest[destPosition + 1]! * (1 - alpha) + src[srcPosition + 1]! * alpha;
        //         dest[destPosition + 2] = dest[destPosition + 2]! * (1 - alpha) + src[srcPosition + 2]! * alpha;
        //     }
        // }
        display.backCtx.putImageData(display.backImageData, 0, 0);
        display.ctx.drawImage(display.backCtx.canvas, 0, 0, display.backCtx.canvas.width, display.backCtx.canvas.height);
        
        // Below is a way to render imagedata without manipulation
        const offscreenCanvas = new OffscreenCanvas(asset.width, asset.height);
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx === null) throw new Error('2D context is not found.');
        ctx.putImageData(asset, 0, 0);
        display.ctx.drawImage(offscreenCanvas, sprite.position.x * .91, sprite.position.y * .75);
    }

    // Move player
    const p_pv = gameState.v2Pool.alloc(pv.x, pv.y);
    pp.add(p_pv.scale(deltaTime));

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
    }
    gameState.v2Pool.free(p_previousCenter);
    gameState.v2Pool.free(p_velocity);

    // Move meteorites
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
    }

    // Collect/move obsidians
    // TODO: only jump if in view, and use partition system for uncollected obsidians
    for (const obsidian of gameState.obsidians) {
        const c = obsidian.center, jump = obsidian.jump;
        switch (obsidian.resourceState) {
            case RESOURCE_STATE.Uncollected: {
                if (c.distToSq(pp) <= obsidian.radiusSq) {
                    jump.copy(c).sub(pp).norm().scale(OBSIDIAN_JUMP_DISTANCE).add(c);
                    obsidian.resourceState = RESOURCE_STATE.Jumping;
                }
                break;
            }
            case RESOURCE_STATE.Jumping: {
                c.lerp(jump, _Math.clamp(OBSIDIAN_VELOCITY * deltaTime, 0, 1));
                if (c.distToSq(jump) < OBSIDIAN_THRESHOLD) {
                    obsidian.resourceState = RESOURCE_STATE.Collecting;
                }
                break;
            }
            case RESOURCE_STATE.Collecting: {
                // There could be a cheaper way to move while still not visually overshooting the target
                obsidian.acceleration *= OBSIDIAN_ACCELERATION;
                c.lerp(pp, _Math.clamp(obsidian.acceleration * deltaTime * deltaTime, 0, 1));
                if (c.distToSq(pp) < OBSIDIAN_THRESHOLD) {
                    gameState.obsidians.splice(gameState.obsidians.indexOf(obsidian), 1);
                    gameState.obsidianPool.free(obsidian);
                    // TODO: add resource to player
                }
                break;
            }
        }
    }

    // Move thunderstorm
    if (gameState.thunderstorm.active) {
        const storm = gameState.thunderstorm;
        const c = storm.center, v = storm.velocity, r = storm.radius;
        const dist = c.distTo(pp);
        const radii = r + pr;
        if (dist > radii + THUNDERSTORM_THRESHOLD) {
            const easingStart = radii * THUNDERSTORM_EASING_FACTOR;
            let deceleration = _Math.clamp((dist - radii) / (easingStart - radii), 0, 1);
            deceleration = _Math.easeOutQuad(deceleration);
            c.add(v.copy(pp).sub(c).norm().scale(THUNDERSTORM_VELOCITY * deceleration * deltaTime));
        }
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
        }
        orb.angle %= _Math.TAU; // Normalize radians to range [0, 2π)
    }

    // Move rupture
    // TODO: transform underlying pixels for quake effect
    if (gameState.rupture.active) {
        const rupture = gameState.rupture;
        const fissures = rupture.fissures;
        if ((rupture.stepIndex === -1 && (rupture.time += deltaTime) >= rupture.cooldown) ||
            (rupture.stepIndex >= 0 && (rupture.stepTime += deltaTime) >= rupture.stepInterval)) {
            rupture.stepTime = 0;
            const hw = rupture.halfWidth, hh = rupture.stepHalfLength;
            if (rupture.stepIndex === -1) {
                rupture.time = 0;
                if (rupture.fissuresToAdd > 0) {
                    for (let i = 0; i < rupture.fissuresToAdd; i++) {
                        fissures.push(defaultFissure(rupture.stepCount));
                    }
                    rupture.fissureCount += rupture.fissuresToAdd;
                    rupture.angleStep = _Math.TAU / rupture.fissureCount;
                    rupture.fissureBound = rupture.angleStep / 2;
                    rupture.fissuresToAdd = 0;
                }
                const startingAngle = Math.random() * _Math.TAU;
                const cx = pp.x, cy = pp.y;
                for (let i = 0; i < rupture.fissureCount; i++) {
                    const currentAngle = (startingAngle + i * rupture.angleStep) % _Math.TAU;
                    const cos = Math.cos(currentAngle);
                    const sin = Math.sin(currentAngle);
                    // Rotate along player radius to the current angle
                    const x = cx + pr * cos;
                    const y = cy + pr * sin;
                    const tangCos = -sin;
                    const tangSin = cos;
                    const root = fissures[i]!.steps[0]!;
                    root.point.set(x, y);
                    root.axes[0].set(tangCos, tangSin); // Primary axis = tangent
                    root.axes[1].set(-tangSin, tangCos); // Orthogonal axis = normal
                    root.angle = currentAngle;
                    fissures[i]!.startingAngle = currentAngle;
                    // Compute rotated offsets for rectangle corners
                    const offsetXsubY = tangCos * hw - tangSin * hh;
                    const offsetXaddY = tangCos * hw + tangSin * hh;
                    const offsetYaddX = tangSin * hw + tangCos * hh;
                    const offsetYsubX = tangSin * hw - tangCos * hh;
                    root.vertices[0].set(x + offsetXaddY, y + offsetYsubX);
                    root.vertices[1].set(x - offsetXsubY, y - offsetYaddX);
                    root.vertices[2].set(x - offsetXaddY, y - offsetYsubX);
                    root.vertices[3].set(x + offsetXsubY, y + offsetYaddX);
                }
                rupture.stepIndex = 0;
            } else {
                // TODO: small optimizations in this branch
                if (++rupture.stepIndex >= rupture.stepCount) {
                    rupture.stepIndex = -1;
                    // console.log(fissures.map((f) => f.steps));
                    // debugger;
                } else {
                    const stepLen = rupture.stepLength;
                    const fissureBound = rupture.fissureBound;
                    for (let i = 0; i < rupture.fissureCount; i++) {
                        const fissure = fissures[i]!;
                        const step = fissure.steps[rupture.stepIndex]!;
                        const prev = fissure.steps[rupture.stepIndex - 1]!;
                        const startingAngle = fissure.startingAngle;
                        const prevAngle = prev.angle;
                        const delta = (Math.random() * 2 - 1) * FISSURE_MAX_DELTA;
                        let newAngle = prevAngle + delta;
                        // Reflect into bounds and wrap around Tau
                        if (Math.abs(newAngle - startingAngle) > fissureBound) {
                            newAngle = prevAngle - delta;
                        }
                        newAngle = (newAngle + _Math.TAU) % _Math.TAU;
                        step.angle = newAngle;
                        const cos = Math.cos(newAngle);
                        const sin = Math.sin(newAngle);
                        const x = prev.point.x + stepLen * cos;
                        const y = prev.point.y + stepLen * sin;
                        step.point.set(x, y);
                        const tangCos = -sin;
                        const tangSin = cos;
                        step.axes[0].set(tangCos, tangSin);
                        step.axes[1].set(-tangSin, tangCos);
                        const offsetXsubY = tangCos * hw - tangSin * hh;
                        const offsetXaddY = tangCos * hw + tangSin * hh;
                        const offsetYaddX = tangSin * hw + tangCos * hh;
                        const offsetYsubX = tangSin * hw - tangCos * hh;
                        step.vertices[0].set(x + offsetXaddY, y + offsetYsubX);
                        step.vertices[1].set(x - offsetXsubY, y - offsetYaddX);
                        step.vertices[2].set(x - offsetXaddY, y - offsetYsubX);
                        step.vertices[3].set(x + offsetXsubY, y + offsetYaddX);
                    }
                }
            }
        }
    }

    for (const lion of gameState.lions) {
        if (lion.center.distToSq(gameState.player.center) <= lion.radiusSq * 2) {
            lion.prefVelocity.set(0, 0);
            // lion.maxSpeed = 0;
        } else {
            lion.prefVelocity.copy(gameState.player.center).sub(lion.center).norm().scale(lion.maxSpeed);
        }
        if (Number.isNaN(lion.center.x) || Number.isNaN(lion.center.y)) {
            console.error(lion.center, ' is NaN');
            debugger;
        }
    }

    // TODO: create simulator like in RVO2 (not really necessary in most cases)
    const lion1 = gameState.lions[0]!;
    const lion2 = gameState.lions[1]!;
    const lion3 = gameState.lions[2]!;
    const lion4 = gameState.lions[3]!;
    if (lion1 && lion2 && lion3 && lion4) {
        const target1 = new Vector2(100, 100);
        const target2 = new Vector2(-200, 200);
        const target3 = new Vector2(200, 0);
        const target4 = new Vector2(-200, 0);
        if (lion1.center.distToSq(target1) >= lion1.radiusSq) {
            lion1.prefVelocity.copy(target1.sub(lion1.center).norm().scale(TEMPLION1_MAXSPEED));
        } else {
            // lion1.prefVelocity.set(0, 0);
            lion1.maxSpeed = 0;
        }
        if (lion2.center.distToSq(target2) >= lion2.radiusSq) {
            lion2.prefVelocity.copy(target2.sub(lion2.center).norm().scale(TEMPLIONX_MAXSPEED));
        } else {
            // lion2.prefVelocity.set(0, 0);
            lion2.maxSpeed = 0;
        }
        if (lion3.center.distToSq(target3) >= lion3.radiusSq) {
            lion3.prefVelocity.copy(target3.sub(lion3.center).norm().scale(TEMPLIONX_MAXSPEED));
        } else {
            // lion3.prefVelocity.set(0, 0);
            lion3.maxSpeed = 0;
        }
        if (lion4.center.distToSq(target4) >= lion4.radiusSq) {
            lion4.prefVelocity.copy(target4.sub(lion4.center).norm().scale(TEMPLIONX_MAXSPEED));
        } else {
            // lion4.prefVelocity.set(0, 0);
            lion4.maxSpeed = 0;
        }
    }

    // ORCA Move Lions
    // Optimal Reciprocal Collision Avoidance as defined in https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
    gameState.kdTree.buildAgentTree();
    for (let i = 0; i < gameState.lions.length; i++) {
        const lionA = gameState.lions[i]!;
        const pA = lionA.center, rA = lionA.radius, vA = lionA.velocity;
        const maxSpeed = lionA.maxSpeed, maxSpeedSq = lionA.maxSpeedSq;
        const constraints = gameState.agentWorker.processAgent({
            id: lionA.id,
            center: pA,
            velocity: vA,
            radius: lionA.radius,
            radiusSq: lionA.radiusSq,
            maxSpeed: lionA.maxSpeed,
            prefVelocity: lionA.prefVelocity,
            maxNeighbors: lionA.maxNeighbors,
            neighborDistSq: lionA.neighborDistSq
        }, deltaTime, 1 / deltaTime);
    }

    for (const lion of gameState.lions) {
        if (Number.isNaN(lion.velocity.x) || Number.isNaN(lion.velocity.y)) {
            console.error(lion);
            console.error('velocity', lion.velocity, ' is NaN');
            debugger;
        }
        lion.center.add(lion.velocity.clone().scale(deltaTime));
    }
}

export function renderShapes(ctx: CanvasRenderingContext2D, gameState: Game, elapsedTime: number, deltaTime: number, timer: number) {
    const player = gameState.player;
    const pp = player.center;
    // First we need to prepare the canvas for the cartesian system
    ctx.save();
    ctx.transform(
        1, 0,                        // Horizontal scaling and skewing
        0, -1,                       // Vertical scaling and skewing
        player.canvasCenterX - pp.x, // Horizontal translation to center player x
        player.canvasCenterY + pp.y  // Vertical translation to center player y
    );
    // Now we can render world space coordinates directly
    // Draw player
    ctx.strokeStyle = '#00ccff';
    ctx.fillStyle = '#ffffff';
    renderPoint(ctx, pp, player.radius);
    renderLine(ctx, pp, player.mousePosition);
    renderPoint(ctx, pp, player.velocity.len());
    const direction = pp.clone().add(player.velocity);
    renderLine(ctx, pp, direction);
    const angle = Math.atan2(direction.y - pp.y, direction.x - pp.x);
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
    ctx.fill();
    ctx.strokeStyle = '#ffffff';

    // Draw spears
    gameState.spears.forEach((spear) => renderRectangle(ctx, spear.vertices));

    // Draw meteorites
    ctx.strokeStyle = '#ff7b00';
    ctx.fillStyle = '#ff7b00';
    gameState.meteorites.forEach((meteorite) => {
        // TODO: remove duplicate t logic
        let t = 1 - (meteorite.lifetime / meteorite.duration); // Normalize to [0, 1] range where 1 = target
        t = _Math.easeOutQuad(t);
        const displayRadius = _Math.lerp(0.5, 1, t) * METEORITE_DISPLAY_RADIUS;
        renderLine(ctx, meteorite.origin, meteorite.target);
        renderPoint(ctx, meteorite.center, displayRadius, true);
        renderPoint(ctx, meteorite.target, meteorite.radius, false);
    });
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';

    // Draw obsidians
    ctx.strokeStyle = '#47ff5f';
    const oJumping = gameState.obsidians.filter((o) => o.resourceState === RESOURCE_STATE.Jumping);
    oJumping.forEach((o) => renderPoint(ctx, o.jump, o.displayRadius, false));
    ctx.strokeStyle = '#bc75ff';
    const oCollecting = gameState.obsidians.filter((o) => o.resourceState === RESOURCE_STATE.Collecting);
    oCollecting.forEach((o) => renderPoint(ctx, o.center, o.displayRadius, false));
    ctx.strokeStyle = '#ffffff';
    const oUncollected = gameState.obsidians.filter((o) => o.resourceState !== RESOURCE_STATE.Collecting);
    oUncollected.forEach((o) => renderPoint(ctx, o.center, o.displayRadius, false));
    gameState.obsidians.forEach((o) => {
        renderLine(ctx, o.center, o.center.clone().set(o.center.x + o.displayRadius, o.center.y))
    });

    // Draw thunderstorm
    if (gameState.thunderstorm.active) {
        const storm = gameState.thunderstorm;
        ctx.strokeStyle = '#141313f8';
        renderPoint(ctx, storm.center, storm.radius, false);
        ctx.strokeStyle = '#ffffff44';
        renderCircle(ctx, storm.center.x, storm.center.y + storm.offset, storm.radius, false);
        ctx.strokeStyle = '#ffffff';
    }

    // Draw orbs
    if (gameState.orb.active) {
        ctx.strokeStyle = '#b3ff00';
        const orb = gameState.orb;
        renderPoint(ctx, pp, orb.offset, false);
        for (const c of orb.centers) {
            renderPoint(ctx, c, orb.radius, false);
        }
        ctx.strokeStyle = '#ffffff';
    }

    // Draw rupture / draw fissures
    if (gameState.rupture.active) {
        ctx.strokeStyle = '#705e35';
        const rupture = gameState.rupture;
        const fissures = rupture.fissures;
        for (let i = 0; i < rupture.fissureCount; i++) {
            const fissure = fissures[i]!;
            for (let j = 0; j < rupture.stepIndex + 1; j++) {
                const step = fissure.steps[j]!;
                renderPoint(ctx, step.point, 3, false);
                renderRectangle(ctx, step.vertices, false);
            }
        }
        ctx.strokeStyle = '#ffffff';
    }

    // Draw agent / draw lion / draw constraints / draw orca
    // TODO: remove duplicate constraints logic
    const lionA = gameState.lions[2]!;
    const pA = lionA.center, rA = lionA.radius, vA = lionA.velocity;
    const constraints = gameState.agentWorker.processAgent({
        id: lionA.id,
        center: pA,
        velocity: vA,
        radius: lionA.radius,
        radiusSq: lionA.radiusSq,
        maxSpeed: lionA.maxSpeed,
        prefVelocity: lionA.prefVelocity,
        maxNeighbors: lionA.maxNeighbors,
        neighborDistSq: lionA.neighborDistSq
    }, deltaTime, 1 / deltaTime);
    const L = 1000;
    const opacityStep = Math.min(1 / constraints.length, 1 / 3).toFixed(1);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.fillStyle = `rgba(255, 0, 0, ${opacityStep})`;
    for (const constraint of constraints) {
        const direction = constraint.direction, v = constraint.point;
        const P_pos = v.clone().scale(TIME_HORIZON).add(pA);
        const D_pos = direction.clone().scale(TIME_HORIZON);
        const N = new Vector2(-D_pos.y, D_pos.x).neg().norm();
        const P1 = P_pos.clone().add(D_pos.clone().scale(L));
        const P2 = P_pos.clone().sub(D_pos.clone().scale(L));
        const NF1 = P1.clone().add(N.clone().scale(L));
        const NF2 = P2.clone().add(N.clone().scale(L));
        renderLine(ctx, P1, P2);
        ctx.beginPath();
        ctx.moveTo(P1.x, P1.y);
        ctx.lineTo(NF1.x, NF1.y);
        ctx.lineTo(NF2.x, NF2.y);
        ctx.lineTo(P2.x, P2.y);
        ctx.closePath();
        ctx.fill();

    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';

    // Draw obstacles
    ctx.strokeStyle = '#c8ff00';
    for (const obstacle of gameState.obstacles) {
        const startPoint = obstacle.point;
        const startId = obstacle.id;
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.beginPath();
        let next = obstacle.next!;
        while (next.id !== startId) {
            ctx.lineTo(next.point.x, next.point.y);
            next = next.next!;
        }
        ctx.stroke();
        ctx.closePath();
    }
    ctx.strokeStyle = '#FFFFFF';

    // Draw agents / draw lions
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#5a5a5a'
    for (const lion of gameState.lions) {
        renderPoint(ctx, lion.center, lion.radius, true);
        const velocity = lion.velocity.clone().scale(TIME_HORIZON);
        renderLine(ctx, lion.center, lion.center.clone().add(velocity));
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';

    // Finally restore the original matrix
    ctx.restore();
}

function renderUi(ctx: CanvasRenderingContext2D, timer: number) {
    // TODO: dont clear (and relatedly redraw) everything
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // Draw timer
    ctx.font = '40px courier';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF';
    const minutes = Math.floor(timer / 60).toString().padStart(2, '0');
    const seconds = Math.floor(timer % 60).toString().padStart(2, '0');
    ctx.fillText(`${minutes}:${seconds}`, ctx.canvas.width / 2, 10);
}

function renderPoint(ctx: CanvasRenderingContext2D, point: Vector2, radius: number, fill = false) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, _Math.TAU);
    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}

function renderCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill = false) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, _Math.TAU);
    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}

function renderRectangle(ctx: CanvasRenderingContext2D, vertices: Rectangle, colored = true) {
    // Intended order: top-left, top-right, bottom-right, bottom-left
    // In colors: #ff0000 (red), #00ff00 (green), #0000ff (blue), #ffff00 (yellow)
    // Using two loops instead of 1 for better rendering performance (fewer strokes)
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const from = vertices[i]!;
        ctx.moveTo(from.x, from.y);
        const to = vertices[(i + 1) % 4]!;
        ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();
    if (!colored) return;
    const colorArray = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    for (let i = 0; i < 4; i++) {
        const point = vertices[i]!;
        ctx.beginPath();
        ctx.fillStyle = colorArray[i % 4]!;
        ctx.arc(point.x, point.y, 3, 0, _Math.TAU);
        ctx.fill();
    }
}

function renderLine(ctx: CanvasRenderingContext2D, start: Vector2, end: Vector2) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}


/** Represents the player (main character) in the game. */
class Player {
    center = new Vector2(150, 300); // Was 150, 300
    velocity = new Vector2(0, 0);
    acceleration = new Vector2(0, 0);
    radius = 25;
    radiusSq = this.radius * this.radius;

    playerDirection: Dir9 = DIR_9.Idle;
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

// TODO: load player/spritesheet sprites better

interface Atlas {
    frames: Record<string, AtlasFrame>;
    width: number;
    height: number;
}

interface AtlasFrame {
    x: number;
    y: number;
    w: number;
    h: number;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = src;
    return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
    });
}

async function loadImageData(url: string): Promise<ImageData> {
    const image = await loadImage(url);
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2D context not found');
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, image.width, image.height);
}

async function loadImageDataFrame(url: string, frame: AtlasFrame): Promise<ImageData> {
    const atlas = await loadImage(url);
    const { w, h, x: sx, y: sy } = frame;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2D context not found');
    ctx.drawImage(atlas, sx, sy, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

async function loadAtlas(jsonUrl: string): Promise<Atlas> {
    // This function expects an atlas/spritesheet like http://free-tex-packer.com
    const data = await fetch(jsonUrl);
    const json = await data.json();
    const { frames: jsonFrames, meta: jsonMeta } = json;
    const frames = Object.fromEntries(
        Object.entries(jsonFrames).map(
            ([name, value]) => [name, (value as { frame: AtlasFrame }).frame]
        )
    ) as Record<string, AtlasFrame>;
    return {
        frames,
        width: jsonMeta.size.w,
        height: jsonMeta.size.h
    }
}

async function loadImageAtlas(imageUrl: string, jsonUrl: string): Promise<Map<string, ImageData>> {
    const fullImage = await loadImage(imageUrl);
    const { frames, width, height } = await loadAtlas(jsonUrl);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2D context not found');
    const data = new Map<string, ImageData>();
    for (let [name, { x: sx, y: sy, w, h }] of Object.entries(frames)) {
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(fullImage, sx, sy, w, h, 0, 0, w, h);
        data.set(name, ctx.getImageData(0, 0, w, h));
    }
    return data;
}