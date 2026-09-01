# Offline security model

This app uses three layers:

1. **License (device + tenant)** — can this installation keep operating offline?
2. **Authentication (user)** — who is using it?
3. **Authorization (role snapshot)** — what can they do? STAFF stays STAFF offline.

A valid license alone does **not** let an unknown user in. Each person must log in online once on this device so an Argon2id verifier can be stored locally.

## Honest browser limitation

Client storage (IndexedDB, the PWA cache, and the clock) can be tampered with. The license is signed with a server-held ECDSA P-256 key so casual editing of the JSON blob fails verification. That blocks “lease forever” edits by a typical shop user. It is **not** unbeatable DRM.

- The signing **private key never ships to the browser**.
- Passwords are never stored in plaintext or as the server bcrypt hash. Only an Argon2id verifier with a per-user salt lives in IndexedDB.
- Logout clears the JWT and the active session only. Device ID, license, authorized users, snapshot, and outbox stay.

## Clock

The client stores `lastServerTime` (from the license `serverTime` / Date header) and `lastLocalNow`. If the local clock jumps backward, the lease is **not** extended. Expiry is evaluated against `max(now, lastLocalNow)` and `min(expiresAt, serverTime + duration)`.

## Revocation delay

Disabling a user or suspending a tenant takes effect on the next successful online contact (`GET /auth/me`, license renew, or `POST /sync/push`). While the device is fully offline we cannot claim instant remote disable. After reconnect, inactive users’ queued mutations are rejected.

A password change, forgot-password reset, or owner-set staff password takes effect on the server immediately and revokes refresh sessions. Tills that already stored an Argon2 verifier keep the **previous** password until that person signs in **online** once (which overwrites the local verifier).

## Platform admin

Platform admins are online-only and skip shop device licenses.
