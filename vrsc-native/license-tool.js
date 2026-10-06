import { createHmac, randomBytes } from "node:crypto";

const pepper = process.env.LICENSE_PEPPER || "";
if (pepper.length < 32) {
  console.error("Set LICENSE_PEPPER to a random secret of at least 32 characters.");
  process.exit(1);
}

const raw = randomBytes(12).toString("hex").toUpperCase();
const key = `MARSX-${raw.match(/.{1,4}/g).join("-")}`;
const keyHash = createHmac("sha256", pepper).update(key).digest("hex");
const record = {
  id: `lic_${randomBytes(6).toString("hex")}`,
  keyHash,
  status: "active",
  expiresAt: null,
  maxDevices: 1,
};

console.log("LICENSE KEY (show to the authorised user once):");
console.log(key);
console.log("\nAPPEND THIS RECORD TO LICENSE_RECORDS_JSON:");
console.log(JSON.stringify(record));
