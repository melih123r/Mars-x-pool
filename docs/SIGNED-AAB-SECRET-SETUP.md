# Signed AAB secret setup

The signed release workflow is intentionally configured to use the existing Google Play upload key. It does not create, rotate or replace a key.

Set these **repository Actions secrets** in GitHub before running `Network DEMO signed AAB` manually:

| Secret | Value |
| --- | --- |
| `MARSX_UPLOAD_KEYSTORE_BASE64` | Base64 of the existing upload `.jks`/`.keystore` file |
| `MARSX_UPLOAD_STORE_PASSWORD` | Keystore password |
| `MARSX_UPLOAD_KEY_ALIAS` | Existing upload-key alias |
| `MARSX_UPLOAD_KEY_PASSWORD` | Existing upload-key password |

The values must come from the current Play upload certificate. Do not generate a replacement key or commit the keystore. The workflow writes the decoded keystore only to the ephemeral runner, builds the release AAB, verifies the signature, records SHA-256 and byte size, uploads the artifact, and deletes the temporary keystore.

Required order:

1. Confirm the Play Console upload certificate fingerprint matches the existing keystore.
2. Add the four secrets under **Settings → Secrets and variables → Actions**.
3. Run **Network DEMO signed AAB** with `workflow_dispatch`.
4. Require a successful `jarsigner` verification and save the generated AAB metadata.

If any value is unknown, stop. Do not guess a password, create a new keystore, or use a key from another application.
