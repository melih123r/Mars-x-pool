# One publisher node, many MARS-X users

The partner-facing identity and the MARS-X user identity are separate:

- one verified `publisher_nodes` row stores the partner account/device reference;
- every authenticated MARS-X user has its own `devices` row and installation ID;
- the server assigns each user device to the publisher node;
- partner traffic/revenue receipts are imported once, deduplicated, reconciled, and allocated in the immutable ledger;
- users never receive the publisher token or partner device identifier.

This model supports one publisher account serving many MARS-X users without pretending that all users are the same device. It does not by itself authorize live routing: the partner must explicitly permit aggregation and provide a receipt/reconciliation contract. Until that contract is verified, all rows remain DEMO-only and the gateway remains locked.
