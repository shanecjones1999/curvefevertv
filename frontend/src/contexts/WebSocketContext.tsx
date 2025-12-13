// src/contexts/WebSocketContext.ts
import { createContext } from "react";
import type { WebSocketMessage } from "../types/WebSocketMessage";

export interface WebSocketContextType {
    send: (data: WebSocketMessage) => void;
    lastMessage: WebSocketMessage | null;
    connected: boolean;
}

// Context only — no component
export const WebSocketContext = createContext<WebSocketContextType | undefined>(
    undefined
);
