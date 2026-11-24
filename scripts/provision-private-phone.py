#!/usr/bin/env python3
"""Install the operator credential over an already-authorized USB adb connection."""
import argparse
import ipaddress
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--serial", required=True)
parser.add_argument("--key-file", required=True, type=Path)
parser.add_argument("--test-ip", type=ipaddress.IPv4Address)
args = parser.parse_args()
if args.test_ip and (not args.test_ip.is_global or args.test_ip.is_multicast or args.test_ip.is_reserved):
    parser.error("Expected the public IPv4 address of the operator test destination")
if args.key_file.stat().st_mode & 0o077:
    parser.error("Restrict the key file to its owner")
key = args.key_file.read_bytes().strip()
if not re.fullmatch(rb"psx_[A-Za-z0-9_-]{8,240}", key):
    parser.error("Unexpected key format")
adb = ["adb", "-s", args.serial]
def run(*command, data=None):
    return subprocess.run(adb + list(command), input=data, capture_output=True, check=True).stdout.strip()
if not run("get-devpath").startswith(b"usb:"):
    parser.error("Select the owner's USB-connected phone")
package = "com.marsx.pool"
installed = run("shell", "dumpsys", "package", package)
if b"0.9.4-network-pilot-private" not in installed:
    parser.error("Install the private pilot variant first")
run("shell", "am", "force-stop", package)
def write(name, data):
    # No credential in shell arguments, terminal output or shared device storage.
    run("shell", "-T", "run-as", package, "sh", "-c",
        "'umask 077; mkdir -p no_backup && cat > no_backup/" + name +
        ".new && mv no_backup/" + name + ".new no_backup/" + name + "'", data=data)
run("shell", "run-as", package, "rm", "-f", "no_backup/operator-test-ip")
if args.test_ip:
    write("operator-test-ip", str(args.test_ip).encode())
write("operator-key", key)
print("Provisioned. Sharing requires consent and Start on the phone.")
