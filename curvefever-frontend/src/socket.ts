import { io, Socket } from "socket.io-client";

const explicitBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();
const pageIsHttps = window.location.protocol === "https:";
const explicitUrlIsInsecure =
    !!explicitBackendUrl && /^(http|ws):\/\//i.test(explicitBackendUrl);
const shouldUseSameOriginProxy = pageIsHttps && explicitUrlIsInsecure;
const socketTarget = shouldUseSameOriginProxy
    ? undefined
    : explicitBackendUrl || undefined;

if (shouldUseSameOriginProxy) {
    console.warn(
        "VITE_BACKEND_URL is insecure for an HTTPS page; using same-origin /socket.io instead.",
        explicitBackendUrl,
    );
} else if (socketTarget) {
    console.log("Connecting to backend at", socketTarget);
} else {
    console.log("Connecting to backend via same-origin /socket.io");
}

export const socket: Socket = io(socketTarget, {
    autoConnect: true,
    path: "/socket.io",
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
});

export default socket;
