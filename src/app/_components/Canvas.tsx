'use client';

import { useEffect, useRef } from "react";
import * as game from "~/lib/game";
import { Vector2 } from "~/lib/vector2";

export function Canvas() {
    /** Guard to prevent multiple games from being created in React strict mode. */
    const _devGameCreated = useRef(false);
    
    /** Canvas to render the game to. */
    const gameCanvas = useRef<HTMLCanvasElement>(null);
    /** The center of the canvas (in unprojected client coordinates). */
    const canvasCenter = useRef({ x: 0, y: 0 });
    /** The bounds of the canvas in world coordinates. */
    const projectedBounds = useRef({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    /** The canvas mouse position in world coordinates. */
    const projectedMousePosition = useRef(new Vector2(0, 0));

    useEffect(() => {
        if (_devGameCreated.current === true) {
            return;
        } else {
            _devGameCreated.current = true;
        }

        if (!gameCanvas.current) throw new Error('Canvas not found');
        gameCanvas.current.width = window.innerWidth;
        gameCanvas.current.height = window.innerHeight;
        const ctx = gameCanvas.current.getContext('2d');
        if (!ctx) throw new Error('2D context not found');

        game.createGame("singlecell").then((gameState) => {
            /**
             * Projects the viewport onto the world coordinate system, centered around the player's position.
             * Both use the same units (pixels), so no scaling occurs. This means that the dimensions of the
             * viewport determine how much of the world is visible.
             */
            const handleResize = (_?: Event) => {
                if (!gameCanvas.current) throw new Error('Canvas not found');
                gameCanvas.current.width = window.innerWidth;
                gameCanvas.current.height = window.innerHeight;
                canvasCenter.current.x = gameCanvas.current.width / 2;
                canvasCenter.current.y = gameCanvas.current.height / 2;
                projectedBounds.current = {
                    minX: gameState.player.position.x - canvasCenter.current.x,
                    minY: gameState.player.position.y - canvasCenter.current.y,
                    maxX: gameState.player.position.x + canvasCenter.current.x,
                    maxY: gameState.player.position.y + canvasCenter.current.y
                }
                console.log('Projected bounds:', projectedBounds.current);
            };

            /** Projects the mouse position to the world coordinate system, using the player's position as a reference point. */
            const handleMouseMove = (e: MouseEvent) => {
                const dx = canvasCenter.current.x - e.clientX;
                const dy = canvasCenter.current.y - e.clientY;
                const nx = gameState.player.position.x - dx;
                const ny = gameState.player.position.y + dy;
                projectedMousePosition.current.set(nx, ny);
            }

            /** TODO: Forward mouse clicks to the game state. */
            const handleClick = (_: MouseEvent) => {
                console.log('Click at projected:', projectedMousePosition.current);
            }

            handleResize(); // Resize once to set the projected bounds
            /** Stores the time difference between frames. */
            const deltas: number[] = [];
            let prevTimestamp = 0;

            /** The main game loop. Each frame, the game is updated and rendered to the canvas. */
            const frame = (timestamp: number) => {
                const deltaTime = (timestamp - prevTimestamp) / 1000;
                const time = timestamp / 1000;
                prevTimestamp = timestamp;

                deltas.push(deltaTime);
                if (deltas.length > 60) deltas.shift();
                const deltaAvg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
                const fps = Math.floor(1 / deltaAvg);

                game.updateGame(ctx, gameState, time, deltaTime).then().catch(console.error);
                window.requestAnimationFrame(frame);
            };

            window.requestAnimationFrame((timestamp) => {
                prevTimestamp = timestamp;
                window.requestAnimationFrame(frame);
            });

            window.addEventListener('resize', handleResize);
            ctx.canvas.addEventListener('mousemove', handleMouseMove);
            ctx.canvas.addEventListener('click', handleClick);
            return () => {
                window.removeEventListener('resize', handleResize)
                ctx.canvas.removeEventListener('mousemove', handleMouseMove);
                ctx.canvas.removeEventListener('click', handleClick);
            };
        }).catch(console.error);
    }, []);

    return (
        <canvas ref={gameCanvas} className="w-screen h-screen bg-blue-950"></canvas>
    );
}