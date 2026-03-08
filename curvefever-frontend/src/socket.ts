import { io, Socket } from "socket.io-client";

const BACKEND_URL = "http://localhost:3001";
console.log("Connecting to backend at", BACKEND_URL);
export const socket: Socket = io(BACKEND_URL, {
    autoConnect: true,
});

export default socket;
