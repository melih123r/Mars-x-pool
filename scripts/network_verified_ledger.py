"""MARS-X Network: verified partner receipt ledger (no payment execution).

All amounts are integer USD micro-units (1 USD = 1_000_000).
Local Android TrafficStats data MUST NOT be submitted as partner receipts.
"""
import sqlite3
from datetime import datetime, timezone

MICRO_USD = 1_000_000


def initialize(connection):
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS network_partner_receipts (
            partner TEXT NOT NULL,
            receipt_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            gross_micro_usd INTEGER NOT NULL CHECK(gross_micro_usd >= 0),
            verified_at TEXT NOT NULL,
            PRIMARY KEY(partner, receipt_id)
        );
        CREATE TABLE IF NOT EXISTS network_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner TEXT NOT NULL,
            receipt_id TEXT NOT NULL,
            account TEXT NOT NULL CHECK(account IN ('user','platform')),
            user_id TEXT NOT NULL,
            amount_micro_usd INTEGER NOT NULL CHECK(amount_micro_usd >= 0),
            UNIQUE(partner, receipt_id, account),
            FOREIGN KEY(partner, receipt_id)
                REFERENCES network_partner_receipts(partner, receipt_id)
        );
    """)


def record_verified_receipt(connection, *, partner, receipt_id, user_id,
                            gross_micro_usd, verified=False):
    """Book exactly once after an independently authenticated partner receipt.

    The caller must authenticate the partner API/webhook and verify the receipt
    against that partner's authoritative settlement data BEFORE setting verified.
    """
    if not verified:
        raise PermissionError("Authenticated partner settlement required")
    if not all(isinstance(x, str) and x.strip() for x in (partner, receipt_id, user_id)):
        raise ValueError("Partner, receipt ID and user ID are required")
    if type(gross_micro_usd) is not int or gross_micro_usd < 0:
        raise ValueError("Gross revenue must be a nonnegative integer")
    user_amount = gross_micro_usd * 80 // 100
    platform_amount = gross_micro_usd - user_amount
    with connection:
        existing = connection.execute(
            "SELECT user_id, gross_micro_usd FROM network_partner_receipts "
            "WHERE partner=? AND receipt_id=?", (partner, receipt_id)
        ).fetchone()
        if existing is not None:
            if existing != (user_id, gross_micro_usd):
                raise ValueError("Conflicting duplicate partner receipt")
            return False
        connection.execute(
            "INSERT INTO network_partner_receipts VALUES (?,?,?,?,?)",
            (partner, receipt_id, user_id, gross_micro_usd,
             datetime.now(timezone.utc).isoformat())
        )
        connection.executemany(
            "INSERT INTO network_ledger "
            "(partner, receipt_id, account, user_id, amount_micro_usd) "
            "VALUES (?,?,?,?,?)",
            [(partner, receipt_id, "user", user_id, user_amount),
             (partner, receipt_id, "platform", user_id, platform_amount)]
        )
    return True


def user_earned_micro_usd(connection, user_id):
    row = connection.execute(
        "SELECT COALESCE(SUM(amount_micro_usd),0) FROM network_ledger "
        "WHERE account='user' AND user_id=?", (user_id,)
    ).fetchone()
    return row[0]
