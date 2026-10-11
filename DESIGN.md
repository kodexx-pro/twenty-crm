---
name: Kodexx One
description: CRM workspace interface with the K1 identity.
colors:
  brand: "#3ecf8e"
  primary-light: "oklch(0.8348 0.1302 160.9080)"
  primary-dark: "oklch(0.4365 0.1044 156.7556)"
  surface-light: "#fcfcfc"
  surface-dark: "#121212"
typography:
  body:
    fontFamily: "Outfit, sans-serif"
    fontSize: "13px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.primary-light}"
    rounded: "{rounded.md}"
---

## Overview

Kodexx One is the visible product name; K1 is the compact mark. Preserve the existing CRM layouts, workspace permissions and record-form behavior. This is an Operate interface: clear controls and dense data take priority.

## Colors

Use the supplied neutral and green palette in both light and dark schemes. Semantic theme values originate in `packages/twenty-ui/design-tokens`, then generate CSS variables and static theme objects. Neutral values use equivalent sRGB hex for compatibility with embedded billing forms. Retain categorical colors and danger/success distinctions.

## Typography

Outfit is bundled locally in the frontend public fonts directory under its SIL OFL license. Use the shared font-family token, retaining the existing interface scale and monospaced code font.

## Layout

Retain the existing responsive layouts and user scale preferences. Rebranding must not resize record tables, change navigation or alter form presentation settings.

## Shapes

Keep existing component radii. The K1 mark is an authored geometric SVG, also rendered into the existing PWA icon sizes.

## Components

Default and accent solid buttons share the primary background, foreground and hover tokens. Outline and soft variants use the accent ramp. Verify text contrast in both schemes; preserve disabled, loading and keyboard-focus states.

## Do's and Don'ts

Use Kodexx One in product copy and translated messages. Keep technical package names, API identifiers, webhook headers and license attribution stable. Respect custom workspace logos. Generated theme files must be regenerated from their sources. Email branding must not fetch assets from Twenty servers.
