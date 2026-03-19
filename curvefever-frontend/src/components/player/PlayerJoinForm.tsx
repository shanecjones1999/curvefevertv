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
    return (
        <div className="form-grid">
            <div className="field-group">
                <label htmlFor="room-code">Room Code</label>
                <input
                    id="room-code"
                    className="ui-input"
                    value={roomCode}
                    onChange={(e) => onRoomCodeChange(e.target.value)}
                    maxLength={4}
                    placeholder="ABCD"
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
                <button className="ui-button" onClick={onJoin}>
                    Join Room
                </button>
            </div>
            {rejoinError && <div className="error-text">{rejoinError}</div>}
        </div>
    );
}
