# Rejoin Logic — Simplification Plan

## Current State: What's Wrong

The player rejoin flow is spread across **4 layers** with overlapping responsibilities, redundant fallback paths, and subtle race conditions. Here's a breakdown of the problems.

### 1. Two Server Endpoints That Do Nearly the Same Thing

| Endpoint | Purpose |
|---|---|
| `rejoinRoom` | Reconnect by `playerId` — rebinds socket to existing player |
| `joinRoom` | Join new **or** reclaim a disconnected player by `playerId` **or** by matching name |

`joinRoom` already has a full "reclaim disconnected player" code path (the `reclaimCandidate` block). This means the client has *two* ways to reconnect to the same player slot, creating ambiguity about which path ran and what the response means.

### 2. Triple-Fallback Cascade on the Client

`usePlayerRejoin.ts` (290 lines) implements a deeply nested retry cascade:

```
rejoinFromSession()
  → emit("rejoinRoom")
      ✓ success → finalizeRejoin()
      ✗ fail →
          tryJoinFallback()
            → tryJoin(playerId)           [calls joinRoom with playerId]
                ✓ success → finalizeRejoin()
                ✗ fail →
                    tryJoin(undefined)     [calls joinRoom without playerId — retry]
                        ✓ success → finalizeRejoin()
                        ✗ fail → failRejoin()
```

That's **three** server round-trips before giving up, with `rejoinResolved` / `reconnectAttemptInFlight` flags threaded through closures to prevent double-resolution. This is fragile — any missed guard causes ghost state.

### 3. Duplicated Session Read Logic

The session is read from `localStorage` in multiple places with subtly different logic:

- `PlayerController.tsx` — `useMemo(() => getStoredPlayerSession(), [])`
- `usePlayerRejoin.ts` — `getStoredPlayerSession() ?? storedSession` (re-reads inside the effect, defeating the memo)
- `PlayerController.handleJoin()` — reads `getStoredPlayerSession()` again to extract `candidatePlayerId`

Each reader constructs a "candidate player ID" differently (`playerIdRef.current ?? activeSession?.playerId ?? null` vs `playerIdRef.current ?? activeSession?.playerId`), making it hard to reason about which identity is used.

### 4. Session Registry Is a Parallel Source of Truth

The backend `sessionRegistry.ts` maintains two `Map`s (`socketToRoomCode`, `socketToPlayerId`) that shadow the canonical state already on the `Room.players` map. They can drift if any code path forgets to call `bindSocket*` / `unbindSocket*`, and `getPlayerBySocket` must cross-check both sources to avoid returning stale data.

### 5. Race Conditions

- **connect + rejoin race**: `usePlayerRejoin` listens for both `"connect"` and calls `rejoinFromSession` directly if already connected. If the socket disconnects and reconnects quickly, the `"connect"` listener fires a second attempt while the first is still in-flight. The `reconnectAttemptInFlight` flag tries to prevent this but doesn't cancel the first request.
- **Stale closure over `storedSession`**: The effect captures `storedSession` from the first render, but inside the effect it also re-reads `getStoredPlayerSession()`. If localStorage was cleared between renders (e.g., by another tab), the two values disagree.
- **Timeout overlap**: `armConnectWaitTimeout` clears and restarts a 20-second timer on each disconnect, but `rejoinRoom` has its own 7-second ack timeout. If the connect timeout fires while an ack is pending, both paths run `failRejoin`.

---

## Simplified Design

### Guiding Principles

1. **One server endpoint for player reconnection** — merge `rejoinRoom` into `joinRoom`.
2. **One attempt, one response** — no client-side retry cascade.
3. **Single source of truth** — remove the parallel session registry; look up the player from the `Room` directly.
4. **Thin reconnect hook** — the hook should do: read session → emit → handle response. Nothing more.

---

### Backend Changes

#### A. Remove `rejoinRoom` — Unify Into `joinRoom`

Merge the rejoin logic into `joinRoom`. The handler already accepts an optional `playerId`. Make the reclaim logic explicit and ordered:

```
joinRoom(roomCode, name, playerId?)
  1. Validate roomCode + name
  2. Find room
  3. If playerId provided → try room.players.get(playerId)
     - If found & disconnected (socketId === null) → reclaim it
     - If found & same socket → already connected, return ok (idempotent)
     - If found & different active socket → reject ("player already connected")
  4. Else → find by name match (disconnected only)
     - If found → reclaim it
  5. Else → create new player
  6. Bind socket, return { ok, player }
```

Delete the `rejoinRoom` event and its type definitions entirely.

#### B. Eliminate `sessionRegistry.ts`

The two maps (`socketToRoomCode`, `socketToPlayerId`) duplicate what's already on `Player.socketId` and room membership. Replace with two simple lookup helpers on the `rooms` module:

```ts
// rooms.ts
export function findPlayerBySocketId(socketId: string): { room: Room; player: Player } | null {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) return { room, player };
    }
  }
  return null;
}

export function findRoomBySocketId(socketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.hostSocketId === socketId) return room;
    for (const player of room.players.values()) {
      if (player.socketId === socketId) return room;
    }
  }
  return null;
}
```

This is O(rooms × players) but perfectly fine at this scale (party game, <20 players). It eliminates an entire class of desync bugs.

#### C. Simplify Disconnect Handler

```ts
socket.on("disconnect", () => {
  const result = findPlayerBySocketId(socket.id);
  if (result) {
    result.player.socketId = null;
    emitLobbyUpdate(io, result.room.code);
    return;
  }
  // Check if it was the host
  const room = findRoomBySocketId(socket.id);
  if (room) {
    // Host disconnect — no-op, they can reconnect
  }
});
```

No more manual unbinding.

---

### Frontend Changes

#### D. Replace `usePlayerRejoin` With a Minimal Hook

The new hook should be ~50 lines, not 290:

```ts
export function usePlayerRejoin({ storedSession, playerIdRef, setJoined, setIsRejoining, setRejoinError }: Params) {
  useEffect(() => {
    if (!storedSession) {
      setIsRejoining(false);
      return;
    }

    const attemptRejoin = () => {
      socket.timeout(ACK_TIMEOUT_MS).emit(
        "joinRoom",
        {
          roomCode: storedSession.roomCode,
          name: storedSession.name,
          playerId: storedSession.playerId,
        },
        (error, res) => {
          if (error || !res?.ok || !res.player?.id) {
            // Failed — clear session, show join form
            playerIdRef.current = null;
            localStorage.removeItem(PLAYER_SESSION_KEY);
            setIsRejoining(false);
            setRejoinError(res?.error ?? "Could not reconnect. Please rejoin.");
            return;
          }
          // Success
          playerIdRef.current = res.player.id;
          localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({
            roomCode: storedSession.roomCode,
            name: res.player.name ?? storedSession.name,
            playerId: res.player.id,
          }));
          setJoined(true);
          setIsRejoining(false);
          setRejoinError(null);
        }
      );
    };

    if (socket.connected) {
      attemptRejoin();
    } else {
      socket.once("connect", attemptRejoin);
      socket.connect();
    }

    return () => { socket.off("connect", attemptRejoin); };
  }, []); // stable — storedSession is from useMemo, refs are stable
}
```

Key differences:
- **No retry cascade** — one `joinRoom` call handles everything.
- **No `rejoinResolved` / `reconnectAttemptInFlight` flags** — single attempt, single callback.
- **No `armConnectWaitTimeout`** — Socket.IO already has `reconnection` and `timeout` options; rely on the built-in ack timeout.
- **No re-reading localStorage inside the effect** — trust the memoized `storedSession` passed in.

#### E. Remove `roomClosed` Handler From the Hook

Move the `roomClosed` listener into `PlayerController.tsx` as a standalone `useEffect`. It's unrelated to rejoin and doesn't belong in the same lifecycle.

#### F. Simplify `PlayerController.handleJoin`

Remove the `getStoredPlayerSession()` call inside `handleJoin` — after the simplification, the only relevant player ID is `playerIdRef.current`, which is `null` for a fresh join. The server's unified `joinRoom` handles the rest.

---

### Files Changed Summary

| File | Action |
|---|---|
| `backend/src/socket/lobbyHandlers.ts` | Remove `rejoinRoom` handler. Refine `joinRoom` reclaim logic. Simplify disconnect handler. Drop all `sessionRegistry` imports. |
| `backend/src/socket/sessionRegistry.ts` | **Delete entirely.** |
| `backend/src/socket/gameHandlers.ts` | Replace `getPlayerBySocket` with `findPlayerBySocketId` from `rooms.ts`. |
| `backend/src/socket/events.ts` | Remove `rejoinRoom` from `ClientToServerEvents`. |
| `backend/src/rooms.ts` | Add `findPlayerBySocketId()` and `findRoomBySocketId()` helpers. |
| `frontend/src/hooks/usePlayerRejoin.ts` | Rewrite to ~50 lines (single `joinRoom` call, no cascade). |
| `frontend/src/PlayerController.tsx` | Extract `roomClosed` listener to its own `useEffect`. Simplify `handleJoin`. |
| `frontend/src/events.ts` | No changes needed (rejoinRoom was never listed here). |

---

### Migration Steps (Suggested Order)

1. **Backend: Add lookup helpers to `rooms.ts`** — `findPlayerBySocketId`, `findRoomBySocketId`.
2. **Backend: Refactor `gameHandlers.ts`** — swap `getPlayerBySocket` → `findPlayerBySocketId`.
3. **Backend: Refactor `lobbyHandlers.ts`** — delete `rejoinRoom`, refine `joinRoom` reclaim logic, simplify disconnect handler, remove all `sessionRegistry` usage.
4. **Backend: Delete `sessionRegistry.ts`**.
5. **Backend: Clean up `events.ts`** — remove `rejoinRoom` type.
6. **Frontend: Rewrite `usePlayerRejoin.ts`** — single `joinRoom` call, no cascade.
7. **Frontend: Clean up `PlayerController.tsx`** — extract `roomClosed` listener, simplify `handleJoin`.
8. **Test**: fresh join, browser refresh mid-game, phone sleep/wake, host disconnect + reconnect, room deleted while player is disconnected.
