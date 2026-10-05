import hashlib
import pathlib
import re
import subprocess
import sys

engine_dir, client_dir = map(pathlib.Path, sys.argv[1:])
policy = (client_dir / "src/com/marsx/mobileminer/EngineArtifact.java").read_text()
for name, constant in [("libmarsxminer.so", "ENGINE_SHA")]:
    expected = re.search(rf'{constant} = "([a-f0-9]{{64}})"', policy).group(1)
    binary = engine_dir / name
    if hashlib.sha256(binary.read_bytes()).hexdigest() != expected:
        raise SystemExit(f"Unverified artifact: {name}")
    header = subprocess.check_output(["readelf", "-h", str(binary)], text=True)
    if "AArch64" not in header:
        raise SystemExit("Wrong native ABI")
dynamic = subprocess.check_output(["readelf", "-d", str(engine_dir / "libmarsxminer.so")], text=True)
needed = re.findall(r"Shared library: \[([^]]+)\]", dynamic)
if set(needed) - {"libc.so", "libm.so", "libdl.so", "liblog.so", "libz.so"}:
    raise SystemExit("Unexpected non-system dynamic dependency")
program = subprocess.check_output(["readelf", "-l", str(engine_dir / "libmarsxminer.so")], text=True)
wide = subprocess.check_output(["readelf", "-Wl", str(engine_dir / "libmarsxminer.so")], text=True)
for line in wide.splitlines():
    fields = line.split()
    if fields and fields[0] == "LOAD" and int(fields[-1], 16) < 16384:
        raise SystemExit("Native load segment is not 16 KB aligned")
    if fields and fields[0] == "GNU_RELRO" and (int(fields[2], 16) + int(fields[5], 16)) % 16384:
        raise SystemExit("Native RELRO segment is not 16 KB aligned")
if "/system/bin/linker64" not in program:
    raise SystemExit("Not an Android Bionic executable")
provenance = (engine_dir / "PROVENANCE.txt").read_text()
if "parent_death=SIGKILL" not in provenance:
    raise SystemExit("Missing parent-death process protection")
print("Verified pinned ARM64 Android package artifacts and parent-death provenance.")
