import { cryptoLiveDemo, equityLiveDemo } from "./demo.js";

const mode=process.argv[2] || "crypto";
const result=mode==="equity" ? await equityLiveDemo(process.argv[3] || "AAPL") : await cryptoLiveDemo();
console.log(JSON.stringify(result,null,2));
