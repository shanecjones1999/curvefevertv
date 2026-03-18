import styles from "../../PlayerController.module.css";

type Props = {
    roomCode: string;
    name: string;
    leftPressed: boolean;
    rightPressed: boolean;
    onLeftDown: () => void;
    onLeftUp: () => void;
    onRightDown: () => void;
    onRightUp: () => void;
};

export default function PlayerLiveControls({
    roomCode,
    name,
    leftPressed,
    rightPressed,
    onLeftDown,
    onLeftUp,
    onRightDown,
    onRightUp,
}: Props) {
    return (
        <div className={styles.controllerLive}>
            <p className="status-pill controller-status-pill">
                Joined room {roomCode} as {name}
            </p>
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
        </div>
    );
}
