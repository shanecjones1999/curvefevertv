type Props = {
    roomCode: string;
    name: string;
    rejoinError: string | null;
    onRoomCodeChange: (value: string) => void;
    onNameChange: (value: string) => void;
    onJoin: () => void;
};

export default function PlayerJoinForm({
    roomCode,
    name,
    rejoinError,
    onRoomCodeChange,
    onNameChange,
    onJoin,
}: Props) {
    const codePreview = roomCode.padEnd(4, " ").slice(0, 4).split("");

    return (
        <form
            className="form-grid player-join-form"
            onSubmit={(event) => {
                event.preventDefault();
                onJoin();
            }}
        >
            <div className="player-join-hero">
                <div className="player-room-code-preview" aria-hidden="true">
                    {codePreview.map((character, index) => (
                        <span key={`${character}-${index}`} className="player-room-code-slot">
                            {character.trim() ? character : "•"}
                        </span>
                    ))}
                </div>
                <p className="player-join-helper">
                    Use the code on the host screen. If you scanned the QR code, it
                    should already be filled in.
                </p>
            </div>
            <div className="field-group">
                <label htmlFor="room-code">Room Code</label>
                <input
                    id="room-code"
                    className="ui-input"
                    value={roomCode}
                    onChange={(e) => onRoomCodeChange(e.target.value)}
                    maxLength={4}
                    placeholder="ABCD"
                    autoCapitalize="characters"
                    autoCorrect="off"
                />
            </div>
            <div className="field-group">
                <label htmlFor="player-name">Name</label>
                <input
                    id="player-name"
                    className="ui-input"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    maxLength={16}
                    placeholder="Player"
                />
            </div>

            <div className="panel-row">
                <button type="submit" className="ui-button player-join-submit">
                    Join Room
                </button>
            </div>
            {rejoinError && <div className="error-text">{rejoinError}</div>}
        </form>
    );
}
