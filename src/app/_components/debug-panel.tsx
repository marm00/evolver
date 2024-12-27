import * as game from "~/lib/game";

export function DebugPanel({ gameState, frameCount }: { gameState: game.Game, frameCount: number }) {
    return (
        <div className="absolute top-0 right-0 p-2 select-none hover:select-text bg-slate-300/25 text-white">
            XY: {'(' + gameState.player.center.x.toFixed(1)}, {gameState.player.center.y.toFixed(1) + ')'}
        </div>
    )
}