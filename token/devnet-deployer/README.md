# MARSX Devnet genesis signer

This browser-only signer is fixed to Solana Devnet and the owner wallet in the PR #9 manifest.

- It never requests, reads, stores, logs, or commits a seed phrase/private key.
- Public addresses are derived with CreateWithSeed. No mint/vault keypairs are generated or stored, and page reloads can resume from on-chain balances.
- Solflare supplies the owner signature and submits each transaction.
- Before every signature, the page verifies the Devnet genesis hash, discovers earlier genesis transactions, reads a finalized mint/vault snapshot, and simulates the next unsigned transaction.
- Allocation transactions never revoke mint authority. A separate final approval is available only after all seven vault balances and exactly 1B MARSX verify on chain.
- Legacy two-transaction deployments can be recovered using their initialization and allocation instructions. Unknown or ambiguous state stops the flow.
- Public transaction links are shown after submission and recovered from chain history after reload.
- The page rejects any connected wallet other than the manifest owner wallet.
- Mainnet configuration is not exposed.

Build the reviewed source with:

```sh
npx esbuild token/devnet-deployer/app.js --bundle --platform=browser --format=esm --target=es2022 --outfile=token/devnet-deployer/app.bundle.js
```

Only public deployment artifacts from the verified result belong in `token/devnet-deployment.json`.

Read-only status: `npm run marsx:devnet-status`. After actual verified completion, `npm run marsx:devnet-status -- --write` writes the public deployment record. This command never signs or submits a transaction. Incomplete or unverifiable deployments cannot produce a success record.
