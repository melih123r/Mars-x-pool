export const MINING_CATALOG = Object.freeze({
  VRSC: {asset:"VRSC", class:"arm_cpu", algorithm:"VerusHash", mode:"external_worker", enabled:false, reason:"provider_adapter_required"},
  XMR: {asset:"XMR", class:"cpu", algorithm:"RandomX", mode:"external_worker", enabled:false, reason:"provider_adapter_required"},
  QUBIC: {asset:"QUBIC", class:"cpu_gpu", algorithm:"UPoW", mode:"external_worker", enabled:false, reason:"provider_adapter_required"},
  ZEPH: {asset:"ZEPH", class:"cpu", algorithm:"RandomX", mode:"external_worker", enabled:false, reason:"provider_adapter_required"},
  LTC: {asset:"LTC", class:"scrypt_asic", algorithm:"Scrypt", mode:"external_worker", enabled:false, reason:"viabtc_runtime_required"},
  DOGE: {asset:"DOGE", class:"scrypt_asic", algorithm:"Scrypt", mode:"external_worker", enabled:false, reason:"viabtc_runtime_required"}
});

export function publicMiningCatalog() {
  return Object.values(MINING_CATALOG).map(x=>({...x}));
}

export function routeMiningWork(device, catalog=MINING_CATALOG) {
  const candidates=[];
  if (device?.scryptAsic) candidates.push("LTC","DOGE");
  if (device?.gpu) candidates.push("QUBIC");
  if (device?.cpu) candidates.push("XMR","ZEPH","QUBIC");
  if (device?.arm) candidates.unshift("VRSC");
  return [...new Set(candidates)].map(asset=>catalog[asset]).filter(Boolean);
}

export function assertUserVisibleMining(asset, catalog=MINING_CATALOG) {
  const item=catalog[asset];
  if (!item) throw new Error("unsupported mining asset");
  if (!item.enabled) throw new Error(`${asset} is not live: ${item.reason}`);
  return item;
}
