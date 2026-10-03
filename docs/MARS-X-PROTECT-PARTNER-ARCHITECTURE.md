# MARS-X Protect — Zero-Capital Partner Architecture

Status: DESIGN / PARTNER-INTEGRATION GATE

## Objective
Launch MARS-X Protect without MARS-X underwriting insurance risk or holding customer premium funds. MARS-X earns a small disclosed distribution/revenue-share commission only after a partner-approved sale.

## Non-negotiable launch rules
- MARS-X is not the risk carrier unless separately licensed and capitalised in the future.
- No customer premium is collected into a MARS-X bank/wallet account.
- No policy is represented as active until the licensed partner confirms issuance.
- No production insurance sale until the partner confirms the permitted distribution/mandate model and required registrations.
- Commission rates, fees and customer disclosures come from the signed partner agreement; no rate is hard-coded as guaranteed.
- Sandbox/demo quotes must be visibly labelled and cannot create real coverage.

## Provider-neutral integration
Protect UI -> Protect Gateway -> Provider Adapter -> licensed insurance infrastructure/carrier.

The gateway owns a stable internal contract:
- getProducts(country, context)
- createQuote(product, customerContext)
- acceptQuote(quoteId, consent)
- getPolicy(policyId)
- cancelPolicy(policyId)
- startClaim(policyId)
- getClaim(claimId)
- getCommissionLedger(period)

Provider adapters translate this contract to the selected partner. Initial candidates:
1. Komodi — sandbox-first candidate; public site advertises no upfront platform fee and a free Build tier.
2. Qover — mature European orchestration/API candidate with multi-carrier setup.
3. Wakam — regulated risk-carrier/embedded-insurance candidate; production access requires contract.
4. Weecover — API/widgets and white-label alternative.
5. Meetch — France-based ORIAS broker/infrastructure alternative, particularly for travel/leisure use cases.
6. Cover Genius / XCover — global API alternative.
7. bolt — broader protection/distribution platform alternative.

## Commercial request
Ask partners for:
- EUR 0 setup/upfront fee where possible.
- No minimum guarantee during pilot.
- Transaction/success-based economics.
- Small commission/revenue share per activated policy.
- Partner/carrier handles premium collection.
- Partner/carrier handles policy issuance and regulated documents.
- Partner/carrier handles or contractually allocates claims and customer-care responsibilities.
- Sandbox/API access before production commitment.
- Written confirmation of MARS-X's required regulatory status in each launch country.

## First pilot
Prefer a simple complementary protection product before crypto-specific coverage. Candidate categories: device/purchase protection, travel disruption, mobility. Crypto/custody protection remains a later phase because underwriting, custody, fraud and claims attribution are more complex.

## Security and data
- Provider credentials only in server-side secrets.
- Never embed production API secrets in Android.
- Store only minimum policy references and consent/audit metadata needed by the agreed model.
- Verify provider webhooks with signatures and idempotency keys.
- Use integer minor currency units for premiums/commissions.
- Keep sandbox and production identifiers/secrets strictly separated.

## Release gates
- [ ] Partner selected and contract signed.
- [ ] Regulatory/distribution role documented for launch country.
- [ ] Required ORIAS/other registration or valid exemption/mandate confirmed.
- [ ] MARS-X does not receive customer premiums unless separately authorised and guaranteed.
- [ ] Production API credentials stored server-side.
- [ ] Policy wording/IPID/terms supplied by authorised partner.
- [ ] Quote/issue/cancel/claim flows pass sandbox tests.
- [ ] Commission ledger reconciles against partner statements.
- [ ] Protect UI clearly identifies the actual insurer/intermediary where legally required.
