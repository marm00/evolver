'use client';

import { useEffect, useRef } from "react";
import * as game from "~/lib/game";
import { Vector2 } from "~/lib/vector2";

export function Canvas() {
    /** Guard to prevent multiple games from being created in React strict mode. */
    const _devGameGuard = useRef(Boolean(1));
    const _devGameCreated = useRef(false);

    /** Canvas to render the game to. */
    const gameCanvas = useRef<HTMLCanvasElement>(null);
    /** The center of the canvas (in unprojected client coordinates). */
    const canvasCenter = useRef({ x: 0, y: 0 });
    // /** The bounds of the canvas in world coordinates. */
    // const projectedBounds = useRef({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    // /** The canvas mouse position in world coordinates. */
    // const projectedMousePosition = useRef(new Vector2(0, 0));

    useEffect(() => {
        if (_devGameGuard.current === true) {
            if (_devGameCreated.current === true) {
                return;
            } else {
                _devGameCreated.current = true;
            }
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
                const canvas = gameCanvas.current;
                if (!canvas) throw new Error('Canvas not found');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                canvasCenter.current.x = canvas.width / 2;
                canvasCenter.current.y = canvas.height / 2;
                const pos = gameState.player.position;
                const center = canvasCenter.current;
                gameState.canvasBounds = {
                    minX: pos.x - center.x,
                    minY: pos.y - center.y,
                    maxX: pos.x + center.x,
                    maxY: pos.y + center.y
                }
            };

            /** Projects the mouse position to the world coordinate system, using the player's position as a reference point. */
            const handleMouseMove = (e: MouseEvent) => {
                const dx = canvasCenter.current.x - e.clientX;
                const dy = canvasCenter.current.y - e.clientY;
                const nx = gameState.player.position.x - dx;
                const ny = gameState.player.position.y + dy;
                gameState.player.mousePosition.set(nx, ny);
            }

            /** TODO: Forward mouse clicks to the game state. */
            const handleMouseDown = (e: MouseEvent) => {
                const dx = canvasCenter.current.x - e.clientX;
                const dy = canvasCenter.current.y - e.clientY;
                const nx = gameState.player.position.x - dx;
                const ny = gameState.player.position.y + dy;
                console.log('Click at projected:', new Vector2(nx, ny));
            }

            const handleMouseUp = (e: MouseEvent) => {
                const dx = canvasCenter.current.x - e.clientX;
                const dy = canvasCenter.current.y - e.clientY;
                const nx = gameState.player.position.x - dx;
                const ny = gameState.player.position.y + dy;
                console.log('Released at projected:', new Vector2(nx, ny));
            }

            const handleKeyDown = (e: KeyboardEvent) => {
                if (!e.repeat) {
                    if (e.key === 'ArrowLeft' || e.key === 'a') {
                        gameState.player.pressingLeft = true;
                    } else if (e.key === 'ArrowRight' || e.key === 'd') {
                        gameState.player.pressingRight = true;
                    } else if (e.key === 'ArrowUp' || e.key === 'w') {
                        gameState.player.pressingUp = true;
                    } else if (e.key === 'ArrowDown' || e.key === 's') {
                        gameState.player.pressingDown = true;
                    }
                }
            }

            const handleKeyUp = (e: KeyboardEvent) => {
                if (!e.repeat) {
                    // console.log('Releasing:', e.key);
                    if (e.key === 'ArrowLeft' || e.key === 'a') {
                        gameState.player.pressingLeft = false;
                    } else if (e.key === 'ArrowRight' || e.key === 'd') {
                        gameState.player.pressingRight = false;
                    } else if (e.key === 'ArrowUp' || e.key === 'w') {
                        gameState.player.pressingUp = false;
                    } else if (e.key === 'ArrowDown' || e.key === 's') {
                        gameState.player.pressingDown = false;
                    }
                }
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
                // console.log('FPS:', fps);

                // TODO: update game state directly instead of passing it to the game update function
                game.updateGame(ctx, gameState, time, deltaTime).then().catch(console.error);
                window.requestAnimationFrame(frame);
            };

            window.requestAnimationFrame((timestamp) => {
                prevTimestamp = timestamp;
                window.requestAnimationFrame(frame);
            });

            window.addEventListener('resize', handleResize);
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            ctx.canvas.addEventListener('mousemove', handleMouseMove);
            ctx.canvas.addEventListener('mousedown', handleMouseDown);
            ctx.canvas.addEventListener('mouseup', handleMouseUp);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
                ctx.canvas.removeEventListener('mousemove', handleMouseMove);
                ctx.canvas.removeEventListener('mousedown', handleMouseDown);
                ctx.canvas.removeEventListener('mouseup', handleMouseUp);
            };
        }).catch(console.error);
    }, []);

    return (
        <canvas ref={gameCanvas} className="h-screen w-screen bg-blue-950"></canvas>
    );
}