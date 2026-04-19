import styles from "../../PlayerController.module.css";
import uiStyles from "../../ui.module.css";
import { cx } from "../../utils/cx";

type Props = {
    roomCode: string;
    name: string;
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

    return (
        <div className={styles.controllerLive}>
            <p
                className={cx(
                    uiStyles["status-pill"],
                    uiStyles["controller-status-pill"],
                )}
            >
                Joined room {roomCode} as {name}
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
