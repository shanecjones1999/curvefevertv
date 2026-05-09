import type { ReactNode } from "react";
import type { GameMode } from "../../types";
import styles from "../../ui.module.css";
import { cx } from "../../utils/cx";
import {
    DiagnosticsIcon,
    FullscreenIcon,
    LeaveGameIcon,
    SoundIcon,
} from "../ActionIcons";
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
    isSoundMuted: boolean;
    isLagDiagnosticsVisible: boolean;
    layout?: "lobby" | "sidebar";
    playersSlot?: ReactNode;
    onLeaveGame: () => void;
    onChangeMode: () => void;
    onCopyGameCode: () => void;
    onStartGame: () => void;
    onToggleSound: () => void;
    onToggleFullscreen: () => void;
    onToggleLagDiagnostics: () => void;
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
    isSoundMuted,
    isLagDiagnosticsVisible,
    layout = "sidebar",
    playersSlot = null,
    onLeaveGame,
    onChangeMode,
    onCopyGameCode,
    onStartGame,
    onToggleSound,
    onToggleFullscreen,
    onToggleLagDiagnostics,
}: Props) {
    const fullscreenLabel = isFullscreen
        ? "Exit fullscreen"
        : "Enter fullscreen";
    const soundLabel = isSoundMuted ? "Enable sound" : "Mute sound";
    const lagDiagnosticsLabel = isLagDiagnosticsVisible
        ? "Hide lag diagnostics"
        : "Show lag diagnostics";
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
                <div
                    className={cx(
                        styles["panel-header"],
                        styles["host-lobby-header"],
                    )}
                >
                    <div>
                        <p className={styles.eyebrow}>Host Console</p>
                    </div>
                    <div className={styles["panel-header-actions"]}>
                        <button
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-ghost"],
                                styles["ui-icon-button"],
                            )}
                            onClick={onToggleSound}
                            data-ui-sound="off"
                            aria-label={soundLabel}
                            title={soundLabel}
                        >
                            <SoundIcon
                                muted={isSoundMuted}
                                className={styles["ui-button-icon"]}
                            />
                        </button>
                        <button
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-ghost"],
                                styles["ui-icon-button"],
                            )}
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
                                className={styles["ui-button-icon"]}
                            />
                        </button>
                        <button
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-ghost"],
                                styles["ui-icon-button"],
                            )}
                            onClick={onToggleLagDiagnostics}
                            aria-label={lagDiagnosticsLabel}
                            title={lagDiagnosticsLabel}
                        >
                            <DiagnosticsIcon
                                active={isLagDiagnosticsVisible}
                                className={styles["ui-button-icon"]}
                            />
                        </button>
                        <button
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-ghost"],
                                styles["ui-icon-button"],
                            )}
                            onClick={onLeaveGame}
                            aria-label="Leave game"
                            title="Leave game"
                        >
                            <LeaveGameIcon className={styles["ui-button-icon"]} />
                        </button>
                    </div>
                </div>

                <div className={styles["host-lobby-share-row"]}>
                    <div className={styles["host-lobby-share-main"]}>
                        <button
                            type="button"
                            className={cx(
                                styles["status-pill"],
                                styles["room-code-pill"],
                                styles["room-code-button"],
                            )}
                            onClick={onCopyGameCode}
                            disabled={!roomCode}
                            title={
                                roomCode
                                    ? "Click to copy game code"
                                    : "No game code available"
                            }
                        >
                            <span className={styles["room-code-label"]}>
                                {copiedCode ? "Copied!" : "Game Code"}
                            </span>
                            <span className={styles["room-code-value"]}>
                                {roomCode ?? "------"}
                            </span>
                        </button>
                        <div
                            className={cx(
                                styles["status-pill"],
                                styles["target-score-pill"],
                                styles["host-lobby-score-pill"],
                            )}
                            role="status"
                        >
                            {scoreText}
                        </div>
                    </div>

                    <HostJoinQr joinUrl={qrJoinUrl} />
                </div>

                {playersSlot}

                <div className={styles["host-lobby-action-section"]}>
                    <div className={styles["host-lobby-action-row"]}>
                        <button
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-secondary"],
                                styles["host-lobby-change-mode-button"],
                            )}
                            onClick={onChangeMode}
                        >
                            <span className={styles["host-lobby-setup-button-label"]}>
                                Game Setup
                            </span>
                            <span className={styles["host-lobby-setup-button-value"]}>
                                {gameModeText}
                            </span>
                        </button>
                        {!playing && (
                            <button
                                className={cx(
                                    styles["ui-button"],
                                    styles["host-lobby-start-button"],
                                )}
                                onClick={onStartGame}
                                disabled={!canStart}
                            >
                                Start Game
                            </button>
                        )}
                    </div>
                    {startError && (
                        <div className={styles["error-text"]}>{startError}</div>
                    )}
                </div>
            </>
        );
    }

    return (
        <>
            <div className={styles["panel-header"]}>
                <div>
                    <p className={styles.eyebrow}>Host Console</p>
                </div>
                <div className={styles["panel-header-actions"]}>
                    <button
                        className={cx(
                            styles["ui-button"],
                            styles["ui-button-ghost"],
                            styles["ui-icon-button"],
                        )}
                        onClick={onToggleSound}
                        data-ui-sound="off"
                        aria-label={soundLabel}
                        title={soundLabel}
                    >
                        <SoundIcon
                            muted={isSoundMuted}
                            className={styles["ui-button-icon"]}
                        />
                    </button>
                    <button
                        className={cx(
                            styles["ui-button"],
                            styles["ui-button-ghost"],
                            styles["ui-icon-button"],
                        )}
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
                            className={styles["ui-button-icon"]}
                        />
                    </button>
                    <button
                        className={cx(
                            styles["ui-button"],
                            styles["ui-button-ghost"],
                            styles["ui-icon-button"],
                        )}
                        onClick={onToggleLagDiagnostics}
                        aria-label={lagDiagnosticsLabel}
                        title={lagDiagnosticsLabel}
                    >
                        <DiagnosticsIcon
                            active={isLagDiagnosticsVisible}
                            className={styles["ui-button-icon"]}
                        />
                    </button>
                    <button
                        className={cx(
                            styles["ui-button"],
                            styles["ui-button-ghost"],
                            styles["ui-icon-button"],
                        )}
                        onClick={onLeaveGame}
                        aria-label="Leave game"
                        title="Leave game"
                    >
                        <LeaveGameIcon className={styles["ui-button-icon"]} />
                    </button>
                </div>
            </div>

            <div className={styles["host-lobby-overview"]}>
                <div>
                    <div className={styles["panel-row"]}>
                        <button
                            type="button"
                            className={cx(
                                styles["status-pill"],
                                styles["room-code-pill"],
                                styles["room-code-button"],
                            )}
                            onClick={onCopyGameCode}
                            disabled={!roomCode}
                            title={
                                roomCode
                                    ? "Click to copy game code"
                                    : "No game code available"
                            }
                        >
                            <span className={styles["room-code-label"]}>
                                {copiedCode ? "Copied!" : "Game Code"}
                            </span>
                            <span className={styles["room-code-value"]}>
                                {roomCode ?? "------"}
                            </span>
                        </button>
                        <div
                            className={cx(
                                styles["status-pill"],
                                styles["target-score-pill"],
                            )}
                            role="status"
                        >
                            {scoreText}
                        </div>
                    </div>
                </div>

                <HostJoinQr joinUrl={qrJoinUrl} />
            </div>

            {(!playing || startError) && (
                <div className={cx(styles["panel-row"], styles["panel-row-bottom"])}>
                    {!playing && (
                        <button
                            className={styles["ui-button"]}
                            onClick={onStartGame}
                            disabled={!canStart}
                        >
                            Start Game
                        </button>
                    )}
                    {startError && (
                        <div className={styles["error-text"]}>{startError}</div>
                    )}
                </div>
            )}
        </>
    );
}
