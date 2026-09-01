# Offline auth / license / sync test matrix

Automated cases run with `npm run test -w apps/api` (signature, tamper, clock). The rest are exercised by the app flows below.

| # | Case | Expected | Coverage |
| --- | --- | --- | --- |
| 1 | Online login with password | JWT + license + local Argon2 verifier | App |
| 2 | Second user online login on same device | Registry has both users; same Device ID | App |
| 3 | Logout | JWT/session cleared; device, license, users kept | App |
| 4 | Offline login as previously authorized staff | Argon2 match + valid license → offline session | App |
| 5 | Offline login unknown user | Rejected; internet required | App |
| 6 | Offline wrong password | Rejected | App |
| 7 | STAFF role snapshot offline | STAFF cannot open owner-only nav | App |
| 8 | Platform admin | No shop license; online only | App |
| 9 | License expired | LICENSE_RENEWAL_REQUIRED; data not wiped | App + unit |
| 10 | Tampered license payload | Signature fails; treat as expired | Unit |
| 11 | Tampered signature | Verify fails | Unit |
| 12 | License for other deviceId | Rejected | App |
| 13 | License for other tenantId | Rejected | App |
| 14 | Suspended tenant cannot renew | 403; no new license | API |
| 15 | Clock rollback, lease remaining | No extra time; still valid | Unit |
| 16 | Clock rollback after duration | Expired | Unit |
| 17 | Tampered far-future expiresAt | Capped by serverTime + duration | Unit |
| 18 | First login on device while offline | Error: internet required | App |
| 19 | Invite user while offline | Toast; no API call | App |
| 20 | POS sale while offline | Outbox SALE + local snapshot | App |
| 21 | Offline customer create then sale | CUSTOMER then SALE on push | App |
| 22 | Push with insufficient stock | SALE rejected; no blind overwrite | API |
| 23 | Duplicate localId push | DUPLICATE, not double-applied | API |
| 24 | Catalog create with existing code | REJECTED conflict | API |
| 25 | Purchase while offline | Outbox PURCHASE; stock applied on push | App |
| 26 | Waste/adjustment offline | Outbox; server authz OWNER | App |
| 27 | STAFF queued purchase | Rejected on push (role) | API |
| 28 | Disabled user after reconnect | Mutations rejected | API |
| 29 | PWA loads login with no network | Shell cached; API not used as source of truth | App |
| 30 | Background license renew when online | New expiresAt stored | App |
| 31 | Device list (owner / platform) | Last seen, expiry, authorized users | App |
| 32 | Sync pull after push | Snapshot matches server | App |
