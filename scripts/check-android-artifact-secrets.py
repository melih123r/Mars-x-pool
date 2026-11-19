#!/usr/bin/env python3
"""Fail closed on recognizable credentials in built APK/AAB archives.

Heuristic release gate, not proof that arbitrary secrets are absent. Never
print matching bytes, device tokens, keys, or any archive member contents.
"""
import argparse
from pathlib import Path
import re
import tempfile
import zipfile

PATTERNS = (
    ("provider-master-key-identifier", re.compile(rb"PROXIES_SX_(?:FARMER_)?API_KEY")),
    ("provider-key-shaped-value", re.compile(rb"psx_[a-fA-F0-9]{32,}")),
    ("embedded-private-key", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("jwt-shaped-credential", re.compile(rb"eyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}")),
)


def scan_archive(path: Path) -> list[tuple[str, str]]:
    findings: list[tuple[str, str]] = []
    with zipfile.ZipFile(path) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            with archive.open(entry) as stream:
                tail = b""
                while chunk := stream.read(128 * 1024):
                    block = tail + chunk
                    for label, pattern in PATTERNS:
                        if pattern.search(block):
                            findings.append((entry.filename, label))
                    tail = block[-256:]
    return sorted(set(findings))


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="marsx-artifact-check-") as temp:
        path = Path(temp) / "synthetic.apk"
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("classes.dex", b"safe APK fixture")
        assert not scan_archive(path), "Safe synthetic APK was incorrectly blocked"
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("classes.dex", b"prefix psx_0123456789abcdef0123456789abcdef suffix")
        assert any(k == "provider-key-shaped-value" for _, k in scan_archive(path)), "Key fixture not detected"
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("classes.dex", b"prefix PROXIES_SX_FARMER_API_KEY suffix")
        assert any(k == "provider-master-key-identifier" for _, k in scan_archive(path)), "Master-key identifier not detected"
    print("Android packaged-credential scanner self-test: PASS")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path, nargs="?", help="Built .apk or .aab ZIP archive")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    if args.artifact is None:
        if args.self_test:
            return
        parser.error("Provide an APK/AAB or --self-test")
    if args.artifact.suffix.lower() not in {".apk", ".aab"}:
        parser.error("Only APK/AAB archives are accepted")
    if not args.artifact.is_file():
        parser.error("Artifact file does not exist")
    try:
        findings = scan_archive(args.artifact)
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        raise SystemExit(f"Artifact secret scan failed closed: {type(error).__name__}") from None
    if findings:
        for path, label in findings:
            print(f"FAIL: {label} in artifact member {path}")
        raise SystemExit("Do not publish this artifact; investigate securely without dumping binary secrets")
    print("Packaged credential-pattern scan: PASS (heuristic, not exhaustive)")


if __name__ == "__main__":
    main()
