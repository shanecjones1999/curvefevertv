import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DISCONNECTED_DOT_COLOR } from "./constants/gameUi";
import HostGameSetup from "./components/host/HostGameSetup";
import HostControls from "./components/host/HostControls";
import HostPlayerList from "./components/host/HostPlayerList";
import PlayerJoinForm from "./components/player/PlayerJoinForm";
import PlayerLiveControls from "./components/player/PlayerLiveControls";
import PhaserGame from "./PhaserGame";
import type { Player } from "./types";
import styles from "./ui.module.css";
import { buildPlayerColorById } from "./utils/playerColor";
import { cx } from "./utils/cx";

type Props = {
    onBack: () => void;
    onStartHost: () => void;
    onStartPlayer: () => void;
};

type TutorialStep = {
    id: string;
    title: string;
    description: string;
    durationMs: number;
};

const DEMO_ROOM_CODE = "ABCD";
const DEMO_JOIN_URL = "https://curvefever.tv/?role=phone&room=ABCD";
const DEMO_GAME_WIDTH = 960;
const DEMO_GAME_HEIGHT = 720;
const DEMO_TRAIL_SAMPLES = 32;
const DEMO_TRAIL_STEP = 0.08;
const noop = () => undefined;

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: "roles",
        title: "Pick the big screen and the phones",
        description:
            "Start by choosing one device to host the match. Everyone else joins from their own phone and uses it as a controller.",
        durationMs: 4200,
    },
    {
        id: "setup",
        title: "Create the room on the host screen",
        description:
            "The host chooses a game mode first. This example uses Teams mode so players can immediately see how group play works.",
        durationMs: 4600,
    },
    {
        id: "join",
        title: "Share the room code or QR",
        description:
            "Once the room is open, players can scan the QR code or type the four-letter room code on their phone.",
        durationMs: 4600,
    },
    {
        id: "lobby",
        title: "Wait in the lobby until everyone arrives",
        description:
            "As players join, they appear on the host screen. In team mode, each phone can choose a team before the match starts.",
        durationMs: 4600,
    },
    {
        id: "controls",
        title: "When the round starts, steer from your phone",
        description:
            "The TV shows the arena and the phone switches to live controls. Hold left or right to steer your trail and avoid collisions.",
        durationMs: 4800,
    },
];

const DEMO_PLAYERS: Player[] = [
    {
        id: "maya",
        name: "Maya",
        score: 4,
        socketId: "socket-maya",
        color: "#ff6aa9",
        teamId: 1,
        alive: true,
        x: 0,
        y: 0,
        direction: 0,
    },
    {
        id: "leo",
        name: "Leo",
        score: 3,
        socketId: "socket-leo",
        color: "#5cf6ff",
        teamId: 2,
        alive: true,
        x: 0,
        y: 0,
        direction: 0,
    },
    {
        id: "ava",
        name: "Ava",
        score: 2,
        socketId: "socket-ava",
        color: "#ffd166",
        teamId: 1,
        alive: true,
        x: 0,
        y: 0,
        direction: 0,
    },
];

const DEMO_PLAYER_MOTION = [
    {
        player: DEMO_PLAYERS[0],
        centerX: 260,
        centerY: 250,
        orbitX: 150,
        orbitY: 112,
        speed: 0.92,
        phase: 0.1,
        wobbleX: 28,
        wobbleY: 16,
    },
    {
        player: DEMO_PLAYERS[1],
        centerX: 640,
        centerY: 290,
        orbitX: 165,
        orbitY: 124,
        speed: 0.78,
        phase: 2.1,
        wobbleX: 22,
        wobbleY: 24,
    },
    {
        player: DEMO_PLAYERS[2],
        centerX: 500,
        centerY: 500,
        orbitX: 138,
        orbitY: 92,
        speed: 1.06,
        phase: 4.2,
        wobbleX: 26,
        wobbleY: 20,
    },
];

function getDemoPoint(
    motion: (typeof DEMO_PLAYER_MOTION)[number],
    time: number,
) {
    const theta = time * motion.speed + motion.phase;

    return {
        x:
            motion.centerX +
            Math.cos(theta) * motion.orbitX +
            Math.sin(theta * 0.66 + motion.phase) * motion.wobbleX,
        y:
            motion.centerY +
            Math.sin(theta * 1.08 + motion.phase) * motion.orbitY +
            Math.cos(theta * 0.58 + motion.phase) * motion.wobbleY,
    };
}

function buildAnimatedDemoPlayers(time: number): Player[] {
    return DEMO_PLAYER_MOTION.map((motion) => {
        const points = Array.from({ length: DEMO_TRAIL_SAMPLES }, (_, index) => {
            const offset = (DEMO_TRAIL_SAMPLES - 1 - index) * DEMO_TRAIL_STEP;
            return getDemoPoint(motion, Math.max(0, time - offset));
        });
        const currentPoint = points[points.length - 1];
        const previousPoint = points[points.length - 2] ?? currentPoint;

        return {
            ...motion.player,
            alive: true,
            x: currentPoint.x,
            y: currentPoint.y,
            direction: Math.atan2(
                currentPoint.y - previousPoint.y,
                currentPoint.x - previousPoint.x,
            ),
            trail: [points],
        };
    });
}

function TutorialRolePreview({
    title,
    subtitle,
    actionLabel,
    highlighted,
}: {
    title: string;
    subtitle: string;
    actionLabel: string;
    highlighted: boolean;
}) {
    return (
        <section
            className={cx(
                styles.panel,
                styles["tutorial-role-preview"],
                highlighted && styles["tutorial-role-preview-active"],
            )}
        >
            <p className={styles.eyebrow}>Preview</p>
            <h3 className={styles["section-title"]}>{title}</h3>
            <p className={styles.subtitle}>{subtitle}</p>
            <button
                type="button"
                className={cx(
                    styles["ui-button"],
                    !highlighted && styles["ui-button-secondary"],
                )}
            >
                {actionLabel}
            </button>
        </section>
    );
}

function TutorialPlaceholderPanel({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <section className={cx(styles.panel, styles["tutorial-placeholder-panel"])}>
            <p className={styles.eyebrow}>Phone view</p>
            <h3 className={styles["section-title"]}>{title}</h3>
            <p className={styles.subtitle}>{description}</p>
        </section>
    );
}

function TutorialArenaPreview({ players }: { players: Player[] }) {
    return (
        <section className={cx(styles.panel, styles["tutorial-arena-panel"])}>
            <div className={styles["tutorial-arena-header"]}>
                <div>
                    <p className={styles.eyebrow}>Host screen</p>
                    <h3 className={styles["section-title"]}>Round in progress</h3>
                </div>
                <span
                    className={cx(
                        styles["status-pill"],
                        styles["tutorial-live-pill"],
                    )}
                >
                    Match live
                </span>
            </div>
            <div className={styles["tutorial-arena-stage"]}>
                <PhaserGame
                    players={players}
                    gameMode="classic"
                    width={DEMO_GAME_WIDTH}
                    height={DEMO_GAME_HEIGHT}
                    className={styles["tutorial-phaser-shell"]}
                />
            </div>
        </section>
    );
}

export default function HowToPlayScreen({
    onBack,
    onStartHost,
    onStartPlayer,
}: Props) {
    const [stepIndex, setStepIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [demoTick, setDemoTick] = useState(0);
    const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
        "forward",
    );
    const currentStep = TUTORIAL_STEPS[stepIndex];
    const currentStepLabel = `${stepIndex + 1} / ${TUTORIAL_STEPS.length}`;

    const playerColorById = useMemo(() => buildPlayerColorById(DEMO_PLAYERS), []);
    const animatedDemoPlayers = useMemo(
        () => buildAnimatedDemoPlayers(demoTick / 14),
        [demoTick],
    );

    const getPlayerRowClassName = (player: Player) =>
        cx(
            styles["player-row"],
            !player.socketId && styles["player-row-disconnected"],
            !player.alive && styles["player-row-eliminated"],
        );

    const getPlayerDotColor = (player: Player) => {
        if (!player.socketId) {
            return DISCONNECTED_DOT_COLOR;
        }

        return playerColorById.get(player.id) ?? DISCONNECTED_DOT_COLOR;
    };

    useEffect(() => {
        if (!isAutoPlaying) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setSlideDirection("forward");
            setStepIndex((currentIndex) => {
                return (currentIndex + 1) % TUTORIAL_STEPS.length;
            });
        }, currentStep.durationMs);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [currentStep.durationMs, isAutoPlaying]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setDemoTick((currentTick) => currentTick + 1);
        }, 60);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    function setActiveStep(
        nextIndex: number,
        direction: "forward" | "backward",
        stopAutoPlay = true,
    ) {
        if (nextIndex === stepIndex) {
            if (stopAutoPlay) {
                setIsAutoPlaying(false);
            }
            return;
        }

        setSlideDirection(direction);
        setStepIndex(nextIndex);

        if (stopAutoPlay) {
            setIsAutoPlaying(false);
        }
    }

    function handleSelectStep(nextIndex: number) {
        const direction = nextIndex >= stepIndex ? "forward" : "backward";
        setActiveStep(nextIndex, direction);
    }

    function handlePreviousStep() {
        setActiveStep(
            stepIndex === 0 ? TUTORIAL_STEPS.length - 1 : stepIndex - 1,
            "backward",
        );
    }

    function handleNextStep() {
        setActiveStep((stepIndex + 1) % TUTORIAL_STEPS.length, "forward");
    }

    let hostPreview: ReactNode;
    let phonePreview: ReactNode;

    switch (currentStep.id) {
        case "roles":
            hostPreview = (
                <TutorialRolePreview
                    title="Host on the TV or laptop"
                    subtitle="The host creates the room, shows the QR code, and starts each round."
                    actionLabel="Host Game"
                    highlighted
                />
            );
            phonePreview = (
                <TutorialRolePreview
                    title="Join from a phone"
                    subtitle="Each player opens the join screen on their own device and uses touch controls to steer."
                    actionLabel="Join as Player"
                    highlighted={false}
                />
            );
            break;
        case "setup":
            hostPreview = (
                <HostGameSetup
                    gameMode="teams"
                    teamCount={2}
                    submitting={false}
                    isEditing={false}
                    canSubmit
                    error={null}
                    onBack={noop}
                    onSubmit={noop}
                    onGameModeChange={noop}
                    onTeamCountChange={noop}
                />
            );
            phonePreview = (
                <TutorialPlaceholderPanel
                    title="Phones wait for the room"
                    description="Players do not need to do anything yet. They can join as soon as the host creates the room and shares the code."
                />
            );
            break;
        case "join":
            hostPreview = (
                <HostControls
                    copiedCode={false}
                    roomCode={DEMO_ROOM_CODE}
                    joinUrl={DEMO_JOIN_URL}
                    gameMode="teams"
                    teamCount={2}
                    effectiveTargetScore={12}
                    playing={false}
                    canStart={false}
                    startError={null}
                    isFullscreen={false}
                    isFullscreenSupported
                    layout="lobby"
                    playersSlot={
                        <HostPlayerList
                            className={styles["tutorial-host-player-panel"]}
                            players={[]}
                            gameMode="teams"
                            teamCount={2}
                            getPlayerRowClassName={getPlayerRowClassName}
                            getPlayerDotColor={getPlayerDotColor}
                        />
                    }
                    onLeaveGame={noop}
                    onChangeMode={noop}
                    onCopyGameCode={noop}
                    onStartGame={noop}
                    onToggleFullscreen={noop}
                />
            );
            phonePreview = (
                <section className={cx(styles.panel, styles["tutorial-phone-panel"])}>
                    <p className={styles.eyebrow}>Phone view</p>
                    <h3 className={styles["section-title"]}>Join the room</h3>
                    <PlayerJoinForm
                        roomCode={DEMO_ROOM_CODE}
                        name="Maya"
                        rejoinError={null}
                        onRoomCodeChange={noop}
                        onNameChange={noop}
                        onJoin={noop}
                    />
                </section>
            );
            break;
        case "lobby":
            hostPreview = (
                <HostControls
                    copiedCode={false}
                    roomCode={DEMO_ROOM_CODE}
                    joinUrl={DEMO_JOIN_URL}
                    gameMode="teams"
                    teamCount={2}
                    effectiveTargetScore={12}
                    playing={false}
                    canStart
                    startError={null}
                    isFullscreen={false}
                    isFullscreenSupported
                    layout="lobby"
                    playersSlot={
                        <HostPlayerList
                            className={styles["tutorial-host-player-panel"]}
                            players={DEMO_PLAYERS}
                            gameMode="teams"
                            teamCount={2}
                            getPlayerRowClassName={getPlayerRowClassName}
                            getPlayerDotColor={getPlayerDotColor}
                        />
                    }
                    onLeaveGame={noop}
                    onChangeMode={noop}
                    onCopyGameCode={noop}
                    onStartGame={noop}
                    onToggleFullscreen={noop}
                />
            );
            phonePreview = (
                <section className={cx(styles.panel, styles["tutorial-phone-panel"])}>
                    <p className={styles.eyebrow}>Phone view</p>
                    <h3 className={styles["section-title"]}>Ready in the lobby</h3>
                    <PlayerLiveControls
                        roomCode={DEMO_ROOM_CODE}
                        name="Maya"
                        playerColor={playerColorById.get("maya") ?? null}
                        isAlive
                        gameMode="teams"
                        roomState="lobby"
                        teamCount={2}
                        currentTeamId={1}
                        leftPressed={false}
                        rightPressed={false}
                        onLeftDown={noop}
                        onLeftUp={noop}
                        onRightDown={noop}
                        onRightUp={noop}
                        onTeamChange={noop}
                    />
                </section>
            );
            break;
        case "controls":
        default:
            hostPreview = <TutorialArenaPreview players={animatedDemoPlayers} />;
            phonePreview = (
                <section className={cx(styles.panel, styles["tutorial-phone-panel"])}>
                    <p className={styles.eyebrow}>Phone view</p>
                    <h3 className={styles["section-title"]}>Steer to survive</h3>
                    <PlayerLiveControls
                        roomCode={DEMO_ROOM_CODE}
                        name="Maya"
                        playerColor={playerColorById.get("maya") ?? null}
                        isAlive
                        gameMode="teams"
                        roomState="playing"
                        teamCount={2}
                        currentTeamId={1}
                        leftPressed
                        rightPressed={false}
                        onLeftDown={noop}
                        onLeftUp={noop}
                        onRightDown={noop}
                        onRightUp={noop}
                        onTeamChange={noop}
                    />
                </section>
            );
            break;
    }

    return (
        <main className={cx(styles["page-shell"], styles["page-shell-tutorial"])}>
            <section className={cx(styles.panel, styles["tutorial-shell"])}>
                <div className={styles["tutorial-header"]}>
                    <div className={styles["tutorial-header-copy"]}>
                        <p className={styles.eyebrow}>How to Play</p>
                        <h1 className={styles.title}>See the full setup flow</h1>
                        <p className={styles.subtitle}>
                            This walkthrough uses the real host and player UI with
                            example data, so everyone can copy what they see before
                            the game starts.
                        </p>
                    </div>
                    <div className={styles["tutorial-header-actions"]}>
                        <button
                            type="button"
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-secondary"],
                            )}
                            onClick={onBack}
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            className={cx(
                                styles["ui-button"],
                                styles["ui-button-ghost"],
                            )}
                            onClick={() => setIsAutoPlaying((current) => !current)}
                        >
                            {isAutoPlaying ? "Pause demo" : "Play demo"}
                        </button>
                    </div>
                </div>

                <section
                    className={styles["tutorial-carousel"]}
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="How to play walkthrough"
                >
                    <div className={styles["tutorial-carousel-frame"]}>
                        <div className={styles["tutorial-carousel-meta"]}>
                            <span
                                className={cx(
                                    styles["status-pill"],
                                    styles["tutorial-carousel-step-pill"],
                                )}
                            >
                                Step {currentStepLabel}
                            </span>
                            <span className={styles["tutorial-carousel-title-inline"]}>
                                {currentStep.title}
                            </span>
                        </div>

                        <div className={styles["tutorial-carousel-viewport"]}>
                            <article
                                key={currentStep.id}
                                className={cx(
                                    styles["tutorial-slide"],
                                    slideDirection === "forward"
                                        ? styles["tutorial-slide-forward"]
                                        : styles["tutorial-slide-backward"],
                                )}
                            >
                            <div className={styles["tutorial-slide-copy"]}>
                                <p className={styles.eyebrow}>Current step</p>
                                <h2
                                    className={cx(
                                        styles["section-title"],
                                        styles["tutorial-step-title"],
                                    )}
                                >
                                    {currentStep.title}
                                </h2>
                                <p className={styles.subtitle}>
                                    {currentStep.description}
                                </p>
                            </div>

                            <div className={styles["tutorial-slide-previews"]}>
                                <section className={styles["tutorial-preview-panel"]}>
                                    <div
                                        className={styles["tutorial-preview-header"]}
                                    >
                                        <p className={styles.eyebrow}>Host screen</p>
                                        <span
                                            className={
                                                styles["tutorial-preview-tag"]
                                            }
                                        >
                                            TV or laptop
                                        </span>
                                    </div>
                                    <div
                                        className={styles["tutorial-preview-surface"]}
                                    >
                                        {hostPreview}
                                    </div>
                                </section>

                                <section className={styles["tutorial-preview-panel"]}>
                                    <div
                                        className={styles["tutorial-preview-header"]}
                                    >
                                        <p className={styles.eyebrow}>Player phone</p>
                                        <span
                                            className={
                                                styles["tutorial-preview-tag"]
                                            }
                                        >
                                            Controller
                                        </span>
                                    </div>
                                    <div
                                        className={styles["tutorial-preview-surface"]}
                                    >
                                        {phonePreview}
                                    </div>
                                </section>
                            </div>
                            </article>
                        </div>

                        <div className={styles["tutorial-carousel-footer"]}>
                            <button
                                type="button"
                                className={cx(
                                    styles["ui-button"],
                                    styles["ui-button-secondary"],
                                )}
                                onClick={handlePreviousStep}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className={styles["ui-button"]}
                                onClick={handleNextStep}
                            >
                                Next
                            </button>
                        </div>

                        <div
                            className={styles["tutorial-carousel-dots"]}
                            role="tablist"
                            aria-label="How to play steps"
                        >
                            {TUTORIAL_STEPS.map((step, index) => {
                                const isActive = index === stepIndex;

                                return (
                                    <button
                                        key={step.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        aria-label={`Go to step ${index + 1}: ${step.title}`}
                                        className={cx(
                                            styles["tutorial-carousel-dot"],
                                            isActive &&
                                                styles["tutorial-carousel-dot-active"],
                                        )}
                                        onClick={() => handleSelectStep(index)}
                                    />
                                );
                            })}
                        </div>

                        <div className={styles["tutorial-cta-row"]}>
                            <button
                                type="button"
                                className={styles["ui-button"]}
                                onClick={onStartHost}
                            >
                                Host a game
                            </button>
                            <button
                                type="button"
                                className={cx(
                                    styles["ui-button"],
                                    styles["ui-button-secondary"],
                                )}
                                onClick={onStartPlayer}
                            >
                                Join as player
                            </button>
                        </div>
                    </div>
                </section>
            </section>
        </main>
    );
}
