# MARS-X Finance × lemon.markets — proposed tied-agent operating model

## Objective

MARS-X Finance wants to retain the MARS-X brand, Android application, user experience and technology while using the regulated investment-services infrastructure of lemon.markets for a France-first stocks/ETF offering.

This document is a proposal for partner scoping only. It is not a claim that MARS-X has already been appointed, registered or authorised as a tied agent.

## Why lemon.markets matches the target model

Official lemon.markets materials state that:
- lemon.markets brokerage GmbH is supervised by BaFin and licensed under the German Investment Firms Act (WpIG).
- For partners that are not already under regulatory oversight, lemon.markets can offer a tied-agent model.
- lemon.markets can cover onboarding, client money, trading, settlement and custody.
- The partner can remain responsible for the customer relationship, continuing business operations and front-end experience.
- lemon.markets describes full brokerage service as covering investment-related regulatory interactions with the customer either directly or by making the partner a tied agent.
- lemon.markets' Tomorrow case study describes a tied-agent relationship in which the partner remains the face to the customer while the investment-service customer relationship, order processing and securities safekeeping sit with lemon.markets.

Sources:
- https://www.lemon.markets/en-de/vertical-brokerage
- https://www.lemon.markets/en-de/brokers-and-wealth-managers
- https://www.lemon.markets/en-de/blog/partner-case-study-tomorrow
- https://www.lemon.markets/en-de/imprint

## Proposed responsibility split

### MARS-X Finance
- MARS-X brand and Android application
- customer acquisition
- product UX and front-end
- first-level customer support, subject to contractual boundaries
- secure client session handling and partner-required SCA protection
- presentation of disclosures supplied/approved by lemon.markets
- no independent investment advice or discretionary portfolio management unless separately authorised
- no storage of Lemon API secrets in Android

### lemon.markets / regulated infrastructure
Subject to contract and regulatory approval:
- investment-service customer agreement
- account onboarding and KYC/PEP/sanctions/risk checks
- client money / funding infrastructure
- securities-account provisioning
- investment order processing and best-execution controls
- settlement
- custody / safekeeping
- required regulatory disclosures, cost information and reporting
- SCA enforcement for regulated actions

## Initial launch scope

- Country: France
- Clients: retail users
- Assets: stocks and ETFs
- Integration: Brokerage API
- Mobile: Android
- Phase 1: sandbox only
- Phase 2: production only after contractual, regulatory and technical sign-off
- No live trading before approval
- No withdrawals before approval

## Questions requiring written confirmation from lemon.markets

1. Can MARS-X Finance be appointed as a tied agent for a France-first launch?
2. Which legal entity must MARS-X establish and in which EEA jurisdiction?
3. Which tied-agent registration / notification process applies for servicing French residents?
4. Which entity contracts directly with the retail customer for investment services?
5. Which activities may MARS-X perform and which must remain exclusively with lemon.markets?
6. Who owns KYC/AML, PEP/sanctions screening and ongoing monitoring?
7. What SCA responsibilities remain with MARS-X?
8. Does lemon.markets passport the relevant investment services into France under the proposed model?
9. What customer-support and complaints responsibilities remain with MARS-X?
10. What sandbox certification must be completed before production?
11. What are the setup fee, monthly minimum, per-account / per-order charges and revenue-sharing options?
12. Are early-stage / pre-revenue fintechs eligible?

## Technical readiness

Current MARS-X branch contains:
- backend-only Lemon Bearer credential handling
- privacy tracing headers
- official development-host allowlist
- fail-closed order / withdrawal feature gates
- account / KYC onboarding primitives
- SCA authenticator helpers
- instrument and product-contract discovery
- bounded account / order / transaction reads
- read-only sandbox certification harness
- Android Lemon readiness UI

The production feature gates remain disabled until partner approval and end-to-end sandbox certification.
