import * as game from "~/lib/game";

export function DebugPanel({ gameState, frameCount }: { gameState: game.Game, frameCount: number }) {
    return (
        <div className="absolute top-0 right-0 p-2 select-none hover:select-text focus:select-text outline-none
        focus:ring-2 focus:ring-slate-500 bg-slate-300/25 text-white" tabIndex={0}>
            XY: {'(' + gameState.player.center.x.toFixed(1)}, {gameState.player.center.y.toFixed(1) + ')'}
        </div>
    )
}