# Security Specification — Чёрное озеро (Player Memory & Cloud Saves)

## 1. Data Invariants
1. Every document in `/players/{userId}` belongs strictly to the authenticated user whose `request.auth.uid == userId`.
2. `list` operations on `/players` are completely denied (`allow list: if false`) so players cannot enumerate or scrape other players' usernames or records.
3. Document IDs must satisfy `isValidId(userId)` (`^[a-zA-Z0-9_\-]+$`, length `<= 128`).
4. `uid` and `createdAt` are immutable after document creation (`incoming().uid == existing().uid`, `incoming().createdAt == existing().createdAt`).
5. `createdAt` (on create) and `updatedAt` (on create and update) MUST equal `request.time`.
6. Every incoming payload on `create` and `update` passes `isValidPlayerProfile(incoming())`, enforcing exact key allowlists (`hasAll` + `hasOnly`), bounded strings, bounded integers, bounded maps (`defeatedByKind` max 11 valid species keys, `unlocked` max 10 valid achievement keys), and validated `savedRun` structure when `hasSavedRun == true` (or `null` when `hasSavedRun == false`).
7. Updates use action-based `affectedKeys().hasOnly(...)` partitioning:
   - `sync_progress`: updates records/bestiary/achievements/savedRun/updatedAt (optionally `username`).
   - `clear_saved_run`: clears `hasSavedRun` to `false` and `savedRun` to `null` + `updatedAt`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. Unauthenticated read (`auth == null`) on `/players/userA` -> `PERMISSION_DENIED`.
2. Cross-user read (`auth.uid == 'userB'`) on `/players/userA` -> `PERMISSION_DENIED`.
3. Collection list scrape (`getDocs(collection(db, 'players'))`) by authenticated user -> `PERMISSION_DENIED`.
4. Identity spoofing on create (`docId == 'userA'`, `incoming.uid == 'userB'`, `auth.uid == 'userA'`) -> `PERMISSION_DENIED`.
5. Shadow/ghost field injection (`isAdmin: true` or `extraField: 1`) on create -> `PERMISSION_DENIED`.
6. Shadow/ghost field injection on update -> `PERMISSION_DENIED`.
7. Oversized `username` (200 chars, limit is `2..32`) -> `PERMISSION_DENIED`.
8. Invalid path ID (`userId == 'bad$id!...'`) -> `PERMISSION_DENIED`.
9. Spoofed timestamp (`createdAt` or `updatedAt` set to client `new Date()` instead of `serverTimestamp()`) -> `PERMISSION_DENIED`.
10. Immutable field mutation on update (`uid` or `createdAt` modified) -> `PERMISSION_DENIED`.
11. Value poisoning on `savedRun` (`wave: 999`, negative `coins`, or arbitrary ghost keys inside `savedRun`) -> `PERMISSION_DENIED`.
12. Map key poisoning on `defeatedByKind` (injecting unknown monster key `'hacker_fish': 999`) -> `PERMISSION_DENIED`.
