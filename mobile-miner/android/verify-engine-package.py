import hashlib
import pathlib
import re
import subprocess
import sys

engine_dir, client_dir = map(pathlib.Path, sys.argv[1:])
policy = (client_dir / "src/com/marsx/mobileminer/EngineArtifact.java").read_text()
for name, constant in [("libmarsxminer.so", "ENGINE_SHA"), ("libc++_shared.so", "RUNTIME_SHA")]:
    expected = re.search(rf'{constant} = "([a-f0-9]{{64}})"', policy).group(1)
    binary = engine_dir / name
    if hashlib.sha256(binary.read_bytes()).hexdigest() != expected:
        raise SystemExit(f"Unverified artifact: {name}")
    header = subprocess.check_output(["readelf", "-h", str(binary)], text=True)
    if "AArch64" not in header:
        raise SystemExit("Wrong native ABI")
program = subprocess.check_output(["readelf", "-l", str(engine_dir / "libmarsxminer.so")], text=True)
if "/system/bin/linker64" not in program:
    raise SystemExit("Not an Android Bionic executable")
provenance = (engine_dir / "PROVENANCE.txt").read_text()
if "parent_death=SIGKILL" not in provenance:
    raise SystemExit("Missing parent-death process protection")
print("Verified pinned ARM64 Android package artifacts and parent-death provenance.")
