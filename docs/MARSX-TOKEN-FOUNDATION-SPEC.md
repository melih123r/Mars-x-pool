# MARS-X Token & Foundation Integration — v1

Status: DESIGN + TESTNET PREPARATION ONLY. No mainnet mint, public sale, exchange listing, real-value reward credit, custody, or brokerage is enabled by this specification.

## Product boundary

MARSX is planned as the utility asset for the MARS-X ecosystem. It is separate from mined BTC/LTC/DOGE balances and must never be presented as mined LTC/DOGE, guaranteed income, investment return, or a claim on company profit.

Current Pool production flags for real mining/rewards/payouts remain OFF. MARSX integration starts on testnet/devnet only.

## Chain decision

Preferred v1 chain: Solana Token-2022.

Reasons:
- low-friction app/wallet integration and small-value transfers;
- native burn reduces both holder balance and mint total supply;
- optional token extensions can be selected at mint creation.

Security decisions:
- NO PermanentDelegate: MARS-X must not have unilateral authority to transfer or burn user balances.
- NO hidden transfer tax.
- NO arbitrary post-launch minting.
- Mint authority is used only to create the genesis allocation, then revoked after allocation verification.
- Freeze/pausable powers, if used during testnet, must be explicitly documented before mainnet and controlled by multisig/timelock rather than a personal hot wallet.

## Genesis economics

Maximum genesis supply: 1,000,000,000 MARSX
Decimals: 9

Allocation:
- 400,000,000 — Pool Reward Vault (40%)
- 200,000,000 — Ecosystem/App Vault (20%)
- 150,000,000 — Liquidity Reserve (15%)
- 120,000,000 — future MARS-X Foundation Treasury (12%)
- 70,000,000 — Founder/Team Vesting (7%)
- 30,000,000 — Community/Referral (3%)
- 30,000,000 — Security/Development (3%)

The allocations are separate on-chain vaults/accounts, not one founder wallet.

## Burn policy

Hard cap is the genesis 1B supply; once the genesis allocation is complete and verified, mint authority is revoked.

Protocol-owned MARSX may be sent to a dedicated Burn Vault and burned on a published cadence. User-owned balances cannot be burned by MARS-X without the user's authorization.

Initial policy target:
- burn floor: 500,000,000 MARSX total supply;
- automatic protocol burn stops at the floor;
- no statement that burn guarantees price appreciation;
- buyback-and-burn using external revenues is NOT enabled in v1 and requires separate legal/compliance review before implementation.

## Governance path

Phase A — project-controlled testnet:
- development multisig;
- public allocation manifest;
- deterministic scripts;
- no public sale.

Phase B — pre-foundation:
- treasury multisig;
- transaction timelock for material treasury actions;
- published treasury and burn reports;
- independent code/security review before mainnet.

Phase C — future MARS-X Foundation:
- transfer protocol treasury/governance authorities only after the legal entity exists and accepts them;
- Foundation manages protocol/ecosystem treasury, not customer brokerage assets;
- operating company remains separate from Foundation;
- any regulated MARS-X Markets/CASP activity remains a separate licensed entity or licensed partner.

## LTC / DOGE relationship

MARSX does not replace Litecoin or Dogecoin mining. MARS-X Pool's first mining pilot remains independently verified Scrypt merged mining for LTC/DOGE, plus the separately specified BTC path.

Architecture:
verified mining provider -> settled LTC/DOGE accounting -> user mining ledger
MARS-X ecosystem -> separate MARSX utility/reward ledger

Never convert settled user LTC/DOGE into MARSX without an explicit user action, exact quote, applicable compliance checks, and a legally permitted provider flow.

## Litecoin Foundation path

The Litecoin Foundation is an independent nonprofit. MARS-X must not use its name/logo in a way that implies endorsement, partnership, funding, or affiliation without written approval.

Once MARS-X has:
1. verified real LTC/DOGE mining telemetry,
2. an open-source integration suitable for public review,
3. a clear Litecoin ecosystem benefit,
4. a project budget and impact statement,
5. stable public project/repository information,

the project can prepare a submission to the Litecoin Foundation's official project-submission process. Until accepted, UI/docs must say only that Litecoin support is planned/implemented as technically verified, not Foundation-backed.

## Brand / metadata

Use the existing approved MARS-X orange/black visual identity as the source of truth for future token metadata/icon work. Do not invent a second token brand.

Token metadata:
- name: MARS-X
- symbol: MARSX
- network: Solana Token-2022 (planned)
- project: MARS-X ecosystem
- canonical repository: melih123r/Mars-x-pool

The final token icon must be derived from the approved project artwork already selected for MARS-X, with a square token-safe export. Do not publish token metadata to mainnet until the exact approved artwork asset is identified and reviewed.

## App integration gates

Gate 0: current sandbox remains unchanged.
Gate 1: read-only devnet MARSX balance display.
Gate 2: authenticated devnet wallet linking.
Gate 3: testnet reward distribution from Pool Reward Vault.
Gate 4: audited mainnet token + legal/white-paper readiness.
Gate 5: real app utility.
Gate 6: licensed/partner MARS-X Markets integration.

No gate may silently reinterpret USDT_TEST as MARSX or a real crypto balance.

## Compliance gates

Before any public offer or admission to trading in the EU, complete MiCA classification and applicable crypto-asset white-paper/notification work. Keep regulated custody, exchange, order execution, transfer and trading-platform services outside the Pool beta unless supplied under an appropriate authorized structure.

No public price target, guaranteed yield, guaranteed mining return, or Foundation endorsement claim.

## Implementation backlog

- add token/ manifest containing network, decimals, genesis allocation and authority policy;
- add deterministic devnet mint/allocation script;
- add burn-vault test script and invariant tests;
- add supply invariant: total minted <= 1B and no mint authority after genesis finalization;
- add app feature flag MARSX_DEVNET_ENABLED=false;
- add read-only MARSX model/API fields without changing sandbox balances;
- identify exact approved orange/black artwork asset before metadata publication;
- prepare Litecoin Foundation project-submission packet only after LTC telemetry is independently verified;
- legal/security review before mainnet.
