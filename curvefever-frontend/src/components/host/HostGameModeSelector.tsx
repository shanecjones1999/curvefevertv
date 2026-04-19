import type { GameMode } from "../../types";
import { MAX_TEAMS, MIN_TEAMS } from "../../utils/teamMode";
import styles from "./HostGameModeSelector.module.css";

type Props = {
    gameMode: GameMode;
    teamCount: number;
    disabled?: boolean;
    onGameModeChange: (gameMode: GameMode) => void;
    onTeamCountChange: (teamCount: number) => void;
};

const MODE_OPTIONS: Array<{
    value: GameMode;
    eyebrow: string;
    title: string;
    description: string;
    accent: string;
    highlights: string[];
}> = [
    {
        value: "classic",
        eyebrow: "Arcade standard",
        title: "Classic",
        description: "Points across rounds",
        accent: "Most flexible",
        highlights: ["Round-based", "Score race"],
    },
    {
        value: "teams",
        eyebrow: "Group play",
        title: "Teams",
        description: "Balanced group play",
        accent: "Best for bigger rooms",
        highlights: ["Shared score", "2-5 teams"],
    },
    {
        value: "battle-royale",
        eyebrow: "High tension",
        title: "Battle Royale",
        description: "Last player standing",
        accent: "Winner-takes-all",
        highlights: ["Single match", "Sudden death"],
    },
];

export default function HostGameModeSelector({
    gameMode,
    teamCount,
    disabled = false,
    onGameModeChange,
    onTeamCountChange,
}: Props) {
    return (
        <div className={styles.selection}>
            <div
                className={styles.toggle}
                role="group"
                aria-label="Select game mode"
            >
                {MODE_OPTIONS.map((modeOption) => (
                    <button
                        key={modeOption.value}
                        type="button"
                        className={`${styles.option} ${
                            gameMode === modeOption.value ? styles.optionActive : ""
                        }`}
                        onClick={() => onGameModeChange(modeOption.value)}
                        disabled={disabled}
                    >
                        <span className={styles.optionEyebrow}>
                            {modeOption.eyebrow}
                        </span>
                        <span className={styles.optionTitle}>
                            {modeOption.title}
                        </span>
                        <span className={styles.optionCopy}>
                            {modeOption.description}
                        </span>
                        <span className={styles.optionAccent}>
                            {modeOption.accent}
                        </span>
                        <span className={styles.tagRow}>
                            {modeOption.highlights.map((highlight) => (
                                <span
                                    key={highlight}
                                    className={styles.tag}
                                >
                                    {highlight}
                                </span>
                            ))}
                        </span>
                    </button>
                ))}
            </div>

            {gameMode === "teams" ? (
                <div className={styles.teamCount}>
                    <span className={styles.teamCountLabel}>Teams</span>
                    <div className={styles.teamCountOptions} role="group">
                        {Array.from(
                            { length: MAX_TEAMS - MIN_TEAMS + 1 },
                            (_, index) => {
                                const value = MIN_TEAMS + index;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`${styles.teamCountOption} ${
                                            teamCount === value
                                                ? styles.teamCountOptionActive
                                                : ""
                                        }`}
                                        onClick={() => onTeamCountChange(value)}
                                        disabled={disabled}
                                    >
                                        {value}
                                    </button>
                                );
                            },
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
