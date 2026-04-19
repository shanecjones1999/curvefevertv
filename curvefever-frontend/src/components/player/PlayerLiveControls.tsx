import styles from "../../PlayerController.module.css";
import uiStyles from "../../ui.module.css";
import { cx } from "../../utils/cx";

function getContrastTextColor(color: string) {
    const normalizedColor = color.replace("#", "");
    const expandedColor =
        normalizedColor.length === 3
            ? normalizedColor
                  .split("")
                  .map((channel) => channel + channel)
                  .join("")
            : normalizedColor;

    const red = Number.parseInt(expandedColor.slice(0, 2), 16);
    const green = Number.parseInt(expandedColor.slice(2, 4), 16);
    const blue = Number.parseInt(expandedColor.slice(4, 6), 16);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

    return luminance >= 160 ? "#091224" : "#f5f9ff";
}

type Props = {
    roomCode: string;
    name: string;
    playerColor: string | null;
    isAlive: boolean;
    gameMode: "classic" | "battle-royale" | "teams";
    roomState: "lobby" | "playing" | "finished";
    teamCount: number;
    currentTeamId: number | null;
    leftPressed: boolean;
    rightPressed: boolean;
    onLeftDown: () => void;
    onLeftUp: () => void;
    onRightDown: () => void;
    onRightUp: () => void;
    onTeamChange: (teamId: number) => void;
};

export default function PlayerLiveControls({
    roomCode,
    name,
    playerColor,
    isAlive,
    gameMode,
    roomState,
    teamCount,
    currentTeamId,
    leftPressed,
    rightPressed,
    onLeftDown,
    onLeftUp,
    onRightDown,
    onRightUp,
    onTeamChange,
}: Props) {
    const isLobby = roomState === "lobby";
    const controlsDisabled = roomState !== "playing" || !isAlive;
    const nameBadgeStyle = playerColor
        ? {
              backgroundColor: playerColor,
              color: getContrastTextColor(playerColor),
          }
        : undefined;

    return (
        <div className={styles.controllerLive}>
            <p
                className={cx(
                    uiStyles["status-pill"],
                    uiStyles["controller-status-pill"],
                )}
            >
                Joined room <span className={styles.joinedRoomCode}>{roomCode}</span> as{" "}
                {playerColor ? (
                    <span
                        className={cx(
                            styles.joinedPlayerName,
                            !isAlive && styles.joinedPlayerNameEliminated,
                        )}
                        style={nameBadgeStyle}
                    >
                        {name}
                    </span>
                ) : (
                    <span
                        className={cx(
                            styles.joinedPlayerNameFallback,
                            !isAlive && styles.joinedPlayerNameEliminated,
                        )}
                    >
                        {name}
                    </span>
                )}
            </p>
            {isLobby ? (
                <div className={styles.lobbyState}>
                    <p className={styles.lobbyMessage}>Waiting for the host to start.</p>
                    {gameMode === "teams" && (
                        <div className={styles.teamSelector}>
                            <p className={styles.teamSelectorLabel}>Choose your team</p>
                            <div className={styles.teamSelectorGrid}>
                                {Array.from({ length: teamCount }, (_, index) => {
                                    const teamId = index + 1;
                                    return (
                                        <button
                                            key={teamId}
                                            type="button"
                                            className={`${styles.teamButton} ${
                                                currentTeamId === teamId
                                                    ? styles.teamButtonActive
                                                    : ""
                                            }`}
                                            onClick={() => onTeamChange(teamId)}
                                        >
                                            Team {teamId}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : roomState === "playing" ? (
                <div className={styles["button-row"]}>
                    <button
                        className={`${styles.button} ${leftPressed ? styles.buttonPressed : ""}`}
                        disabled={controlsDisabled}
                        onMouseDown={onLeftDown}
                        onMouseUp={onLeftUp}
                        onMouseLeave={onLeftUp}
                        onTouchStart={onLeftDown}
                        onTouchEnd={onLeftUp}
                        onTouchCancel={onLeftUp}
                    >
                        Turn Left
                    </button>
                    <button
                        className={`${styles.button} ${rightPressed ? styles.buttonPressed : ""}`}
                        disabled={controlsDisabled}
                        onMouseDown={onRightDown}
                        onMouseUp={onRightUp}
                        onMouseLeave={onRightUp}
                        onTouchStart={onRightDown}
                        onTouchEnd={onRightUp}
                        onTouchCancel={onRightUp}
                    >
                        Turn Right
                    </button>
                </div>
            ) : (
                <p className={styles.lobbyMessage}>Game finished. Waiting for the host.</p>
            )}
        </div>
    );
}
