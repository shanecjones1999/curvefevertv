import { useEffect } from "react";
import socket from "../socket";
import { EVENTS } from "../events";
import { PLAYER_SESSION_KEY } from "../constants/storage";
import {
    getStoredPlayerSession,
    type PlayerSession,
} from "../utils/playerSession";

const REJOIN_TIMEOUT_MS = 7000;

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
    setPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
    stopSendingInput: () => void;
    onLeave: () => void;
    setJoined: React.Dispatch<React.SetStateAction<boolean>>;
    setIsRejoining: React.Dispatch<React.SetStateAction<boolean>>;
    setRejoinError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function usePlayerRejoin({
    storedSession,
    playerIdRef,
    setPlayerId,
    stopSendingInput,
    onLeave,
    setJoined,
    setIsRejoining,
    setRejoinError,
}: UsePlayerRejoinParams) {
    useEffect(() => {
        let rejoinTimeoutId: number | null = null;
        let rejoinResolved = false;

        const clearRejoinTimeout = () => {
            if (rejoinTimeoutId !== null) {
                window.clearTimeout(rejoinTimeoutId);
                rejoinTimeoutId = null;
            }
        };

        const failRejoin = (message: string) => {
            if (rejoinResolved) return;
            rejoinResolved = true;
            clearRejoinTimeout();
            playerIdRef.current = null;
            setPlayerId(null);
            setJoined(false);
            setIsRejoining(false);
            setRejoinError(message);
            localStorage.removeItem(PLAYER_SESSION_KEY);
        };

        const armRejoinTimeout = () => {
            clearRejoinTimeout();
            rejoinTimeoutId = window.setTimeout(() => {
                failRejoin("Could not reconnect. Please rejoin the room.");
            }, REJOIN_TIMEOUT_MS);
        };

        const rejoinFromSession = () => {
            const activeSession = storedSession ?? getStoredPlayerSession();
            const activePlayerId =
                playerIdRef.current ?? activeSession?.playerId ?? null;

            // Only attempt rejoin if we can resolve both room and player identity
            if (!activeSession || !activePlayerId) {
                setIsRejoining(false);
                return;
            }

            armRejoinTimeout();
            playerIdRef.current = activePlayerId;

            console.log(
                "[PlayerController] Attempting to rejoin room",
                activeSession.roomCode,
                "as player",
                activePlayerId,
            );

            socket.emit(
                "rejoinRoom",
                {
                    roomCode: activeSession.roomCode,
                    playerId: activePlayerId,
                    name: activeSession.name,
                },
                (res: JoinRoomResponse) => {
                    clearRejoinTimeout();
                    if (rejoinResolved) return;
                    console.log("[PlayerController] rejoinRoom response:", res);
                    if (res?.ok && res.player?.id) {
                        console.log(
                            "[PlayerController] Successfully rejoined room",
                        );
                        rejoinResolved = true;
                        playerIdRef.current = res.player.id;
                        setPlayerId(res.player.id);
                        setJoined(true);
                        setIsRejoining(false);
                        setRejoinError(null);
                        localStorage.setItem(
                            PLAYER_SESSION_KEY,
                            JSON.stringify({
                                roomCode: activeSession.roomCode,
                                name: res.player.name ?? activeSession.name,
                                playerId: res.player.id,
                            }),
                        );
                    } else {
                        console.log(
                            "[PlayerController] Rejoin failed:",
                            res?.error ?? "Unknown error",
                        );
                        failRejoin(
                            res?.error ??
                                "Could not reconnect. Please rejoin the room.",
                        );
                    }
                },
            );
        };

        // Set up listener for socket connection
        const handleDisconnect = () => {
            if (!rejoinResolved) {
                armRejoinTimeout();
            }
        };
        socket.on("connect", rejoinFromSession);
        socket.on("disconnect", handleDisconnect);

        // Try to rejoin immediately if socket is already connected
        if (socket.connected) {
            console.log(
                "[PlayerController] Socket already connected, attempting rejoin",
            );
            rejoinFromSession();
        } else {
            armRejoinTimeout();
            console.log(
                "[PlayerController] Socket not connected yet, waiting for connection event",
            );
        }

        // if the host deletes the room, the client should depart too
        const handleRoomClosed = () => {
            alert("Room has been closed by the host.");
            playerIdRef.current = null;
            setPlayerId(null);
            setJoined(false);
            setIsRejoining(false);
            localStorage.removeItem(PLAYER_SESSION_KEY);
            onLeave();
        };
        socket.on(EVENTS.ROOM_CLOSED, handleRoomClosed);

        return () => {
            clearRejoinTimeout();
            stopSendingInput();
            socket.off("connect", rejoinFromSession);
            socket.off("disconnect", handleDisconnect);
            socket.off(EVENTS.ROOM_CLOSED, handleRoomClosed);
        };
    }, [
        storedSession,
        playerIdRef,
        setPlayerId,
        stopSendingInput,
        onLeave,
        setJoined,
        setIsRejoining,
        setRejoinError,
    ]);
}
