import { io, Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
console.log("Connecting to backend at", BACKEND_URL);
export const socket: Socket = io(BACKEND_URL, {
    autoConnect: true,
    transports: ["websocket"],
});

export default socket;
