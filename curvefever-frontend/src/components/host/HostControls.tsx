import type { ReactNode } from "react";
import type { GameMode } from "../../types";
import { FullscreenIcon, LeaveGameIcon } from "../ActionIcons";
import HostJoinQr from "./HostJoinQr";

type Props = {
    copiedCode: boolean;
    roomCode: string | null;
    joinUrl: string | null;
    gameMode: GameMode;
    teamCount: number;
    effectiveTargetScore: number;
    playing: boolean;
    canStart: boolean;
    startError: string | null;
    isFullscreen: boolean;
    isFullscreenSupported: boolean;
    layout?: "lobby" | "sidebar";
    playersSlot?: ReactNode;
    onLeaveGame: () => void;
    onChangeMode: () => void;
    onCopyGameCode: () => void;
    onStartGame: () => void;
    onToggleFullscreen: () => void;
};

export default function HostControls({
    copiedCode,
    roomCode,
    joinUrl,
    gameMode,
    teamCount,
    effectiveTargetScore,
    playing,
    canStart,
    startError,
    isFullscreen,
    isFullscreenSupported,
    layout = "sidebar",
    playersSlot = null,
    onLeaveGame,
    onChangeMode,
    onCopyGameCode,
    onStartGame,
    onToggleFullscreen,
}: Props) {
    const fullscreenLabel = isFullscreen
        ? "Exit fullscreen"
        : "Enter fullscreen";
    const qrJoinUrl = playing ? null : joinUrl;
    const scoreText =
        gameMode === "classic"
            ? `Race to ${effectiveTargetScore} pts`
            : gameMode === "teams"
              ? `Teams · First to ${effectiveTargetScore} pts`
              : "Battle Royale · Last player standing";
    const gameModeText =
        gameMode === "classic"
            ? "Classic"
            : gameMode === "teams"
              ? `Teams${teamCount > 0 ? ` · ${teamCount} teams` : ""}`
              : "Battle Royale";

    if (layout === "lobby") {
        return (
            <>
                <div className="panel-header host-lobby-header">
                    <div>
                        <p className="eyebrow">Host Console</p>
                    </div>
                    <div className="panel-header-actions">
                        <button
                            className="ui-button ui-button-ghost ui-icon-button"
                            onClick={onToggleFullscreen}
                            disabled={!isFullscreenSupported}
                            aria-label={
                                isFullscreenSupported
                                    ? fullscreenLabel
                                    : "Fullscreen unavailable"
                            }
                            title={
                                isFullscreenSupported
                                    ? fullscreenLabel
                                    : "Fullscreen unavailable"
                            }
                        >
                            <FullscreenIcon
                                active={isFullscreen}
                                className="ui-button-icon"
                            />
                        </button>
                        <button
                            className="ui-button ui-button-ghost ui-icon-button"
                            onClick={onLeaveGame}
                            aria-label="Leave game"
                            title="Leave game"
                        >
                            <LeaveGameIcon className="ui-button-icon" />
                        </button>
                    </div>
                </div>

                <div className="host-lobby-share-row">
                    <div className="host-lobby-share-main">
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
                        <div
                            className="status-pill target-score-pill host-lobby-score-pill"
                            role="status"
                        >
                            {scoreText}
                        </div>
                    </div>

                    <HostJoinQr joinUrl={qrJoinUrl} />
                </div>

                {playersSlot}

                <div className="host-lobby-action-section">
                    <div className="host-lobby-action-row">
                        <button
                            className="ui-button ui-button-secondary host-lobby-change-mode-button"
                            onClick={onChangeMode}
                        >
                            <span className="host-lobby-setup-button-label">
                                Game Setup
                            </span>
                            <span className="host-lobby-setup-button-value">
                                {gameModeText}
                            </span>
                        </button>
                        {!playing && (
                            <button
                                className="ui-button host-lobby-start-button"
                                onClick={onStartGame}
                                disabled={!canStart}
                            >
                                Start Game
                            </button>
                        )}
                    </div>
                    {startError && <div className="error-text">{startError}</div>}
                </div>
            </>
        );
    }

    return (
        <>
            <div className="panel-header">
                <div>
                    <p className="eyebrow">Host Console</p>
                </div>
                <div className="panel-header-actions">
                    <button
                        className="ui-button ui-button-ghost ui-icon-button"
                        onClick={onToggleFullscreen}
                        disabled={!isFullscreenSupported}
                        aria-label={
                            isFullscreenSupported
                                ? fullscreenLabel
                                : "Fullscreen unavailable"
                        }
                        title={
                            isFullscreenSupported
                                ? fullscreenLabel
                                : "Fullscreen unavailable"
                        }
                    >
                        <FullscreenIcon
                            active={isFullscreen}
                            className="ui-button-icon"
                        />
                    </button>
                    <button
                        className="ui-button ui-button-ghost ui-icon-button"
                        onClick={onLeaveGame}
                        aria-label="Leave game"
                        title="Leave game"
                    >
                        <LeaveGameIcon className="ui-button-icon" />
                    </button>
                </div>
            </div>

            <div className="host-lobby-overview">
                <div className="host-lobby-meta">
                    <div className="panel-row host-room-row">
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
                            {scoreText}
                        </div>
                    </div>
                </div>

                <HostJoinQr joinUrl={qrJoinUrl} />
            </div>

            {(!playing || startError) && (
                <div className="panel-row panel-row-bottom">
                    {!playing && (
                        <button
                            className="ui-button"
                            onClick={onStartGame}
                            disabled={!canStart}
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
