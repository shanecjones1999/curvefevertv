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
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            ws.send(JSON.stringify({ type: "auth", token: jwt }));
        };
        ws.onmessage = (e) => setLastMessage(JSON.parse(e.data));
        ws.onclose = () => setConnected(false);
        ws.onerror = (err) => console.error(err);

        return () => ws.close();
    }, [url, jwt]);

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
