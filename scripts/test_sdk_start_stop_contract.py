#!/usr/bin/env python3
"""Offline reference-model tests, NOT tests of the vendor SDK binary.

Run: python3 -m unittest discover -s scripts -p 'test_sdk_start_stop_contract.py'
The vendor integration remains blocked until equivalent SDK-level tests pass.
"""
import unittest


class StartGate:
    """Desired control-plane invariant: last STOP always wins."""

    def __init__(self):
        self.epoch = 0
        self.consented = False
        self.lease_valid = False
        self.revoked = False
        self.connected = False

    def authorize(self, *, consent, lease):
        self.epoch += 1
        self.consented = consent
        self.lease_valid = lease
        self.revoked = False

    def begin_start(self):
        if not (self.consented and self.lease_valid and not self.revoked):
            return None
        return self.epoch

    def complete_start(self, captured_epoch):
        if (captured_epoch is None or captured_epoch != self.epoch
                or not self.consented or not self.lease_valid or self.revoked):
            return False
        self.connected = True
        return True

    def stop(self):
        self.epoch += 1
        self.connected = False
        self.consented = False

    def revoke(self):
        self.stop()
        self.revoked = True

    def expire_lease(self):
        self.epoch += 1
        self.lease_valid = False
        self.connected = False


class StartStopContractTests(unittest.TestCase):
    def setUp(self):
        self.gate = StartGate()
        self.gate.authorize(consent=True, lease=True)

    def test_delayed_registration_after_stop_must_not_connect(self):
        pending = self.gate.begin_start()
        self.gate.stop()
        self.assertFalse(self.gate.complete_start(pending))
        self.assertFalse(self.gate.connected)

    def test_delayed_refresh_after_revoke_must_not_connect(self):
        pending = self.gate.begin_start()
        self.gate.revoke()
        self.assertFalse(self.gate.complete_start(pending))

    def test_lease_expiry_fences_old_start(self):
        pending = self.gate.begin_start()
        self.gate.expire_lease()
        self.assertFalse(self.gate.complete_start(pending))

    def test_old_start_cannot_override_new_stop(self):
        first = self.gate.begin_start()
        self.gate.stop()
        self.gate.authorize(consent=True, lease=True)
        second = self.gate.begin_start()
        self.assertFalse(self.gate.complete_start(first))
        self.assertTrue(self.gate.complete_start(second))
        self.gate.stop()
        self.assertFalse(self.gate.connected)

    def test_no_consent_or_no_lease_blocks_start(self):
        for consent, lease in ((False, True), (True, False), (False, False)):
            with self.subTest(consent=consent, lease=lease):
                self.gate.authorize(consent=consent, lease=lease)
                self.assertIsNone(self.gate.begin_start())

    def test_revoke_blocks_new_start(self):
        self.gate.revoke()
        self.assertIsNone(self.gate.begin_start())



class UnsafeStartGate:
    """Minimal reproduction of vendor's unguarded late service start."""

    def __init__(self):
        self.connected = False

    def complete_start(self):
        self.connected = True

    def stop(self):
        self.connected = False


class ContractSensitivityTests(unittest.TestCase):
    def test_unguarded_late_start_violates_last_stop_wins(self):
        unsafe = UnsafeStartGate()
        unsafe.stop()
        unsafe.complete_start()
        self.assertTrue(unsafe.connected, "The unsafe sequence must reproduce the violation")

    def test_fenced_model_rejects_same_late_completion(self):
        safe = StartGate()
        safe.authorize(consent=True, lease=True)
        token = safe.begin_start()
        safe.stop()
        self.assertFalse(safe.complete_start(token))
        self.assertFalse(safe.connected)

if __name__ == '__main__':
    unittest.main()
