import React, { useState } from "react";
import { AuthContext, AuthStorageKey } from "../contexts/AuthContext";

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [token, setTokenState] = useState<string | null>(
        localStorage.getItem(AuthStorageKey) || null
    );

    const setToken = (newToken: string | null) => {
        if (newToken) {
            localStorage.setItem(AuthStorageKey, newToken);
        } else {
            localStorage.removeItem(AuthStorageKey);
        }
        setTokenState(newToken);
    };

    return (
        <AuthContext.Provider value={{ token, setToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
