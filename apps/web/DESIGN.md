---
name: Scent Pro
description: Boutique atelier counter — warm paper ops UI with ink authority and brass accent
colors:
  boutique-ink: "#1c1917"
  ink-hover: "#292524"
  atelier-brass: "#b0894a"
  champagne-highlight: "#d4b483"
  shop-paper: "#f7f3ee"
  stone-border: "#e7e5e4"
  stone-muted: "#78716c"
  white: "#ffffff"
  danger: "#b91c1c"
typography:
  display:
    fontFamily: "Fraunces, Cairo, ui-serif, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Fraunces, Cairo, ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "DM Sans, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.boutique-ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.white}"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.boutique-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.stone-muted}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "{colors.white}"
    textColor: "{colors.boutique-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.white}"
    textColor: "{colors.boutique-ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  nav-aside:
    backgroundColor: "{colors.boutique-ink}"
    textColor: "#e7e5e4"
    width: "256px"
---

# Design System: Scent Pro

## Overview

**Creative North Star: "Boutique Atelier Counter"**

Scent Pro’s interface should feel like a refined perfume boutique counter that also runs a serious retail operating system: warm shop paper, ink as authority, and brass reserved for brand and wayfinding. Density stays till-first — scanable tables, large POS taps, obvious primary actions — while serif display moments (page titles, totals, builder headers) carry restrained luxury without slowing the cashier.

The system is bilingual: English uses Fraunces + DM Sans; Arabic prefers Cairo while keeping the same hierarchy and roles. RTL is a first-class layout mode, not an afterthought. Per-tenant themes may recolor ink, brass, and paper; gold remains the canonical Scent Pro brand identity and the reference for documentation.

**Key Characteristics:**
- Warm paper canvas with ink primary actions and brass accents
- Serif for display/brand; sans for body/ops density
- Flat-by-default surfaces; soft card shadow only
- Till-first clarity: decisive selected states, large POS targets
- Theme-swappable tokens with stable semantic roles

## Colors

A warm neutral ops palette: dark ink for structure and CTAs, soft brass for brand, cream paper for the canvas. Stone borders and muted labels support density without competing with brass.

### Primary
- **Boutique Ink** (`#1c1917` / `--ink`): Sidebar, primary buttons, selected POS chips, high-authority text. The system’s “stamp.”
- **Ink Hover** (`#292524` / `--ink-hover`): Primary button hover only.

### Secondary
- **Atelier Brass** (`#b0894a` / `--gold`): Brand wordmark accent (“Pro”), links, active nav tint, focus ring hue, hover borders on choice cards. Used sparingly.
- **Champagne Highlight** (`#d4b483` / `--gold-light`): Softer brass for secondary emphasis (e.g. light captions on dark or decorative accents).

### Neutral
- **Shop Paper** (`#f7f3ee` / `--paper`): App background and inset POS panels.
- **White** (`#ffffff`): Cards, inputs, elevated content surfaces.
- **Stone Border** (`#e7e5e4` / stone-200): Default card and field borders.
- **Stone Muted** (`#78716c` / stone-500): Labels, meta, ghost button text.

### Semantic
- **Danger** (`#b91c1c` / red-700): Destructive actions only.

**The One Brass Rule.** Atelier Brass is for brand, links, focus, and selection hints — not large fills. Primary fills stay Boutique Ink (or theme ink).

**The Theme Swap Rule.** Gold is canonical. Tenant themes (oud, rose, emerald, midnight, terracotta) may remap `--ink`, `--ink-hover`, `--gold`, `--gold-light`, and `--paper` only. Component hierarchy, density, and UX behavior must not change.

## Typography

**Display Font:** Fraunces (Cairo for Arabic UI)
**Body Font:** DM Sans (Cairo for Arabic UI)
**Label Font:** DM Sans / Cairo, uppercase tracking for field labels

**Character:** Fraunces gives boutique display moments; DM Sans keeps tables, forms, and POS readable at speed. Cairo unifies Arabic body and display without breaking hierarchy.

### Hierarchy
- **Display** (Fraunces ~600, ~1.875–2rem / `font-serif text-2xl`–`text-3xl`): Page titles (`PageHeader`), POS net total, builder titles.
- **Headline** (Fraunces ~600, ~1.5rem): Modal/section titles in POS flows.
- **Title** (DM Sans 600, 1rem / `font-semibold`): Button labels, row titles, emphasis.
- **Body** (DM Sans 400, 0.875rem): Tables, descriptions, form values.
- **Label** (DM Sans 600, 0.75rem, uppercase + wide tracking): `Label` component above fields.

**The Serif Moment Rule.** Serif is for brand and display totals/titles — not dense table body text.

## Layout

App shell: fixed 256px ink sidebar (drawer on small screens) + flexible content. Content uses stacked cards and full-width tables with start-aligned headers (RTL-aware). Spacing rhythm is Tailwind-like 4/8/16/24 with page header margin ~24px (`mb-6`). POS uses multi-column cards on large screens and stacked panels on mobile. Safe-area padding on the sidebar for notched devices.

**The Till Density Rule.** Prefer scannable lists and large tap targets on POS over decorative whitespace.

## Elevation & Depth

Flat-by-default. Depth comes from paper vs white tonal layering and 1px stone borders. Shadows are ambient and rare — not a structural system.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` / `shadow-sm`): Default `Card`.
- **Panel lift** (`shadow-lg` / `shadow-2xl`): Dropdowns, login/auth shells only.
- **Nav scrim** (`bg-black/40`): Mobile sidebar overlay.

**The Flat-By-Default Rule.** No glow stacks, glassmorphism, or decorative multi-layer shadows on ops surfaces.

## Shapes

Gently curved retail UI: controls use ~8px (`rounded-lg`); cards and POS panels use ~16px (`rounded-2xl`); auth shells may use ~24px (`rounded-3xl`); filter chips use full pills (`rounded-full`). Borders are light stone; selected choice cards use ink fill or brass border emphasis.

**The Soft Counter Rule.** Prefer rounded-lg/2xl over sharp zero-radius or oversized capsules on primary buttons.

## Components

Till-first confident: solid ink CTAs, clear selected states, obvious interaction feedback.

### Buttons
- **Shape:** Gently rounded (`8px` / `rounded-lg`), `px-4 py-2`, `text-sm font-semibold`
- **Primary:** Boutique Ink fill, white text; hover Ink Hover
- **Outline:** White fill, stone border; used for unselected payment/channel toggles
- **Ghost:** Muted text, light hover wash
- **Danger:** Red-700 fill for destructive actions
- **Selected toggle:** Primary (ink) when active; outline when idle

### Cards / Containers
- **Corner Style:** Soft (`16px` / `rounded-2xl`)
- **Background:** White on Shop Paper
- **Border:** Stone-200
- **Shadow:** `shadow-sm` at rest
- **Internal Padding:** ~20px (`p-5`)

### Inputs / Fields
- **Style:** White fill, stone-300 border, `rounded-lg`, `px-3 py-2 text-sm`
- **Focus:** `ring-2` with brass-tinted ring (`ring-gold/40`)
- **Labels:** Uppercase tracked muted labels above fields

### Navigation
- **Aside:** Full Boutique Ink, light stone text, 256px wide; brand uses Fraunces with brass on “Pro”
- **Active item:** Brass-tinted wash (`bg-gold/20`) and stronger brass text
- **Mobile:** Off-canvas drawer + dark scrim; respects RTL slide direction

### Signature — BrandName
- **Style:** `font-serif` “Scent” + brass “Pro”; do not restyle away from this lockup without a rebrand decision

### Signature — POS choice tiles
- **Style:** Large `rounded-2xl` tiles with border-2; hover brass border + paper wash; selected state ink fill + white text (oils/bottles) or primary button treatment for payment/channel

## Do's and Don'ts

### Do:
- **Do** use Boutique Ink for primary actions and Atelier Brass for brand/links/focus.
- **Do** keep Fraunces for display titles and totals; DM Sans/Cairo for body and tables.
- **Do** preserve RTL and Arabic Cairo overrides when locale is `ar`.
- **Do** keep theme swaps limited to the five CSS variables; preserve roles and hierarchy.
- **Do** make selected payment/channel/POS states visually obvious (ink fill or strong border).

### Don't:
- **Don't** use purple SaaS gradients, neon accents, or heavy glassmorphism.
- **Don't** flood screens with brass fills — brass is accent, not the canvas.
- **Don't** put serif on dense table cells or long body copy.
- **Don't** invent a second layout language per theme; themes recolor, they don’t redesign.
- **Don't** replace the Scent Pro wordmark/logo treatment without an explicit rebrand.
