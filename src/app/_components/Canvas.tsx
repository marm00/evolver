'use client';

import { useEffect, useRef } from "react";
import * as game from "~/lib/game";

export function Canvas() {
    /** Guard to prevent multiple games from being created in React strict mode. */
    const _devRunOnce = useRef(Boolean(1));
    const _devGameCreated = useRef(false);

    /** Canvas to render the game to. */
    const gameCanvas = useRef<HTMLCanvasElement>(null);

    type KeyAction = () => void;

    useEffect(() => {
        if (_devRunOnce.current === true) {
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
            /** Update the canvas dimensions and store the center in game state. */
            const handleResize = (_?: Event) => {
                const canvas = gameCanvas.current;
                if (!canvas) throw new Error('Canvas not found');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                gameState.player.canvasCenterX = canvas.width / 2;
                gameState.player.canvasCenterY = canvas.height / 2;
                if (!canvas.getContext('2d')) throw new Error('2D context not found');
            };

            /** Sets the mouse center offset for faster mouse projection every frame. */
            const handleMouseMove = (e: MouseEvent) => {
                gameState.player.mouseCanvasDX = gameState.player.canvasCenterX - e.clientX;
                gameState.player.mouseCanvasDY = gameState.player.canvasCenterY - e.clientY;
            }

            /** TODO: Forward mouse clicks to the game state. */
            const handleMouseDown = (_: MouseEvent) => {
                console.log('Clicked at :', gameState.player.mousePosition.x, gameState.player.mousePosition.y);
                game.attack(gameState.player.mousePosition, gameState.player, gameState.world, gameState.oRectPool, gameState.v2Pool2, gameState.v2Pool, gameState.spearPool, gameState.spears);
                game.launchMeteorite(gameState.player.mousePosition, gameState.player.center, gameState.meteoritePool, gameState.meteorites);
            }

            const handleMouseUp = (_: MouseEvent) => {
                console.log('Released at:', gameState.player.mousePosition.x, gameState.player.mousePosition.y);
            }

            const keyDownActions: Record<string, KeyAction> = {
                'ArrowLeft': () => { gameState.player.pressingLeft = true; },
                'a': () => { gameState.player.pressingLeft = true; },
                'ArrowRight': () => { gameState.player.pressingRight = true; },
                'd': () => { gameState.player.pressingRight = true; },
                'ArrowUp': () => { gameState.player.pressingUp = true; },
                'w': () => { gameState.player.pressingUp = true; },
                'ArrowDown': () => { gameState.player.pressingDown = true; },
                's': () => { gameState.player.pressingDown = true; }
            };

            const keyUpActions: Record<string, KeyAction> = {
                'ArrowLeft': () => { gameState.player.pressingLeft = false; },
                'a': () => { gameState.player.pressingLeft = false; },
                'ArrowRight': () => { gameState.player.pressingRight = false; },
                'd': () => { gameState.player.pressingRight = false; },
                'ArrowUp': () => { gameState.player.pressingUp = false; },
                'w': () => { gameState.player.pressingUp = false; },
                'ArrowDown': () => { gameState.player.pressingDown = false; },
                's': () => { gameState.player.pressingDown = false; }
            };

            const handleKeyDown = (e: KeyboardEvent) => {
                if (!e.repeat) {
                    keyDownActions[e.key]?.();
                    game.updatePlayerDirection(gameState.player);
                }
            }

            const handleKeyUp = (e: KeyboardEvent) => {
                if (!e.repeat) {
                    keyUpActions[e.key]?.();
                    game.updatePlayerDirection(gameState.player);
                }
            }

            handleResize(); // Resize once to set the projected bounds
            /** 
             * TODO: find a better way to show FPS
             * Stores the time difference between frames.
             */
            const deltas: number[] = [];
            let prevTimestamp = 0;

            /** The main game loop. Each frame, the game is updated and rendered to the canvas. */
            const frame = (timestamp: number) => {
                const deltaTime = (timestamp - prevTimestamp) / 1000;
                const elapsedTime = timestamp / 1000;
                prevTimestamp = timestamp;

                deltas.push(deltaTime);
                if (deltas.length > 60) deltas.shift();
                const deltaAvg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
                const fps = Math.floor(1 / deltaAvg);
                // console.log('FPS:', fps);

                game.updateGame(ctx, gameState, elapsedTime, deltaTime).then().catch(console.error);
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