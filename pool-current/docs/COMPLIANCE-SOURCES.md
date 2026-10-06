# Compliance sources checked on 25 September 2026

- [Google Play Developer Programme Policy](https://support.google.com/googleplay/android-developer/answer/17517561?hl=en-GB): device cryptomining is prohibited; remote management is permitted; token earning may require the Financial features declaration.
- [Play Integrity overview](https://developer.android.com/google/play/integrity/overview): validate request details, recognised app/signing identity and the `LICENSED` verdict before granting sensitive access.
- [Google Play Billing security](https://developer.android.com/google/play/billing/security): send purchase tokens to the backend and verify with the Google Play Developer API before granting entitlement.
- [Play closed-testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB): applicable new personal accounts need at least 12 continuously opted-in testers for 14 days before applying for production.
- [CNIL mobile-app recommendations](https://www.cnil.fr/fr/recommandations-applications-mobiles-modifiee): consent-dependent SDK access and tracking should not start before valid consent.
- [French Intellectual Property Code Article L122-6](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278919) and [Article L122-6-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044365559): software exploitation rights and mandatory exceptions.
- [INPI e-Soleau guidance](https://www.inpi.fr/realiser-demarches/propriete-intellectuelle/se-preparer-au-depot-dune-e-soleau): e-Soleau gives a certain creation date/evidence of priority but does not itself create an IP right.

These references guide design and release checks; they do not replace advice on final commercial terms, tax, consumer law or a specific infringement dispute.
