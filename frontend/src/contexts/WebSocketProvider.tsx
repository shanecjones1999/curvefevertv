// src/contexts/WebSocketProvider.tsx
import React, { useRef, useState, useEffect } from "react";
import { WebSocketContext } from "./WebSocketContext";
import type { WebSocketMessage } from "../types/WebSocketMessage";
import { io, Socket } from "socket.io-client";

interface WebSocketProviderProps {
    url: string;
    jwt: string;
    children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
    url,
    jwt,
    children,
}) => {
    const socketRef = useRef<Socket | null>(null);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
        null
    );
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Create Socket.IO connection
        const socket = io(url, {
            auth: {
                token: jwt, // pass token on initial handshake
            },
            transports: ["websocket"], // force WebSocket transport
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
            console.log("Connected to Socket.IO server:", socket.id);
        });

        socket.on("disconnect", () => {
            setConnected(false);
            console.log("Disconnected from Socket.IO server");
        });

        socket.on("message", (msg: WebSocketMessage) => {
            setLastMessage(msg);
        });

        socket.on("connect_error", (err) => {
            console.error("Socket.IO connection error:", err);
        });

        return () => {
            socket.disconnect();
        };
    }, [url, jwt]);

    const send = (msg: WebSocketMessage) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit("message", msg);
        }
    };

    return (
        <WebSocketContext.Provider value={{ connected, lastMessage, send }}>
            {children}
        </WebSocketContext.Provider>
    );
};
