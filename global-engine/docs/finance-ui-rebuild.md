# MARS-X Finance — UI rebuild plan

Status: ACTIVE DESIGN REBUILD
Scope: MARS-X Finance mobile client only. Engine and provider adapters stay intact.

## Goal
Replace the current programmatic FinanceActivity presentation with a professional, provider-neutral mobile finance UI without changing the fail-closed execution model.

## Tool pipeline
1. Figma — source of truth for visual design and tokens.
2. Bravo MCP / Mokkoi — rapid mobile UI prototypes and React Native/Expo candidates.
3. FlutterFlow / Nowa — Flutter candidate when native Flutter output is preferable.
4. Locofy / Dezyn — design-to-code comparison and component extraction.
5. Expo + Codex or Flutter + Dart/Flutter MCP — implementation, runtime inspection and visual QA.
6. GitHub Actions — reproducible Android build and test.

Only one implementation stack will ship. Generated code from competing tools is evaluated in isolated branches; it is not mixed into production blindly.

## Product constraints
- Product name: MARS-X Finance.
- Android application id: com.marsx.finance.
- Dark finance-terminal aesthetic; restrained MARS orange accent.
- Provider-neutral customer UI. No ChangeNOW logo/name in normal screens.
- Do not imply MARS-X owns or operates third-party exchange infrastructure.
- Required legal/provider disclosures must never be hidden.
- No fabricated balances, prices, fees, yields, fills, status, or transaction history.
- Loading/skeleton/empty states are preferred to fake data.
- No provider API key or secret in the APK.
- Client talks only to MARS-X Engine.
- Quote preview remains read-only. Real transaction execution stays disabled until separately approved.

## Core screens
1. Home / Markets
2. Convert
3. Portfolio empty/loading state
4. Activity
5. Analysis
6. Settings / theme
7. Service unavailable / connection pending / quote expired / unsupported route / below-minimum states

## Convert screen
- From asset + network
- Amount
- To asset + network
- Estimated receive amount
- Minimum amount
- Network/provider fees when actually returned by Engine
- Quote validity / expiry
- Preview quote CTA
- Explicit read-only/development state when execution is unavailable

## Design tokens
- Background: near-black neutral, not pure black everywhere.
- Surface hierarchy: base / raised / interactive.
- Accent: Mars orange as default; optional Aqua, Ocean, Nova, Crimson themes.
- 8pt spacing grid.
- Rounded cards, restrained shadows, high contrast typography.
- Numeric values use tabular figures.
- Touch targets >= 48dp.
- WCAG-aware contrast.

## Architecture target
Mobile UI -> provider-neutral MARS-X Engine endpoints -> internal provider adapter.

Preferred public aliases:
- GET /convert/health
- GET /convert/assets
- GET /convert/min-amount
- GET /convert/quote

Provider-specific /changenow/* paths remain internal compatibility routes until aliases are complete.

## Acceptance gates
A candidate UI does not replace the current launcher until all gates pass:
- visual review on 360x800 and 412x915 Android viewports
- dark-mode contrast review
- no fake financial data
- no secrets in client bundle
- provider-neutral network paths
- offline/loading/error/expired quote states
- Android back navigation
- quote parsing contract tests
- unit/lint/build CI green
- installable debug APK artifact
- explicit approval before any real transaction path

## Migration sequence
Phase A — freeze visual requirements and API contract.
Phase B — produce 2-3 visual candidates outside the production launcher.
Phase C — select one implementation stack by fidelity, maintainability, APK size and accessibility.
Phase D — connect read-only Engine endpoints and run visual/runtime QA.
Phase E — switch launcher only after CI + device review.
Phase F — production execution remains a separate future approval gate.

## Do not do
- Do not merge PR #20 automatically.
- Do not activate real swaps, payouts, withdrawals, custody, or signing.
- Do not copy a third-party finance app pixel-for-pixel.
- Do not ship generated UI without code review and runtime tests.
