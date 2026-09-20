# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audiences are equal partners in the same product:

- **Shop staff / cashiers** at the till — complete sales quickly (custom perfume, ready-made, others), take payment, handle returns, look up customers.
- **Shop owners / managers** — inventory, procurement, suppliers, products/catalog, reports, settings, staff access, and business configuration.

Secondary: **platform admin** who manually provisions and suspends tenants. There is no public self-signup.

## Product Purpose

Scent Pro is a multi-tenant POS and operations web app for perfume retail shops. It makes it possible to sell customized perfume (oils, concentration, bottle, packaging) and ready-made products in one workflow, while keeping inventory, purchases, customers, suppliers, returns, and reporting consistent for the business.

Success means a shop can run daily till work and owner-level ops without losing stock truth, and without mixing one business’s data with another’s.

## Positioning

Full perfume retail operations — ready-made, oils, bottles/packaging, suppliers, and procurement — with **custom perfume mixing as a first-class sale type** (recipe, tier pricing, and inventory consumption), not a bolt-on SKU. Generic retail POS does not model perfume customization and component stock this way.

## Operating Context

- Used in Egyptian perfume shops and similar markets (EGP defaults, Arabic/English UI).
- Multi-outlet capable per tenant; staff work under a selected outlet.
- Typical workflows: POS sale → payment + sales channel (in shop / online, same stock) → inventory movements; purchases from suppliers; returns with disposition; owner reports and settings.
- Offline-capable till/auth where already supported; online sync when connected.
- Manual platform onboarding of each paying business (tenant).

## Capabilities and Constraints

**Capabilities (confirmed):**

- POS: custom perfume builder, ready-made, others, discounts, payment methods, in-shop vs online sales channel
- Customers, inventory, procurement, suppliers, products/catalog, returns, reports, dashboard
- Owner vs Staff roles with staff page permissions
- Per-tenant theme selection
- Platform admin tenant provisioning
- Demo master template tenant for demos/cloning later

**Constraints (must preserve):**

- Bilingual EN/AR UI chrome with correct RTL when Arabic is selected
- Offline till/auth where already supported
- Multi-tenant isolation; no public signup
- Owner vs Staff permissions
- Per-tenant themes
- Logo and “Scent Pro” naming as binding product identity
- Catalog/master data language may be Arabic-only in DB today (no bilingual name columns); do not invent schema bilingualism without an explicit product decision

**Open / undecided:**

- Whether catalog entities should gain true bilingual fields later
- Platform Admin can create additional Demo accounts from `/platform` (same seeded template data, unique owner credentials)

## Brand Commitments

- Product name: **Scent Pro** (UI `appName`; also referenced as ScentPro in demo tenant naming)
- Logo asset: project logo files (e.g. `Logo.png` / web public logo) are binding; do not replace without an explicit rebrand request
- Voice: professional retail/ops tool for perfume shops; bilingual EN/AR

## Evidence on Hand

- Runnable web app under `apps/web` (React + Vite + Tailwind) and API under `apps/api`
- Demo template tenant and seed data for a realistic Arabic catalog and history
- Do **not** fabricate customer testimonials, press, or third-party case studies

## Product Principles

1. **Till speed and stock truth** — POS must stay fast; every sale path must stay consistent with inventory.
2. **Perfume-native commerce** — customization, oils, bottles, and ready-made are core, not afterthoughts.
3. **One business, isolated** — tenant boundaries and roles are non-negotiable.
4. **Bilingual by default** — Arabic and English (with RTL) are first-class for UI chrome.
5. **Owner clarity, staff focus** — staff get the pages they need; owners get control and reports without cluttering the till.

## Accessibility & Inclusion

Support bilingual EN/AR including RTL layout when Arabic is selected. No additional formal accessibility standard was mandated beyond preserving usable contrast and operable controls already expected of the product UI.
