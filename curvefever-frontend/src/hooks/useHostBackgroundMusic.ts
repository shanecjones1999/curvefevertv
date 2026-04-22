import { useEffect, useRef } from "react";
import {
    getSharedAudioContext,
    getSharedAudioDestination,
} from "../utils/audioContext";

const BACKGROUND_MUSIC_URL = "/audio/Last%20Coil%20Chase%20-%20game%20mix.mp3";
const BACKGROUND_MUSIC_VOLUME = 0.152;

const decodedBackgroundMusicBuffers = new Map<string, AudioBuffer>();
const decodedBackgroundMusicPromises = new Map<string, Promise<AudioBuffer>>();

function loadBackgroundMusicBuffer(context: AudioContext) {
    const cachedBuffer = decodedBackgroundMusicBuffers.get(BACKGROUND_MUSIC_URL);
    if (cachedBuffer) {
        return Promise.resolve(cachedBuffer);
    }

    const inFlightPromise = decodedBackgroundMusicPromises.get(BACKGROUND_MUSIC_URL);
    if (inFlightPromise) {
        return inFlightPromise;
    }

    const nextPromise = fetch(BACKGROUND_MUSIC_URL)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        `Failed to load background music: ${response.status}`,
                    );
                }

                const audioData = await response.arrayBuffer();
                return await context.decodeAudioData(audioData);
            })
            .then((buffer) => {
                decodedBackgroundMusicBuffers.set(BACKGROUND_MUSIC_URL, buffer);
                return buffer;
            })
            .catch((error: unknown) => {
                decodedBackgroundMusicPromises.delete(BACKGROUND_MUSIC_URL);
                throw error;
            });

    decodedBackgroundMusicPromises.set(BACKGROUND_MUSIC_URL, nextPromise);
    return nextPromise;
}

function stopBackgroundMusicSource(source: AudioBufferSourceNode | null) {
    if (!source) {
        return;
    }

    source.onended = null;
    source.stop();
    source.disconnect();
}

export function useHostBackgroundMusic(active: boolean, isMuted: boolean) {
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const requestIdRef = useRef(0);
    const didWarnPlaybackRef = useRef(false);

    useEffect(() => {
        const context = getSharedAudioContext();
        const destination = getSharedAudioDestination();
        if (!context || !destination) {
            return;
        }

        const gainNode = context.createGain();
        gainNode.connect(destination);
        gainRef.current = gainNode;

        return () => {
            stopBackgroundMusicSource(sourceRef.current);
            sourceRef.current = null;
            gainNode.disconnect();
            gainRef.current = null;
        };
    }, []);

    useEffect(() => {
        const gainNode = gainRef.current;
        if (!gainNode) {
            return;
        }

        const context = getSharedAudioContext();
        if (!context) {
            return;
        }

        const now = context.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(
            isMuted ? 0 : BACKGROUND_MUSIC_VOLUME,
            now + 0.04,
        );
    }, [isMuted]);

    useEffect(() => {
        const context = getSharedAudioContext();
        const gainNode = gainRef.current;
        if (!context || !gainNode) {
            return;
        }

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        if (!active) {
            stopBackgroundMusicSource(sourceRef.current);
            sourceRef.current = null;
            return;
        }

        if (sourceRef.current) {
            return;
        }

        void loadBackgroundMusicBuffer(context)
            .then((buffer) => {
                if (requestId !== requestIdRef.current || sourceRef.current) {
                    return;
                }

                const source = context.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                source.connect(gainNode);
                source.onended = () => {
                    if (sourceRef.current === source) {
                        sourceRef.current = null;
                    }
                    source.disconnect();
                };
                source.start();
                sourceRef.current = source;
                didWarnPlaybackRef.current = false;
            })
            .catch((error: unknown) => {
                if (didWarnPlaybackRef.current) {
                    return;
                }

                didWarnPlaybackRef.current = true;
                console.warn("Background music could not start.", error);
            });

        return () => {
            if (requestId === requestIdRef.current && !active) {
                stopBackgroundMusicSource(sourceRef.current);
                sourceRef.current = null;
            }
        };
    }, [active]);
}
