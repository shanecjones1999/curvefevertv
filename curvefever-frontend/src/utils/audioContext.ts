type WindowWithWebkitAudio = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

let sharedAudioContext: AudioContext | null = null;
let sharedAudioDestination: GainNode | null = null;
let sharedAudioMuted = false;
let hasHydratedMutedState = false;

const AUDIO_MUTED_STORAGE_KEY = "curvefever:audio-muted";

function hydrateMutedState() {
    if (hasHydratedMutedState || typeof window === "undefined") {
        return;
    }

    sharedAudioMuted = localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === "true";
    hasHydratedMutedState = true;
}

function applyMutedState() {
    if (!sharedAudioContext || !sharedAudioDestination) {
        return;
    }

    const now = sharedAudioContext.currentTime;
    sharedAudioDestination.gain.cancelScheduledValues(now);
    sharedAudioDestination.gain.setValueAtTime(sharedAudioDestination.gain.value, now);
    sharedAudioDestination.gain.linearRampToValueAtTime(
        sharedAudioMuted ? 0 : 1,
        now + 0.04,
    );
}

export function getSharedAudioContext() {
    if (typeof window === "undefined") {
        return null;
    }

    hydrateMutedState();

    const audioContextConstructor =
        window.AudioContext ??
        (window as WindowWithWebkitAudio).webkitAudioContext;

    if (!audioContextConstructor) {
        return null;
    }

    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
        sharedAudioContext = new audioContextConstructor();
        sharedAudioDestination = sharedAudioContext.createGain();
        sharedAudioDestination.connect(sharedAudioContext.destination);
        sharedAudioDestination.gain.setValueAtTime(sharedAudioMuted ? 0 : 1, 0);
    }

    if (sharedAudioContext.state === "suspended") {
        void sharedAudioContext.resume();
    }

    applyMutedState();

    return sharedAudioContext;
}

export function getSharedAudioDestination() {
    const context = getSharedAudioContext();
    if (!context || !sharedAudioDestination) {
        return null;
    }

    return sharedAudioDestination;
}

export function isSharedAudioMuted() {
    hydrateMutedState();
    return sharedAudioMuted;
}

export function setSharedAudioMuted(muted: boolean) {
    hydrateMutedState();
    sharedAudioMuted = muted;

    if (typeof window !== "undefined") {
        localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, String(muted));
    }

    applyMutedState();
}
