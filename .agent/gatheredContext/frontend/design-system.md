# FlyerBoard Design System

> Architecture documentation for the FlyerBoard design system and color tokens.

## Color Palette

The FlyerBoard design system uses semantic color tokens that automatically adapt between light and dark modes. This enables easy theme customization and consistent visual identity.

### Quick Reference

See [color_palette.md](color_palette.md) for the full color palette with HSL values and use cases.

### Token Categories

| Category | Tokens | Purpose |
|----------|--------|---------|
| **Brand** | `primary`, `trade` | Brand identity, CTAs |
| **Surface** | `background`, `card`, `muted` | Page and component backgrounds |
| **Text** | `foreground`, `muted-foreground` | Content hierarchy |
| **Interactive** | `border`, `input`, `ring` | State feedback |
| **Feedback** | `destructive` | Error states |

### Key Design Decision

The system uses **two brand color variants**:
- `primary` — Darker red for **filled buttons** (large surface area)
- `trade` — Brighter red for **text** requiring high contrast in dark mode

This avoids proliferating custom tokens while ensuring readability.

### Files

- **CSS Variables**: [src/index.css](file:///Users/amir.rudd/flyerBoard/FlyerBoard/src/index.css)
- **Tailwind Config**: [tailwind.config.js](file:///Users/amir.rudd/flyerBoard/FlyerBoard/tailwind.config.js)
