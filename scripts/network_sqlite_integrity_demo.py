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
    CREATE TRIGGER prevent_receipt_update
    BEFORE UPDATE ON receipts
    BEGIN
      SELECT RAISE(ABORT, 'verified receipt is immutable');
    END;
    CREATE TRIGGER prevent_receipt_delete
    BEFORE DELETE ON receipts
    BEGIN
      SELECT RAISE(ABORT, 'verified receipt cannot be deleted');
    END;
    CREATE TRIGGER prevent_reserved_withdrawal_delete
    BEFORE DELETE ON withdrawals
    WHEN OLD.state='reserved'
    BEGIN
      SELECT RAISE(ABORT, 'reserved withdrawal must transition to cancelled');
    END;
    CREATE TRIGGER prevent_withdrawal_identity_edit
    BEFORE UPDATE ON withdrawals
    WHEN NEW.withdrawal_id != OLD.withdrawal_id
      OR NEW.user_id != OLD.user_id
      OR NEW.gross_cents != OLD.gross_cents
    BEGIN
      SELECT RAISE(ABORT, 'withdrawal identity and amount are immutable');
    END;
    CREATE TRIGGER prevent_invalid_withdrawal_transition
    BEFORE UPDATE OF state ON withdrawals
    WHEN OLD.state='reserved' AND NEW.state NOT IN ('paid','cancelled')
    BEGIN
      SELECT RAISE(ABORT, 'invalid reserved withdrawal transition');
    END;
    CREATE TRIGGER prevent_terminal_withdrawal_mutation
    BEFORE UPDATE ON withdrawals
    WHEN OLD.state IN ('paid', 'cancelled')
    BEGIN
      SELECT RAISE(ABORT, 'terminal withdrawal state is immutable');
    END;
    CREATE TRIGGER prevent_terminal_withdrawal_delete
    BEFORE DELETE ON withdrawals
    WHEN OLD.state IN ('paid', 'cancelled')
    BEGIN
      SELECT RAISE(ABORT, 'terminal withdrawal cannot be deleted');
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
    # Even a pending reservation cannot be reassigned or inflated.
    with db:
        db.execute("INSERT INTO withdrawals VALUES (?,?,?,?)", ("pending", "a", 1000, "reserved"))
    for sql in (
        "UPDATE withdrawals SET user_id='b' WHERE withdrawal_id='pending'",
        "UPDATE withdrawals SET gross_cents=2000 WHERE withdrawal_id='pending'",
        "UPDATE withdrawals SET withdrawal_id='renamed' WHERE withdrawal_id='pending'",
    ):
        try:
            with db:
                db.execute(sql)
            raise AssertionError("pending withdrawal identity was mutated")
        except sqlite3.IntegrityError:
            pass
    try:
        with db:
            db.execute("UPDATE withdrawals SET state='reserved' WHERE withdrawal_id='pending'")
        raise AssertionError("redundant reserved transition accepted")
    except sqlite3.IntegrityError:
        pass
    try:
        with db:
            db.execute("DELETE FROM withdrawals WHERE withdrawal_id='pending'")
        raise AssertionError("pending withdrawal deleted without cancellation")
    except sqlite3.IntegrityError:
        pass
    with db:
        assert db.execute("UPDATE withdrawals SET state='cancelled' WHERE withdrawal_id='pending' AND state='reserved'").rowcount == 1
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
    for wid in ("w1", "w2"):
        try:
            with db:
                db.execute("DELETE FROM withdrawals WHERE withdrawal_id=?", (wid,))
            raise AssertionError("terminal record deleted")
        except sqlite3.IntegrityError:
            pass
    try:
        with db:
            db.execute("UPDATE withdrawals SET gross_cents=2000 WHERE withdrawal_id='w2'")
        raise AssertionError("terminal amount edited")
    except sqlite3.IntegrityError:
        pass
    for sql in ("UPDATE receipts SET amount_cents=2000 WHERE receipt_id='r1'",
                "DELETE FROM receipts WHERE receipt_id='r1'"):
        try:
            with db:
                db.execute(sql)
            raise AssertionError("immutable receipt was modified")
        except sqlite3.IntegrityError:
            pass
    assert db.execute("SELECT amount_cents FROM receipts WHERE receipt_id='r1'").fetchone()[0] == 1500
    assert db.execute("SELECT COUNT(*) FROM withdrawals").fetchone()[0] == 3
    print("Offline SQLite settlement constraints: PASS")


if __name__ == "__main__":
    demo()
