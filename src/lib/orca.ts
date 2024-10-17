/*
 * Optimal Reciprocal Collision Avoidance (ORCA) implementation.
 * See: https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
 * Reference library: RVO2 (https://github.com/snape/RVO2)
 * Licensed under the Apache License, Version 2.0.
 */

import { Vector2 } from "./vector2";

const timeHorizon = 10;
const inverseTimeHorizon = 1 / timeHorizon;
const obstTimeHorizon = 10;
const inverseObstTimeHorizon = 1 / obstTimeHorizon;

interface Line {
    direction: Vector2;
    point: Vector2;
}

interface AgentNeighbor {
    distSq: number;
    agent: Agent;
}

interface Obstacle {
    direction: Vector2;
    point: Vector2;
    next: Obstacle;
    previous: Obstacle;
    isConvex: boolean;
}

interface ObstacleNeighbor {
    distSq: number;
    obstacle: Obstacle;
}

let agents: Agent[] = [];
let obstacles: Obstacle[] = [];
const agentNeighbors: AgentNeighbor[] = [];
const constraints: Line[] = [];

export class Agent {
    center: Vector2;
    radius: number;
    velocity: Vector2;
    maxSpeed: number;
    maxSpeedSq: number;

    computeNeighbors() {
        let numConstraints = 0;
        
    }

    update() {
        
    }
}

export function update(newAgents: Agent[], newObstacles: Obstacle[]) {
    // TODO: prevent garbage collection for agents array while keeping it global
    agents = newAgents;
    obstacles = newObstacles;
    for (const agent of agents) {

    }
}
