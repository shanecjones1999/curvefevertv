import type { GameMode } from "../../types";
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
        <section className="panel host-panel host-setup-panel">
            <div>
                <p className="eyebrow">Host Console</p>
                <h1 className="title title-small">{title}</h1>
            </div>

            <p className="subtitle">{subtitle}</p>

            <div className="inset-panel host-setup-details">
                <div className="host-setup-copy">
                    <p className="eyebrow">Selected mode</p>
                    <h2 className="section-title host-setup-mode-title">
                        {selectedModeCopy.title}
                    </h2>
                    <p className="subtitle host-setup-mode-description">
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

            <div className="host-setup-actions">
                <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={onBack}
                >
                    {backLabel}
                </button>
                <button
                    type="button"
                    className="ui-button"
                    onClick={onSubmit}
                    disabled={submitting || !canSubmit}
                >
                    {submitLabel}
                </button>
            </div>

            {error ? <div className="error-text">{error}</div> : null}
        </section>
    );
}
