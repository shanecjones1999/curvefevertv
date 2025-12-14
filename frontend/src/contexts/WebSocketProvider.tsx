// src/contexts/WebSocketProvider.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { io, Socket } from "socket.io-client";

// Define all possible events and their payload types
interface WebSocketEvents {
    connect: undefined;
    disconnect: undefined;
    player_joined: { name: string };
    player_left: { name: string };
    start_game: undefined;
    // add other events as needed
}

type EventKey = keyof WebSocketEvents;
type Callback<T extends EventKey> = (data: WebSocketEvents[T]) => void;

interface WebSocketContextType {
    sendMessage: <T extends EventKey>(
        type: T,
        payload: WebSocketEvents[T]
    ) => void;
    subscribe: <T extends EventKey>(
        type: T,
        callback: Callback<T>
    ) => () => void; // returns unsubscribe
    connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
    undefined
);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const subscribersRef = useRef<Record<string, Set<Callback<any>>>>({});

    useEffect(() => {
        const socket = io("http://localhost:8000"); // Replace with your server URL
        socketRef.current = socket;

        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));

        // Handle all events and route to subscribers
        socket.onAny((event: string, data: any) => {
            subscribersRef.current[event]?.forEach((cb) => cb(data));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendMessage = <T extends EventKey>(
        type: T,
        payload: WebSocketEvents[T]
    ) => {
        socketRef.current?.emit(type, payload);
    };

    const subscribe = <T extends EventKey>(type: T, callback: Callback<T>) => {
        if (!subscribersRef.current[type]) {
            subscribersRef.current[type] = new Set();
        }
        subscribersRef.current[type].add(callback);
        return () => subscribersRef.current[type]?.delete(callback);
    };

    return (
        <WebSocketContext.Provider
            value={{ sendMessage, subscribe, connected }}
        >
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = (): WebSocketContextType => {
    const context = useContext(WebSocketContext);
    if (!context)
        throw new Error("useWebSocket must be used inside a WebSocketProvider");
    return context;
};

// // src/contexts/WebSocketProvider.tsx
// import React, { useRef, useState, useEffect } from "react";
// import { WebSocketContext } from "./WebSocketContext";
// import type { WebSocketMessage } from "../types/WebSocketMessage";
// import { io, Socket } from "socket.io-client";

// interface WebSocketProviderProps {
//     url: string;
//     jwt: string;
//     children: React.ReactNode;
// }

// export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
//     url,
//     jwt,
//     children,
// }) => {
//     const socketRef = useRef<Socket | null>(null);
//     const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(
//         null
//     );
//     const [connected, setConnected] = useState(false);

//     useEffect(() => {
//         // Create Socket.IO connection
//         const socket = io(url, {
//             auth: {
//                 token: jwt, // pass token on initial handshake
//             },
//             transports: ["websocket"], // force WebSocket transport
//         });

//         socketRef.current = socket;

//         socket.on("connect", () => {
//             setConnected(true);
//             console.log("Connected to Socket.IO server:", socket.id);
//         });

//         socket.on("disconnect", () => {
//             setConnected(false);
//             console.log("Disconnected from Socket.IO server");
//         });

//         socket.on("message", (msg: WebSocketMessage) => {
//             setLastMessage(msg);
//         });

//         socket.on("connect_error", (err) => {
//             console.error("Socket.IO connection error:", err);
//         });

//         return () => {
//             socket.disconnect();
//         };
//     }, [url, jwt]);

//     const send = (msg: WebSocketMessage) => {
//         if (socketRef.current?.connected) {
//             socketRef.current.emit("message", msg);
//         }
//     };

//     return (
//         <WebSocketContext.Provider value={{ connected, lastMessage, send }}>
//             {children}
//         </WebSocketContext.Provider>
//     );
// };
