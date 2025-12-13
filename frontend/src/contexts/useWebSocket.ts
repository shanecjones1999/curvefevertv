// src/contexts/useWebSocket.ts
import { useContext } from "react";
import { WebSocketContext } from "./WebSocketContext";
import type { WebSocketContextType } from "./WebSocketContext";

export const useWebSocket = (): WebSocketContextType => {
    const context = useContext(WebSocketContext);
    if (!context)
        throw new Error("useWebSocket must be used within a WebSocketProvider");
    return context;
};
