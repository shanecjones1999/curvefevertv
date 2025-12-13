// src/contexts/WebSocketProvider.tsx
import React, { useRef, useState, useEffect } from "react";
import { WebSocketContext } from "./WebSocketContext";
import type { WebSocketMessage } from "../types/WebSocketMessage";

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
    const wsRef = useRef<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
        null
    );
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Only attempt connection if we have a valid url and jwt
        if (!url || !jwt) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            ws.send(JSON.stringify({ type: "auth", token: jwt }));
        };

        ws.onmessage = (e) => {
            setLastMessage(JSON.parse(e.data));
            console.log("WebSocket message received:", e.data);
        };
        ws.onclose = () => setConnected(false);
        ws.onerror = (err) => console.error("WebSocket error:", err);

        return () => {
            // Close socket on unmount if it's still open or connecting
            if (
                ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING
            ) {
                ws.close();
            }
        };
    }, [url, jwt]); // Reconnect automatically if url or jwt changes

    const send = (data: WebSocketMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    };

    return (
        <WebSocketContext.Provider value={{ send, lastMessage, connected }}>
            {children}
        </WebSocketContext.Provider>
    );
};
