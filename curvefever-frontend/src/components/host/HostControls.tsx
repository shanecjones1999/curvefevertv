import type { GameMode } from "../../types";

type Props = {
    copiedCode: boolean;
    roomCode: string | null;
    gameMode: GameMode;
    powerUpsEnabled: boolean;
    effectiveTargetScore: number;
    playing: boolean;
    playersCount: number;
    startError: string | null;
    onLeaveGame: () => void;
    onCopyGameCode: () => void;
    onGameModeChange: (gameMode: GameMode) => void;
    onPowerUpsEnabledChange: (enabled: boolean) => void;
    onStartGame: () => void;
};

export default function HostControls({
    copiedCode,
    roomCode,
    gameMode,
    powerUpsEnabled,
    effectiveTargetScore,
    playing,
    playersCount,
    startError,
    onLeaveGame,
    onCopyGameCode,
    onGameModeChange,
    onPowerUpsEnabledChange,
    onStartGame,
}: Props) {
    return (
        <>
            <div className="panel-header">
                <div>
                    <p className="eyebrow">Host Console</p>
                </div>
                <button
                    className="ui-button ui-button-ghost"
                    onClick={onLeaveGame}
                >
                    Leave Game
                </button>
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

            <div className="panel-row host-setting-row">
                <div
                    className="host-mode-toggle"
                    role="group"
                    aria-label="Enable power ups"
                >
                    <button
                        type="button"
                        className={`host-mode-option ${!powerUpsEnabled ? "is-active" : ""}`}
                        onClick={() => onPowerUpsEnabledChange(false)}
                        disabled={playing}
                    >
                        Power-Ups Off
                    </button>
                    <button
                        type="button"
                        className={`host-mode-option ${powerUpsEnabled ? "is-active" : ""}`}
                        onClick={() => onPowerUpsEnabledChange(true)}
                        disabled={playing}
                    >
                        Power-Ups On
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
