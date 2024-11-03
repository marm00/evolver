/*
 * Optimal Reciprocal Collision Avoidance (ORCA) implementation.
 * See: https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf
 * Reference library: RVO2 (https://github.com/snape/RVO2)
 * Licensed under the Apache License, Version 2.0.
 */

import { _Math } from "./mathUtils";
import { Vector2 } from "./vector2";

interface Line {
    direction: Vector2;
    point: Vector2;
}

export interface Obstacle {
    id: number,
    direction: Vector2;
    point: Vector2;
    next: Obstacle | null;
    prev: Obstacle | null;
    isConvex: boolean;
}

interface ObstacleNeighbor {
    distSq: number;
    obstacle: Obstacle;
}

interface Agent {
    id: number;
    center: Vector2;
    velocity: Vector2;
    radius: number;
    radiusSq: number;
    maxSpeed: number;
    prefVelocity: Vector2;
}

interface AgentNeighbor {
    distSq: number;
    agent: Agent;
}


export class AgentWorker {
    /**
     * Minimal amount of time for which new velocities are computed. The larger
     * this number, the sooner an agent will respond to the presence of others, 
     * but the less freedom the agent  has in choosing its velocities. It has a 
     * symbiotic relationship with velocties: higher velocities require a lower 
     * time horizon and vice versa, to prevent infeasible linear programs.
     */
    readonly timeHorizon: number;
    readonly obstTimeHorizon: number;
    readonly invTimeHorizon: number;
    readonly invTimeHorizonObst: number;

    readonly v2Pool: Vector2[];
    readonly lines: Line[];
    readonly projectedLines: Line[];
    readonly v2PoolSize = 8;
    readonly linesInitialSize = 32;
    readonly projectedLinesInitialSize = 16;
    readonly linesGrowthN = 8;
    readonly projectedLinesGrowthN = 4;
    lineIndex = -1;
    projectedLineIndex = -1;

    readonly agentsRef: Agent[];
    readonly obstaclesRef: Obstacle[];
    // TODO: add a k-d tree with access to all agents and obstacles, to fill neighbors
    agentNeighbors: AgentNeighbor[] = [];
    obstacleNeighbors: ObstacleNeighbor[] = [];

    constructor(agentsRef: Agent[], obstaclesRef: Obstacle[], timeHorizon: number, obstTimeHorizon: number) {
        this.agentsRef = agentsRef;
        this.obstaclesRef = obstaclesRef;
        this.timeHorizon = timeHorizon;
        this.invTimeHorizon = 1 / timeHorizon;
        this.obstTimeHorizon = obstTimeHorizon;
        this.invTimeHorizonObst = 1 / obstTimeHorizon;
        this.v2Pool = Array(this.v2PoolSize).fill(null).map(() => new Vector2());
        this.lines = Array(this.linesInitialSize).fill(null).map(() => ({ direction: new Vector2(), point: new Vector2() }));
        this.projectedLines = Array(this.projectedLinesInitialSize).fill(null).map(() => ({ direction: new Vector2(), point: new Vector2() }));
    }

    update(deltaTime: number) {
        for (const agentA of this.agentsRef) {
            this.processAgent(agentA, deltaTime, 1 / deltaTime);
        }
    }

    processAgent(agentA: Agent, deltaTime: number, invDeltaTime: number): Line[] { // TODO: dont return Line[] probably
        this.lineIndex = -1;
        const lines = this.lines;
        const projectedLines = this.projectedLines;
        const invTimeHorizonObst = this.invTimeHorizonObst;
        const invTimeHorizon = this.invTimeHorizon;
        // const invDeltaTime = this.invDeltaTime;
        const v2Pool = this.v2Pool;
        const pA = agentA.center, vA = agentA.velocity, rA = agentA.radius, rSqA = agentA.radiusSq;
        const maxSpeedA = agentA.maxSpeed;
        const rInvA = rA * invTimeHorizonObst;

        // Compute obstacle neighbors
        // TODO: use a k-d tree to find neighbors and implement pooling
        this.agentNeighbors = this.agentsRef.filter(agentB => agentA.id !== agentB.id).map(agentB => {
            const pB = agentB.center;
            const distSq = pA.distToSq(pB);
            return { distSq, agent: agentB };
        });

        // Compute agent neighbors
        // TODO: use a k-d tree to find neighbors and implement pooling
        this.obstacleNeighbors = this.obstaclesRef.map(obstacle => {
            const distSq = pA.distToSq(obstacle.point);
            return { distSq, obstacle };
        });

        // Compute obstacle constraints
        // TODO: obstacle clipping with current game scenario
        const pRelA = v2Pool[0]!;
        const pRelB = v2Pool[1]!;
        const leftCutoff = v2Pool[2]!;
        const rightCutoff = v2Pool[3]!;
        const velocity = v2Pool[4]!;
        const temp1 = v2Pool[5]!;
        const temp2 = v2Pool[6]!;
        const lineTemp = v2Pool[7]!;
        for (const obstacleNeighbor of this.obstacleNeighbors) {
            // Obstacles A and B, two vertices, define a restricted Line/polygon edge 
            let obstacleA = obstacleNeighbor.obstacle;
            let obstacleB = obstacleA.next!;
            pRelA.copy(obstacleA.point).sub(pA);
            pRelB.copy(obstacleB.point).sub(pA);
            // If the current VO falls fully inside a previous ORCA line's infeasible space, skip
            let alreadyCovered = false;
            for (let i = 0; i < this.lineIndex + 1; i++) {
                const line = lines[i]!;
                temp1.copy(pRelA).scale(invTimeHorizonObst).sub(line.point);
                if (temp1.det(line.direction) - rInvA >= _Math.NEG_EPSILON) {
                    temp1.copy(pRelB).scale(invTimeHorizonObst).sub(line.point);
                    if (temp1.det(line.direction) - rInvA >= _Math.NEG_EPSILON) {
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
            temp1.copy(pRelA).neg();
            /** Closest point on (or next to) the obstacle segment with endpoints A and B. */
            const s = temp1.dot(temp2) / temp2.lenSq();
            /** Distance from the relative agent position to the left endpoint of the obstacle segment. */
            const distSqA = pRelA.lenSq();
            if (s < 0 && distSqA <= rSqA) {
                // Collision with left endpoint, ignore if concave
                if (obstacleA.isConvex) {
                    lineTemp.copy(pRelA).rot90Counter().norm();
                    this.pushLine(lineTemp.x, lineTemp.y, 0, 0);
                }
                continue;
            }
            /** Distance from the relative agent position to the right endpoint of the obstacle segment. */
            const distSqB = pRelB.lenSq();
            if (s > 0 && distSqB <= rSqA) {
                // Collision with right endpoint, ignore if concave or agent to the right of B direction
                if (obstacleB.isConvex && pRelB.det(obstacleB.direction) >= 0) {
                    lineTemp.copy(pRelB).rot90Counter().norm();
                    this.pushLine(lineTemp.x, lineTemp.y, 0, 0);
                }
                continue;
            }
            /** Distance from the (negated) relative agent position to the closest point on the obstacle segment. */
            const distSqLine = temp1.sub(temp2.scale(s)).lenSq();
            if (s >= 0 && s <= 1 && distSqLine <= rSqA) {
                // Collision with obstacle segment
                lineTemp.copy(obstacleA.direction).neg();
                this.pushLine(lineTemp.x, lineTemp.y, 0, 0);
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
                    temp1.copy(obstacleA.direction).neg();
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
            const leftNeighbor = obstacleA.prev!;
            let isLeftLegForeign = false;
            let isRightLegForeign = false;
            // Left neighbor negated direction
            pRelA.copy(leftNeighbor.direction).neg();
            if (obstacleA.isConvex && temp1.det(pRelA) >= 0) {
                // Left leg points into obstacle
                temp1.copy(pRelA);
                isLeftLegForeign = true;
            }
            if (obstacleB.isConvex && temp2.det(obstacleB.direction) <= 0) {
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
            const t = obstacleA === obstacleB ? 0.5 : velocity.dot(pRelA) / pRelA.lenSq();
            const tLeft = velocity.dot(temp1);
            const tRight = velocity.copy(vA).sub(rightCutoff).dot(temp2);
            if ((t < 0 && tLeft < 0) || (obstacleA == obstacleB && tLeft < 0 && tRight < 0)) {
                // Project on left cut-off circle, agent velocity to the left and slow
                // unitW (apex of VO or truncated cone)
                pRelB.copy(vA).sub(leftCutoff).norm();
                lineTemp.copy(leftCutoff).add(pRelB.scale(rInvA));
                this.pushLine(pRelB.y, -pRelB.x, lineTemp.x, lineTemp.y);
                continue;
            }
            if (t > 1 && tRight < 0) {
                // Project on right cut-off circle, agent velocity to the right and slow
                // unitW (apex of VO or truncated cone)
                pRelB.copy(vA).sub(rightCutoff).norm();
                lineTemp.copy(rightCutoff).add(pRelB.scale(rInvA));
                this.pushLine(pRelB.y, -pRelB.x, lineTemp.x, lineTemp.y);
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
                distSqCutoff = velocity.copy(vA).sub(pRelB.scale(t).add(leftCutoff)).lenSq();
            }
            if (tLeft < 0) {
                distSqLeft = Number.MAX_VALUE;
            } else {
                // Left leg direction
                pRelB.copy(temp1);
                distSqLeft = velocity.copy(vA).sub(pRelB.scale(tLeft).add(leftCutoff)).lenSq();
            }
            if (tRight < 0) {
                distSqRight = Number.MAX_VALUE;
            } else {
                // Right leg direction
                pRelB.copy(temp2);
                distSqRight = velocity.copy(vA).sub(pRelB.scale(tRight).add(rightCutoff)).lenSq();
            }
            if (distSqCutoff <= distSqLeft && distSqCutoff <= distSqRight) {
                // Closer to point on cut-off line than either left or right leg, project on cut-off
                lineTemp.copy(obstacleA.direction).neg();
                const directionX = lineTemp.x, directionY = lineTemp.y;
                lineTemp.rot90Counter().scale(rInvA).add(leftCutoff);
                this.pushLine(directionX, directionY, lineTemp.x, lineTemp.y);
                continue;
            }
            if (distSqLeft < distSqRight) {
                // Closer to left than right, project on left leg
                if (isLeftLegForeign) {
                    continue;
                }
                lineTemp.copy(temp1).rot90Counter().scale(rInvA).add(leftCutoff);
                this.pushLine(temp1.x, temp1.y, lineTemp.x, lineTemp.y);
                continue;
            }
            // Closest to right, project on right leg
            if (isRightLegForeign) {
                continue;
            }
            lineTemp.copy(temp2).neg();
            const directionX = lineTemp.x, directionY = lineTemp.y;
            lineTemp.rot90Counter().scale(rInvA).add(rightCutoff);
            this.pushLine(directionX, directionY, lineTemp.x, lineTemp.y);
        }

        // Compute agent constraints
        const numObstLines = this.lineIndex + 1;
        const pRel = v2Pool[0]!;
        const vRel = v2Pool[1]!;
        /** Apex of the VO (truncated) cone or origin of relative velocity space. */
        const apex = v2Pool[2]!;
        /** The smallest change in relative velocity required to resolve the collision. */
        const u = v2Pool[3]!;
        const temp1Agent = v2Pool[4]!;
        for (const agentNeighbor of this.agentNeighbors) {
            const other = agentNeighbor.agent;
            const pB = other.center, vB = other.velocity, rB = other.radius;
            pRel.copy(pB).sub(pA);
            vRel.copy(vA).sub(vB);
            const distSq = pRel.lenSq();
            if (distSq === 0) {
                console.error(pRel, pB, pA);
                console.error(vRel);
                debugger;    
            }
            const r = rA + rB;
            const rSq = r * r;
            if (distSq > rSq) {
                // No observed collision or overlap
                apex.copy(vRel).sub(temp1Agent.copy(pRel).scale(invTimeHorizon));
                const apexLengthSq = apex.lenSq();
                const dotProduct = apex.dot(pRel);
                if (dotProduct < 0 && dotProduct * dotProduct > rSq * apexLengthSq) {
                    // Project on cut-off circle
                    const apexLength = Math.sqrt(apexLengthSq);
                    u.copy(apex).scale(1 / apexLength);
                    lineTemp.copy(u).rot90();
                    u.scale(r * invTimeHorizon - apexLength);
                } else {
                    // No imminent collision, project velocity on nearest leg
                    const leg = Math.sqrt(distSq - rSq);
                    const pX = pRel.x, pY = pRel.y;
                    if (pRel.det(apex) > 0) {
                        // 2D cross product is positive, project on left leg
                        lineTemp.set(
                            pX * leg - pY * r,
                            pX * r + pY * leg
                        ).scale(1 / distSq);
                    } else {
                        // 2D cross product is negative, project on right leg
                        lineTemp.set(
                            pX * leg + pY * r,
                            -pX * r + pY * leg
                        ).neg().scale(1 / distSq);
                    }
                    // Find shortest vector (adjusted velocity) on the ORCA constraint line
                    u.copy(lineTemp).scale(vRel.dot(lineTemp)).sub(vRel);
                }
            } else {
                // Lions are on top of each other, define VO as entire plane
                // Apex is now defined as the cutoff center to relative velocity
                apex.copy(vRel).sub(temp1Agent.copy(pRel).scale(invDeltaTime));
                const apexLength = apex.len();
                if (apexLength === 0) {
                    console.error('vRel', vRel);
                    console.error('pRel', pRel);
                    console.error(invDeltaTime);
                    console.error(apex, ' is NaN');
                    debugger;
                }
                u.copy(apex).scale(1 / apexLength);
                lineTemp.copy(u).rot90();
                u.scale(r * invDeltaTime - apexLength);
                if (Number.isNaN(u.x) || Number.isNaN(u.y)) {
                    console.error(u, ' is NaN');
                    debugger;
                }
            }
            // ORCA constraint (half-plane) is now defined by n (direction off of u) and vA+halfU (point)
            // Where halfU is the reciprocal (shared half effort) of the smallest change
            // Direction represents the normal vector n (or direction) of minimal change
            // Point represents the line on which to adjust velocity for reciprocal avoidance
            const directionX = lineTemp.x, directionY = lineTemp.y;
            lineTemp.copy(vA).add(u.scale(0.5));
            this.pushLine(directionX, directionY, lineTemp.x, lineTemp.y);
        }

        // Compute optimal velocity
        // ORCA lines are defined, linear programming to find new vOpt satisfying constraints
        const result = v2Pool[0]!.set(0, 0);
        // Final linear program: linearProgram3
        const totalLines = this.lineIndex + 1;
        const lineCount = this.linearProgram2(maxSpeedA, false, agentA.prefVelocity);
        if (lineCount === totalLines) {
            // Success, no failed lines
            vA.copy(result);
            return lines.slice(0, lineCount);
        }
        const vTemp = v2Pool[3]!;
        const vOptTemp = v2Pool[4]!;
        // If not enough empty slots, grow array to lowest value divisible by projectedLinesGrowthN
        if (projectedLines.length < numObstLines) {
            console.warn('More obstacle lines' + numObstLines + ' than projected lines'
                + projectedLines.length + ', growing array to'
                + Math.ceil(numObstLines / this.projectedLinesGrowthN) * this.projectedLinesGrowthN);
            // No need to initialize undefined slots, as each gets a reference to lines[j] below
            projectedLines.length = Math.ceil(numObstLines / this.projectedLinesGrowthN) * this.projectedLinesGrowthN;
        }
        let distance = 0;
        for (let i = lineCount; i < totalLines; i++) {
            const line = lines[i]!;
            const n = line.direction, v = line.point;
            if (n.det(vTemp.copy(v).sub(result)) > distance) {
                // Velocity does not satisfy constraint of the current line
                // Reset the projected lines array
                for (let j = 0; j < numObstLines; j++) {
                    projectedLines[j] = lines[j]!;
                }
                this.projectedLineIndex = numObstLines - 1;
                for (let j = numObstLines; j < i; j++) {
                    const linePrev = lines[j]!;
                    const nPrev = linePrev.direction, vPrev = linePrev.point;
                    const determinant = n.det(nPrev);
                    if (Math.abs(determinant) <= _Math.EPSILON) {
                        // Lines are parallel
                        if (n.dot(nPrev) > 0) {
                            // Lines are in the same direction
                            continue;
                        }
                        lineTemp.copy(v).add(vPrev).scale(0.5);
                    } else {
                        vTemp.copy(n).scale(nPrev.det(vOptTemp.copy(v).sub(vPrev)) / determinant)
                        lineTemp.copy(v).add(vTemp);
                    }
                    const pointX = lineTemp.x, pointY = lineTemp.y;
                    lineTemp.copy(nPrev).sub(n).norm();
                    // Push projected line
                    if (++this.projectedLineIndex >= projectedLines.length) {
                        // No empty slots, grow array
                        console.warn('Projected lines pool exhausted at ' + projectedLines.length
                            + ', triggering reallocation by ' + this.projectedLinesGrowthN);
                        const curLength = projectedLines.length;
                        projectedLines.length += this.projectedLinesGrowthN;
                        for (let i = curLength; i < projectedLines.length; i++) {
                            projectedLines[i] = { direction: new Vector2(), point: new Vector2() };
                        }
                    }
                    const projectedLine = projectedLines[this.projectedLineIndex]!;
                    projectedLine.direction.x = lineTemp.x;
                    projectedLine.direction.y = lineTemp.y;
                    projectedLine.point.x = pointX;
                    projectedLine.point.y = pointY;
                }
                vTemp.copy(result);
                if (this.linearProgram2(maxSpeedA, true, vOptTemp.copy(n).rot90Counter()) < this.projectedLineIndex + 1) {
                    result.copy(vTemp);
                }
                distance = n.det(vTemp.copy(v).sub(result));
            }
        }
        vA.copy(result);
        return lines.slice(0, lineCount);
    }

    linearProgram1(current: number, maxSpeedSq: number, directionOpt: boolean, optVelocity: Vector2): boolean {
        const result = this.v2Pool[0]!;
        const temp = this.v2Pool[2]!;
        const lines = this.lines;
        const { direction: n, point: v } = lines[current]!;
        const alignment = v.dot(n);
        const discriminantSq = alignment * alignment + maxSpeedSq - v.lenSq();
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
            const denominator = n.det(nPrev);
            const numerator = nPrev.det(temp.copy(v).sub(vPrev));
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

    linearProgram2(maxSpeed: number, directionOpt: boolean, optVelocity: Vector2): number {
        const result = this.v2Pool[0]!;
        const temp = this.v2Pool[1]!;
        const maxSpeedSq = maxSpeed * maxSpeed;
        if (this.v2Pool.some(v => Number.isNaN(v.x) || Number.isNaN(v.y))) {
            console.error(this.v2Pool);
            debugger;
        }
        if (Number.isNaN(optVelocity.x) || Number.isNaN(optVelocity.y)) {
            console.error(this.agentsRef);
            console.error(this.v2Pool);
            console.error(directionOpt, optVelocity, ' is NaN');
            debugger;
        }
        let lines: Line[];
        let lineCount: number;
        if (directionOpt) {
            // Optimize direction with velocity as a unit vector
            result.copy(optVelocity).scale(maxSpeed);
            // Setup projected lines
            lines = this.projectedLines;
            lineCount = this.projectedLineIndex + 1;
        } else {
            if (optVelocity.lenSq() > maxSpeedSq) {
                // Outside circle, optimize closest point
                result.copy(optVelocity).norm().scale(maxSpeed);
            } else {
                // Inside circle, optimize closest point
                result.copy(optVelocity);
            }
            // Setup lines
            lines = this.lines;
            lineCount = this.lineIndex + 1;
        }
        for (let i = 0; i < lineCount; i++) {
            // Objective:   Minimize f(v) = ||v - vPref||^2
            // Constraints: (v-vPref) * n >= 0
            //              ||v|| <= vMax
            //              ORCA lines
            // ORCA2
            const constraint = lines[i]!;
            if (constraint.direction.det(temp.copy(constraint.point).sub(result)) > 0) {
                // Optimal velocity is on the wrong side (left) of the ORCA constraint
                // Next linear program
                temp.copy(result);
                if (!this.linearProgram1(i, maxSpeedSq, directionOpt, optVelocity)) {
                    result.copy(temp);
                    return i;
                }
            }
        }
        return lineCount;
    }

    pushLine(directionX: number, directionY: number, pointX: number, pointY: number): void {
        if (++this.lineIndex >= this.lines.length) {
            // No empty slots, grow array
            console.warn('Lines pool exhausted at ' + this.lines.length
                + ', triggering reallocation by ' + this.linesGrowthN);
            const lines = this.lines, curLength = lines.length;
            lines.length += this.linesGrowthN;
            for (let i = curLength; i < lines.length; i++) {
                lines[i] = { direction: new Vector2(), point: new Vector2() };
            }
        }
        const line = this.lines[this.lineIndex]!;
        line.direction.x = directionX;
        line.direction.y = directionY;
        line.point.x = pointX;
        line.point.y = pointY;
    }
}




