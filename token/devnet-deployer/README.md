# MARSX Devnet genesis signer

This browser-only signer is fixed to Solana Devnet and the owner wallet in the PR #9 manifest.

- It never requests, reads, stores, logs, or commits a seed phrase/private key.
- Ephemeral mint/vault account keypairs exist only in page memory until their creation transactions are signed.
- Solflare supplies the owner signature and submits each transaction.
- Transaction 2 contains the final mint instructions and the irreversible mint-authority revocation.
- The page rejects any connected wallet other than the manifest owner wallet.
- Mainnet configuration is not exposed.

Build the reviewed source with:

```sh
npx esbuild token/devnet-deployer/app.js --bundle --platform=browser --format=esm --target=es2022 --outfile=token/devnet-deployer/app.bundle.js
```

Only public deployment artifacts from the verified result belong in `token/devnet-deployment.json`.
