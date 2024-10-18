/*
 * Optimal Reciprocal Collision Avoidance (ORCA) implementation.
 * See: https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
 * Reference library: RVO2 (https://github.com/snape/RVO2)
 * Licensed under the Apache License, Version 2.0.
 */

import { _Math } from "./mathUtils";
import { Vector2 } from "./vector2";

const deltaTime = 1; // TODO: get delta time and SCREAM_CASE consts
const invDeltaTime = 1 / deltaTime;
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
    prefVelocity: Vector2;
}
export class AgentWorker {
    readonly agentsRef: Agent[];
    readonly obstaclesRef: Obstacle[];
    agentNeighbors: AgentNeighbor[] = [];
    obstacleNeighbors: ObstacleNeighbor[] = [];
    // TODO: add a k-d tree with access to all agents and obstacles, to fill neighbors
    constraints: Line[] = [];
    projectedLines: Line[] = [];
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
        const constraints = this.constraints;
        let projectedLines = this.projectedLines;
        const v2Pool = this.v2Pool;
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
        const linePoint = new Vector2();
        const lineDirection = new Vector2();
        const pRelA = v2Pool[0]!;
        const pRelB = v2Pool[1]!;
        const leftCutoff = v2Pool[2]!;
        const rightCutoff = v2Pool[3]!;
        const velocity = v2Pool[4]!;
        const temp1 = v2Pool[5]!;
        const temp2 = v2Pool[6]!;
        for (const obstacleNeighbor of this.obstacleNeighbors) {
            // Obstacles A and B, two vertices, define a restricted Line/polygon edge 
            let obstacleA = obstacleNeighbor.obstacle;
            let obstacleB = obstacleA.next;
            pRelA.copy(obstacleA.point).sub(pA);
            pRelB.copy(obstacleB.point).sub(pA);
            // If the current VO falls fully inside a previous ORCA line's infeasible space, skip
            let alreadyCovered = false;
            for (const line of constraints) {
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
                    constraints.push({ point: linePoint, direction: lineDirection });
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
                    constraints.push({ point: linePoint, direction: lineDirection });
                }
                continue;
            }
            /** Distance from the (negated) relative agent position to the closest point on the obstacle segment. */
            const distSqLine = temp1.sub(temp2.scale(s)).magnitudeSq();
            if (s >= 0 && s <= 1 && distSqLine <= rSqA) {
                // Collision with obstacle segment
                linePoint.set(0, 0);
                lineDirection.copy(obstacleA.direction).negate();
                constraints.push({ point: linePoint, direction: lineDirection });
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
                constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            if (t > 1 && tRight < 0) {
                // Project on right cut-off circle, agent velocity to the right and slow
                // unitW (apex of VO or truncated cone)
                pRelB.copy(vA).sub(rightCutoff).normalize();
                lineDirection.set(pRelB.y, -pRelB.x);
                linePoint.copy(rightCutoff).add(pRelB.scale(rInvA));
                constraints.push({ direction: lineDirection, point: linePoint });
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
                constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            if (distSqLeft < distSqRight) {
                // Closer to left than right, project on left leg
                if (isLeftLegForeign) {
                    continue;
                }
                lineDirection.copy(temp1);
                linePoint.copy(lineDirection).rotate90DegCounter().scale(rInvA).add(leftCutoff);
                constraints.push({ direction: lineDirection, point: linePoint });
                continue;
            }
            // Closest to right, project on right leg
            if (isRightLegForeign) {
                continue;
            }
            lineDirection.copy(temp2).negate();
            linePoint.copy(lineDirection).rotate90DegCounter().scale(rInvA).add(rightCutoff);
            constraints.push({ direction: lineDirection, point: linePoint });
        }

        // Compute agent constraints
        const numObstLines = constraints.length;
        this.poolIndex = -1;
        const pRel = this.v2Pool[0]!;
        const vRel = this.v2Pool[1]!;
        /** Apex of the VO (truncated) cone or origin of relative velocity space. */
        const apex = this.v2Pool[2]!;
        /** The smallest change in relative velocity required to resolve the collision. */
        const u = this.v2Pool[3]!;
        const temp1Agent = this.v2Pool[4]!;
        // TODO: pool new line points and directions, and be careful with references
        /** Normal vector n (or direction) of minimal change. */
        const lineDirectionAgent = new Vector2();
        /** Represents the line on which to adjust velocity for reciprocal avoidance. */
        const linePointAgent = new Vector2();
        for (const agentNeighbor of this.agentNeighbors) {
            const other = agentNeighbor.agent;
            const pB = other.center, vB = other.velocity, rB = other.radius;
            pRel.copy(pB).sub(pA);
            vRel.copy(vA).sub(vB);
            const distSq = pRel.magnitudeSq();
            const r = rA + rB;
            const rSq = r * r;
            if (distSq > rSq) {
                // No observed collision or overlap
                apex.copy(vRel).sub(temp1Agent.copy(pRel).scale(invTimeHorizon));
                const apexLengthSq = apex.magnitudeSq();
                const dotProduct = apex.dot(pRel);
                if (dotProduct < 0 && dotProduct * dotProduct > rSq * apexLengthSq) {
                    // Project on cut-off circle
                    const apexLength = Math.sqrt(apexLengthSq);
                    u.copy(apex).scale(1 / apexLength);
                    lineDirectionAgent.copy(u).rotate90Deg();
                    u.scale(r * invTimeHorizon - apexLength);
                } else {
                    // No imminent collision, project velocity on nearest leg
                    const leg = Math.sqrt(distSq - rSq);
                    const pX = pRel.x, pY = pRel.y;
                    if (pRel.detUnchecked(apex) > 0) {
                        // 2D cross product is positive, project on left leg
                        lineDirectionAgent.set(
                            pX * leg - pY * r,
                            pX * r + pY * leg
                        ).scale(1 / distSq);
                    } else {
                        // 2D cross product is negative, project on right leg
                        lineDirectionAgent.set(
                            pX * leg + pY * r,
                            -pX * r + pY * leg
                        ).negate().scale(1 / distSq);
                    }
                    // Find shortest vector (adjusted velocity) on the ORCA constraint line
                    u.copy(lineDirectionAgent).scale(vRel.dot(lineDirectionAgent)).sub(vRel);
                }
            } else {
                // Lions are on top of each other, define VO as entire plane
                // Apex is now defined as the cutoff center to relative velocity
                apex.copy(vRel).sub(temp1Agent.copy(pRel).scale(invDeltaTime));
                const apexLength = apex.magnitude();
                u.copy(apex).scale(1 / apexLength);
                lineDirectionAgent.copy(u).rotate90Deg();
                u.scale(r * invDeltaTime - apexLength);
            }
            // ORCA constraint (half-plane) is now defined by n (direction off of u) and vA+halfU (point)
            // Where halfU is the reciprocal (shared half effort) of the smallest change
            linePointAgent.copy(vA).add(u.scale(0.5));
            constraints.push({ direction: lineDirectionAgent, point: linePointAgent });
        }

        // Compute optimal velocity
        // ORCA lines are defined, linear programming to find new vOpt satisfying constraints
        const result = v2Pool[0]!.set(0, 0);
        // Final linear program: linearProgram3
        const lineCount = this.linearProgram2(maxSpeedA, false, agentA.prefVelocity, result);
        if (lineCount < constraints.length) {
            let distance = 0;
            for (let i = lineCount; i < constraints.length; i++) {
                const line = constraints[i]!;
                const n = line.direction, v = line.point;
                if (n.detUnchecked(v.clone().sub(result)) > distance) {
                    projectedLines = constraints.slice(0, numObstLines);
                    // Velocity does not satisfy constraint of the current line
                    for (let j = numObstLines; j < i; j++) {
                        const newLine = { direction: new Vector2(), point: new Vector2() };
                        const linePrev = constraints[j]!;
                        const nPrev = linePrev.direction, vPrev = linePrev.point;
                        const determinant = n.detUnchecked(nPrev);
                        if (Math.abs(determinant) <= _Math.EPSILON) {
                            // Lines are parallel
                            if (n.dot(nPrev) > 0) {
                                // Lines are in the same direction
                                continue;
                            }
                            newLine.point.copy(v).add(vPrev).scale(0.5);
                        } else {
                            newLine.point.copy(v).add(n.clone().scale(nPrev.detUnchecked(v.clone().sub(vPrev)) / determinant));
                        }
                        newLine.direction.copy(nPrev).sub(n).normalize();
                        projectedLines.push(newLine);
                    }
                    const temp = result.clone();
                    if (this.linearProgram2(maxSpeedA, true, n.clone().rotate90DegCounter(), result) < projectedLines.length) {
                        result.copy(temp);
                    }
                    distance = n.detUnchecked(v.clone().sub(result));
                }
            }
        }
        vA.copy(result);
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

    linearProgram1(current: number, maxSpeedSq: number, directionOpt: boolean, optVelocity: Vector2, result: Vector2): boolean {
        const temp = this.v2Pool[2]!;
        const lines = this.constraints;
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
            const denominator = n.detUnchecked(nPrev);
            const numerator = nPrev.detUnchecked(temp.copy(v).sub(vPrev));
            if (Math.abs(denominator) <= _Math.EPSILON) {
                // Lines are parallel or nearly parallel
                if (numerator < 0) {
                    // Current constraint line is on the wrong side (right) of previous
                    return false;
                }
                continue;
            }
            /** The intersection point along the current constraint line. */
            const t = numerator / denominator;
            if (denominator >= 0) {
                // Previous line bounds current line on the left
                tRight = Math.min(tRight, t);
            } else {
                // Previous line bounds current line on the right
                tLeft = Math.max(tLeft, t);
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
                result.copy(v).add(temp.copy(n).scale(tRight));
            } else {
                // Take leftmost point
                result.copy(v).add(temp.copy(n).scale(tLeft));
            }
        } else {
            // Optimize closest point
            /** Project preferred velocity onto constraint line, the value (distance) to minimize. */
            const t = n.dot(temp.copy(optVelocity).sub(v));
            if (t < tLeft) {
                result.copy(v).add(temp.copy(n).scale(tLeft));
            } else if (t > tRight) {
                result.copy(v).add(temp.copy(n).scale(tRight));
            } else {
                result.copy(v).add(temp.copy(n).scale(t));
            }
        }
        return true;
    }

    linearProgram2(maxSpeed: number, directionOpt: boolean, optVelocity: Vector2, result: Vector2): number {
        const temp = this.v2Pool[1]!;
        const maxSpeedSq = maxSpeed * maxSpeed;
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
        const lines = directionOpt ? this.projectedLines : this.constraints;
        for (let i = 0; i < lines.length; i++) {
            // Objective:   Minimize f(v) = ||v - vPref||^2
            // Constraints: (v-vPref) * n >= 0
            //              ||v|| <= vMax
            //              ORCA lines
            // ORCA2
            const constraint = lines[i]!;
            if (constraint.direction.detUnchecked(temp.copy(constraint.point).sub(result)) > 0) {
                // Optimal velocity is on the wrong side (left) of the ORCA constraint
                // Next linear program
                temp.copy(result);
                if (!this.linearProgram1(i, maxSpeedSq, directionOpt, optVelocity, result)) {
                    result.copy(temp);
                    return i;
                }
            }
        }
        return lines.length;
    }
}




