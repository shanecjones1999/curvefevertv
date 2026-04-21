import { isValidRoomCode, sanitizeRoomCodeInput } from "./roomCode";

type AppRole = "host" | "phone";

const ROLE_QUERY_PARAM = "role";
const ROOM_QUERY_PARAM = "room";

function getCurrentUrl() {
    if (typeof window === "undefined") {
        return null;
    }

    return new URL(window.location.href);
}

export function getRequestedRoleFromUrl(): AppRole | null {
    const url = getCurrentUrl();
    const requestedRole = url?.searchParams.get(ROLE_QUERY_PARAM);

    if (requestedRole === "host" || requestedRole === "phone") {
        return requestedRole;
    }

    return null;
}

export function getRequestedRoomCodeFromUrl(): string | null {
    const url = getCurrentUrl();
    const requestedRoomCode = sanitizeRoomCodeInput(
        url?.searchParams.get(ROOM_QUERY_PARAM) ?? "",
    );

    if (!isValidRoomCode(requestedRoomCode)) {
        return null;
    }

    return requestedRoomCode;
}

export function buildPlayerJoinUrl(roomCode: string): string | null {
    const url = getCurrentUrl();
    const normalizedRoomCode = sanitizeRoomCodeInput(roomCode);

    if (!url || !isValidRoomCode(normalizedRoomCode)) {
        return null;
    }

    url.searchParams.set(ROLE_QUERY_PARAM, "phone");
    url.searchParams.set(ROOM_QUERY_PARAM, normalizedRoomCode);
    url.hash = "";

    return url.toString();
}

export function clearJoinUrlParams() {
    const url = getCurrentUrl();

    if (!url) {
        return;
    }

    url.search = "";
    window.history.replaceState({}, "", url);
}
