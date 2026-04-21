type WindowWithWebkitAudio = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext() {
    if (typeof window === "undefined") {
        return null;
    }

    const audioContextConstructor =
        window.AudioContext ??
        (window as WindowWithWebkitAudio).webkitAudioContext;

    if (!audioContextConstructor) {
        return null;
    }

    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
        sharedAudioContext = new audioContextConstructor();
    }

    if (sharedAudioContext.state === "suspended") {
        void sharedAudioContext.resume();
    }

    return sharedAudioContext;
}
