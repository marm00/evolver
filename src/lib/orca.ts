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
    maxNeighbors: number;
    neighborDistSq: number;
}

interface AgentNeighbor {
    distSq: number;
    agent: Agent;
}

interface AgentTreeNode {
    begin: number;
    end: number;
    left: number;
    right: number;
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
}

interface ObstacleTreeNode {
    obstacle: Obstacle | null;
    left: ObstacleTreeNode | null;
    right: ObstacleTreeNode | null;
}

function defaultAgentTreeNode(): AgentTreeNode {
    return {
        begin: 0,
        end: 0,
        left: 0,
        right: 0,
        maxX: 0,
        maxY: 0,
        minX: 0,
        minY: 0
    }
}

function defaultLine(): Line {
    return {
        direction: new Vector2(),
        point: new Vector2()
    }
}

/** Use 2d cross product (det) to check if vector3 is left of line1-2. */
function leftOf(line1: Vector2, line2: Vector2, vector3: Vector2) {
    return (line1.x - vector3.x) * (line2.y - line1.y) -
        (line1.y - vector3.y) * (line2.x - line1.x);
}

/** Add an obstacle as defined by a list of vertices, to a shared array. */
export function addObstacle(vertices: Vector2[], obstacles: Obstacle[]): void {
    const obstacleNo = obstacles.length;
    const verticesLength = vertices.length;
    for (let i = 0; i < verticesLength; i++) {
        const point = vertices[i]!;
        const obstacle: Obstacle = {
            id: 0,
            direction: new Vector2(),
            point: point,
            next: null,
            prev: null,
            isConvex: false
        }
        if (i !== 0) {
            obstacle.prev = obstacles[obstacles.length - 1]!;
            obstacle.prev.next = obstacle;
        }
        if (i === verticesLength - 1) {
            obstacle.next = obstacles[obstacleNo]!;
            obstacle.next.prev = obstacle;
        }
        const nextPoint = vertices[(i + 1) % verticesLength]!;
        obstacle.direction.copy(nextPoint).sub(point).norm();
        if (verticesLength === 2) {
            obstacle.isConvex = true;
        } else {
            // Use 2d cross product (det) to check if point is left of prev->next and convex
            const prevPoint = vertices[(i - 1 + verticesLength) % verticesLength]!;
            const x1 = prevPoint.x - nextPoint.x;
            const y1 = prevPoint.y - nextPoint.y;
            const x2 = point.x - prevPoint.x;
            const y2 = point.y - prevPoint.y;
            obstacle.isConvex = (x1 * y2 - y1 * x2) >= 0;
        }
        obstacle.id = obstacles.length;
        obstacles.push(obstacle);
    }
}

// Each agent worker shares a kdtree reference
export class KdTree {
    // agents: Agent[];
    // agentTree: AgentTreeNode[];
    obstacleTree: ObstacleTreeNode | null;
    agentTree: AgentTreeNode[];
    agents: Agent[];
    readonly agentsRef: Agent[];
    readonly obstaclesRef: Obstacle[];
    readonly maxLeafSize = 10;

    constructor(obstacleTree: ObstacleTreeNode | null, agentsRef: Agent[], obstaclesRef: Obstacle[]) {
        this.obstacleTree = obstacleTree;
        this.agents = [];
        this.agentsRef = agentsRef;
        this.agentTree = [];
        this.obstaclesRef = obstaclesRef;
    }

    buildAgentTree() {
        const agentsLength = this.agents.length;
        if (agentsLength < this.agentsRef.length) {
            const agents = this.agents, agentsRef = this.agentsRef;
            for (let i = agentsLength; i < agentsRef.length; i++) {
                agents.push(agentsRef[i]!);
            }
            const oldLength = this.agentTree.length;
            const newLength = 2 * agents.length - 1;
            for (let i = oldLength; i < newLength; i++) {
                this.agentTree.push(defaultAgentTreeNode());
            }
        }
        if (agentsLength !== 0) {
            this.buildAgentTreeRecursive(0, agentsLength, 0);
        }
    }

    buildAgentTreeRecursive(begin: number, end: number, node: number) {
        const currentNode = this.agentTree[node]!;
        const agents = this.agents;
        currentNode.begin = begin;
        currentNode.end = end;
        currentNode.minX = currentNode.maxX = agents[begin]!.center.x;
        currentNode.minY = currentNode.maxY = agents[begin]!.center.y;
        for (let i = begin + 1; i < end; i++) {
            const ix = agents[i]!.center.x, iy = agents[i]!.center.y;
            currentNode.maxX = Math.max(currentNode.maxX, ix);
            currentNode.minX = Math.min(currentNode.minX, ix);
            currentNode.maxY = Math.max(currentNode.maxY, iy);
            currentNode.minY = Math.min(currentNode.minY, iy);
        }
        if (end - begin > this.maxLeafSize) {
            // No leaf node
            const minX = currentNode.minX, maxX = currentNode.maxX;
            const minY = currentNode.minY, maxY = currentNode.maxY;
            const isVertical = maxX - minX > maxY - minY;
            const splitValue = 0.5 * (isVertical ? maxX + minX : maxY + minY);
            let left = begin;
            let right = end;
            while (left < right) {
                while (left < right && (isVertical ? agents[left]!.center.x
                    : agents[left]!.center.y) < splitValue) {
                    left++;
                }
                while (right > left && (isVertical ? agents[right - 1]!.center.x
                    : agents[right - 1]!.center.y) >= splitValue) {
                    right--;
                }
                if (left < right) {
                    const oldLeft = agents[left]!;
                    agents[left] = agents[right - 1]!;
                    agents[right - 1] = oldLeft;
                    left++;
                    right--;
                }
            }
            if (left == begin) {
                left++;
                right++;
            }
            currentNode.left = node + 1;
            currentNode.right = node + 2 * (left - begin);
            this.buildAgentTreeRecursive(begin, left, currentNode.left);
            this.buildAgentTreeRecursive(left, end, currentNode.right);
        }
    }

    buildObstacleTree() {
        this.deleteObstacleTree(this.obstacleTree);
        // TODO: confirm that passing the global obstaclesRef has no side effects
        this.obstacleTree = this.buildObstacleTreeRecursive(this.obstaclesRef);
    }

    computeAgentNeighbors(agentA: Agent, rangeSq: { reference: number }, agentNeighbors: AgentNeighbor[]) {
        this.queryAgentTreeRecursive(agentA, rangeSq, 0, agentNeighbors);
    }

    // TODO: optimize agentNeighbors (prevent constant passing)
    queryAgentTreeRecursive(agentA: Agent, rangeSq: { reference: number }, node: number, agentNeighbors: AgentNeighbor[]) {
        const currentNode = this.agentTree[node]!;
        if (currentNode.end - currentNode.begin <= this.maxLeafSize) {
            for (let i = currentNode.begin; i < currentNode.end; i++) {
                const agentB = this.agents[i]!;
                if (agentA.id === agentB.id) {
                    continue;
                }
                const distSq = agentA.center.clone().sub(agentB.center).lenSq();
                if (distSq >= rangeSq.reference) {
                    continue;
                }
                if (agentNeighbors.length < agentA.maxNeighbors) {
                    agentNeighbors.push({ distSq, agent: agentB });
                }
                let j = agentNeighbors.length - 1;
                while (j !== 0 && distSq < agentNeighbors[j - 1]!.distSq) {
                    agentNeighbors[j] = agentNeighbors[j - 1]!;
                    j--;
                }
                agentNeighbors[j] = { distSq, agent: agentB };
                if (agentNeighbors.length === agentA.maxNeighbors) {
                    rangeSq.reference = agentNeighbors[agentNeighbors.length - 1]!.distSq;
                }
            }
        } else {
            const ax = agentA.center.x, ay = agentA.center.y;
            const currLeft = this.agentTree[currentNode.left]!;
            const currRight = this.agentTree[currentNode.right]!;
            const distLeftMinX = Math.max(0, currLeft.minX - ax);
            const distLeftMaxX = Math.max(0, ax - currLeft.maxX);
            const distLeftMinY = Math.max(0, currLeft.minY - ay);
            const distLeftMaxY = Math.max(0, ay - currLeft.maxY);
            const distSqLeft = distLeftMinX * distLeftMinX + distLeftMaxX * distLeftMaxX
                + distLeftMinY * distLeftMinY + distLeftMaxY * distLeftMaxY;
            const distRightMinX = Math.max(0, currRight.minX - ax);
            const distRightMaxX = Math.max(0, ax - currRight.maxX);
            const distRightMinY = Math.max(0, currRight.minY - ay);
            const distRightMaxY = Math.max(0, ay - currRight.maxY);
            const distSqRight = distRightMinX * distRightMinX + distRightMaxX * distRightMaxX
                + distRightMinY * distRightMinY + distRightMaxY * distRightMaxY;
            if (distSqLeft < distSqRight) {
                if (distSqLeft < rangeSq.reference) {
                    this.queryAgentTreeRecursive(agentA, rangeSq, currentNode.left, agentNeighbors);
                    if (distSqRight < rangeSq.reference) {
                        this.queryAgentTreeRecursive(agentA, rangeSq, currentNode.right, agentNeighbors);
                    }
                }
            } else if (distSqRight < rangeSq.reference) {
                this.queryAgentTreeRecursive(agentA, rangeSq, currentNode.right, agentNeighbors);
                if (distSqLeft < rangeSq.reference) {
                    this.queryAgentTreeRecursive(agentA, rangeSq, currentNode.left, agentNeighbors);
                }
            }
        }
    }

    buildObstacleTreeRecursive(obstacles: Obstacle[]) {
        if (obstacles.length === 0) {
            return null;
        }
        const node: ObstacleTreeNode = {
            obstacle: null,
            left: null,
            right: null
        }
        let optimalSplit = 0;
        let minLeft = obstacles.length;
        let minRight = obstacles.length;
        for (let i = 0; i < obstacles.length; i++) {
            let leftSize = 0;
            let rightSize = 0;
            const obstacleI1 = obstacles[i]!;
            const obstacleI2 = obstacleI1.next!;
            // Compute optimal split mode
            for (let j = 0; j < obstacles.length; j++) {
                if (i === j) {
                    continue;
                }
                const obstacleJ1 = obstacles[j]!;
                const obstacleJ2 = obstacleJ1.next!;
                const j1LeftOfI = leftOf(obstacleI1.point, obstacleI2.point, obstacleJ1.point);
                const j2LeftOfI = leftOf(obstacleI1.point, obstacleI2.point, obstacleJ2.point);
                if (j1LeftOfI >= _Math.NEG_EPSILON && j2LeftOfI >= _Math.NEG_EPSILON) {
                    ++leftSize;
                } else if (j1LeftOfI <= _Math.EPSILON && j2LeftOfI <= _Math.EPSILON) {
                    ++rightSize;
                } else {
                    ++leftSize;
                    ++rightSize;
                }
                const maxSize = Math.max(leftSize, rightSize);
                const minSize = Math.min(leftSize, rightSize);
                const maxDir = Math.max(minLeft, minRight);
                const minDir = Math.min(minLeft, minRight);
                if (maxSize > maxDir || (maxSize === maxDir && minSize >= minDir)) {
                    break;
                }
            }
            const maxSize = Math.max(leftSize, rightSize);
            const minSize = Math.min(leftSize, rightSize);
            const maxDir = Math.max(minLeft, minRight);
            const minDir = Math.min(minLeft, minRight);
            if (maxSize < maxDir || (maxSize === maxDir && minSize < minDir)) {
                minLeft = leftSize;
                minRight = rightSize;
                optimalSplit = i;
            }
        }
        // Build split node
        const leftObstacles: (Obstacle | null)[] = Array(minLeft).fill(null) as null[];
        const rightObstacles: (Obstacle | null)[] = Array(minRight).fill(null) as null[];
        let leftCounter = 0;
        let rightCounter = 0;
        const i = optimalSplit;
        const obstacleI1 = obstacles[i]!;
        const obstacleI2 = obstacleI1.next!;
        for (let j = 0; j < obstacles.length; j++) {
            if (i === j) {
                continue;
            }
            const obstacleJ1 = obstacles[j]!;
            const obstacleJ2 = obstacleJ1.next!;
            const j1LeftOfI = leftOf(obstacleI1.point, obstacleI2.point, obstacleJ1.point);
            const j2LeftOfI = leftOf(obstacleI1.point, obstacleI2.point, obstacleJ2.point);
            if (j1LeftOfI >= _Math.NEG_EPSILON && j2LeftOfI >= _Math.NEG_EPSILON) {
                leftObstacles[leftCounter++] = obstacles[j]!;
            } else if (j1LeftOfI <= _Math.EPSILON && j2LeftOfI <= _Math.EPSILON) {
                rightObstacles[rightCounter++] = obstacles[j]!;
            } else {
                // Split obstacle j
                const det1 = obstacleI2.point.clone().sub(obstacleI1.point).det(
                    obstacleJ1.point.clone().sub(obstacleI1.point));
                const det2 = obstacleI2.point.clone().sub(obstacleI1.point).det(
                    obstacleJ1.point.clone().sub(obstacleJ2.point));
                const t = det1 / det2;
                const splitPoint = obstacleJ1.point.clone().add(
                    obstacleJ2.point.clone().sub(obstacleJ1.point).scale(t));
                const newObstacle = {
                    id: this.obstaclesRef.length,
                    direction: obstacleJ1.direction,
                    point: splitPoint,
                    next: obstacleJ2,
                    prev: obstacleJ1,
                    isConvex: true
                }
                this.obstaclesRef.push(newObstacle); // TODO: confirm no side effects
                obstacleJ1.next = newObstacle;
                obstacleJ2.prev = newObstacle;
                if (j1LeftOfI > 0) {
                    leftObstacles[leftCounter++] = obstacleJ1;
                    rightObstacles[rightCounter++] = newObstacle;
                } else {
                    rightObstacles[rightCounter++] = obstacleJ1;
                    leftObstacles[leftCounter++] = newObstacle;
                }
            }
        }
        node.obstacle = obstacleI1;
        node.left = this.buildObstacleTreeRecursive(leftObstacles as Obstacle[]);
        node.right = this.buildObstacleTreeRecursive(rightObstacles as Obstacle[]);
        return node;
    }

    deleteObstacleTree(node: ObstacleTreeNode | null): void {
        // TODO: manage memory differently?
        if (node !== null) {
            this.deleteObstacleTree(node.left);
            this.deleteObstacleTree(node.right);
            node.left = null;
            node.right = null;
            node.obstacle = null;
        }
    }

    // TODO: avoid having to pass the obstacleNeighbors array every time (store in kdtree?)
    computeObstacleNeighbors(agent: Agent, rangeSq: number, obstacleNeighbors: ObstacleNeighbor[]) {
        this.queryObstacleTreeRecursive(agent, rangeSq, this.obstacleTree, obstacleNeighbors);
    }

    queryObstacleTreeRecursive(agent: Agent, rangeSq: number, node: ObstacleTreeNode | null, obstacleNeighbors: ObstacleNeighbor[]) {
        if (node === null) {
            return;
        }
        const position = agent.center;
        const obstacle1 = node.obstacle!;
        const obstacle2 = obstacle1.next!;
        const agentLeftOfLine = leftOf(obstacle1.point, obstacle2.point, position);
        this.queryObstacleTreeRecursive(agent, rangeSq, agentLeftOfLine >= 0 ? node.left : node.right, obstacleNeighbors);
        const distSqLine = (agentLeftOfLine * agentLeftOfLine) /
            obstacle2.point.clone().sub(obstacle1.point).lenSq();
        if (distSqLine < rangeSq) {
            if (agentLeftOfLine < 0) {
                // Try obstacle at this node only if agent is on right side of obstacle
                // and can see obstacle.
                // Insert obstacle neighbor
                const obstacle = node.obstacle!;
                const nextObstacle = obstacle.next!;
                let distSq = 0;
                const numerator = position.clone().sub(obstacle.point).dot(
                    nextObstacle.point.clone().sub(obstacle.point));
                const determinant = nextObstacle.point.clone().sub(obstacle.point).lenSq();
                const r = numerator / determinant;
                if (r < 0) {
                    distSq = position.clone().sub(obstacle.point).lenSq();
                } else if (r > 1) {
                    distSq = position.clone().sub(nextObstacle.point).lenSq();
                } else {
                    distSq = position.clone().sub(obstacle.point.clone().add(
                        nextObstacle.point.clone().sub(obstacle.point).scale(r))).lenSq();
                }
                if (distSq < rangeSq) {
                    obstacleNeighbors.push({ distSq, obstacle });
                    let i = obstacleNeighbors.length - 1;
                    while (i != 0 && distSq < obstacleNeighbors[i - 1]!.distSq) {
                        obstacleNeighbors[i] = obstacleNeighbors[i - 1]!;
                        --i;
                    }
                    obstacleNeighbors[i] = { distSq, obstacle };
                }
            }
            // Try other side of line
            this.queryObstacleTreeRecursive(agent, rangeSq, agentLeftOfLine >= 0 ? node.right : node.left, obstacleNeighbors);
        }
    }

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
    readonly timeHorizonObst: number;
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
    kdTree: KdTree;

    // TODO: for parallelization, implement a callback mechanism to merge added obstacles (if not all predetermined?)
    // TODO: shared array buffer optional for web workers
    constructor(kdTree: KdTree, agentsRef: Agent[], obstaclesRef: Obstacle[], timeHorizon: number, obstTimeHorizon: number) {
        this.kdTree = kdTree;
        this.agentsRef = agentsRef;
        this.obstaclesRef = obstaclesRef;
        this.timeHorizon = timeHorizon;
        this.invTimeHorizon = 1 / timeHorizon;
        this.timeHorizonObst = obstTimeHorizon;
        this.invTimeHorizonObst = 1 / obstTimeHorizon;
        this.v2Pool = Array(this.v2PoolSize).fill(null).map(() => new Vector2());
        this.lines = Array(this.linesInitialSize).fill(null).map(() => (defaultLine()));
        this.projectedLines = Array(this.projectedLinesInitialSize).fill(null).map(() => (defaultLine()));
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
        // TODO: optimize (pooling etc.)
        this.obstacleNeighbors = [];
        const range = this.timeHorizonObst * maxSpeedA + rA;
        this.kdTree.computeObstacleNeighbors(agentA, range * range, this.obstacleNeighbors);

        // Compute agent neighbors
        // TODO: optimize (pooling etc.)
        this.agentNeighbors = [];
        // TODO: fix jittering caused by the compute agent approach
        if (agentA.maxNeighbors > 0) {
            const rangeSqObj = { reference: agentA.neighborDistSq };
            this.kdTree.computeAgentNeighbors(agentA, rangeSqObj, this.agentNeighbors);
        }
        // this.agentNeighbors = this.agentsRef.filter(agentB => agentA.id !== agentB.id).map(agentB => {
        //     const pB = agentB.center;
        //     const distSq = pA.distToSq(pB);
        //     return { distSq, agent: agentB };
        // });

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
                        for (let i = 0; i < this.projectedLinesGrowthN; i++) {
                            projectedLines.push(defaultLine());
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
            const lines = this.lines;
            for (let i = 0; i < this.linesGrowthN; i++) {
                lines.push(defaultLine());
            }
        }
        const line = this.lines[this.lineIndex]!;
        line.direction.x = directionX;
        line.direction.y = directionY;
        line.point.x = pointX;
        line.point.y = pointY;
    }
}




