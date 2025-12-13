// src/contexts/UserContext.ts
import { createContext } from "react";

export type UserRole = "host" | "player";

export type UserContextType = {
    role: UserRole | null;
    userId: string | null;
    roomCode: string | null;
    setUser: (user: {
        role: UserRole | null;
        userId: string | null;
        roomCode: string | null;
    }) => void;
};

export const UserContext = createContext<UserContextType>({
    role: null,
    userId: null,
    roomCode: null,
    setUser: () => {},
});
