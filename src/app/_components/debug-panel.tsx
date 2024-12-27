import * as game from "~/lib/game";
import { Vector2 } from "~/lib/vector2";
import { _Math } from "~/lib/mathUtils";

export function DebugPanel({ gameState, frameCount }: { gameState: game.Game, frameCount: number }) {
    const gs = gameState;
    const mouseDirRad = gs.player.mousePosition.clone().sub(gs.player.center).norm().dir();
    const mouseDirDeg = _Math.radToDeg(mouseDirRad);

    function formatV2(v: Vector2, decimals = 1): { x: string, y: string, value: string } {
        const x = v.x.toFixed(decimals).padStart(8, '\u00A0');
        const y = v.y.toFixed(decimals).padStart(8, '\u00A0');
        const value = `(${x}, ${y})`;
        return { x, y, value };
    }

    return (
        <div className="fixed top-5 right-5 p-5 select-none hover:select-text focus:select-text outline-none
        focus:ring-2 focus:ring-slate-500 bg-slate-300/25 text-white font-mono flex flex-col text-right 
        overflow-auto max-h-screen max-w-full whitespace-pre-wrap text-base" tabIndex={0}>
            <div className="grid grid-cols-[auto_auto] gap-x-2">
                <span>XY:</span>
                <span>{formatV2(gs.player.center).value}</span>
                <span>Velocity:</span>
                <span>{formatV2(gs.player.velocity).value}</span>
                <span>Mouse rel:</span>
                <span>{formatV2(gs.player.mousePosition).value}</span>
                <span>Thunderstorm:</span>
                <span>{formatV2(gs.thunderstorm.active ? gs.thunderstorm.center : Vector2.zero()).value}</span>
                <span>Mouse angle:</span>
                <span>{mouseDirRad.toFixed(2)}, {mouseDirDeg.toFixed(2)}&#176;</span>
            </div>
            <hr className="my-2" />
            <div className="grid grid-cols-[auto_auto] gap-x-2">
                <span>Orb count:</span>
                <span>{gs.orb.active ? gs.orb.centers.length : 0}</span>
                <span>Obsidian count:</span>
                <span>{gs.obsidians.length}</span>
                <span>Meteorite count:</span>
                <span>{gs.meteorites.length}</span>
                <span>Spear count:</span>
                <span>{gs.spears.length}</span>
            </div>
            <hr className="my-2" />
            <div className="grid grid-cols-[auto_auto] gap-x-2">
                <span>Agents:</span>
                <span>{gs.kdTree.agents.length}</span>
                <span>Time horizon:</span>
                <span>{gs.agentWorker.timeHorizon}</span>
                <span>Time horizon obst:</span>
                <span>{gs.agentWorker.timeHorizonObst}</span>
                <span>Max agent neighbors:</span>
                <span>{gs.agentWorker.maxAgentNeighbors}</span>
                <span>Lines capacity:</span>
                <span>{gs.agentWorker.lines.length}</span>
                <span>Obst. capacity:</span>
                <span>{gs.agentWorker.obstacleNeighbors.length}</span>
                <span>Proj. lines capacity:</span>
                <span>{gs.agentWorker.projectedLines.length}</span>
            </div>
        </div>
    );
}
