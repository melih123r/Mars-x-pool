# Bot 4 — MARS-X Global Website Deployment

Status: **assigned in repository, not running autonomously**. Owner: Bot 4 (API / integrations). Scope: website publishing, partner-facing web information, and Android web-screen coordination. This document does not start a ChatGPT Work session or grant browser access.

## Priority 0 — Publish verified HTTPS website
1. Check GitHub repository Settings → Pages. Set Source to GitHub Actions if permitted.
2. Run `.github/workflows/network-website-pages.yml` on `main`; inspect deployment result.
3. Record the **verified live URL** only after HTTPS GET and page-content checks. Never invent an address.
4. If Pages settings or workflow dispatch is unavailable, report the exact blocker and ask repository owner to perform the minimum manual step.

## Priority 1 — Product website QA
- Validate Network, Finance, Insurance and partner information sections.
- Test mobile viewport, anchor links, accessibility, security headers and broken links.
- Before representing site as a commercial service, obtain verified operator identity, contact email, accurate privacy notice and terms.
- Do not claim operational VPN/DNS, brokerage, insurance sales, partner approval or guaranteed earnings.
- Custom domain `marsxglobal.com` is only a **candidate**, not owned or verified. Do not add CNAME or DNS records without proof of control.

## Priority 2 — Android integration
- Verify `android/app/src/main/assets/network/index.html` matches `website/index.html`.
- Verify `NetworkWebsiteActivity` opens the bundled offline page and external HTTPS links safely.
- Run Android CI, capture run ID, job status, artifact name and APK/AAB result. On-device install is separate.
- Make changes in a separate branch and PR; avoid unrelated Finance, backend or Telegram modifications.

## Definition of done
- Live URL responds over HTTPS and displays correct content.
- GitHub Pages deploy run succeeds.
- Website legal/operator placeholders are resolved or clearly labeled as preview.
- Android CI succeeds and offline page is tested.
- Report: timestamp, branch, commit SHA, PR, Actions run URL, site URL, blockers.

## Work-mode handoff
Open ChatGPT Work and instruct it to execute this file's checklist using connected GitHub and a browser. Work execution cannot be launched by committing this document.
