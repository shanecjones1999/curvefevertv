// src/contexts/AuthContext.ts
import { createContext } from "react";

export const AuthStorageKey = "game.authToken";

export type AuthContextType = {
    token: string | null;
    setToken: (token: string | null) => void;
};

export const AuthContext = createContext<AuthContextType>({
    token: null,
    setToken: () => {},
});
