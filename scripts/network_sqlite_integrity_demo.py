"""SQLite-only offline settlement integrity smoke test; never processes real payments."""
import sqlite3


def open_demo_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
    CREATE TABLE receipts (provider TEXT NOT NULL, receipt_id TEXT NOT NULL,
      user_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer' AND amount_cents>0),
      PRIMARY KEY(provider, receipt_id));
    CREATE TABLE withdrawals (withdrawal_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL, gross_cents INTEGER NOT NULL CHECK(typeof(gross_cents)='integer' AND gross_cents>=1000),
      state TEXT NOT NULL CHECK(state IN ('reserved','cancelled','paid')));
    """)
    db.executescript("""
    CREATE TRIGGER prevent_terminal_withdrawal_mutation
    BEFORE UPDATE OF state ON withdrawals
    WHEN OLD.state IN ('paid', 'cancelled')
    BEGIN
      SELECT RAISE(ABORT, 'terminal withdrawal state is immutable');
    END;
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
    # Owner mismatch and duplicate state transitions cannot mutate settled records.
    with db:
        assert db.execute("UPDATE withdrawals SET state='paid' WHERE withdrawal_id='w1' AND user_id='b' AND state='reserved'").rowcount == 0
        assert db.execute("UPDATE withdrawals SET state='cancelled' WHERE withdrawal_id='w1' AND user_id='a' AND state='reserved'").rowcount == 0
    for sql, params in (
        ("INSERT INTO receipts VALUES (?,?,?,?)", ("test-provider", "bad", "a", -1)),
        ("INSERT INTO receipts VALUES (?,?,?,?)", ("test-provider", "bad-text", "a", "not-money")),
        ("INSERT INTO withdrawals VALUES (?,?,?,?)", ("bad-text", "a", "not-money", "reserved")),
        ("INSERT INTO withdrawals VALUES (?,?,?,?)", ("bad", "a", 999, "reserved")),
        ("INSERT INTO withdrawals VALUES (?,?,?,?)", ("bad", "a", 1000, "unknown")),
    ):
        try:
            with db:
                db.execute(sql, params)
            raise AssertionError("invalid database record accepted")
        except sqlite3.IntegrityError:
            pass
    assert db.execute("SELECT COUNT(*) FROM receipts").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM withdrawals").fetchone()[0] == 1
    # A paid withdrawal cannot transition back into a reserved or cancelled state.
    with db:
        db.execute("INSERT INTO withdrawals VALUES (?,?,?,?)", ("w2", "a", 1000, "reserved"))
        assert db.execute("UPDATE withdrawals SET state='paid' WHERE withdrawal_id='w2' AND user_id='a' AND state='reserved'").rowcount == 1
        assert db.execute("UPDATE withdrawals SET state='cancelled' WHERE withdrawal_id='w2' AND user_id='a' AND state='reserved'").rowcount == 0
    assert db.execute("SELECT state FROM withdrawals WHERE withdrawal_id='w2'").fetchone()[0] == "paid"
    # Database itself blocks an accidental unguarded terminal-state rewrite.
    for wid, new_state in (("w1", "paid"), ("w2", "cancelled")):
        try:
            with db:
                db.execute("UPDATE withdrawals SET state=? WHERE withdrawal_id=?", (new_state, wid))
            raise AssertionError("terminal state rewrite accepted")
        except sqlite3.IntegrityError:
            pass
    print("Offline SQLite settlement constraints: PASS")


if __name__ == "__main__":
    demo()
