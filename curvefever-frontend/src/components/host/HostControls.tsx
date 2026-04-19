import type { ReactNode } from "react";
import type { GameMode } from "../../types";
import { FullscreenIcon, LeaveGameIcon } from "../ActionIcons";
import HostJoinQr from "./HostJoinQr";
import styles from "./HostControls.module.css";

type Props = {
    copiedCode: boolean;
    roomCode: string | null;
    joinUrl: string | null;
    gameMode: GameMode;
    teamCount: number;
    effectiveTargetScore: number;
    playerCount: number;
    connectedPlayerCount: number;
    alivePlayerCount: number;
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
    playerCount,
    connectedPlayerCount,
    alivePlayerCount,
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
    const playerSummary =
        playerCount === 1 ? "1 player in room" : `${playerCount} players in room`;
    const connectionSummary =
        playerCount === 0
            ? "Waiting for joins"
            : connectedPlayerCount === playerCount
            ? "Everyone connected"
            : `${connectedPlayerCount}/${playerCount || 0} connected`;

    if (layout === "lobby") {
        return (
            <>
                <div className={`panel-header ${styles.header}`}>
                    <div className={styles.headerCopy}>
                        <p className="eyebrow">Host Console</p>
                        <h1 className={`title title-small ${styles.title}`}>
                            Room ready for players.
                        </h1>
                        <p className={`subtitle ${styles.subtitle}`}>
                            Share the code, watch the roster, and launch when the
                            room is set.
                        </p>
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

                <div className={styles.contentGrid}>
                    <div className={styles.primary}>
                        <div className={styles.shareMain}>
                            <div className={styles.shareHeader}>
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
                                <div className={styles.shareMeta}>
                                    <div
                                        className={`status-pill target-score-pill ${styles.scorePill}`}
                                        role="status"
                                    >
                                        {scoreText}
                                    </div>
                                    <p className={styles.shareHint}>
                                        Scan the QR or type the code from any phone on
                                        the same network.
                                    </p>
                                </div>
                            </div>
                            <div
                                className={styles.stepGrid}
                                aria-label="How to join"
                            >
                                <div className={styles.stepCard}>
                                    <span className={styles.stepIndex}>1</span>
                                    <div>
                                        <strong>Scan</strong>
                                        <p>Open the join page.</p>
                                    </div>
                                </div>
                                <div className={styles.stepCard}>
                                    <span className={styles.stepIndex}>2</span>
                                    <div>
                                        <strong>Join</strong>
                                        <p>Pick a name and connect.</p>
                                    </div>
                                </div>
                                <div className={styles.stepCard}>
                                    <span className={styles.stepIndex}>3</span>
                                    <div>
                                        <strong>Launch</strong>
                                        <p>Start when the roster is ready.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {playersSlot}
                    </div>

                    <div className={styles.shareSide}>
                        <HostJoinQr joinUrl={qrJoinUrl} />
                        <div className={styles.metrics} aria-label="Lobby overview">
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Roster</span>
                                <strong className={styles.metricValue}>
                                    {playerSummary}
                                </strong>
                                <span className={styles.metricCopy}>
                                    {connectionSummary}
                                </span>
                            </article>
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Mode</span>
                                <strong className={styles.metricValue}>
                                    {gameModeText}
                                </strong>
                                <span className={styles.metricCopy}>
                                    Tuned for this room setup
                                </span>
                            </article>
                            <article className={styles.metricCard}>
                                <span className={styles.metricLabel}>Win condition</span>
                                <strong className={styles.metricValue}>
                                    {gameMode === "battle-royale"
                                        ? "Last one alive"
                                        : `${effectiveTargetScore} pts`}
                                </strong>
                                <span className={styles.metricCopy}>
                                    {gameMode === "battle-royale"
                                        ? "Single-elimination showdown"
                                        : "Score race across rounds"}
                                </span>
                            </article>
                        </div>
                        <div className={`${styles.actionSection} ${styles.actionSectionInline}`}>
                            <div className={styles.actionRow}>
                                <button
                                    className={`ui-button ui-button-secondary ${styles.changeModeButton}`}
                                    onClick={onChangeMode}
                                >
                                    <span className={styles.setupButtonLabel}>
                                        Game Setup
                                    </span>
                                    <span className={styles.setupButtonValue}>
                                        {gameModeText}
                                    </span>
                                </button>
                                {!playing && (
                                    <button
                                        className={`ui-button ${styles.startButton}`}
                                        onClick={onStartGame}
                                        disabled={!canStart}
                                    >
                                        Start Game
                                    </button>
                                )}
                            </div>
                            {startError && <div className={`error-text ${styles.errorText}`}>{startError}</div>}
                        </div>
                    </div>
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
                    <div className="host-sidebar-stat-grid">
                        <span className="host-sidebar-stat">
                            <strong>{playerCount}</strong>
                            <span>in room</span>
                        </span>
                        <span className="host-sidebar-stat">
                            <strong>{connectedPlayerCount}</strong>
                            <span>connected</span>
                        </span>
                        <span className="host-sidebar-stat">
                            <strong>{alivePlayerCount}</strong>
                            <span>alive</span>
                        </span>
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
