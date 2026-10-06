package com.marsx.worker;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class MinerLogParser {
 private static final Pattern RATE=Pattern.compile("(?i)\\b([0-9]+(?:\\.[0-9]+)?)\\s*([kmg]?)h/s\\b");
 private static final Pattern ACCEPTED=Pattern.compile("(?i)(?:\\baccepted\\s+share(?:\\s*#?\\d+)?\\b|\\bshare\\s+accepted\\b|yay!!!)");
 private static final Pattern REJECTED=Pattern.compile("(?i)(?:\\brejected\\s+share(?:\\s*#?\\d+)?\\b|\\bshare\\s+rejected\\b|booooo)");
 private static final Pattern CONNECTED=Pattern.compile("(?i)(?:stratum.*(?:connected|subscribed|authorized)|connected to|login succeeded)");
 static double hashrate(String line){Matcher m=RATE.matcher(line==null?"":line);if(!m.find())return -1;double v=Double.parseDouble(m.group(1));String u=m.group(2).toLowerCase(Locale.ROOT);if("k".equals(u))v*=1e3;else if("m".equals(u))v*=1e6;else if("g".equals(u))v*=1e9;return v;}
 static boolean accepted(String line){return ACCEPTED.matcher(line==null?"":line).find();}
 static boolean rejected(String line){return REJECTED.matcher(line==null?"":line).find();}
 static boolean connected(String line){return CONNECTED.matcher(line==null?"":line).find();}
 private MinerLogParser(){}
}
