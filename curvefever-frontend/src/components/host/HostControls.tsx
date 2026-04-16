import type { GameMode } from "../../types";
import HostJoinQr from "./HostJoinQr";

type Props = {
    copiedCode: boolean;
    roomCode: string | null;
    joinUrl: string | null;
    gameMode: GameMode;
    effectiveTargetScore: number;
    playing: boolean;
    playersCount: number;
    startError: string | null;
    isFullscreen: boolean;
    isFullscreenSupported: boolean;
    onLeaveGame: () => void;
    onCopyGameCode: () => void;
    onGameModeChange: (gameMode: GameMode) => void;
    onStartGame: () => void;
    onToggleFullscreen: () => void;
};

export default function HostControls({
    copiedCode,
    roomCode,
    joinUrl,
    gameMode,
    effectiveTargetScore,
    playing,
    playersCount,
    startError,
    isFullscreen,
    isFullscreenSupported,
    onLeaveGame,
    onCopyGameCode,
    onGameModeChange,
    onStartGame,
    onToggleFullscreen,
}: Props) {
    return (
        <>
            <div className="panel-header">
                <div>
                    <p className="eyebrow">Host Console</p>
                </div>
                <div className="panel-header-actions">
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={onToggleFullscreen}
                        disabled={!isFullscreenSupported}
                    >
                        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </button>
                    <button
                        className="ui-button ui-button-ghost"
                        onClick={onLeaveGame}
                    >
                        Leave Game
                    </button>
                </div>
            </div>

            <div className="panel-row">
                <button
                    type="button"
                    className="status-pill room-code-pill room-code-button"
                    onClick={onCopyGameCode}
                    disabled={!roomCode}
                    title={
                        roomCode
                            ? "Click to copy game code"
                            : "No game code available"
                    }
                >
                    <span className="room-code-label">
                        {copiedCode ? "Copied!" : "Game Code"}
                    </span>
                    <span className="room-code-value">
                        {roomCode ?? "------"}
                    </span>
                </button>
                <div className="status-pill target-score-pill" role="status">
                    {gameMode === "classic"
                        ? `Race to ${effectiveTargetScore} pts`
                        : "Battle Royale · Last player standing"}
                </div>
            </div>

            <HostJoinQr joinUrl={playing ? null : joinUrl} />

            <div className="panel-row host-mode-row">
                <div
                    className="host-mode-toggle"
                    role="group"
                    aria-label="Select game mode"
                >
                    <button
                        type="button"
                        className={`host-mode-option ${gameMode === "classic" ? "is-active" : ""}`}
                        onClick={() => onGameModeChange("classic")}
                        disabled={playing}
                    >
                        Classic
                    </button>
                    <button
                        type="button"
                        className={`host-mode-option ${gameMode === "battle-royale" ? "is-active" : ""}`}
                        onClick={() => onGameModeChange("battle-royale")}
                        disabled={playing}
                    >
                        Battle Royale
                    </button>
                </div>
            </div>

            {(!playing || startError) && (
                <div className="panel-row panel-row-bottom">
                    {!playing && (
                        <button
                            className="ui-button"
                            onClick={onStartGame}
                            disabled={playersCount < 1}
                        >
                            Start Game
                        </button>
                    )}
                    {startError && (
                        <div className="error-text">{startError}</div>
                    )}
                </div>
            )}
        </>
    );
}
