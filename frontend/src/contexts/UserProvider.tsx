// src/components/UserProvider.tsx
import React, { useState } from "react";
import { UserContext } from "./UserContext";
import type { UserRole } from "./UserContext";

const UserStorageKey = "curvefever.user";

type UserState = {
    role: UserRole | null;
    userId: string | null;
    roomCode: string | null;
};

const loadInitialUser = (): UserState => {
    try {
        const raw = localStorage.getItem(UserStorageKey);
        return raw
            ? JSON.parse(raw)
            : { role: null, userId: null, roomCode: null };
    } catch {
        return { role: null, userId: null, roomCode: null };
    }
};

const UserProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [userState, setUserState] = useState<UserState>(loadInitialUser);

    const setUser = (user: UserState) => {
        setUserState(user);

        if (user.role || user.userId || user.roomCode) {
            localStorage.setItem(UserStorageKey, JSON.stringify(user));
        } else {
            localStorage.removeItem(UserStorageKey);
        }
    };

    return (
        <UserContext.Provider value={{ ...userState, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export default UserProvider;
