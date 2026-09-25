# Security

Do not commit Railway variables, beta access tokens, Android signing keys, or Play Console credentials.

Report a vulnerability privately through GitHub's security reporting interface when available. Do not include live tokens in an issue. Rotate `WORKER_TOKEN` after the closed test, whenever a tester leaves, or immediately if it is exposed.

The shared beta token is suitable only for a small closed test. A production release must replace it with per-device enrollment and revocable credentials.
