import { useCallback, useRef } from "react";
import { getSharedAudioContext } from "../utils/audioContext";

type ToneSpec = {
    offsetMs?: number;
    durationMs: number;
    frequency: number;
    endFrequency?: number;
    gain: number;
    type?: OscillatorType;
};

function playToneSequence(tones: ToneSpec[]) {
    const context = getSharedAudioContext();
    if (!context) {
        return;
    }

    const now = context.currentTime;

    for (const tone of tones) {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const startTime = now + (tone.offsetMs ?? 0) / 1000;
        const stopTime = startTime + tone.durationMs / 1000;
        const peakGain = tone.gain;

        oscillator.type = tone.type ?? "square";
        oscillator.frequency.setValueAtTime(tone.frequency, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(
            tone.endFrequency ?? tone.frequency,
            stopTime,
        );

        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(
            peakGain,
            startTime + Math.min(0.02, tone.durationMs / 4000),
        );
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(startTime);
        oscillator.stop(stopTime);
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }
}

function findEnabledButton(target: EventTarget | null) {
    if (!(target instanceof Element)) {
        return null;
    }

    const button = target.closest("button");
    if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return null;
    }

    return button;
}

export function useHostSoundboard() {
    const hoveredButtonRef = useRef<HTMLButtonElement | null>(null);

    const playUiHover = useCallback(() => {
        playToneSequence([
            {
                durationMs: 32,
                frequency: 900,
                endFrequency: 1040,
                gain: 0.014,
                type: "sine",
            },
        ]);
    }, []);

    const playUiClick = useCallback(() => {
        playToneSequence([
            {
                durationMs: 55,
                frequency: 420,
                endFrequency: 280,
                gain: 0.03,
                type: "triangle",
            },
        ]);
    }, []);

    const playUiSelect = useCallback(() => {
        playToneSequence([
            {
                durationMs: 42,
                frequency: 560,
                endFrequency: 640,
                gain: 0.022,
                type: "square",
            },
            {
                offsetMs: 48,
                durationMs: 46,
                frequency: 720,
                endFrequency: 860,
                gain: 0.018,
                type: "square",
            },
        ]);
    }, []);

    const playLobbyJoin = useCallback(() => {
        playToneSequence([
            {
                durationMs: 70,
                frequency: 380,
                endFrequency: 620,
                gain: 0.028,
                type: "triangle",
            },
        ]);
    }, []);

    const playLobbyReady = useCallback(() => {
        playToneSequence([
            {
                durationMs: 55,
                frequency: 520,
                endFrequency: 520,
                gain: 0.022,
                type: "square",
            },
            {
                offsetMs: 70,
                durationMs: 55,
                frequency: 680,
                endFrequency: 680,
                gain: 0.022,
                type: "square",
            },
            {
                offsetMs: 140,
                durationMs: 70,
                frequency: 920,
                endFrequency: 920,
                gain: 0.024,
                type: "square",
            },
        ]);
    }, []);

    const playRoundCountdown = useCallback((countdown: number) => {
        const frequencyByCount: Record<number, number> = {
            3: 520,
            2: 620,
            1: 740,
        };
        const frequency = frequencyByCount[countdown];
        if (!frequency) {
            return;
        }

        playToneSequence([
            {
                durationMs: 95,
                frequency,
                endFrequency: frequency * 0.98,
                gain: 0.026,
                type: "square",
            },
        ]);
    }, []);

    const playRoundGo = useCallback(() => {
        playToneSequence([
            {
                durationMs: 68,
                frequency: 880,
                endFrequency: 960,
                gain: 0.03,
                type: "square",
            },
            {
                offsetMs: 82,
                durationMs: 92,
                frequency: 1120,
                endFrequency: 1320,
                gain: 0.032,
                type: "square",
            },
        ]);
    }, []);

    const playTeamSwitch = useCallback(() => {
        playToneSequence([
            {
                durationMs: 48,
                frequency: 430,
                endFrequency: 360,
                gain: 0.02,
                type: "triangle",
            },
            {
                offsetMs: 52,
                durationMs: 62,
                frequency: 520,
                endFrequency: 660,
                gain: 0.022,
                type: "triangle",
            },
        ]);
    }, []);

    const playTeamWin = useCallback(() => {
        playToneSequence([
            {
                durationMs: 90,
                frequency: 660,
                endFrequency: 700,
                gain: 0.024,
                type: "square",
            },
            {
                offsetMs: 80,
                durationMs: 110,
                frequency: 880,
                endFrequency: 940,
                gain: 0.024,
                type: "square",
            },
            {
                offsetMs: 170,
                durationMs: 140,
                frequency: 1175,
                endFrequency: 1240,
                gain: 0.026,
                type: "square",
            },
        ]);
    }, []);

    const handleUiPointerOver = useCallback(
        (target: EventTarget | null) => {
            const button = findEnabledButton(target);
            if (!button) {
                hoveredButtonRef.current = null;
                return;
            }

            if (hoveredButtonRef.current === button) {
                return;
            }

            hoveredButtonRef.current = button;
            playUiHover();
        },
        [playUiHover],
    );

    const handleUiFocus = useCallback(
        (target: EventTarget | null) => {
            const button = findEnabledButton(target);
            if (!button) {
                return;
            }

            if (hoveredButtonRef.current === button) {
                return;
            }

            hoveredButtonRef.current = button;
            playUiHover();
        },
        [playUiHover],
    );

    const handleUiClick = useCallback(
        (target: EventTarget | null) => {
            if (!findEnabledButton(target)) {
                return;
            }

            playUiClick();
        },
        [playUiClick],
    );

    const resetHoveredButton = useCallback(() => {
        hoveredButtonRef.current = null;
    }, []);

    return {
        playLobbyJoin,
        playLobbyReady,
        playRoundCountdown,
        playRoundGo,
        playTeamSwitch,
        playTeamWin,
        playUiSelect,
        handleUiPointerOver,
        handleUiFocus,
        handleUiClick,
        resetHoveredButton,
    };
}
