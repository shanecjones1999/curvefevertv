import styles from "../../PlayerController.module.css";

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
    const modeClassName =
        gameMode === "teams"
            ? styles.modeTeams
            : gameMode === "battle-royale"
              ? styles.modeBattleRoyale
              : styles.modeClassic;
    const stateLabel =
        roomState === "lobby"
            ? "Waiting in lobby"
            : roomState === "playing"
              ? "Live match"
              : "Round complete";
    const modeLabel =
        gameMode === "classic"
            ? "Classic"
            : gameMode === "teams"
              ? `Teams · ${teamCount}`
              : "Battle Royale";

    return (
        <div className={`${styles.controllerLive} ${modeClassName}`}>
            <section className={styles.sessionCard}>
                <div className={styles.sessionHeader}>
                    <div>
                        <p className={styles.sessionEyebrow}>Controller linked</p>
                        <h3 className={styles.sessionTitle}>{name}</h3>
                    </div>
                    <span className={styles.sessionState}>{stateLabel}</span>
                </div>
                <div className={styles.sessionMetaRow}>
                    <span className={styles.sessionMetaChip}>Room {roomCode}</span>
                    <span className={styles.sessionMetaChip}>{modeLabel}</span>
                    {gameMode === "teams" && currentTeamId && (
                        <span className={styles.sessionMetaChip}>
                            Team {currentTeamId}
                        </span>
                    )}
                </div>
            </section>
            {isLobby ? (
                <div className={styles.lobbyState}>
                    <div className={styles.stateCard}>
                        <p className={styles.stateTitle}>You&apos;re in.</p>
                        <p className={styles.lobbyMessage}>
                            The host is setting the stage. Stay ready and your
                            controls will light up when the round starts.
                        </p>
                    </div>
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
                                            <span className={styles.teamButtonLabel}>
                                                Team {teamId}
                                            </span>
                                            <span className={styles.teamButtonHint}>
                                                {currentTeamId === teamId
                                                    ? "Selected"
                                                    : "Tap to join"}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : roomState === "playing" ? (
                <>
                    <div className={styles.stateCard}>
                        <p className={styles.stateTitle}>Hold to steer</p>
                        <p className={styles.lobbyMessage}>
                            Press and hold either side to curve your line in real time.
                        </p>
                    </div>
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
                            <span className={styles.buttonDirection}>Left</span>
                            <span className={styles.buttonLabel}>Turn Left</span>
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
                            <span className={styles.buttonDirection}>Right</span>
                            <span className={styles.buttonLabel}>Turn Right</span>
                        </button>
                    </div>
                </>
            ) : (
                <div className={styles.stateCard}>
                    <p className={styles.stateTitle}>Round complete</p>
                    <p className={styles.lobbyMessage}>
                        Results are on the host screen. Stay connected for the next
                        launch.
                    </p>
                </div>
            )}
        </div>
    );
}
