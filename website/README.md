# MARS-X Network — partner site

Static, dependency-free informational website in `website/index.html`. It is a development preview, **not** a live DNS/VPN service and does not imply any partner approval.

## Publish free with GitHub Pages

1. Merge this branch into the repository's default branch after review.
2. In GitHub **Settings → Pages**, select **Deploy from a branch**, choose the default branch and the `/docs` folder **only if you copy the website there**, or choose GitHub Actions with a workflow that uploads `website/`.
3. Recommended: use the included `.github/workflows/network-website-pages.yml` GitHub Actions workflow. In Settings → Pages set **Source: GitHub Actions**. The workflow runs after a push to the default branch when the `website/**` files change, or manually via Actions → Deploy MARS-X Network site → Run workflow.
4. Wait for the deployment job to succeed, then use the exact URL GitHub displays in **Settings → Pages**. Do not assume a URL is live before checking it.
5. Before sharing with partners, add a verified business email, legal operator identity, a reviewed privacy notice and terms, and accurate product screenshots. Do not invent user counts, partnership approvals, DNS/VPN availability, or income claims.

## DNS for a custom domain (optional)

Only after owning a domain, configure the DNS records shown by your hosting provider. For GitHub Pages follow the provider's current official custom-domain instructions. Do not create arbitrary DNS records.

For business email, SPF/DKIM/DMARC records depend on the actual email sender; obtain exact values from that provider. DNS routing for a website/email is unrelated to an Android DNS/VPN feature.

## Verification

- Confirm GitHub Pages deployment succeeded.
- Check all navigation anchors, responsive layout, HTTPS, accessibility, privacy and terms.
- Ensure no secrets or credentials are committed.
- Obtain partner approval independently.
