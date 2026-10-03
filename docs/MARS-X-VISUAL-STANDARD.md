# MARS-X Ecosystem Visual Standard — Release Gate

Status: **MANDATORY**

This standard applies to every MARS-X product, app, website, store listing, dashboard and promotional asset. A release must not be published until it passes this visual gate.

## Shared foundation
- Background: deep space / near-black navy.
- Surfaces: dark navy-black cards and panels.
- Primary typography: white / cool white.
- Borders and highlights: restrained neon glow using the active product accent.
- MARS-X identity, typography, navigation geometry and spacing remain consistent across products.
- Product accent must be used consistently for icons, active controls, charts, focus states and key highlights.
- Accent colors must not reduce text contrast or accessibility.

## Product identity colors
| Product | Required accent |
|---|---|
| MARS-X ID / Core | violet → cyan energy gradient |
| MARS-X Finance | violet / electric blue |
| MARS-X Pay | electric blue / cyan |
| MARS-X Broker | purple / magenta |
| MARS-X Wallet | cyan / turquoise |
| MARS-X Protect / Insurance | gold / amber |
| MARS-X Pool | orange / red-orange |
| MARS-X Engine | indigo / violet-blue |

## Ecosystem Theme System
MARS-X is one application ecosystem, not a collection of unrelated visual shells. The shared dark foundation stays stable while the active module supplies its accent theme.

When the user moves between modules:
1. Keep the app shell, MARS-X mark, typography, navigation positions and dark surfaces stable.
2. Transition the selected navigation state, primary CTA, chart accent, focus ring, progress indicator and restrained border/glow to the destination module accent.
3. Preserve semantic colors for success, warning, error, security and regulatory states.
4. Use a short, subtle transition; never flash the entire screen or sacrifice readability.
5. Keep state and navigation continuity so a theme change never looks like an unexpected external-app launch.
6. Respect reduced-motion/accessibility settings; theme identity must remain understandable without animation.

### Theme tokens
UI code should consume semantic tokens rather than scattering product colors through screens:
- `marsx.background`
- `marsx.surface`
- `marsx.text.primary`
- `marsx.text.secondary`
- `marsx.accent.primary`
- `marsx.accent.secondary`
- `marsx.accent.glow`
- `marsx.navigation.selected`
- `marsx.chart.primary`
- `marsx.focus`

Each module maps these shared tokens to its assigned palette. New MARS-X modules must add a palette mapping before release instead of introducing ad-hoc colors.

## App requirements
Each app/module must apply its assigned accent to:
1. App/module icon and major identity marks.
2. Primary CTA and selected navigation state.
3. Charts and status highlights where semantically appropriate.
4. Borders/glows and loading/progress states.
5. Store screenshots and launch/promotional graphics.

Do not recolor warning, error, success or regulatory status indicators merely to match branding; semantic colors take precedence.

## Release gate — blocking
Before production or store publication:
- [ ] Correct MARS-X product/module accent is implemented.
- [ ] Dark MARS-X shared foundation is implemented.
- [ ] Module switching preserves the common app shell and changes only theme tokens appropriate to the destination.
- [ ] No screen contains hard-coded dominant colors that bypass the module theme without a semantic reason.
- [ ] Product iconography and navigation follow the shared visual family.
- [ ] Light/dark text contrast is readable and accessible.
- [ ] Reduced-motion users can navigate modules without relying on transition animation.
- [ ] Store screenshots match the in-app visual identity.
- [ ] No unrelated product accent is used as the dominant color.
- [ ] Product remains visually recognizable as part of the MARS-X ecosystem.
- [ ] Functional, security, compliance and store checks also pass independently.

**FAILURE OF THE VISUAL GATE = NO RELEASE.**

This visual gate is an additional release requirement; it never overrides security, legal, regulatory, accessibility or platform requirements.
