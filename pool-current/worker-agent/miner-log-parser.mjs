const RATE_RE=new RegExp("\\b([0-9]+(?:\\.[0-9]+)?)\\s*([kmg]?)h/s\\b","i");
const CONNECTED_RE=new RegExp("(?:stratum.*(?:connected|subscribed|authorized)|connected to|login succeeded)","i");
const ACCEPTED_RE=new RegExp("(?:\\baccepted\\s+share(?:\\s*#?\\d+)?\\b|\\bshare\\s+accepted\\b|yay!!!|accepted:\\s*\\d+/\\d+.*(?:yay|yes))","i");
const REJECTED_RE=new RegExp("(?:\\brejected\\s+share(?:\\s*#?\\d+)?\\b|\\bshare\\s+rejected\\b|booooo|accepted:\\s*\\d+/\\d+.*(?:boo|no))","i");
export function parseMinerLine(line){const s=String(line||"");let hashrate=-1;const m=s.match(RATE_RE);if(m){hashrate=Number(m[1]);const unit=String(m[2]||"").toLowerCase();if(unit==="k")hashrate*=1e3;else if(unit==="m")hashrate*=1e6;else if(unit==="g")hashrate*=1e9}return{hashrate,poolConnected:CONNECTED_RE.test(s),accepted:ACCEPTED_RE.test(s),rejected:REJECTED_RE.test(s)}}
