export const HAPTIC_PATTERNS = {
    joinSuccess: 25,
    reconnectSuccess: [30, 40, 30],
    roundStart: [20, 30, 20],
    roundRestart: [15, 25, 15],
    eliminated: [80, 40, 120],
} as const;

export function triggerHapticFeedback(pattern: number | readonly number[]) {
    if (
        typeof navigator === "undefined" ||
        typeof navigator.vibrate !== "function"
    ) {
        return false;
    }

    return navigator.vibrate(
        typeof pattern === "number" ? pattern : [...pattern],
    );
}
