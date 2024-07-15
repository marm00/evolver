'use client';

import { useEffect, useRef } from "react";
import { renderGrass } from "~/lib/game";

export function Canvas() {
    const gameCanvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!gameCanvas.current) throw new Error('Canvas not found');
        gameCanvas.current.width = window.innerWidth;
        gameCanvas.current.height = window.innerHeight;
        const ctx = gameCanvas.current.getContext('2d');
        if (!ctx) throw new Error('2D context not found');

        const deltas: number[] = [];
        let prevTimestamp = 0;

        const frame = (timestamp: number) => {
            const deltaTime = (timestamp - prevTimestamp) / 1000;
            const time = timestamp / 1000;
            prevTimestamp = timestamp;

            deltas.push(deltaTime);
            if (deltas.length > 60) deltas.shift();
            const deltaAvg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            const fps = Math.floor(1/deltaAvg);
            console.log(`${fps} fps`);
            
            renderGrass(ctx).then().catch(console.error);

            window.requestAnimationFrame(frame);
        };

        window.requestAnimationFrame((timestamp) => {
            prevTimestamp = timestamp;
            window.requestAnimationFrame(frame);
        });

        const handleResize = () => {
            if (!gameCanvas.current) throw new Error('Canvas not found');
            gameCanvas.current.width = window.innerWidth;
            gameCanvas.current.height = window.innerHeight;

            const ctx = gameCanvas.current.getContext('2d');
            if (!ctx) throw new Error('Canvas not found');
            ctx.canvas.width = window.innerWidth;
            ctx.canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <canvas ref={gameCanvas} className="h-screen w-screen bg-blue-950"></canvas>
    );
}
