# Performance improvement opportunities

This list captures the main follow-up opportunities after the server-side trail collision spatial hashing work.

## 1. Reduce trail data sent over the network

- Stop sending the full trail history on every `gameState` update.
- Send only incremental trail updates, or periodically send snapshots plus deltas.
- Consider a compressed trail representation for older trail sections.

## 2. Avoid deep-cloning full trail state on the host

- `useHostRoomSync` currently clones every player trail on each update.
- If trail payloads stay large, this creates avoidable CPU and GC pressure in React.
- Prefer immutable server payloads, incremental updates, or cloning only changed players/segments.

## 3. Avoid redrawing every trail from scratch in Phaser

- `PhaserGame` currently clears and redraws every visible trail on each update.
- Keep persistent graphics for settled trail segments and only draw newly added segments.
- Separate static trail rendering from moving player head rendering.

## 4. Compress or simplify old trail geometry

- Merge nearly collinear trail points into longer segments.
- Reduce point density for older parts of trails where visual fidelity is less important.
- This helps collision cost, network payload size, clone cost, and render cost at the same time.

## 5. Make trail collision indexing incremental

- The current spatial hash is rebuilt each tick.
- A bigger optimization would be to insert only newly created trail edges and remove/reset them on round restart.
- This would reduce per-tick server work further, especially in long rounds.

## 6. Profile socket update frequency and payload size

- The game broadcasts state frequently, including trail data.
- Measure average payload size and message frequency during long rounds.
- If needed, lower broadcast frequency for host-only visual state or split critical vs non-critical updates.

## 7. Add lightweight runtime instrumentation

- Log or sample:
  - trail point count per room,
  - collision candidate counts,
  - serialized `gameState` payload size,
  - host render/update duration.
- This makes regressions much easier to spot.

## 8. Revisit background music delivery

- Background music is a fixed overhead, but still adds decode and playback cost.
- If needed, switch to a smaller/shorter asset, streamed playback, or make music opt-in.

## 9. Reduce frontend bundle size

- The frontend build currently emits a large main chunk.
- Code-splitting host-only and game-only paths could reduce startup cost and improve responsiveness on slower devices.

## Suggested order

1. Reduce trail data sent over the network.
2. Stop deep-cloning full trail state on each host update.
3. Make Phaser trail rendering incremental.
4. Make trail indexing incremental.
5. Add instrumentation so future regressions are obvious.
