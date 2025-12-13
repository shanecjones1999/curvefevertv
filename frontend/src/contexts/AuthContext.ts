// src/contexts/AuthContext.ts
import { createContext } from "react";

export const AuthStorageKey = "player.authToken";

export type AuthContextType = {
    token: string | null;
    setToken: (token: string | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
    token: null,
    setToken: () => {},
});
