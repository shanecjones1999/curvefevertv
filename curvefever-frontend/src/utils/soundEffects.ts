type SoundEffectKey =
    | "crash"
    | "lobbyJoin"
    | "lobbyReady"
    | "roundCountdown1"
    | "roundCountdown2"
    | "roundCountdown3"
    | "roundGo"
    | "teamWin";

type SoundEffectConfig = {
    url: string;
    volume: number;
    poolSize: number;
};

const SOUND_EFFECTS_MUTED_STORAGE_KEY = "curvefever:sound-effects-muted";

const SOUND_EFFECTS: Record<SoundEffectKey, SoundEffectConfig> = {
    crash: {
        url: "/audio/sfx/crash.wav",
        volume: 0.35,
        poolSize: 3,
    },
    lobbyJoin: {
        url: "/audio/sfx/lobby-join.wav",
        volume: 0.3,
        poolSize: 1,
    },
    lobbyReady: {
        url: "/audio/sfx/lobby-ready.wav",
        volume: 0.26,
        poolSize: 1,
    },
    roundCountdown1: {
        url: "/audio/sfx/round-countdown-1.wav",
        volume: 0.28,
        poolSize: 1,
    },
    roundCountdown2: {
        url: "/audio/sfx/round-countdown-2.wav",
        volume: 0.28,
        poolSize: 1,
    },
    roundCountdown3: {
        url: "/audio/sfx/round-countdown-3.wav",
        volume: 0.28,
        poolSize: 1,
    },
    roundGo: {
        url: "/audio/sfx/round-go.wav",
        volume: 0.32,
        poolSize: 1,
    },
    teamWin: {
        url: "/audio/sfx/team-win.wav",
        volume: 0.32,
        poolSize: 1,
    },
};

const soundEffectPools = new Map<SoundEffectKey, HTMLAudioElement[]>();
const warnedSoundEffects = new Set<SoundEffectKey>();
let soundEffectsMuted = false;
let hasHydratedMutedState = false;

function hydrateMutedState() {
    if (hasHydratedMutedState || typeof window === "undefined") {
        return;
    }

    soundEffectsMuted =
        localStorage.getItem(SOUND_EFFECTS_MUTED_STORAGE_KEY) === "true";
    hasHydratedMutedState = true;
}

function applyMutedState() {
    for (const pool of soundEffectPools.values()) {
        for (const audio of pool) {
            audio.muted = soundEffectsMuted;
        }
    }
}

function getSoundEffectPool(key: SoundEffectKey) {
    if (typeof window === "undefined") {
        return [];
    }

    hydrateMutedState();

    const existingPool = soundEffectPools.get(key);
    if (existingPool) {
        return existingPool;
    }

    const config = SOUND_EFFECTS[key];
    const pool = Array.from({ length: config.poolSize }, () => {
        const audio = new Audio(config.url);
        audio.preload = "auto";
        audio.volume = config.volume;
        audio.muted = soundEffectsMuted;
        audio.load();
        return audio;
    });

    soundEffectPools.set(key, pool);
    return pool;
}

export function preloadHostSoundEffects() {
    for (const key of Object.keys(SOUND_EFFECTS) as SoundEffectKey[]) {
        getSoundEffectPool(key);
    }
}

export function areSoundEffectsMuted() {
    hydrateMutedState();
    return soundEffectsMuted;
}

export function setSoundEffectsMuted(muted: boolean) {
    hydrateMutedState();
    soundEffectsMuted = muted;

    if (typeof window !== "undefined") {
        localStorage.setItem(SOUND_EFFECTS_MUTED_STORAGE_KEY, String(muted));
    }

    applyMutedState();
}

export function getRoundCountdownSoundEffect(
    countdown: number,
): SoundEffectKey | null {
    if (countdown === 3) return "roundCountdown3";
    if (countdown === 2) return "roundCountdown2";
    if (countdown === 1) return "roundCountdown1";
    return null;
}

export function playSoundEffect(key: SoundEffectKey) {
    hydrateMutedState();
    if (soundEffectsMuted) {
        return;
    }

    const pool = getSoundEffectPool(key);
    if (pool.length === 0) {
        return;
    }

    const audio = pool.find((candidate) => candidate.paused || candidate.ended);
    const target = audio ?? pool[0];

    target.currentTime = 0;
    void target.play().catch((error: unknown) => {
        if (warnedSoundEffects.has(key)) {
            return;
        }

        warnedSoundEffects.add(key);
        console.warn("Sound effect could not start.", error);
    });
}
