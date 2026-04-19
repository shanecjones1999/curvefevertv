import type { GameMode } from "../../types";
import styles from "../../ui.module.css";
import { cx } from "../../utils/cx";
import HostGameModeSelector from "./HostGameModeSelector";

type Props = {
    gameMode: GameMode;
    teamCount: number;
    submitting: boolean;
    isEditing: boolean;
    canSubmit: boolean;
    error: string | null;
    onBack: () => void;
    onSubmit: () => void;
    onGameModeChange: (gameMode: GameMode) => void;
    onTeamCountChange: (teamCount: number) => void;
};

const GAME_MODE_COPY: Record<
    GameMode,
    { title: string; description: string }
> = {
    classic: {
        title: "Classic",
        description: "Race for points across rounds. Best for the standard Curvefever setup.",
    },
    teams: {
        title: "Teams",
        description: "Split players into teams and score together. Great for bigger groups.",
    },
    "battle-royale": {
        title: "Battle Royale",
        description: "One round, one winner. Last player alive takes it all.",
    },
};

export default function HostGameSetup({
    gameMode,
    teamCount,
    submitting,
    isEditing,
    canSubmit,
    error,
    onBack,
    onSubmit,
    onGameModeChange,
    onTeamCountChange,
}: Props) {
    const selectedModeCopy = GAME_MODE_COPY[gameMode];
    const title = isEditing ? "Game Setup" : "Create Game";
    const subtitle = isEditing
        ? "Update the game mode for this room before starting the match."
        : "Choose the game mode before opening the room for players.";
    const backLabel = isEditing ? "Cancel" : "Back";
    const submitLabel = submitting
        ? isEditing
            ? "Saving..."
            : "Creating..."
        : isEditing
          ? "Save Changes"
          : "Create Game";

    return (
        <section
            className={cx(
                styles.panel,
                styles["host-panel"],
                styles["host-setup-panel"],
            )}
        >
            <div>
                <p className={styles.eyebrow}>Host Console</p>
                <h1 className={cx(styles.title, styles["title-small"])}>
                    {title}
                </h1>
            </div>

            <p className={styles.subtitle}>{subtitle}</p>

            <div className={cx(styles["inset-panel"], styles["host-setup-details"])}>
                <div className={styles["host-setup-copy"]}>
                    <p className={styles.eyebrow}>Selected mode</p>
                    <h2
                        className={cx(
                            styles["section-title"],
                            styles["host-setup-mode-title"],
                        )}
                    >
                        {selectedModeCopy.title}
                    </h2>
                    <p
                        className={cx(
                            styles.subtitle,
                            styles["host-setup-mode-description"],
                        )}
                    >
                        {selectedModeCopy.description}
                    </p>
                </div>

                <HostGameModeSelector
                    gameMode={gameMode}
                    teamCount={teamCount}
                    onGameModeChange={onGameModeChange}
                    onTeamCountChange={onTeamCountChange}
                />
            </div>

            <div className={styles["host-setup-actions"]}>
                <button
                    type="button"
                    className={cx(
                        styles["ui-button"],
                        styles["ui-button-secondary"],
                    )}
                    onClick={onBack}
                >
                    {backLabel}
                </button>
                <button
                    type="button"
                    className={styles["ui-button"]}
                    onClick={onSubmit}
                    disabled={submitting || !canSubmit}
                >
                    {submitLabel}
                </button>
            </div>

            {error ? <div className={styles["error-text"]}>{error}</div> : null}
        </section>
    );
}
