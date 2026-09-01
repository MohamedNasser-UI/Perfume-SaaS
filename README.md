# Perfume Outlet SaaS

Multi-tenant POS for perfume customization shops. One paying customer is a perfume business (tenant), architected for multiple outlets. You provision tenants manually — there is no public signup.

## Stack

- React + Vite + Tailwind (web POS / admin)
- NestJS + Prisma + PostgreSQL (API)
- Nest-owned JWT auth: short-lived access token + HttpOnly refresh cookie. Passwords are bcrypt hashes in PostgreSQL.

## Local setup

1. Copy env and start Postgres:

```bash
cp .env.example .env
docker compose up -d postgres
```

2. Install, migrate, seed:

```bash
npm install
npm run build -w packages/types -w packages/validation
cd apps/api && npx prisma generate && npx prisma db push && npm run prisma:seed && cd ../..
```

3. Run API + web:

```bash
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/v1

Keep `VITE_API_URL=/api/v1` (relative). The Vite dev server proxies `/api` to the API so the refresh cookie is first-party.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Platform admin | admin@perfume.saas | ChangeMe123! |
| Tenant owner | owner@noor.perfume | ChangeMe123! |
| Staff | staff@noor.perfume | ChangeMe123! |

### Forgot password

**Console (no inbox):** set `EMAIL_PROVIDER=console`, submit Forgot password, then copy the reset URL from the API log.

**Gmail SMTP:** set `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS` (Gmail App Password), and `EMAIL_FROM`. The reset mail goes to the **account** address — demo emails like `owner@noor.perfume` are not real inboxes.

**Resend:** `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_PUBLIC_URL` set to the public site origin.

Choose a new password (min 8 characters). Password changes and owner resets take effect on the server immediately. Tills that already stored an offline Argon2 verifier keep the **old** password until that person signs in online once.

## Auth endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/auth/login` | Email/password. Sets refresh cookie. Returns `{ token, expiresIn, user, tenant, outlets, license }`. |
| POST | `/api/v1/auth/refresh` | Cookie only. Rotates refresh token, returns new `token`. |
| POST | `/api/v1/auth/logout` | Revokes current session. Idempotent. |
| POST | `/api/v1/auth/logout-all` | Revokes every session for the user. |
| GET | `/api/v1/auth/me` | Current user, tenant, outlets. |
| GET | `/api/v1/auth/sessions` | Active sessions for the current user. |
| POST | `/api/v1/auth/sessions/:id/revoke` | Revoke one of your sessions. |
| POST | `/api/v1/auth/forgot-password` | Always a generic success message. |
| POST | `/api/v1/auth/reset-password` | `{ token, newPassword }`. |
| POST | `/api/v1/auth/change-password` | `{ currentPassword, newPassword }`. |
| POST | `/api/v1/users/:id/reset-password` | Owner sets a staff password. |

## Production

```bash
docker compose up --build
```

Nginx on port 80 proxies `/api/` to the API and everything else to the web app. Put TLS in front (or add certificates to the nginx service). Set a strong `JWT_SECRET` in `.env` (the API refuses the development default when `NODE_ENV=production`). Optional: `AUTH_COOKIE_SECURE=true` behind HTTPS.

## How onboarding works

1. Sign in as platform admin.
2. Create a tenant (business name, first outlet, owner email + password).
3. Send the owner their login. Their catalog, stock, customers, and sales are isolated by `tenant_id`.
4. Suspend the tenant if they stop paying.

A second location is another outlet on the same tenant — not a new product.
