import type { GameMode } from "../../types";
import { MAX_TEAMS, MIN_TEAMS } from "../../utils/teamMode";

type Props = {
    gameMode: GameMode;
    teamCount: number;
    disabled?: boolean;
    onGameModeChange: (gameMode: GameMode) => void;
    onTeamCountChange: (teamCount: number) => void;
};

const MODE_OPTIONS: Array<{
    value: GameMode;
    title: string;
    description: string;
}> = [
    {
        value: "classic",
        title: "Classic",
        description: "Points across rounds",
    },
    {
        value: "teams",
        title: "Teams",
        description: "Balanced group play",
    },
    {
        value: "battle-royale",
        title: "Battle Royale",
        description: "Last player standing",
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
        <div className="host-mode-selection">
            <div
                className="host-mode-toggle"
                role="group"
                aria-label="Select game mode"
            >
                {MODE_OPTIONS.map((modeOption) => (
                    <button
                        key={modeOption.value}
                        type="button"
                        className={`host-mode-option ${
                            gameMode === modeOption.value ? "is-active" : ""
                        }`}
                        onClick={() => onGameModeChange(modeOption.value)}
                        disabled={disabled}
                    >
                        <span className="host-mode-option-title">
                            {modeOption.title}
                        </span>
                        <span className="host-mode-option-copy">
                            {modeOption.description}
                        </span>
                    </button>
                ))}
            </div>

            {gameMode === "teams" ? (
                <div className="host-team-count">
                    <span className="host-team-count-label">Teams</span>
                    <div className="host-team-count-options" role="group">
                        {Array.from(
                            { length: MAX_TEAMS - MIN_TEAMS + 1 },
                            (_, index) => {
                                const value = MIN_TEAMS + index;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`host-team-count-option ${
                                            teamCount === value ? "is-active" : ""
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
