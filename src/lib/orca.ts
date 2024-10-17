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

interface Agent {
    center: Vector2;
    velocity: Vector2;
    radius: number;
    maxSpeed: number;
    maxSpeedSq: number;
}

export class AgentWorker {
    agents: Agent[];
    obstacles: Obstacle[];
    agentNeighbors: AgentNeighbor[] = [];
    obstacleNeighbors: ObstacleNeighbor[] = [];
    // TODO: add a k-d tree with access to all agents and obstacles, to fill neighbors
    constraints: Line[] = [];

    constructor(agents: Agent[], obstacles: Obstacle[]) {
        this.agents = agents;
        this.obstacles = obstacles;
    }

    update() {
        const agents = this.agents, obstacles = this.obstacles;
        for (const agentA of agents) {
            const pA = agentA.center, vA = agentA.velocity, rA = agentA.radius;
            const maxSpeedA = agentA.maxSpeed, maxSpeedSqA = agentA.maxSpeedSq;

            // Compute obstacle neighbors
            // TODO: use a k-d tree to find neighbors and implement pooling
            this.agentNeighbors = agents.filter(agentB => agentA !== agentB).map(agentB => {
                const pB = agentB.center;
                const distSq = pA.distanceToSq(pB);
                return { distSq, agent: agentB };
            });

            // Compute agent neighbors
            // TODO: use a k-d tree to find neighbors and implement pooling
            this.obstacleNeighbors = obstacles.map(obstacle => {
                const distSq = pA.distanceTo(obstacle.point);
                return { distSq, obstacle };
            });

            // Compute obstacle constraints
            for (const obstacleNeighbor of this.obstacleNeighbors) {
                const obstacleA = obstacleNeighbor.obstacle;
                const obstacleB = obstacleA.next;
            }

            // Compute agent constraints

            // Compute optimal velocity

        }
    }
}




