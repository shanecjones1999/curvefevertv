import { useEffect } from "react";
import socket from "../socket";
import { PLAYER_SESSION_KEY } from "../constants/storage";
import type { PlayerSession } from "../utils/playerSession";

const ACK_TIMEOUT_MS = 7000;
const REJOIN_GUARD_TIMEOUT_MS = 12000;

type JoinRoomResponse = {
    ok: boolean;
    player?: {
        id: string;
        name: string;
    };
    error?: string;
};

type UsePlayerRejoinParams = {
    storedSession: PlayerSession | null;
    playerIdRef: React.MutableRefObject<string | null>;
    setJoined: React.Dispatch<React.SetStateAction<boolean>>;
    setIsRejoining: React.Dispatch<React.SetStateAction<boolean>>;
    setRejoinError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function usePlayerRejoin({
    storedSession,
    playerIdRef,
    setJoined,
    setIsRejoining,
    setRejoinError,
}: UsePlayerRejoinParams) {
    useEffect(() => {
        if (!storedSession) {
            setIsRejoining(false);
            return;
        }

        let resolved = false;
        let attemptInFlight = false;

        const guardTimeoutId = window.setTimeout(() => {
            if (resolved) return;
            resolved = true;
            attemptInFlight = false;
            playerIdRef.current = null;
            localStorage.removeItem(PLAYER_SESSION_KEY);
            setIsRejoining(false);
            setRejoinError("Could not reconnect. Please rejoin.");
        }, REJOIN_GUARD_TIMEOUT_MS);

        const failRejoin = (message: string) => {
            if (resolved) return;
            resolved = true;
            attemptInFlight = false;
            window.clearTimeout(guardTimeoutId);
            playerIdRef.current = null;
            localStorage.removeItem(PLAYER_SESSION_KEY);
            setIsRejoining(false);
            setRejoinError(message);
        };

        const finalizeRejoin = (
            roomCode: string,
            fallbackName: string,
            playerId: string,
            playerName?: string,
        ) => {
            if (resolved) return;
            resolved = true;
            attemptInFlight = false;
            window.clearTimeout(guardTimeoutId);
            playerIdRef.current = playerId;
            localStorage.setItem(
                PLAYER_SESSION_KEY,
                JSON.stringify({
                    roomCode,
                    name: playerName ?? fallbackName,
                    playerId,
                }),
            );
            setJoined(true);
            setIsRejoining(false);
            setRejoinError(null);
        };

        const attemptRejoin = () => {
            if (resolved || attemptInFlight) return;
            if (!socket.connected) return;

            attemptInFlight = true;

            socket.timeout(ACK_TIMEOUT_MS).emit(
                "joinRoom",
                {
                    roomCode: storedSession.roomCode,
                    name: storedSession.name,
                    playerId: storedSession.playerId,
                },
                (error: Error | null, res?: JoinRoomResponse) => {
                    attemptInFlight = false;
                    if (resolved) return;

                    if (error || !res?.ok || !res.player?.id) {
                        failRejoin(
                            res?.error ?? "Could not reconnect. Please rejoin.",
                        );
                        return;
                    }

                    finalizeRejoin(
                        storedSession.roomCode,
                        storedSession.name,
                        res.player.id,
                        res.player.name,
                    );
                },
            );
        };

        const handleConnectError = () => {
            failRejoin("Could not reconnect. Please rejoin.");
        };

        socket.on("connect", attemptRejoin);
        socket.on("connect_error", handleConnectError);

        socket.connect();
        attemptRejoin();

        return () => {
            resolved = true;
            window.clearTimeout(guardTimeoutId);
            socket.off("connect", attemptRejoin);
            socket.off("connect_error", handleConnectError);
        };
    }, [storedSession, playerIdRef, setJoined, setIsRejoining, setRejoinError]);
}
