# MARS-X Finance accelerated handoff — 2026-10-12

Target (not guaranteed): testable read-only market data + demo APK by **2026-10-19**, stretch goal **2026-10-17**.
Release candidate target: **2026-10-26**, subject to device, signing and security gates.
Real-money trading: NO date commitment; disabled until legal/provider/security approval.

Bot 1 — backend: own reliable market data proxy, provider fallback, stale data and resync handling, rate limits and secret hygiene. Report SHA, CI and endpoints.
Bot 2 — Android: integrate order book and charts; produce a directly installable APK artifact, test SDK26/Android16 and physical 4GB RAM; report startup/ANR, APK size and SHA256.
Bot 3 — graphics: compare approved reference at matched resolution, optimize frame time, accessibility and animations; supply screenshot evidence.
Bot 4 — integrations: verify ChangeNOW read-only auth/currencies/min-amount/quote, geo restrictions, audit logs and Render readiness; never execute swaps.
Bot 5 — independent QA: audit PR #20/#32/#33/#34/#37/#55/#56, Gmail failures, Render and CI. Mark each gate PASS/FAIL/BLOCKED; no invented percentages.

Prioritize existing broken workflows over new modules. 1GB maximum APK, no artificial size inflation. No KYC bypass, unauthorized financial actions or leaked secrets.

This file is an asynchronous coordination artifact for developers/agents reading the repository. It does not automatically message or control other ChatGPT conversations or scheduled bots.
