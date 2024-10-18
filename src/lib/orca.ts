/*
 * Optimal Reciprocal Collision Avoidance (ORCA) implementation.
 * See: https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
 * Reference library: RVO2 (https://github.com/snape/RVO2)
 * Licensed under the Apache License, Version 2.0.
 */

import { _Math } from "./mathUtils";
import { Vector2 } from "./vector2";

const timeHorizon = 10;
const invTimeHorizon = 1 / timeHorizon;
const obstTimeHorizon = 10;
const invTimeHorizonObst = 1 / obstTimeHorizon;
const V2_POOL_SIZE = 16;

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
    prev: Obstacle;
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
    radiusSq: number;
    maxSpeed: number;
    maxSpeedSq: number; // TODO: maybe just square in functions (should be let not const anyhow)
}
export class AgentWorker {
    readonly agentsRef: Agent[];
    readonly obstaclesRef: Obstacle[];
    agentNeighbors: AgentNeighbor[] = [];
    obstacleNeighbors: ObstacleNeighbor[] = [];
    // TODO: add a k-d tree with access to all agents and obstacles, to fill neighbors
    constraints: Line[] = [];
    v2Pool: Vector2[];
    poolIndex = -1;

    constructor(agentsRef: Agent[], obstaclesRef: Obstacle[]) {
        this.agentsRef = agentsRef;
        this.obstaclesRef = obstaclesRef;
        this.v2Pool = Array(V2_POOL_SIZE).fill(null).map(() => new Vector2());
    }

    update() {
        for (const agentA of this.agentsRef) {
            this.processAgent(agentA);
        }
    }

    processAgent(agentA: Agent) {
        this.poolIndex = -1;
        const pA = agentA.center, vA = agentA.velocity, rA = agentA.radius, rSqA = agentA.radiusSq;
        const maxSpeedA = agentA.maxSpeed, maxSpeedSqA = agentA.maxSpeedSq;

        // Compute obstacle neighbors
        // TODO: use a k-d tree to find neighbors and implement pooling
        this.agentNeighbors = this.agentsRef.filter(agentB => agentA !== agentB).map(agentB => {
            const pB = agentB.center;
            const distSq = pA.distanceToSq(pB);
            return { distSq, agent: agentB };
        });

        // Compute agent neighbors
        // TODO: use a k-d tree to find neighbors and implement pooling
        this.obstacleNeighbors = this.obstaclesRef.map(obstacle => {
            const distSq = pA.distanceTo(obstacle.point);
            return { distSq, obstacle };
        });

        // Compute obstacle constraints
        const rInvA = rA * invTimeHorizonObst;
        // TODO: pool new line points and directions, and be careful with references
        const linePoint = this.v2Fast();
        const lineDirection = this.v2Fast();
        const pRelA = this.v2Fast();
        const pRelB = this.v2Fast();
        const leftCutoff = this.v2Fast();
        const rightCutoff = this.v2Fast();
        const velocity = this.v2Fast();
        const temp1 = this.v2Fast();
        const temp2 = this.v2Fast();
        for (const obstacleNeighbor of this.obstacleNeighbors) {
            // Obstacles A and B, two vertices, define a restricted Line/polygon edge 
            let obstacleA = obstacleNeighbor.obstacle;
            let obstacleB = obstacleA.next;
            pRelA.copy(obstacleA.point).sub(pA);
            pRelB.copy(obstacleB.point).sub(pA);
            // If the current VO falls fully inside a previous ORCA line's infeasible space, skip
            let alreadyCovered = false;
            for (const line of this.constraints) {
                temp1.copy(pRelA).scale(invTimeHorizonObst).sub(line.point);
                if (temp1.detUnchecked(line.direction) - rInvA >= _Math.NEG_EPSILON) {
                    temp1.copy(pRelB).scale(invTimeHorizonObst).sub(line.point);
                    if (temp1.detUnchecked(line.direction) - rInvA >= _Math.NEG_EPSILON) {
                        alreadyCovered = true;
                        break;
                    }
                }
            }
            if (alreadyCovered) {
                continue;
            }
            // Obstacle vector
            temp2.copy(obstacleB.point).sub(obstacleA.point);
            // Negated relative agent position
            temp1.copy(pRelA).negate();
            /** Closest point on (or next to) the obstacle segment with endpoints A and B. */
            const s = temp1.dot(temp2) / temp2.magnitudeSq();
            /** Distance from the relative agent position to the left endpoint of the obstacle segment. */
            const distSqA = pRelA.magnitudeSq();
            if (s < 0 && distSqA <= rSqA) {
                // Collision with left endpoint, ignore if concave
                if (obstacleA.isConvex) {
                    linePoint.set(0, 0);
                    lineDirection.copy(pRelA).rotate90DegCounter().normalize();
                    this.constraints.push({ point: linePoint, direction: lineDirection });
                }
                continue;
            }
            /** Distance from the relative agent position to the right endpoint of the obstacle segment. */
            const distSqB = pRelB.magnitudeSq();
            if (s > 0 && distSqB <= rSqA) {
                // Collision with right endpoint, ignore if concave or agent to the right of B direction
                if (obstacleB.isConvex && pRelB.detUnchecked(obstacleB.direction) >= 0) {
                    linePoint.set(0, 0);
                    lineDirection.copy(pRelB).rotate90DegCounter().normalize();
                    this.constraints.push({ point: linePoint, direction: lineDirection });
                }
                continue;
            }
            /** Distance from the (negated) relative agent position to the closest point on the obstacle segment. */
            const distSqLine = temp1.sub(temp2.scale(s)).magnitudeSq();
            if (s >= 0 && s <= 1 && distSqLine <= rSqA) {
                // Collision with obstacle segment
                linePoint.set(0, 0);
                lineDirection.copy(obstacleA.direction).negate();
                this.constraints.push({ point: linePoint, direction: lineDirection });
                continue;
            }
            if (s < 0 && distSqLine <= rSqA) {
                // Obstacle viewed obliquely, so the left vertex defines the VO by itself
                if (!obstacleA.isConvex) {
                    continue;
                }
                obstacleB = obstacleA;
                const legA = Math.sqrt(distSqA - rSqA);
                const xA = pRelA.x, yA = pRelA.y;
                // Left leg direction
                temp1.set(xA * legA - yA * rA, xA * rA + yA * legA).scale(1 / distSqA);
                // Right leg direction
                temp2.set(yA, -xA).scale(2 * rA / distSqA).add(temp1);
            } else if (s > 1 && distSqLine <= rSqA) {
                // Obstacle viewed obliquely, so the right vertex defines the VO by itself
                if (!obstacleB.isConvex) {
                    continue;
                }
                obstacleA = obstacleB;
                const legB = Math.sqrt(distSqB - rSqA);
                const xA = pRelB.x, yA = pRelB.y;
                // Left leg direction
                temp1.set(xA * legB - yA * rA, xA * rA + yA * legB).scale(1 / distSqB);
                // Right leg direction
                temp2.set(yA, -xA).scale(2 * rA / distSqB).add(temp1);
            } else {
                // Farther away from endpoints, usual situation
                if (obstacleA.isConvex) {
                    const legA = Math.sqrt(distSqA - rSqA);
                    const xA = pRelA.x, yA = pRelA.y;
                    // Left leg direction
                    temp1.set(xA * legA - yA * rA, xA * rA + yA * legA).scale(1 / distSqA);
                } else {
                    // Left endpoint is concave, so the left leg extends the cut-off line
                    temp1.copy(obstacleA.direction).negate();
                }
                if (obstacleB.isConvex) {
                    const legB = Math.sqrt(distSqB - rSqA);
                    const xB = pRelB.x, yB = pRelB.y;
                    // Right leg direction
                    temp2.set(xB * legB + yB * rA, -xB * rA + yB * legB).scale(1 / distSqB);
                } else {
                    // Right endpoint is concave, so the right leg extends the cut-off line
                    temp2.copy(obstacleA.direction);
                }
            }
            // Legs can never point into neighboring edge when convex vertex, take
            // cutoff-line of neighboring edge instead. If velocity projected on
            // "foreign" leg, no constraint is added.
            const leftNeighbor = obstacleA.prev;
            let isLeftLegForeign = false;
            let isRightLegForeign = false;
            // Left neighbor negated direction
            pRelA.copy(leftNeighbor.direction).negate();
            if (obstacleA.isConvex && temp1.detUnchecked(pRelA) >= 0) {
                // Left leg points into obstacle
                temp1.copy(pRelA);
                isLeftLegForeign = true;
            }
            if (obstacleB.isConvex && temp2.detUnchecked(obstacleB.direction) <= 0) {
                // Right leg points into obstacle
                temp2.copy(obstacleB.direction);
                isRightLegForeign = true;
            }
            // Compute cut-off centers (agent radius at both endpoints) for O⊕ −D(pA,rA)
            leftCutoff.copy(obstacleA.point).sub(pA).scale(invTimeHorizonObst);
            rightCutoff.copy(obstacleB.point).sub(pA).scale(invTimeHorizonObst);
            // Cut-off vector
            pRelA.copy(rightCutoff).sub(leftCutoff);
            // Project current velocity on VO, first check if VO is projected on cut-off circles
            velocity.copy(vA).sub(leftCutoff);
            /** Represents the projection of agent velocity onto the cut-off line, where 0 < t < 1 is on line. */
            const t = obstacleA === obstacleB ? 0.5 : velocity.dot(pRelA) / pRelA.magnitudeSq();
            const tLeft = velocity.dot(temp1);
            const tRight = velocity.copy(vA).sub(rightCutoff).dot(temp2);
            if ((t < 0 && tLeft < 0) || (obstacleA == obstacleB && tLeft < 0 && tRight < 0)) {
                // Project on left cut-off circle, agent velocity to the left and slow
                // unitW (apex of VO or truncated cone)
                pRelB.copy(vA).sub(leftCutoff).normalize();
                lineDirection.set(pRelB.y, -pRelB.x);
                linePoint.copy(leftCutoff).add(pRelB.scale(rInvA));
                this.constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            if (t > 1 && tRight < 0) {
                // Project on right cut-off circle, agent velocity to the right and slow
                // unitW (apex of VO or truncated cone)
                pRelB.copy(vA).sub(rightCutoff).normalize();
                lineDirection.set(pRelB.y, -pRelB.x);
                linePoint.copy(rightCutoff).add(pRelB.scale(rInvA));
                this.constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            // Project on closest of: left leg, right leg, cut-off line (somewhere on segment)
            let distSqCutoff: number;
            let distSqLeft: number;
            let distSqRight: number;
            if (t < 0 || t > 1 || obstacleA === obstacleB) {
                distSqCutoff = Number.MAX_VALUE;
            } else {
                // Cut-off vector
                pRelB.copy(pRelA);
                distSqCutoff = velocity.copy(vA).sub(pRelB.scale(t).add(leftCutoff)).magnitudeSq();
            }
            if (tLeft < 0) {
                distSqLeft = Number.MAX_VALUE;
            } else {
                // Left leg direction
                pRelB.copy(temp1);
                distSqLeft = velocity.copy(vA).sub(pRelB.scale(tLeft).add(leftCutoff)).magnitudeSq();
            }
            if (tRight < 0) {
                distSqRight = Number.MAX_VALUE;
            } else {
                // Right leg direction
                pRelB.copy(temp2);
                distSqRight = velocity.copy(vA).sub(pRelB.scale(tRight).add(rightCutoff)).magnitudeSq();
            }
            if (distSqCutoff <= distSqLeft && distSqCutoff <= distSqRight) {
                // Closer to point on cut-off line than either left or right leg, project on cut-off
                lineDirection.copy(obstacleA.direction).negate();
                linePoint.copy(lineDirection).rotate90DegCounter().scale(rInvA).add(leftCutoff);
                this.constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            if (distSqLeft < distSqRight) {
                // Closer to left than right, project on left leg
                if (isLeftLegForeign) {
                    continue;
                }
                lineDirection.copy(temp1);
                linePoint.copy(lineDirection).rotate90DegCounter().scale(rInvA).add(leftCutoff);
                this.constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            // Closest to right, project on right leg
            if (isRightLegForeign) {
                continue;
            }
            lineDirection.copy(temp2).negate();
            linePoint.copy(lineDirection).rotate90DegCounter().scale(rInvA).add(rightCutoff);
            this.constraints.push({ direction: lineDirection, point: linePoint });
        }

        // Compute agent constraints
        const numObstLines = this.constraints.length;


        // Compute optimal velocity
    }

    v2(x: number, y: number): Vector2 {
        if (this.poolIndex++ < this.v2Pool.length) {
            const vector = this.v2Pool[this.poolIndex]!;
            vector.x = x;
            vector.y = y;
            return vector;
        }
        console.warn('Vector2 pool exhausted, triggering reallocation.');
        this.v2Pool.push(new Vector2(x, y));
        return this.v2Pool[this.poolIndex]!;
    }

    v2Fast(): Vector2 {
        if (this.poolIndex++ < this.v2Pool.length) {
            return this.v2Pool[this.poolIndex]!;
        }
        console.warn('Vector2 pool exhausted, triggering reallocation.');
        this.v2Pool.push(new Vector2());
        return this.v2Pool[this.poolIndex]!;
    }
}




