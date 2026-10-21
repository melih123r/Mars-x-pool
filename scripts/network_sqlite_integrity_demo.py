"""SQLite-only offline settlement integrity smoke test; never processes real payments."""
import sqlite3


def open_demo_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
    CREATE TABLE receipts (provider TEXT NOT NULL, receipt_id TEXT NOT NULL,
      user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
      PRIMARY KEY(provider, receipt_id));
    CREATE TABLE withdrawals (withdrawal_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL, gross_cents INTEGER NOT NULL CHECK(gross_cents>=1000),
      state TEXT NOT NULL CHECK(state IN ('reserved','cancelled','paid')));
    """)
    return db


def demo():
    db = open_demo_db()
    with db:
        db.execute("INSERT INTO receipts VALUES (?,?,?,?)", ("test-provider", "r1", "a", 1500))
    try:
        with db:
            db.execute("INSERT INTO receipts VALUES (?,?,?,?)", ("test-provider", "r1", "b", 1500))
        raise AssertionError("duplicate receipt persisted")
    except sqlite3.IntegrityError:
        pass
    with db:
        db.execute("INSERT INTO withdrawals VALUES (?,?,?,?)", ("w1", "a", 1000, "reserved"))
    assert db.execute("SELECT COUNT(*) FROM withdrawals WHERE state='reserved'").fetchone()[0] == 1
    with db:
        updated = db.execute("UPDATE withdrawals SET state='cancelled' WHERE withdrawal_id='w1' AND user_id='a' AND state='reserved'").rowcount
    assert updated == 1
    with db:
        updated = db.execute("UPDATE withdrawals SET state='paid' WHERE withdrawal_id='w1' AND user_id='a' AND state='reserved'").rowcount
    assert updated == 0
    assert db.execute("SELECT state FROM withdrawals WHERE withdrawal_id='w1'").fetchone()[0] == "cancelled"
    print("Offline SQLite settlement constraints: PASS")


if __name__ == "__main__":
    demo()
