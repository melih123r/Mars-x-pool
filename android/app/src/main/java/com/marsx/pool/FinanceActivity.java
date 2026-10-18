package com.marsx.pool;

import android.app.*;import android.content.*;import android.graphics.*;import android.graphics.drawable.*;import android.os.*;import android.view.*;import android.widget.*;import org.json.*;import java.io.*;import java.net.*;import java.nio.charset.StandardCharsets;import java.util.*;

public final class FinanceActivity extends Activity{
 LinearLayout root; TextView result,status,brokerStatus,marketPrice,marketProviders,demoWalletSummary; ChartView chartView; final ArrayList<ChartView> comparisonCharts=new ArrayList<>(); Spinner marketAsset,marketTimeframe; EditText amount; Spinner from,to,fromNet,toNet; int ACCENT=Color.rgb(255,106,0),BG=Color.rgb(4,7,12),CARD=Color.rgb(10,14,22),RAISED=Color.rgb(15,20,31),MUTED=Color.rgb(158,169,188); final int[] THEMES={Color.rgb(0,194,255),Color.rgb(50,134,255),Color.rgb(185,60,255),Color.rgb(255,182,55),Color.rgb(42,207,129)}; int themeIndex=0; final Handler refreshHandler=new Handler(Looper.getMainLooper()); boolean screenActive=false; boolean tradingScreenVisible=false; String displayedChartKey="";int chartRequestGeneration=0; int quoteRequestGeneration=0; int marketListRequestGeneration=0; final Runnable refreshTick=new Runnable(){public void run(){if(screenActive&&tradingScreenVisible){chartSnapshot();for(ChartView extra:comparisonCharts)if(!extra.drawingSymbol.isEmpty())loadComparisonCrypto(extra,extra.drawingSymbol);refreshHandler.postDelayed(this,60000);}}};
 @Override protected void onResume(){super.onResume();screenActive=true;refreshHandler.removeCallbacks(refreshTick);if(tradingScreenVisible){refreshHandler.postDelayed(refreshTick,60000);if(chartView!=null){chartSnapshot();for(ChartView extra:comparisonCharts)if(!extra.drawingSymbol.isEmpty())loadComparisonCrypto(extra,extra.drawingSymbol);}}}
 @Override protected void onPause(){screenActive=false;chartRequestGeneration++;quoteRequestGeneration++;marketListRequestGeneration++;refreshHandler.removeCallbacks(refreshTick);super.onPause();}
 @Override public void onCreate(Bundle b){super.onCreate(b);requestWindowFeature(Window.FEATURE_NO_TITLE);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);themeIndex=getPreferences(MODE_PRIVATE).getInt("theme",0);if(themeIndex<0||themeIndex>=THEMES.length)themeIndex=0;ACCENT=THEMES[themeIndex];restorePaperState();restoreDemoConversionBalances();build();}
 void build(){displayedChartKey="";comparisonCharts.clear();tradingScreenVisible=true;chartRequestGeneration++;quoteRequestGeneration++;marketListRequestGeneration++;refreshHandler.removeCallbacks(refreshTick);if(screenActive)refreshHandler.postDelayed(refreshTick,60000);if(root!=null)root=null;ScrollView s=new ScrollView(this);root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(28,24,28,34);root.setBackgroundColor(BG);
  rowTitle(); themePicker(); visualHero(); balanceCard(); cardHeader(); selectors(); quoteInfo(); popularPairs(); marketCard(); brokerCard(); nav(); s.addView(root);setContentView(s); health(); brokerHealth(); marketProviders(); chartSnapshot();
 }
 void rowTitle(){LinearLayout r=row();LinearLayout brand=new LinearLayout(this);brand.setOrientation(LinearLayout.VERTICAL);TextView logo=t("MARS-X",26,Color.WHITE);logo.setTypeface(null,Typeface.BOLD);logo.setLetterSpacing(.04f);oneLine(logo);brand.addView(logo);TextView sub=t("Dönüştür",13,ACCENT);sub.setTypeface(null,Typeface.BOLD);sub.setLetterSpacing(.08f);oneLine(sub);brand.addView(sub);r.addView(brand,new LinearLayout.LayoutParams(0,-2,1));status=t("● Bağlanıyor",12,MUTED);oneLine(status);status.setBackground(pill(Color.rgb(16,20,30),ACCENT));status.setPadding(14,10,14,10);r.addView(status);root.addView(r);}
 void visualHero(){LinearLayout c=card();c.setPadding(0,0,0,0);c.setBackground(panel(Color.rgb(7,11,19),26,ACCENT));MarsFinanceHero hero=new MarsFinanceHero(this);hero.accent=ACCENT;c.addView(hero,new LinearLayout.LayoutParams(-1,230));root.addView(c,mp(14));}
 void balanceCard(){LinearLayout c=card();c.setBackground(panel(RAISED,22,Color.rgb(37,48,66)));TextView h=t("MEVCUT BAKİYE",11,MUTED);h.setLetterSpacing(.08f);c.addView(h);TextView v=t("—",34,Color.WHITE);v.setTypeface(null,Typeface.BOLD);c.addView(v);c.addView(t("Önizleme modu • doğrulanmış bakiye gelmeden değer gösterilmez",12,MUTED));demoWalletSummary=t(demoBalanceSummary(DEMO_CONVERSION_ASSETS),12,ACCENT);c.addView(demoWalletSummary,mp(8));LinearLayout r=row();metricCard(r,"24s Hacim","—","canlı veri");metricCard(r,"Risk","Kilitli","SCA/KYC");metricCard(r,"API","Read","quote only");c.addView(r,mp(12));root.addView(c,mp(12));}
 void themePicker(){LinearLayout r=row();String[] n={"Klasik","Uzay","Neon","Altın","Orman"};for(int i=0;i<n.length;i++){final int k=i;Button b=new Button(this);b.setText(n[i]);b.setTextSize(12);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setMinWidth(0);b.setMinHeight(56);b.setPadding(4,4,4,4);b.setBackground(pill(k==themeIndex?THEMES[i]:Color.rgb(14,18,28),THEMES[i]));b.setOnClickListener(v->{themeIndex=k;ACCENT=THEMES[k];getPreferences(MODE_PRIVATE).edit().putInt("theme",k).apply();build();root.setAlpha(0f);root.animate().alpha(1f).setDuration(260).start();});r.addView(b,new LinearLayout.LayoutParams(0,(int)(56*getResources().getDisplayMetrics().density),1));}root.addView(r,mp(10));}
 void metricCard(LinearLayout r,String label,String value,String note){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(16,14,16,14);c.setBackground(round(Color.rgb(10,14,24),18));TextView l=t(label,10,MUTED);l.setLetterSpacing(.06f);c.addView(l);TextView val=t(value,20,Color.WHITE);val.setTypeface(null,Typeface.BOLD);c.addView(val);c.addView(t(note,10,MUTED));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(4,0,4,0);r.addView(c,p);}
 void cardHeader(){LinearLayout c=card();c.setBackground(panel(CARD,22,ACCENT));TextView h=t("KRİPTO DÖNÜŞTÜR",13,ACCENT);h.setLetterSpacing(.10f);h.setTypeface(null,Typeface.BOLD);c.addView(h);c.addView(t("Hızlı, güvenli ve en iyi oran önizlemesi",12,MUTED));root.addView(c,mp(14));}
 void selectors(){LinearLayout c=(LinearLayout)root.getChildAt(root.getChildCount()-1);String[] assets={"BTC · Bitcoin","ETH · Ethereum","USDT · Tether","SOL · Solana","BNB · BNB","DOGE · Dogecoin"};c.addView(label("Gönderilecek Coin"));from=spin(assets,0);c.addView(from);c.addView(label("Dönüştürülecek Miktar"));amount=new EditText(this);amount.setText("0.01");amount.setTextColor(Color.WHITE);amount.setTextSize(29);amount.setTypeface(null,Typeface.BOLD);amount.setInputType(2|8192);amount.setBackground(box());amount.setPadding(22,20,22,20);c.addView(amount,mp(6));c.addView(label("Ağ Seçimi"));fromNet=spin(new String[]{"Bitcoin (BTC)","Ethereum (ERC20)","Solana","BNB Smart Chain"},0);c.addView(fromNet);TextView swap=t("⇅",34,ACCENT);swap.setGravity(Gravity.CENTER);swap.setTypeface(null,Typeface.BOLD);c.addView(swap);c.addView(label("Alınacak Coin"));to=spin(assets,1);c.addView(to);c.addView(label("Ağ Seçimi"));toNet=spin(new String[]{"Ethereum (ERC20)","Bitcoin (BTC)","Solana","BNB Smart Chain"},0);c.addView(toNet);
  LinearLayout stats=row();metricCard(stats,"Piyasa Oranı","—","provider quote");metricCard(stats,"Ağ Ücreti","—","estimate");c.addView(stats,mp(12));LinearLayout stats2=row();metricCard(stats2,"Min. Tutar","—","route gate");metricCard(stats2,"Geçerlilik","10 dk","preview");c.addView(stats2,mp(8));
  fromNet.setEnabled(false);toNet.setEnabled(false);c.addView(t("Ağ seçimi henüz sağlayıcı tarafından doğrulanmadı; yanlış ağa transfer yapılmasını önlemek için devre dışı.",11,MUTED));
  Button q=new Button(this);q.setText("Fiyat Teklifi Al (İşlem Yok)");q.setTextSize(18);q.setTypeface(null,Typeface.BOLD);q.setTextColor(Color.BLACK);q.setBackground(round(ACCENT,18));q.setOnClickListener(v->quote());c.addView(q,mp(16));Button demo=new Button(this);demo.setText("Demo bakiyeleri ve çevrim (Sanal)");demo.setOnClickListener(v->demoConversionDialog());c.addView(demo,mp(8));result=t("Bu ekran önizleme modundadır. Gerçek işlem oluşturulmaz.",14,Color.LTGRAY);c.addView(result);
 }

 final DemoConversionLedger demoConversionLedger=createDemoConversionLedger();
 static DemoConversionLedger createDemoConversionLedger(){
  DemoConversionLedger ledger=new DemoConversionLedger();
  ledger.setBalance("BTC",new java.math.BigDecimal("1"));
  ledger.setBalance("ETH",new java.math.BigDecimal("10"));
  ledger.setBalance("USDT",new java.math.BigDecimal("1000"));
  return ledger;
 }
 private static final String[] DEMO_CONVERSION_ASSETS={"BTC","ETH","USDT","SOL","BNB","DOGE"};
 void restoreDemoConversionBalances(){
  android.content.SharedPreferences prefs=getPreferences(MODE_PRIVATE);
  java.util.Map<String,java.math.BigDecimal> candidate=new java.util.HashMap<>(demoConversionLedger.snapshot());
  try{
   for(String asset:DEMO_CONVERSION_ASSETS){
    String stored=prefs.getString("demo_conversion_balance_"+asset,null);
    if(stored==null)continue;
    java.math.BigDecimal value=new java.math.BigDecimal(stored);
    if(value.signum()<0)throw new IllegalArgumentException("negative saved demo balance");
    candidate.put(asset,value);
   }
   demoConversionLedger.restore(candidate); // All-or-nothing; never partially load corrupted local state.
  }catch(RuntimeException ignored){/* Preserve initial demo balances on invalid saved state. */}
 }
 boolean saveDemoConversionBalances(){
  android.content.SharedPreferences.Editor editor=getPreferences(MODE_PRIVATE).edit();
  for(String asset:DEMO_CONVERSION_ASSETS)
   editor.putString("demo_conversion_balance_"+asset,demoConversionLedger.balance(asset).toPlainString());
  return editor.commit(); // Do not report a persisted demo conversion before the write succeeds.
 }
 String demoBalanceSummary(String[] assets){
  StringBuilder b=new StringBuilder("SANAL BAKİYELER\n");
  for(String asset:assets)b.append(asset).append(": ").append(demoConversionLedger.balance(asset).stripTrailingZeros().toPlainString()).append("  ");
  return b.toString();
 }
 static java.math.BigDecimal parseDemoDecimal(String raw){
  if(raw==null)throw new IllegalArgumentException("missing demo decimal");
  String value=raw.trim();
  if(value.isEmpty()||value.indexOf(',')>=0&&value.indexOf('.')>=0)throw new IllegalArgumentException("ambiguous demo decimal");
  if(value.indexOf(',')>=0)value=value.replace(',', '.');
  if(!value.matches("[+-]?[0-9]+(\\.[0-9]+)?"))throw new IllegalArgumentException("invalid demo decimal");
  return new java.math.BigDecimal(value);
 }
 void demoConversionDialog(){
  final String[] assets={"BTC","ETH","USDT","SOL","BNB","DOGE"};
  final DemoConversionLedger ledger=demoConversionLedger;
  final LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(22,8,22,8);
  form.addView(t("SANAL BAKİYE • Bu cihazda saklanır; gerçek cüzdan değildir.",13,ACCENT));
  final TextView balances=t(demoBalanceSummary(assets),13,Color.WHITE);form.addView(balances);
  final Spinner source=spin(assets,0),target=spin(assets,1);
  form.addView(t("Kaynak",12,MUTED));form.addView(source);
  form.addView(t("Hedef",12,MUTED));form.addView(target);
  final EditText qty=new EditText(this);qty.setHint("Miktar (örn. 0.1)");qty.setInputType(2|8192);form.addView(qty);
  final EditText rate=new EditText(this);rate.setHint("Sanal kur: 1 kaynak = ? hedef");rate.setInputType(2|8192);form.addView(rate);
  form.addView(t("Kur elle girilir; canlı veya doğrulanmış fiyat değildir. Demo komisyonu %0,1.",12,MUTED));
  final TextView feedback=t("Henüz demo işlem yapılmadı.",13,Color.WHITE);form.addView(feedback);
  final ScrollView conversionScroll=new ScrollView(this);
  conversionScroll.setFillViewport(false);
  conversionScroll.addView(form);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle("MARS-X • Demo dönüştür").setView(conversionScroll).setNegativeButton("Kapat",null).create();
  final Button execute=new Button(this);execute.setText("Sanal dönüşüm yap");form.addView(execute);
  execute.setOnClickListener(v->{
   java.util.Map<String,java.math.BigDecimal> before=ledger.snapshot();
   try{
    java.math.BigDecimal amountValue=parseDemoDecimal(qty.getText().toString());
    java.math.BigDecimal rateValue=parseDemoDecimal(rate.getText().toString());
    String fromAsset=source.getSelectedItem().toString(),toAsset=target.getSelectedItem().toString();
    java.math.BigDecimal received=ledger.convert(fromAsset,toAsset,amountValue,rateValue,new java.math.BigDecimal("0.001"));
    if(!saveDemoConversionBalances()){
     ledger.restore(before);
     feedback.setText("Demo işlem kaydedilemedi; sanal bakiyeler değiştirilmedi.");
     return;
    }
    balances.setText(demoBalanceSummary(assets));
    if(demoWalletSummary!=null)demoWalletSummary.setText(demoBalanceSummary(DEMO_CONVERSION_ASSETS));
    feedback.setText("DEMO: "+amountValue.toPlainString()+" "+fromAsset+" → "+received.stripTrailingZeros().toPlainString()+" "+toAsset);
   }catch(Exception e){
    ledger.restore(before); // Exception-safe rollback, including SharedPreferences failures.
    balances.setText(demoBalanceSummary(assets));
    if(demoWalletSummary!=null)demoWalletSummary.setText(demoBalanceSummary(DEMO_CONVERSION_ASSETS));
    feedback.setText("Demo işlem reddedildi veya kaydedilemedi; sanal bakiyeler korunuyor.");
   }
  });
  dialog.show();
 }
 void quoteInfo(){LinearLayout c=card();c.addView(t("Hizmet Durumu",12,ACCENT));c.addView(t("Dönüşüm fiyat önizlemesi • Gerçek işlem kapalı",12,MUTED));String[] f={"✓ Fiyat önizlemesi","✓ Gerçek emir kapalı","✓ Gerçek swap kapalı","✓ Çekim kapalı","✓ Demo bakiye ayrıdır","✓ Fiyat garantisi yok"};for(int i=0;i<3;i++){LinearLayout r=row();feature(r,f[i*2]);feature(r,f[i*2+1]);c.addView(r,mp(4));}root.addView(c,mp(12));}
 void popularPairs(){LinearLayout c=card();c.addView(t("POPÜLER ÇİFTLER",12,ACCENT));String[] pairs={"BTC  ›  ETH","ETH  ›  USDT","BNB  ›  USDT","SOL  ›  USDT","USDT  ›  TRX"};for(String pair:pairs){TextView p=t(pair+"        veri bekleniyor",14,Color.WHITE);p.setBackground(pill(Color.rgb(12,17,27),Color.rgb(35,45,62)));p.setPadding(16,10,16,10);c.addView(p,mp(6));}root.addView(c,mp(12));}
 void brokerCard(){LinearLayout c=card();c.addView(t("SİSTEM DURUMU",12,ACCENT));brokerStatus=t("Broker durumu kontrol ediliyor…",13,MUTED);c.addView(brokerStatus);c.addView(t("İşlem modu: Önizleme • canlı emir ve çekim kapalı",12,MUTED));financeAction(c,"Demo emir hesaplayıcı",()->brokerDemo());financeAction(c,"Demo emir paneli",()->paperOrderDialog());financeAction(c,"Demo portföy ve emirler",()->paperDashboard());root.addView(c,mp(12));}
 void marketCard(){LinearLayout c=card();c.addView(t("MARS-X Finance • Grafik Önizleme • DEMO / Salt Okunur",12,ACCENT));c.addView(t("PİYASA ÖZETİ",12,ACCENT));marketPrice=t("BTC / USD     —     veri bekleniyor",18,Color.WHITE);marketPrice.setTypeface(null,Typeface.BOLD);oneLine(marketPrice);c.addView(marketPrice);marketAsset=spin(new String[]{"BTC-USD","ETH-USD","SOL-USD","DOGE-USD","LTC-USD","AVAX-USD","ADA-USD","XRP-USD","LINK-USD","DOT-USD","BCH-USD","XLM-USD","UNI-USD","AAVE-USD","ATOM-USD","NEAR-USD","FIL-USD","ETC-USD","ALGO-USD","ICP-USD","HBAR-USD","SUI-USD","APT-USD","OP-USD","ARB-USD","INJ-USD","SEI-USD","TIA-USD","STX-USD","IMX-USD","GRT-USD","CRV-USD","COMP-USD","SNX-USD","SUSHI-USD","YFI-USD","LDO-USD","RENDER-USD","FET-USD","RLC-USD","ZEC-USD","DASH-USD","BAT-USD","ZRX-USD","MANA-USD","SAND-USD","AXS-USD","CHZ-USD","FLOW-USD","MINA-USD","KAVA-USD","ROSE-USD","OXT-USD","ANKR-USD","SKL-USD","CVC-USD","UMA-USD","API3-USD","BAND-USD","NMR-USD","AUDIO-USD","MASK-USD","1INCH-USD","BAL-USD","CTSI-USD","COTI-USD","ACH-USD","AMP-USD","SPELL-USD","JASMY-USD","SHIB-USD","PEPE-USD","BONK-USD","FLOKI-USD","WIF-USD","TRUMP-USD","PENGU-USD","WLD-USD","PYTH-USD","JTO-USD","RAY-USD","ORCA-USD","GMT-USD","GST-USD","ENS-USD","BLUR-USD","LPT-USD","BNT-USD","KNC-USD","ZEN-USD","NKN-USD","CELR-USD","DNT-USD","REQ-USD","POL-USD","XTZ-USD","BNB-USD","TON-USD","VET-USD","EGLD-USD","KSM-USD","CAKE-USD","OSMO-USD","AAPL","MSFT","NVDA","TSLA","SPY","AMZN","GOOGL","GOOG","META","NFLX","AMD","INTC","AVGO","ORCL","CRM","ADBE","QCOM","TXN","MU","AMAT","ASML","IBM","CSCO","NOW","PLTR","UBER","ABNB","SHOP","PYPL","COIN","HOOD","JPM","BAC","WFC","GS","MS","C","V","MA","AXP","BRK-B","UNH","JNJ","PFE","MRK","ABBV","LLY","TMO","ABT","MDT","ISRG","NVO","WMT","COST","TGT","HD","LOW","NKE","MCD","SBUX","KO","PEP","PG","CL","DIS","CMCSA","T","VZ","TMUS","BA","CAT","DE","GE","HON","LMT","RTX","NOC","F","GM","RIVN","LCID","XOM","CVX","COP","SLB","OXY","EOG","NEM","FCX","GLD","SLV","USO","IWM","QQQ","DIA","VOO","VTI","XLK","XLF","XLE","XLI","XLY","XLP","XLU","XLV","XLB","ARKK","TLT","IEF","HYG","LQD","EEM","EFA","EWJ","FXI","BABA","PDD","JD","BIDU","TSM","SAP","SONY","RY","TD","BMO","ENB","SU","BP","SHEL","RIO","BHP","VALE","FX:EUR/USD","FX:GBP/USD","FX:USD/JPY","INDEX:SP500","INDEX:NASDAQ","INDEX:DOW","CMD:GOLD","CMD:SILVER","TRX-USD","XMR-USD","XDC-USD","KAS-USD","QNT-USD","GALA-USD","IOTA-USD","ZIL-USD","RVN-USD","DGB-USD","WAVES-USD","ENJ-USD","HOT-USD","SXP-USD","ONT-USD","ICX-USD","AR-USD","JUP-USD","PENDLE-USD","STRK-USD","FX:EUR/GBP","FX:EUR/JPY","FX:EUR/CHF","FX:EUR/AUD","FX:EUR/CAD","FX:EUR/NZD","FX:GBP/JPY","FX:GBP/CHF","FX:GBP/AUD","FX:GBP/CAD","FX:AUD/USD","FX:NZD/USD","FX:USD/CHF","FX:USD/CAD","FX:USD/CNH","FX:USD/SEK","FX:USD/NOK","FX:USD/DKK","FX:USD/PLN","FX:USD/TRY","FX:USD/MXN","FX:USD/ZAR","FX:USD/SGD","FX:USD/HKD","FX:USD/INR","FX:USD/BRL","FX:USD/KRW","FX:USD/THB","FX:AUD/JPY","FX:CAD/JPY","FX:CHF/JPY","FX:NZD/JPY","FX:AUD/NZD","FX:EUR/TRY","FX:GBP/TRY","FX:EUR/PLN","FX:EUR/SEK","INDEX:DAX40","INDEX:FTSE100","INDEX:CAC40","INDEX:EUROSTOXX50","INDEX:NIKKEI225","INDEX:TOPIX","INDEX:HANGSENG","INDEX:CSI300","INDEX:ASX200","INDEX:IBEX35","INDEX:FTSEMIB","INDEX:SMI","INDEX:TSX","INDEX:BIST100","INDEX:RUSSELL2000","INDEX:VIX","CMD:BRENT","CMD:NATGAS","CMD:COPPER","CMD:PLATINUM","CMD:PALLADIUM","CMD:ALUMINUM","CMD:NICKEL","CMD:ZINC","CMD:WHEAT","CMD:CORN","CMD:SOYBEANS","CMD:COFFEE","CMD:COCOA","CMD:SUGAR","CMD:COTTON","CMD:LIVE_CATTLE","VUG","VTV","SCHD","VIG","JEPI","JEPQ","BND","AGG","TIP","SHY","SGOV","BIL","VGK","VEA","VWO","IEMG","INDA","EWG","EWU","EWQ","EWT","EWZ","EWC","EWA","XBI","SMH","SOXX","XRT","XHB","KRE","VNQ","REET","DBC","PDBC","UNG","GDX","GDXJ","ARKG","ARKW","ARKF","DHR","SYK","BSX","VRTX","REGN","GILD","AMGN","BIIB","PANW","CRWD","FTNT","DDOG","NET","SNOW","MDB","ZS","TEAM","HUBS","DELL","HPQ","LEN","DHI","NEE","DUK","SO","AEP","LIN","APD","ECL","WM","UPS","FDX","BKNG","MAR","HLT","DAL","UAL","AAL","RCL","CCL","NCLH","FX:EUR/NOK","FX:EUR/DKK","FX:EUR/CZK","FX:EUR/HUF","FX:EUR/RON","FX:EUR/ZAR","FX:EUR/MXN","FX:GBP/NZD","FX:GBP/SEK","FX:GBP/NOK","FX:GBP/PLN","FX:GBP/ZAR","FX:AUD/CAD","FX:AUD/CHF","FX:AUD/SGD","FX:CAD/CHF","FX:CAD/SGD","FX:NZD/CAD","FX:NZD/CHF","FX:NZD/SGD","FX:CHF/SGD","FX:USD/CZK","FX:USD/HUF","FX:USD/RON","FX:USD/ILS","FX:USD/AED","FX:USD/SAR","FX:USD/TWD","FX:USD/IDR","FX:USD/PHP","FX:USD/MYR","FX:USD/CLP","FX:USD/COP","FX:USD/PEN","FX:USD/ARS","FX:USD/EGP","INDEX:KOSPI200","INDEX:NIFTY50","INDEX:SENSEX","INDEX:TAIEX","INDEX:SET50","INDEX:IPC_MEXICO","INDEX:IBOVESPA","INDEX:OMX30","INDEX:ATX","INDEX:AEX","CMD:HEATING_OIL","CMD:GASOLINE","CMD:URANIUM","CMD:IRON_ORE","CMD:RICE","CMD:OATS","CMD:ORANGE_JUICE","CMD:LUMBER","CMD:LEAN_HOGS","CMD:FEEDER_CATTLE","CMD:CANOLA","CMD:RUBBER","XRP-EUR","BTC-EUR","ETH-EUR","SOL-EUR","DOGE-EUR","ADA-EUR","LTC-EUR","AVAX-EUR","LINK-EUR","DOT-EUR","BTC-USDT","ETH-USDT","SOL-USDT","XRP-USDT","DOGE-USDT","ADA-USDT","LTC-USDT","BNB-USDT","AVAX-USDT","LINK-USDT","BTC-GBP","ETH-GBP","SOL-GBP","XRP-GBP","ETH-USDC","SOL-USDC","XRP-USDC","DOGE-USDC","ADA-USDC","BTC-DAI","ETH-DAI","SOL-BTC","ETH-BTC","XRP-BTC","ADA-BTC","LINK-BTC","LTC-BTC","DOGE-BTC","AVAX-BTC","FX:EUR/CNH","FX:GBP/CNH","FX:AUD/CNH","FX:USD/VND","FX:USD/PKR","FX:USD/BDT","FX:USD/KES","FX:USD/NGN","FX:USD/GHS","FX:USD/MAD","FX:USD/TND","FX:USD/UAH","FX:USD/KZT","FX:USD/UZS","FX:EUR/UAH","FX:EUR/ILS","FX:EUR/AED","FX:EUR/SAR","FX:GBP/AED","FX:GBP/SAR","FX:USD/BGN","FX:EUR/BGN","FX:EUR/RSD","FX:EUR/ALL","FX:EUR/BAM","INDEX:FTSE250","INDEX:FTSEALLSHARE","INDEX:NASDAQ100","INDEX:NASDAQCOMPOSITE","INDEX:SP400","INDEX:SP600","INDEX:EUROSTOXX600","INDEX:MDAX","INDEX:SDAX","INDEX:TECDAX","INDEX:FTSECHINA50","INDEX:HSCEI","INDEX:KOSPI","INDEX:NIFTYBANK","INDEX:SMALLCAP2000","CMD:WTI","CMD:TTF_GAS","CMD:EU_CARBON","CMD:CARBON_CREDIT","CMD:LITHIUM","CMD:COBALT","CMD:STEEL","CMD:ETHANOL","CMD:PALM_OIL","CMD:SOYBEAN_MEAL","CMD:SOYBEAN_OIL","CMD:ROUGH_RICE","CMD:FEED_WHEAT","CMD:OAT_FUTURES","CMD:WHITE_SUGAR","CMD:ROBUSTA_COFFEE","CMD:ARABICA_COFFEE","CMD:BRENT_CRUDE","CMD:URANIUM_OXIDE","CMD:PROPANE","IWF","IWD","IJH","IJR","VB","VO","VBR","VOT","VXF","VT","ACWI","URTH","IOO","QUAL","MTUM","USMV","SPLV","RSP","SPYG","SPYV","QQQM","TQQQ","SQQQ","SPXL","SPXS","SOXL","SOXS","TNA","TZA","XOP","OIH","XME","XSD","ITA","IYT","IGV","SKYY","CLOU","BOTZ","ROBO","ICLN","TAN","FAN","LIT","REMX","COPX","URA","URNM","PICK","SIL","SLX","PPLT","PALL","DBA","WEAT","CORN","SOYB","JO","NIB","BAL","BKLN","EMB","VWOB","VCIT","VCSH","VCLT","MUB","HYD","JNK","BNDX","IGOV","GOVT","SCHO","SCHR","SCHZ","SCHP","TLH","EDV","ZROZ","KWEB","CQQQ","MCHI","ASHR","EWH","EWS","EIDO","EPHE","EWW","EZA","TUR","GREK","EIS","ARGT","ECH","EPU","THD","VNM","FM","FRDM","GXC","KSA","UAE","QAT","EIRL","EWL","EWN","EWP","EWI","EWD","EWO","EWM","XAR","PAVE","IFRA","CIBR","HACK","BUG","IBB","ARKQ","ARKX","FX:USD/JOD","FX:USD/BHD","FX:USD/KWD","FX:USD/OMR","FX:USD/QAR","FX:USD/LBP","FX:USD/IQD","FX:USD/ISK","FX:USD/GEL","FX:USD/AMD","FX:USD/AZN","FX:USD/CRC","FX:USD/DOP","FX:USD/GTQ","FX:USD/HNL","FX:USD/NIO","FX:USD/PYG","FX:USD/UYU","FX:USD/BOB","FX:USD/BBD","FX:USD/JMD","FX:USD/TTD","FX:USD/XOF","FX:USD/XAF","FX:USD/UGX","FX:USD/TZS","FX:USD/RWF","FX:USD/ETB","FX:USD/MUR","FX:USD/MZN","FX:USD/BWP","FX:USD/NAD","FX:USD/ZMW","FX:USD/MWK","FX:USD/BIF","FX:USD/AFN","FX:USD/NPR","FX:USD/LKR","FX:USD/MMK","FX:USD/KHR","FX:USD/LAK","FX:USD/MNT","FX:USD/FJD","FX:USD/PGK","FX:USD/WST","FX:EUR/ISK","FX:EUR/GEL","FX:EUR/AMD","FX:EUR/AZN","FX:EUR/MAD","FX:EUR/EGP","FX:EUR/NGN","FX:EUR/KES","FX:EUR/INR","FX:EUR/BRL","FX:EUR/SGD","FX:EUR/HKD","FX:EUR/KRW","FX:EUR/TWD","FX:EUR/THB","FX:EUR/IDR","FX:EUR/MYR","FX:EUR/PHP","FX:EUR/CLP","FX:EUR/COP","FX:EUR/PEN","INDEX:PSI20","INDEX:OMXC25","INDEX:OMXH25","INDEX:OMXHGI","INDEX:OMXSPI","INDEX:WIG20","INDEX:PX","INDEX:BUX","INDEX:BET","INDEX:MOEX","INDEX:RTSI","INDEX:TA35","INDEX:TASI","INDEX:ADX","INDEX:DFMGI","INDEX:QE","INDEX:EGX30","INDEX:JSE_TOP40","INDEX:MSCI_WORLD","INDEX:MSCI_EM","INDEX:MSCI_EAFE","INDEX:MSCI_ACWI","INDEX:SP500_EQUAL_WEIGHT","INDEX:NYSE_COMPOSITE","INDEX:PHLX_SEMICONDUCTOR","INDEX:KBW_BANK","INDEX:DJ_TRANSPORT","INDEX:DJ_UTILITIES","INDEX:FTSE_MIB","INDEX:ATHEX","INDEX:ISEQ20","CMD:COAL","CMD:THERMAL_COAL","CMD:COKING_COAL","CMD:URANIUM_SPOT","CMD:LITHIUM_CARBONATE","CMD:LITHIUM_HYDROXIDE","CMD:COBALT_METAL","CMD:RARE_EARTHS","CMD:NEODYMIUM","CMD:GRAPHITE","CMD:PHOSPHATE","CMD:POTASH","CMD:UREA","CMD:AMMONIA","CMD:METHANOL","CMD:ETHYLENE","CMD:POLYETHYLENE","CMD:PVC","CMD:BITUMEN","CMD:JET_FUEL","CMD:DIESEL","CMD:FUEL_OIL","CMD:EU_DIESEL","CMD:CARBON_EUA","CMD:CARBON_UKA","CMD:CARBON_CCA","CMD:CARBON_RGGI","CMD:COCOA_LONDON","CMD:COFFEE_LONDON","CMD:COFFEE_NY","CMD:COTTON_NO2","CMD:SUGAR_NO11","CMD:SUGAR_NO5","CMD:WHEAT_KC","CMD:WHEAT_MATIF","CMD:CORN_MATIF","CMD:SOYBEAN_MATIF","CMD:CANOLA_ICE","CMD:LIVE_CATTLE_CME","CMD:FEEDER_CATTLE_CME","CMD:LEAN_HOGS_CME","CMD:MILK_CLASS_III","CMD:BUTTER","CMD:CHEESE","CMD:EGGS","ADP","PAYX","INTU","FISV","FI","FIS","GPN","SQ","XYZ","AFRM","SOFI","UPST","LC","NU","STNE","MELI","SE","SEAT","ROKU","PINS","SNAP","SPOT","RDDT","DUOL","U","PATH","AI","C3AI","BBAI","IONQ","RGTI","QBTS","OKLO","SMR","NNE","VST","CEG","TLN","NRG","AES","BEPC","BEP","BIP","BAM","BN","KKR","BX","APO","CG","ARES","OWL","TROW","BLK","SCHW","IBKR","CME","ICE","CBOE","NDAQ","MKTX","MCO","SPGI","MSCI","FDS","VRSK","CSGP","EQIX","DLR","AMT","CCI","SBAC","PSA","EXR","O","WELL","VICI","EQR","AVB","ESS","MAA","INVH","UDR","CPT","SPG","OHI","MPW","DOC","ARE","BXP","KIM","REG","FRT","NNN","STAG","WPC","ADC","REXR","PLD","TRNO","FR","EGP","CUBE","LSI","NSA","IRM","VTR","HST","APLE","RHP","PK","CHH","WH","WY","RYN","PCH","GPC","ORLY","AZO","AAP","KMX","CVNA","AN","ANF","GPS","AEO","URBN","LULU","DECK","CROX","ONON","BIRK","RL","TPR","CPRI","PVH","VFC","HBI","LEVI","COLM","UAA","UA","WWW","SKX","FL","ELF","ULTA","COTY","EL","KHC","GIS","K","DPZ","YUM","YUMC","CMG","CAVA","WING","SHAK","TXRH","DRI","EAT","BJRI","CAKE","BROS","QSR","RBI","SYY","USFD"},0);c.addView(marketAsset);Button marketScanner=new Button(this);marketScanner.setText("Piyasa tarayıcı • "+marketAsset.getCount()+" sembol");marketScanner.setOnClickListener(v->{if(marketAsset==null)return;final java.util.LinkedHashSet<String> uniqueMarkets=new java.util.LinkedHashSet<>();for(int i=0;i<marketAsset.getCount();i++){String symbol=marketAsset.getItemAtPosition(i).toString().trim();if(!symbol.isEmpty())uniqueMarkets.add(symbol.toUpperCase(java.util.Locale.ROOT));}final String[] all=uniqueMarkets.toArray(new String[0]);final EditText query=new EditText(this);query.setSingleLine(true);query.setHint("Sembol ara: BTC, EUR, AAPL...");final Spinner group=spin(new String[]{"Tümü","Kripto","Forex","Endeks","Emtia","Hisse/ETF"},0);final LinearLayout filters=new LinearLayout(this);filters.setOrientation(LinearLayout.VERTICAL);filters.addView(query);filters.addView(group);final AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Piyasa tarayıcı • "+all.length+" sembol").setNegativeButton("Kapat",null).create();final android.widget.ListView results=new android.widget.ListView(this);final LinearLayout wrapper=new LinearLayout(this);wrapper.setOrientation(LinearLayout.VERTICAL);wrapper.addView(filters);wrapper.addView(results,new LinearLayout.LayoutParams(-1,(int)(getResources().getDisplayMetrics().density*320)));dialog.setView(wrapper);final Runnable update=()->{java.util.ArrayList<String> matches=new java.util.ArrayList<>();String term=query.getText().toString().trim().toUpperCase(java.util.Locale.ROOT);int selected=group.getSelectedItemPosition();for(String sym:all){boolean crypto=sym.endsWith("-USD")&&!sym.startsWith("FX:")&&!sym.startsWith("INDEX:")&&!sym.startsWith("CMD:");boolean fx=sym.startsWith("FX:");boolean index=sym.startsWith("INDEX:");boolean commodity=sym.startsWith("CMD:");if((selected==1&&!crypto)||(selected==2&&!fx)||(selected==3&&!index)||(selected==4&&!commodity)||(selected==5&&(crypto||fx||index||commodity)))continue;if(!sym.toUpperCase(java.util.Locale.ROOT).contains(term))continue;matches.add(sym);}java.util.Collections.sort(matches);results.setAdapter(new android.widget.ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,matches));results.setOnItemClickListener((parent,view,pos,id)->{String chosen=matches.get(pos);for(int k=0;k<marketAsset.getCount();k++)if(chosen.equals(marketAsset.getItemAtPosition(k).toString())){marketAsset.setSelection(k);break;}dialog.dismiss();});};query.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence t,int st,int count,int after){}public void onTextChanged(CharSequence t,int st,int before,int count){update.run();}public void afterTextChanged(android.text.Editable e){}});group.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){update.run();}});update.run();dialog.show();});c.addView(marketScanner);Button discoverMarkets=new Button(this);discoverMarkets.setText("Coinbase • canlı ürün kataloğunu sorgula (salt okunur)");discoverMarkets.setOnClickListener(v->discoverCoinbaseProducts());c.addView(discoverMarkets);Button coinbaseCandles=new Button(this);coinbaseCandles.setText("Coinbase • seçili kripto mum verileri");coinbaseCandles.setOnClickListener(v->inspectCoinbaseCandles());c.addView(coinbaseCandles);Button orderBook=new Button(this);orderBook.setText("Coinbase • emir defteri ve spread (salt okunur)");orderBook.setOnClickListener(v->inspectCoinbaseOrderBook());c.addView(orderBook);Button marketTrades=new Button(this);marketTrades.setText("Coinbase • son işlemler ve fiyat özeti");marketTrades.setOnClickListener(v->inspectCoinbaseMarketTrades());c.addView(marketTrades);Button productDetails=new Button(this);productDetails.setText("Coinbase • ürün ayrıntıları ve işlem kısıtları");productDetails.setOnClickListener(v->inspectCoinbaseProductDetails());c.addView(productDetails);Button marketHealth=new Button(this);marketHealth.setText("Coinbase • sunucu saati ve veri gecikmesi");marketHealth.setOnClickListener(v->inspectCoinbaseServerTime());c.addView(marketHealth);Button unifiedMarket=new Button(this);unifiedMarket.setText("Coinbase • birleşik piyasa özeti");unifiedMarket.setOnClickListener(v->inspectUnifiedCoinbaseMarket());c.addView(unifiedMarket);Button figiLookup=new Button(this);figiLookup.setText("OpenFIGI • seçili hisse/ETF kimliğini doğrula");figiLookup.setOnClickListener(v->lookupOpenFigi());c.addView(figiLookup);marketTimeframe=spin(new String[]{"1m","5m","15m","1h","6h","1D","4h"},0);c.addView(marketTimeframe);marketAsset.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int i,long id){if(chartView!=null)chartSnapshot();}});marketTimeframe.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int i,long id){if(chartView!=null)chartSnapshot();}});chartView=new ChartView(this);chartView.accent=ACCENT;chartView.setContentDescription("BTC USD mum grafiği; veri bekleniyor");c.addView(chartView,new LinearLayout.LayoutParams(-1,420));Button fullscreenChart=new Button(this);fullscreenChart.setText("⛶ Tam ekran grafik");fullscreenChart.setAllCaps(false);fullscreenChart.setOnClickListener(v->{if(chartView==null)return;if(chartView.candles.isEmpty()){new AlertDialog.Builder(this).setTitle("Grafik verisi bekleniyor").setMessage("Tam ekran grafik için önce seçili sembol ve zaman diliminde doğrulanmış mum verisi yüklenmelidir.").setPositiveButton("Tamam",null).show();return;}ChartView expanded=new ChartView(this);expanded.accent=chartView.accent;expanded.candles.addAll(chartView.candles);expanded.chartStyle=chartView.chartStyle;expanded.smaPeriod=chartView.smaPeriod;expanded.emaPeriod=chartView.emaPeriod;expanded.visibleCount=chartView.visibleCount;expanded.scrollBack=chartView.scrollBack;expanded.cryptoSession=chartView.cryptoSession;expanded.drawingSymbol=chartView.drawingSymbol;expanded.horizontalLevel=chartView.horizontalLevel;expanded.trendX1=chartView.trendX1;expanded.trendY1=chartView.trendY1;expanded.trendX2=chartView.trendX2;expanded.trendY2=chartView.trendY2;expanded.volumeProfileEnabled=chartView.volumeProfileEnabled;expanded.setContentDescription("Tam ekran demo piyasa grafiği");LinearLayout full=new LinearLayout(this);full.setOrientation(LinearLayout.VERTICAL);full.setBackgroundColor(Color.rgb(7,12,19));LinearLayout actions=new LinearLayout(this);Button minus=new Button(this);minus.setText("−");minus.setOnClickListener(w->expanded.zoom(1));actions.addView(minus,new LinearLayout.LayoutParams(0,-2,1));Button plus=new Button(this);plus.setText("+");plus.setOnClickListener(w->expanded.zoom(-1));actions.addView(plus,new LinearLayout.LayoutParams(0,-2,1));full.addView(actions);Spinner fullStyle=spin(new String[]{"Mum","Çizgi","Alan"},Math.max(0,Math.min(2,expanded.chartStyle)));fullStyle.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){expanded.chartStyle=position;expanded.invalidate();}});full.addView(fullStyle);Spinner fullSma=spin(new String[]{"SMA 20","SMA 50","SMA 100","SMA 200"},expanded.smaPeriod==50?1:expanded.smaPeriod==100?2:expanded.smaPeriod==200?3:0);fullSma.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){expanded.smaPeriod=new int[]{20,50,100,200}[position];expanded.invalidate();}});full.addView(fullSma);Spinner fullEma=spin(new String[]{"EMA 9","EMA 21","EMA 50","EMA 200"},expanded.emaPeriod==9?0:expanded.emaPeriod==50?2:expanded.emaPeriod==200?3:1);fullEma.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){expanded.emaPeriod=new int[]{9,21,50,200}[position];expanded.invalidate();}});full.addView(fullEma);full.addView(expanded,new LinearLayout.LayoutParams(-1,0,1));AlertDialog dialog=new AlertDialog.Builder(this).setTitle("MARS-X • Grafik").setView(full).setPositiveButton("Kapat",null).create();dialog.setOnShowListener(w->{android.view.Window window=dialog.getWindow();if(window!=null)window.setLayout(-1,-1);});dialog.setOnDismissListener(w->{if(chartView!=null){chartView.visibleCount=expanded.visibleCount;chartView.scrollBack=expanded.scrollBack;chartView.chartStyle=expanded.chartStyle;chartView.smaPeriod=expanded.smaPeriod;chartView.emaPeriod=expanded.emaPeriod;chartView.horizontalLevel=expanded.horizontalLevel;chartView.trendX1=expanded.trendX1;chartView.trendY1=expanded.trendY1;chartView.trendX2=expanded.trendX2;chartView.trendY2=expanded.trendY2;chartView.invalidate();}});dialog.show();});c.addView(fullscreenChart);Button correlation=new Button(this);correlation.setText("Korelasyon • Ana grafik / karşılaştırma");correlation.setOnClickListener(v->{if(chartView==null||comparisonCharts.isEmpty()){new AlertDialog.Builder(this).setMessage("Önce 2 veya 4 grafik seçin ve karşılaştırma verilerini yükleyin.").setPositiveButton("Tamam",null).show();return;}StringBuilder report=new StringBuilder("Kapanış getirilerinin Pearson korelasyonu (yaklaşık).\nFarklı zaman damgaları eşleştirilmez; yalnızca aynı zaman aralığı ve eşit uzunlukta seriler kabul edilir.\n\n");int usable=0;for(ChartView other:comparisonCharts){if(other.candles.size()<12||chartView.candles.size()!=other.candles.size()||other.comparisonSeconds!=new int[]{60,300,900,3600,21600,86400,14400}[marketTimeframe.getSelectedItemPosition()]){report.append(other.drawingSymbol.isEmpty()?"Karşılaştırma":other.drawingSymbol).append(": veri veya zaman aralığı uyumsuz\n");continue;}int n=chartView.candles.size()-1;double sx=0,sy=0,sxx=0,syy=0,sxy=0;boolean valid=true;for(int k=1;k<=n;k++){float[] a0=chartView.candles.get(k-1),a1=chartView.candles.get(k),b0=other.candles.get(k-1),b1=other.candles.get(k);if(a0.length<4||a1.length<4||b0.length<4||b1.length<4||a0[3]<=0||a1[3]<=0||b0[3]<=0||b1[3]<=0){valid=false;break;}double x=Math.log(a1[3]/a0[3]),y=Math.log(b1[3]/b0[3]);if(!Double.isFinite(x)||!Double.isFinite(y)){valid=false;break;}sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;}double denom=Math.sqrt((n*sxx-sx*sx)*(n*syy-sy*sy));if(!valid||denom<=1e-15){report.append(other.drawingSymbol).append(": hesaplanamadı\n");continue;}double value=(n*sxy-sx*sy)/denom;report.append(other.drawingSymbol.isEmpty()?"Aynı piyasa":other.drawingSymbol).append(": ").append(String.format(java.util.Locale.US,"%.3f",Math.max(-1,Math.min(1,value)))).append(" (").append(n).append(" getiri)\n");usable++;}if(usable==0)report.append("Karşılaştırılabilir seri bulunamadı.");new AlertDialog.Builder(this).setTitle("Korelasyon • Ön analiz").setMessage(report.toString().replace("\\\n","\n")).setPositiveButton("Tamam",null).show();});c.addView(correlation);comparisonCharts.clear();LinearLayout comparisonContainer=new LinearLayout(this);comparisonContainer.setOrientation(LinearLayout.VERTICAL);c.addView(comparisonContainer);Spinner chartCount=spin(new String[]{"1 grafik","2 grafik (aynı piyasa)","4 grafik (aynı piyasa)"},0);chartCount.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int position,long id){comparisonContainer.removeAllViews();comparisonCharts.clear();int total=position==0?1:position==1?2:4;for(int i=1;i<total;i++){ChartView extra=new ChartView(FinanceActivity.this);extra.accent=ACCENT;extra.cryptoSession=chartView.cryptoSession;extra.chartStyle=i%3;extra.candles.addAll(chartView.candles);extra.visibleCount=chartView.visibleCount;extra.scrollBack=chartView.scrollBack;extra.smaPeriod=chartView.smaPeriod;extra.emaPeriod=chartView.emaPeriod;extra.setContentDescription("Karşılaştırma grafiği "+(i+1)+"; aynı piyasa");comparisonCharts.add(extra);comparisonContainer.addView(t("Grafik "+(i+1)+" • aynı piyasa / farklı görünüm",12,ACCENT));Spinner extraStyle=spin(new String[]{"Mum","Çizgi","Alan"},extra.chartStyle);extraStyle.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int selected,long itemId){extra.chartStyle=selected;extra.invalidate();}});comparisonContainer.addView(extraStyle);Spinner extraAsset=spin(comparisonSymbols(),0);extraAsset.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int selected,long id){String chosen=selected==0?"":extraAsset.getSelectedItem().toString();extra.comparisonRequestId++;extra.drawingSymbol=chosen;extra.clear();if(chosen.isEmpty()){extra.cryptoSession=chartView.cryptoSession;extra.candles.addAll(chartView.candles);extra.invalidate();}else loadComparisonCrypto(extra,chosen);}});comparisonContainer.addView(extraAsset);Spinner extraTf=spin(new String[]{"1m","5m","15m","1h","6h","1D","4h"},marketTimeframe.getSelectedItemPosition());extra.comparisonSeconds=new int[]{60,300,900,3600,21600,86400,14400}[extraTf.getSelectedItemPosition()];extraTf.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> parent){}public void onItemSelected(android.widget.AdapterView<?> parent,View view,int selected,long id){extra.comparisonSeconds=new int[]{60,300,900,3600,21600,86400,14400}[selected];if(!extra.drawingSymbol.isEmpty()){extra.comparisonRequestId++;extra.clear();loadComparisonCrypto(extra,extra.drawingSymbol);}}});comparisonContainer.addView(extraTf);comparisonContainer.addView(extra,new LinearLayout.LayoutParams(-1,330));} }});c.addView(chartCount);Button levelButton=new Button(this);levelButton.setText("Seviye: Grafiğe dokun");levelButton.setOnClickListener(v->{chartView.placeLevelOnTap=true;chartView.placeTrendOnTap=false;levelButton.setText("Grafiğe dokunarak seviyeyi seç");});c.addView(levelButton);Button trendButton=new Button(this);trendButton.setText("Trend çizgisi: 2 noktaya dokun");trendButton.setOnClickListener(v->{chartView.placeTrendOnTap=true;chartView.placeLevelOnTap=false;chartView.trendX1=Float.NaN;chartView.trendX2=Float.NaN;chartView.invalidate();});c.addView(trendButton);Button saveDrawings=new Button(this);saveDrawings.setText("Çizimleri kaydet");saveDrawings.setOnClickListener(v->{if(chartView==null||chartView.drawingSymbol.isEmpty())return;try{JSONObject data=new JSONObject();data.put("level",Float.isFinite(chartView.horizontalLevel)?chartView.horizontalLevel:JSONObject.NULL);data.put("x1",Float.isFinite(chartView.trendX1)?chartView.trendX1:JSONObject.NULL);data.put("y1",Float.isFinite(chartView.trendY1)?chartView.trendY1:JSONObject.NULL);data.put("x2",Float.isFinite(chartView.trendX2)?chartView.trendX2:JSONObject.NULL);data.put("y2",Float.isFinite(chartView.trendY2)?chartView.trendY2:JSONObject.NULL);getPreferences(MODE_PRIVATE).edit().putString("drawing_v1_"+chartView.drawingSymbol,data.toString()).apply();android.widget.Toast.makeText(this,"Çizimler cihazda kaydedildi",android.widget.Toast.LENGTH_SHORT).show();}catch(Exception ignored){}});c.addView(saveDrawings);Button editLevel=new Button(this);editLevel.setText("Yatay seviyeyi düzenle");editLevel.setOnClickListener(v->{if(chartView==null)return;EditText input=new EditText(this);input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);input.setSingleLine(true);if(Float.isFinite(chartView.horizontalLevel))input.setText(Float.toString(chartView.horizontalLevel));new AlertDialog.Builder(this).setTitle("Yatay seviye fiyatı").setView(input).setNegativeButton("Vazgeç",null).setPositiveButton("Uygula",(dialog,which)->{try{String raw=input.getText().toString().trim().replace(',','.');float level=Float.parseFloat(raw);if(!Float.isFinite(level)||level<=0f)throw new IllegalArgumentException();chartView.horizontalLevel=level;chartView.invalidate();saveDrawings.performClick();}catch(Exception ex){new AlertDialog.Builder(this).setMessage("Geçerli, pozitif bir fiyat girin.").setPositiveButton("Tamam",null).show();}}).show();});c.addView(editLevel);Button editTrend=new Button(this);editTrend.setText("Trend çizgisinin fiyatlarını düzenle");editTrend.setOnClickListener(v->{if(chartView==null||!Float.isFinite(chartView.trendY1)||!Float.isFinite(chartView.trendY2)){new AlertDialog.Builder(this).setMessage("Önce grafikte iki noktalı bir trend çizgisi oluşturun.").setPositiveButton("Tamam",null).show();return;}LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);EditText first=new EditText(this),second=new EditText(this);first.setInputType(8194);second.setInputType(8194);first.setHint("Başlangıç fiyatı");second.setHint("Bitiş fiyatı");first.setText(Float.toString(chartView.trendY1));second.setText(Float.toString(chartView.trendY2));form.addView(first);form.addView(second);new AlertDialog.Builder(this).setTitle("Trend çizgisi • fiyat düzenle").setView(form).setNegativeButton("Vazgeç",null).setPositiveButton("Kaydet",(d,w)->{try{float y1=Float.parseFloat(first.getText().toString().trim().replace(',','.')),y2=Float.parseFloat(second.getText().toString().trim().replace(',','.'));if(!Float.isFinite(y1)||!Float.isFinite(y2)||y1<=0||y2<=0)throw new IllegalArgumentException();chartView.trendY1=y1;chartView.trendY2=y2;chartView.invalidate();saveDrawings.performClick();}catch(Exception ex){new AlertDialog.Builder(this).setMessage("İki geçerli pozitif fiyat girin.").setPositiveButton("Tamam",null).show();}}).show();});c.addView(editTrend);Button clearDrawings=new Button(this);clearDrawings.setText("Çizimleri temizle");clearDrawings.setOnClickListener(v->{chartView.horizontalLevel=Float.NaN;chartView.trendX1=Float.NaN;chartView.trendY1=Float.NaN;chartView.trendX2=Float.NaN;chartView.trendY2=Float.NaN;chartView.placeLevelOnTap=false;chartView.placeTrendOnTap=false;levelButton.setText("Seviye: Grafiğe dokun");if(!chartView.drawingSymbol.isEmpty())getPreferences(MODE_PRIVATE).edit().remove("drawing_v1_"+chartView.drawingSymbol).apply();chartView.invalidate();});c.addView(clearDrawings);Button chartDemoOrder=new Button(this);chartDemoOrder.setText("Grafikten DEMO emir • gerçek işlem yok");chartDemoOrder.setOnClickListener(v->paperOrderDialog(marketAsset.getSelectedItem().toString()));c.addView(chartDemoOrder);Button levelDemoOrder=new Button(this);levelDemoOrder.setText("Seçili seviyeden DEMO LIMIT emir");levelDemoOrder.setOnClickListener(v->{if(!Float.isFinite(chartView.horizontalLevel)||chartView.horizontalLevel<=0){new AlertDialog.Builder(this).setMessage("Önce Seviye butonuyla grafikte bir fiyat noktası seçin.").setPositiveButton("Tamam",null).show();return;}paperOrderDialog(marketAsset.getSelectedItem().toString(),chartView.horizontalLevel);});c.addView(levelDemoOrder);Button replayButton=new Button(this);replayButton.setText("Tekrar oynat: Başlat");replayButton.setOnClickListener(v->{if(chartView==null||chartView.candles.size()<3){android.widget.Toast.makeText(this,"Tekrar oynatma için en az 3 mum gerekli",android.widget.Toast.LENGTH_SHORT).show();return;}if(!chartView.replayActive){chartView.replayActive=true;chartView.replayEnd=Math.min(chartView.candles.size(),Math.max(3,chartView.visibleCount));replayButton.setText("Tekrar oynat: Sonraki mum");}else if(chartView.replayEnd<chartView.candles.size()){chartView.replayEnd++;if(chartView.replayEnd==chartView.candles.size())replayButton.setText("Tekrar oynat: Bitir");}else{chartView.replayActive=false;replayButton.setText("Tekrar oynat: Başlat");}chartView.invalidate();});c.addView(replayButton);Button replayExit=new Button(this);replayExit.setText("Tekrar oynatmayı kapat");replayExit.setOnClickListener(v->{if(chartView!=null){chartView.replayActive=false;chartView.invalidate();}replayButton.setText("Tekrar oynat: Başlat");});c.addView(replayExit);Button replayBack=new Button(this);replayBack.setText("Tekrar oynat: Önceki mum");replayBack.setOnClickListener(v->{if(chartView==null||!chartView.replayActive)return;int min=Math.min(chartView.candles.size(),3);chartView.replayEnd=Math.max(min,chartView.replayEnd-1);replayButton.setText("Tekrar oynat: Sonraki mum");chartView.invalidate();});c.addView(replayBack);Button replaySpeed=new Button(this);replaySpeed.setText("Otomatik oynat: Başlat");final Handler replayHandler=new Handler(Looper.getMainLooper());final boolean[] autoReplay={false};final Runnable[] replayTick=new Runnable[1];replayTick[0]=()->{if(!autoReplay[0]||chartView==null)return;if(!chartView.replayActive||chartView.replayEnd>=chartView.candles.size()){autoReplay[0]=false;replaySpeed.setText("Otomatik oynat: Başlat");return;}chartView.replayEnd++;chartView.invalidate();if(chartView.replayEnd>=chartView.candles.size()){autoReplay[0]=false;replaySpeed.setText("Otomatik oynat: Başlat");}else replayHandler.postDelayed(replayTick[0],750);};replaySpeed.setOnClickListener(v->{if(autoReplay[0]){autoReplay[0]=false;replayHandler.removeCallbacks(replayTick[0]);replaySpeed.setText("Otomatik oynat: Başlat");return;}if(chartView==null||chartView.candles.size()<3)return;if(!chartView.replayActive){chartView.replayActive=true;chartView.replayEnd=Math.min(chartView.candles.size(),Math.max(3,chartView.visibleCount));}if(chartView.replayEnd>=chartView.candles.size())chartView.replayEnd=3;autoReplay[0]=true;replaySpeed.setText("Otomatik oynat: Durdur");replayHandler.postDelayed(replayTick[0],750);chartView.invalidate();});c.addView(replaySpeed);Button replayReset=new Button(this);replayReset.setText("Tekrar oynat: Baştan");replayReset.setOnClickListener(v->{autoReplay[0]=false;replayHandler.removeCallbacks(replayTick[0]);replaySpeed.setText("Otomatik oynat: Başlat");if(chartView==null||chartView.candles.size()<3)return;chartView.replayActive=true;chartView.replayEnd=3;replayButton.setText("Tekrar oynat: Sonraki mum");chartView.invalidate();});c.addView(replayReset);Button profileToggle=new Button(this);profileToggle.setText("Hacim profili: Kapalı");profileToggle.setOnClickListener(v->{if(chartView==null)return;chartView.volumeProfileEnabled=!chartView.volumeProfileEnabled;profileToggle.setText(chartView.volumeProfileEnabled?"Hacim profili: Açık":"Hacim profili: Kapalı");chartView.invalidate();});c.addView(profileToggle);Spinner chartType=spin(new String[]{"Mum","Çizgi","Alan"},0);chartType.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int i,long id){if(chartView!=null){chartView.chartStyle=i;chartView.invalidate();}}});c.addView(chartType);Spinner smaSelector=spin(new String[]{"SMA 20","SMA 50","SMA 100","SMA 200"},0);smaSelector.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int i,long id){if(chartView!=null){chartView.smaPeriod=new int[]{20,50,100,200}[i];chartView.invalidate();}}});c.addView(smaSelector);Spinner emaSelector=spin(new String[]{"EMA 9","EMA 21","EMA 50","EMA 200"},1);emaSelector.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int i,long id){if(chartView!=null){chartView.emaPeriod=new int[]{9,21,50,200}[i];chartView.invalidate();}}});c.addView(emaSelector);LinearLayout controls=row();Button zoomIn=new Button(this);zoomIn.setText("＋ Yakınlaştır");zoomIn.setAllCaps(false);zoomIn.setOnClickListener(v->chartView.zoom(-1));controls.addView(zoomIn,new LinearLayout.LayoutParams(0,54,1));Button zoomOut=new Button(this);zoomOut.setText("－ Uzaklaştır");zoomOut.setAllCaps(false);zoomOut.setOnClickListener(v->chartView.zoom(1));controls.addView(zoomOut,new LinearLayout.LayoutParams(0,54,1));c.addView(controls);c.addView(t("Mum grafik • hacim • salt okunur veri",12,MUTED));marketProviders=t("Piyasa verisi: Coinbase + Kraken + Bybit hazırlanıyor",12,MUTED);c.addView(marketProviders);root.addView(c,mp(12));}
 int screenAccent(String screen){if("Piyasalar".equals(screen))return Color.rgb(0,194,255);if("Trading".equals(screen))return Color.rgb(255,106,0);if("Portföy".equals(screen))return Color.rgb(42,207,129);if("Cüzdan".equals(screen))return Color.rgb(185,60,255);if("Network".equals(screen))return Color.rgb(255,182,55);return ACCENT;}
 int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
 void nav(){LinearLayout r=row();String[] items={"Piyasalar","Trading","Portföy","Cüzdan","Network"};for(String item:items){TextView n=t(item,14,MUTED);n.setMinHeight(dp(64));n.setContentDescription(item+" sekmesi");n.setGravity(Gravity.CENTER);oneLine(n);n.setTextColor(screenAccent(item));n.setBackground(pill(Color.rgb(8,11,18),screenAccent(item)));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(64),1);p.setMargins(dp(2),0,dp(2),0);r.addView(n,p);n.setOnClickListener(v->openFinanceScreen(item));}root.addView(r,mp(20));}
 void openFinanceScreen(String name){if("Network".equals(name)){startActivity(new Intent(this,MainActivity.class));return;}chartRequestGeneration++;quoteRequestGeneration++;marketListRequestGeneration++;tradingScreenVisible=false;refreshHandler.removeCallbacks(refreshTick);
  if("Trading".equals(name)){build();return;}
  final int white=Color.WHITE;ScrollView scroll=new ScrollView(this);LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(26,24,26,26);body.setBackgroundColor(Color.rgb(Math.max(0,Color.red(screenAccent(name))/12),Math.max(0,Color.green(screenAccent(name))/12),Math.max(0,Color.blue(screenAccent(name))/12)));scroll.addView(body);
  TextView heading=t(name.toUpperCase(Locale.ROOT),24,white);heading.setTypeface(null,Typeface.BOLD);heading.setLetterSpacing(.06f);body.addView(heading);body.addView(t("MARS-X FINANCE  /  DEMO WORKSPACE",10,screenAccent(name)));
  if("Ana Sayfa".equals(name)){financeHero(body,"TOPLAM PORTFÖY","—","Canlı bakiye bağlantısı bekleniyor");financeSection(body,"PİYASA GENEL BAKIŞ");body.addView(t("Canlı fiyatlar doğrulandığında aşağıda listelenir; veri yoksa fiyat gösterilmez.",12,MUTED));financeSection(body,"HIZLI İŞLEMLER");financeAction(body,"Piyasaları Gör",()->openFinanceScreen("Piyasalar"));financeAction(body,"Cüzdanı Aç",()->openFinanceScreen("Cüzdan"));}
  else if("Piyasalar".equals(name)){financeSection(body,"İZLEME LİSTESİ");body.addView(t("Canlı fiyatlar aşağıda tek listede gösterilir. Desteklenmeyen paritelerde fiyat uydurulmaz.",12,MUTED));financeSection(body,"VERİ KALİTESİ");financeLine(body,"Durum","Bağlantı bekleniyor");financeLine(body,"Veri kaynağı","Salt okunur");}
  else if("Portföy".equals(name)){financeHero(body,"PORTFÖY DEĞERİ","—","Doğrulanmış bakiye bulunmuyor");financeSection(body,"VARLIK DAĞILIMI");financeLine(body,"Spot Varlıklar","—");financeLine(body,"Açık Pozisyonlar","—");financeLine(body,"Günlük Kâr / Zarar","—");financeSection(body,"PERFORMANS");financeLine(body,"Gerçekleşmiş Kâr / Zarar","—");financeLine(body,"Geçmiş İşlemler","Henüz veri yok");}
  else if("Cüzdan".equals(name)){financeHero(body,"CÜZDAN BAKİYESİ","—","Bakiye sağlayıcısı bağlı değil");financeSection(body,"CÜZDAN İŞLEMLERİ");financeAction(body,"Para Yatır",()->financePreview("Para yatırma"));financeAction(body,"Para Çek",()->financePreview("Para çekme"));financeAction(body,"Transfer",()->financePreview("Transfer"));financeSection(body,"SANAL VARLIKLAR • DEMO");demoWalletSummary=t(demoBalanceSummary(DEMO_CONVERSION_ASSETS),13,Color.WHITE);body.addView(demoWalletSummary,mp(12));financeAction(body,"Sanal kripto dönüştür",()->demoConversionDialog());financeSection(body,"GERÇEK CÜZDAN");body.addView(t("Gerçek bakiyeler bağlı değil • canlı transfer ve çekim kapalı.",12,MUTED));}
  else if("Profil".equals(name)){financeSection(body,"HESAP");financeLine(body,"Oturum","Demo");financeLine(body,"Kimlik Doğrulama","Bağlı değil");financeSection(body,"GÜVENLİK");financeLine(body,"İki Aşamalı Doğrulama","Yapılandırılmadı");financeLine(body,"Cihazlar","—");financeSection(body,"TERCİHLER");financeAction(body,"Görünüm ve Tema",()->financeThemeDialog());financeAction(body,"Bildirimler",()->financePreview("Bildirimler"));financeAction(body,"İşlem Geçmişi",()->financePreview("İşlem geçmişi"));financeAction(body,"Fiyat Alarmları",()->financePreview("Fiyat alarmları"));}
  if("Ana Sayfa".equals(name)||"Piyasalar".equals(name)){final LinearLayout target=body;financeAction(body,"↻ Canlı piyasa fiyatlarını yenile",()->loadPublicPrices(target));loadPublicPrices(body);}
  financeAction(body,"← Ana ekrana dön",()->build());
  LinearLayout screen=new LinearLayout(this);screen.setOrientation(LinearLayout.VERTICAL);screen.setBackgroundColor(BG);screen.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout tabs=row();String[] sections={"Ana Sayfa","Piyasalar","Trading","Portföy","Cüzdan","Profil"};
  for(String section:sections){TextView tab=t(section,12,section.equals(name)?Color.WHITE:MUTED);tab.setGravity(Gravity.CENTER);oneLine(tab);tab.setBackground(pill(Color.rgb(8,11,18),section.equals(name)?screenAccent(name):Color.rgb(32,40,56)));LinearLayout.LayoutParams tabParams=new LinearLayout.LayoutParams(0,dp(56),1);tabParams.setMargins(dp(2),0,dp(2),0);tabs.addView(tab,tabParams);tab.setOnClickListener(v->openFinanceScreen(section));}
  screen.addView(tabs,new LinearLayout.LayoutParams(-1,-2));
  setContentView(screen);screen.setAlpha(0f);screen.animate().alpha(1f).setDuration(220).start();
 }
 void inspectUnifiedCoinbaseMarket(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String product=marketAsset.getSelectedItem().toString().toUpperCase(Locale.ROOT);
  if(!product.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}")){
   new AlertDialog.Builder(this).setMessage("Birleşik piyasa özeti yalnızca Coinbase kripto ürünleri için kullanılabilir.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("Piyasa verileri birleştiriliyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(product+" • birleşik piyasa özeti").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   StringBuilder report=new StringBuilder("Coinbase public REST • salt okunur\\n");
   String root="https://api.coinbase.com/api/v3/brokerage/market/products/"+product;
   try{
    JSONObject data=fetchCoinbasePublicJson(root);
    if(!product.equalsIgnoreCase(data.optString("product_id","")))throw new IOException("product mismatch");
    report.append("Ürün: ").append(data.optString("product_id","?")).append(" • tür: ").append(data.optString("product_type","?")).append("\\n");
    report.append("Fiyat: ").append(data.optString("price","?")).append(" • 24s hacim: ").append(data.optString("volume_24h","?")).append("\\n");
    report.append("İşlem engeli: ").append(data.optBoolean("trading_disabled",false)).append("\\n");
   }catch(Exception e){report.append("Ürün bilgisi alınamadı.\\n");}
   try{
    JSONObject data=fetchCoinbasePublicJson(root+"/ticker?limit=10");
    report.append("En iyi alış: ").append(data.optString("best_bid","?")).append(" • satış: ").append(data.optString("best_ask","?")).append("\\n");
    JSONArray trades=data.optJSONArray("trades");
    report.append("Son işlemler: ").append(trades==null?"bilinmiyor":trades.length()).append("\\n");
   }catch(Exception e){report.append("Son işlemler alınamadı.\\n");}
   try{
    JSONObject data=fetchCoinbasePublicJson("https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id="+product+"&limit=5");
    JSONObject book=data.optJSONObject("pricebook");
    JSONArray bids=book==null?null:book.optJSONArray("bids"),asks=book==null?null:book.optJSONArray("asks");
    if(bids==null||asks==null||bids.length()==0||asks.length()==0)throw new IOException("empty book");
    java.math.BigDecimal bid=new java.math.BigDecimal(bids.getJSONObject(0).getString("price"));
    java.math.BigDecimal ask=new java.math.BigDecimal(asks.getJSONObject(0).getString("price"));
    if(bid.signum()<=0||ask.compareTo(bid)<0)throw new IOException("invalid prices");
    java.math.BigDecimal bps=ask.subtract(bid).multiply(new java.math.BigDecimal("20000")).divide(ask.add(bid),4,java.math.RoundingMode.HALF_UP);
    report.append("Spread: ").append(bps.toPlainString()).append(" bp\\n");
   }catch(Exception e){report.append("Emir defteri alınamadı.\\n");}
   final String output=report.append("Gerçek emir gönderilmedi.").toString();
   runOnUiThread(()->{if(dialog.isShowing())info.setText(output);});
  }).start();
 }
 JSONObject fetchCoinbasePublicJson(String endpoint)throws Exception{
  HttpURLConnection conn=null;
  try{
   conn=(HttpURLConnection)new URL(endpoint).openConnection();
   conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
   if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
   return new JSONObject(read(conn.getInputStream()));
  }finally{if(conn!=null)conn.disconnect();}
 }
 void inspectCoinbaseServerTime(){
  final TextView info=t("Coinbase sunucu saati kontrol ediliyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Piyasa veri sağlığı • Coinbase").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    long started=System.currentTimeMillis();
    conn=(HttpURLConnection)new URL("https://api.coinbase.com/api/v3/brokerage/time").openConnection();
    conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    JSONObject payload=new JSONObject(read(conn.getInputStream()));
    long completed=System.currentTimeMillis();
    String raw=payload.optString("epochSeconds","");
    if(!raw.matches("[0-9]{9,12}"))throw new IOException("missing epochSeconds");
    long serverSeconds=Long.parseLong(raw);
    long midpointSeconds=(started/2L+completed/2L)/1000L;
    long clockSkewSeconds=serverSeconds-midpointSeconds;
    long roundTripMs=completed-started;
    if(roundTripMs<0||roundTripMs>30000L)throw new IOException("invalid latency");
    output="Kaynak: Coinbase public time API\\nSunucu zamanı (UTC): "+new java.util.Date(serverSeconds*1000L).toString()+"\\nAğ gidiş-dönüş: "+roundTripMs+" ms\\nYaklaşık cihaz-sunucu saat farkı: "+clockSkewSeconds+" sn\\nBu kontrol fiyat verisinin güncelliğini garanti etmez.";
   }catch(Exception e){output="Sunucu saati veya ağ gecikmesi doğrulanamadı. Canlı veri sağlığı bilinmiyor.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void inspectCoinbaseProductDetails(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String product=marketAsset.getSelectedItem().toString().toUpperCase(Locale.ROOT);
  if(!product.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}")){
   new AlertDialog.Builder(this).setMessage("Coinbase ürün ayrıntıları yalnızca geçerli kripto ürün kimlikleri için sorgulanır.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("Coinbase ürün bilgileri alınıyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(product+" • ürün bilgisi").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    String endpoint="https://api.coinbase.com/api/v3/brokerage/market/products/"+product;
    conn=(HttpURLConnection)new URL(endpoint).openConnection();conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    JSONObject data=new JSONObject(read(conn.getInputStream()));
    if(!product.equalsIgnoreCase(data.optString("product_id","")))throw new IOException("product mismatch");
    StringBuilder result=new StringBuilder("Coinbase public product • salt okunur\\n");
    result.append("Ürün: ").append(data.optString("product_id","?")).append("\\n");
    result.append("Temel varlık: ").append(data.optString("base_currency_id","?")).append(" • karşıt: ").append(data.optString("quote_currency_id","?")).append("\\n");
    result.append("Ürün türü: ").append(data.optString("product_type","?")).append("\\n");
    result.append("Fiyat adımı: ").append(data.optString("quote_increment","?")).append("\\n");
    result.append("Miktar adımı: ").append(data.optString("base_increment","?")).append("\\n");
    result.append("Min. miktar: ").append(data.optString("base_min_size","?")).append("\\n");
    result.append("Maks. miktar: ").append(data.optString("base_max_size","?")).append("\\n");
    result.append("İşlem engeli: ").append(data.optBoolean("trading_disabled",false)).append("\\n");
    result.append("Yalnızca görüntüleme; gerçek emirler kapalı.");
    output=result.toString();
   }catch(Exception e){output="Ürün ayrıntıları alınamadı veya kimlik doğrulanamadı. İşlem yapılmadı.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void inspectCoinbaseMarketTrades(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String product=marketAsset.getSelectedItem().toString().toUpperCase(Locale.ROOT);
  if(!product.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}")){
   new AlertDialog.Builder(this).setMessage("Son işlem sorgusu yalnızca Coinbase kripto ürünleri içindir. Diğer varlıklar ayrı sağlayıcı gerektirir.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("Coinbase piyasa işlemleri sorgulanıyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(product+" • son işlemler").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    String endpoint="https://api.coinbase.com/api/v3/brokerage/market/products/"+product+"/ticker?limit=20";
    conn=(HttpURLConnection)new URL(endpoint).openConnection();conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    JSONObject payload=new JSONObject(read(conn.getInputStream()));
    JSONArray trades=payload.optJSONArray("trades");
    if(trades==null)throw new IOException("trades missing");
    StringBuilder result=new StringBuilder("Coinbase public trades • salt okunur\\n");
    result.append("En iyi alış: ").append(payload.optString("best_bid","?")).append(" • satış: ").append(payload.optString("best_ask","?")).append("\\n");
    result.append("İşlem kaydı: ").append(trades.length()).append("\\n");
    for(int i=0;i<Math.min(trades.length(),8);i++){
     JSONObject trade=trades.optJSONObject(i);if(trade==null)continue;
     result.append(trade.optString("side","?")).append(" • ").append(trade.optString("price","?")).append(" × ").append(trade.optString("size","?")).append("\\n");
    }
    output=result.toString();
   }catch(Exception e){output="Son işlemler alınamadı veya yanıt doğrulanamadı. Emir gönderilmedi.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void inspectCoinbaseOrderBook(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String product=marketAsset.getSelectedItem().toString().toUpperCase(Locale.ROOT);
  if(!product.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}")){
   new AlertDialog.Builder(this).setMessage("Emir defteri yalnızca Coinbase kripto ürünleri için sorgulanır. Diğer varlıklar ayrı sağlayıcı gerektirir.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("Canlı emir defteri anlık görüntüsü alınıyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(product+" • emir defteri").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    String endpoint="https://api.coinbase.com/api/v3/brokerage/market/product_book?product_id="+product+"&limit=10";
    conn=(HttpURLConnection)new URL(endpoint).openConnection();conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    JSONObject payload=new JSONObject(read(conn.getInputStream()));
    JSONObject book=payload.optJSONObject("pricebook");
    if(book==null)throw new IOException("pricebook missing");
    JSONArray bids=book.optJSONArray("bids"),asks=book.optJSONArray("asks");
    if(bids==null||asks==null||bids.length()==0||asks.length()==0)throw new IOException("empty book");
    JSONObject bid=bids.optJSONObject(0),ask=asks.optJSONObject(0);
    if(bid==null||ask==null)throw new IOException("invalid level");
    java.math.BigDecimal bidPx=new java.math.BigDecimal(bid.optString("price","0"));
    java.math.BigDecimal askPx=new java.math.BigDecimal(ask.optString("price","0"));
    if(bidPx.signum()<=0||askPx.compareTo(bidPx)<0)throw new IOException("invalid spread");
    java.math.BigDecimal spread=askPx.subtract(bidPx);
    java.math.BigDecimal midpoint=askPx.add(bidPx).divide(new java.math.BigDecimal("2"),12,java.math.RoundingMode.HALF_UP);
    java.math.BigDecimal bps=spread.multiply(new java.math.BigDecimal("10000")).divide(midpoint,4,java.math.RoundingMode.HALF_UP);
    output="Kaynak: Coinbase public order book\\nAlış: "+bidPx.toPlainString()+" • miktar: "+bid.optString("size","?")+"\\nSatış: "+askPx.toPlainString()+" • miktar: "+ask.optString("size","?")+"\\nSpread: "+spread.toPlainString()+" ("+bps.toPlainString()+" bp)\\nAnlık görüntü; emir gönderilmedi.";
   }catch(Exception e){output="Emir defteri alınamadı veya doğrulanamadı. İşlem yapılmadı.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void inspectCoinbaseCandles(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String product=marketAsset.getSelectedItem().toString().toUpperCase(Locale.ROOT);
  if(!product.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}")){
   new AlertDialog.Builder(this).setMessage("Coinbase mum verileri yalnızca kripto ürün kimlikleri için sorgulanır. Hisse, Forex ve endeks verileri bu uç noktaya gönderilmez.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("Coinbase mum verileri alınıyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(product+" • son 24 saat").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    long end=System.currentTimeMillis()/1000L;long start=end-86400L;
    String endpoint="https://api.coinbase.com/api/v3/brokerage/market/products/"+product+"/candles?start="+start+"&end="+end+"&granularity=ONE_HOUR&limit=24";
    conn=(HttpURLConnection)new URL(endpoint).openConnection();conn.setConnectTimeout(6000);conn.setReadTimeout(8000);conn.setRequestProperty("Accept","application/json");
    if(conn.getResponseCode()!=200)throw new IOException("HTTP "+conn.getResponseCode());
    JSONObject payload=new JSONObject(read(conn.getInputStream()));JSONArray candles=payload.optJSONArray("candles");
    if(candles==null||candles.length()==0)output="Bu ürün için son 24 saatte mum verisi bulunamadı.";
    else{
     StringBuilder result=new StringBuilder("Kaynak: Coinbase public API • 1 saatlik mumlar\\n");
     result.append("Kayıt: ").append(candles.length()).append("\\n");
     for(int i=0;i<Math.min(8,candles.length());i++){
      JSONObject candle=candles.optJSONObject(i);if(candle==null)continue;
      result.append("T: ").append(candle.optString("start","?")).append(" • O: ").append(candle.optString("open","?")).append(" • H: ").append(candle.optString("high","?")).append(" • L: ").append(candle.optString("low","?")).append(" • C: ").append(candle.optString("close","?")).append("\\n");
     }
     output=result.toString();
    }
   }catch(Exception e){output="Coinbase mum verileri alınamadı. Yerel katalog etkilenmedi.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void lookupOpenFigi(){
  if(marketAsset==null||marketAsset.getSelectedItem()==null)return;
  final String ticker=marketAsset.getSelectedItem().toString();
  if(!ticker.matches("[A-Z]{1,6}")){
   new AlertDialog.Builder(this).setMessage("OpenFIGI araması yalnızca yalın hisse/ETF sembolleri için açıldı. Forex, kripto, endeks ve emtia ayrı sağlayıcı gerektirir.").setPositiveButton("Tamam",null).show();return;
  }
  final TextView info=t("OpenFIGI v3 kimlik sorgusu yapılıyor…",14,MUTED);
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle(ticker+" • FIGI kimlik kontrolü").setView(info).setPositiveButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   String output;HttpURLConnection conn=null;
   try{
    conn=(HttpURLConnection)new URL("https://api.openfigi.com/v3/mapping").openConnection();
    conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setConnectTimeout(6000);conn.setReadTimeout(8000);
    conn.setRequestProperty("Content-Type","application/json");conn.setRequestProperty("Accept","application/json");
    JSONArray jobs=new JSONArray();JSONObject job=new JSONObject();job.put("idType","TICKER");job.put("idValue",ticker);job.put("exchCode","US");jobs.put(job);
    byte[] bytes=jobs.toString().getBytes(StandardCharsets.UTF_8);
    try(java.io.OutputStream out=conn.getOutputStream()){out.write(bytes);}
    int http=conn.getResponseCode();
    if(http!=200)throw new IOException("HTTP "+http);
    JSONArray response=new JSONArray(read(conn.getInputStream()));
    JSONObject first=response.optJSONObject(0);JSONArray matches=first==null?null:first.optJSONArray("data");
    if(matches==null||matches.length()==0)output="ABD borsası için eşleşme bulunamadı. Bu, sembolün başka borsada olmadığı anlamına gelmez.";
    else{
     StringBuilder details=new StringBuilder("OpenFIGI eşleşmeleri (işlem/fiyat yetkisi sağlamaz):\\n");
     for(int i=0;i<Math.min(matches.length(),5);i++){
      JSONObject m=matches.optJSONObject(i);if(m==null)continue;
      details.append(m.optString("name","?")).append("\\nFIGI: ").append(m.optString("figi","?")).append(" • ").append(m.optString("exchCode","?")).append("\\n");
     }
     output=details.toString();
    }
   }catch(Exception e){output="Kimlik sorgusu tamamlanamadı. Çevrimdışı katalog korunuyor.";}
   finally{if(conn!=null)conn.disconnect();}
   final String resultText=output;runOnUiThread(()->{if(dialog.isShowing())info.setText(resultText);});
  }).start();
 }
 void discoverCoinbaseProducts(){
  final TextView status=t("Coinbase ürün kataloğu yükleniyor…",13,MUTED);
  final LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(dp(16),dp(8),dp(16),dp(8));panel.addView(status);
  final android.widget.ListView list=new android.widget.ListView(this);panel.addView(list,new LinearLayout.LayoutParams(-1,dp(340)));
  final AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Coinbase • Doğrulanmış ürünler").setView(panel).setNegativeButton("Kapat",null).create();dialog.show();
  new Thread(()->{
   final java.util.ArrayList<String> products=new java.util.ArrayList<>();
   String error=null;HttpURLConnection connection=null;
   try{
    java.util.LinkedHashSet<String> unique=new java.util.LinkedHashSet<>();
    for(int page=0;page<8;page++){
     connection=(HttpURLConnection)new URL("https://api.coinbase.com/api/v3/brokerage/market/products?limit=250&offset="+(page*250)).openConnection();
     connection.setConnectTimeout(6000);connection.setReadTimeout(8000);connection.setRequestProperty("Accept","application/json");
     if(connection.getResponseCode()!=200)throw new IOException("HTTP "+connection.getResponseCode());
     JSONObject payload=new JSONObject(read(connection.getInputStream()));
     org.json.JSONArray entries=payload.optJSONArray("products");
     if(entries==null)throw new IOException("Ürün listesi bulunamadı");
     for(int i=0;i<entries.length();i++){
      JSONObject item=entries.optJSONObject(i);if(item==null)continue;
      String id=item.optString("product_id","").trim().toUpperCase(Locale.ROOT);
      if(!id.matches("[A-Z0-9]{2,20}-[A-Z0-9]{2,12}"))continue;
      if(item.optBoolean("is_disabled",false)||item.optBoolean("trading_disabled",false))continue;
      unique.add(id);
     }
     connection.disconnect();connection=null;
     if(entries.length()<250)break;
    }
    products.addAll(unique);java.util.Collections.sort(products);
   }catch(Exception e){error="Katalog alınamadı; yerel sembol listesi korunuyor.";}
   finally{if(connection!=null)connection.disconnect();}
   final String failure=error;
   runOnUiThread(()->{if(!dialog.isShowing())return;
    if(failure!=null||products.isEmpty()){status.setText(failure!=null?failure:"Doğrulanmış ürün bulunamadı.");return;}
    status.setText("Coinbase API • "+products.size()+" benzersiz ürün (en fazla 8 sayfa, canlı işlem kapalı)");
    list.setAdapter(new android.widget.ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,products));
    list.setOnItemClickListener((parent,view,position,id)->{
     String chosen=products.get(position);boolean found=false;
     if(marketAsset!=null)for(int j=0;j<marketAsset.getCount();j++)if(chosen.equals(marketAsset.getItemAtPosition(j).toString())){marketAsset.setSelection(j);found=true;break;}
     if(found)dialog.dismiss();else status.setText(chosen+" • katalogda mevcut, grafik/işlem desteği henüz doğrulanmadı.");
    });
   });
  }).start();
 }
 void loadPublicPrices(LinearLayout body){
  final int requestId=++marketListRequestGeneration;
  for(int i=body.getChildCount()-1;i>=0;i--){View child=body.getChildAt(i);if("marsx_market_quote".equals(child.getTag()))body.removeViewAt(i);}
  TextView state=t("Coinbase • canlı fiyatlar yükleniyor…",13,MUTED);state.setTag("marsx_market_quote");body.addView(state,mp(8));new Thread(()->{String[] assets={"BTC-USD","ETH-USD","SOL-USD","DOGE-USD","LTC-USD","AVAX-USD","BNB-USD","ADA-USD","XRP-USD","LINK-USD","EUR-USD","GBP-USD"};ArrayList<String> lines=new ArrayList<>();java.util.HashSet<String> displayedSymbols=new java.util.HashSet<>();for(String symbol:assets){if(!displayedSymbols.add(symbol.trim().toUpperCase(Locale.ROOT)))continue;try{HttpURLConnection c=(HttpURLConnection)new URL("https://api.exchange.coinbase.com/products/"+symbol+"/ticker").openConnection();c.setConnectTimeout(5000);c.setReadTimeout(5000);c.setRequestProperty("Accept","application/json");try{if(c.getResponseCode()!=200)throw new IOException("HTTP "+c.getResponseCode());JSONObject j=new JSONObject(read(c.getInputStream()));double price=j.optDouble("price",Double.NaN);if(Double.isFinite(price)&&price>0)lines.add(symbol+"   $"+String.format(Locale.ROOT,"%,.2f",price));}finally{c.disconnect();}}catch(Exception ignored){}}runOnUiThread(()->{if(!body.isAttachedToWindow()||requestId!=marketListRequestGeneration)return;for(int i=body.getChildCount()-1;i>=0;i--){View child=body.getChildAt(i);if(child!=state&&"marsx_market_quote".equals(child.getTag()))body.removeViewAt(i);}state.setText(lines.isEmpty()?"Canlı fiyat bağlantısı başarısız • demo fiyatı gösterilmiyor":"Coinbase Exchange • doğrulanmış salt-okunur fiyatlar");for(String line:lines){int start=body.getChildCount();financeLine(body,line.split("   ")[0],line.substring(line.indexOf("   ")+3));for(int idx=start;idx<body.getChildCount();idx++)body.getChildAt(idx).setTag("marsx_market_quote");}});}).start();}
 void financeHero(LinearLayout parent,String label,String value,String note){LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(24,22,24,22);panel.setBackground(panel(RAISED,22,ACCENT));TextView title=t(label,11,ACCENT);title.setLetterSpacing(.08f);panel.addView(title);TextView big=t(value,35,Color.WHITE);big.setTypeface(null,Typeface.BOLD);panel.addView(big);panel.addView(t(note,12,MUTED));MiniGraph g=new MiniGraph(this);g.accent=ACCENT;panel.addView(g,new LinearLayout.LayoutParams(-1,120));parent.addView(panel,mp(20));}
 void financeSection(LinearLayout parent,String title){TextView v=t(title,12,ACCENT);v.setTypeface(null,Typeface.BOLD);v.setLetterSpacing(.08f);parent.addView(v,mp(24));}
 void financeAction(LinearLayout parent,String title,Runnable action){Button b=new Button(this);b.setText(title+"   →");b.setTextSize(14);b.setAllCaps(false);b.setTextColor(Color.WHITE);b.setGravity(Gravity.CENTER_VERTICAL|Gravity.LEFT);b.setPadding(24,12,16,12);b.setBackground(panel(RAISED,16,Color.rgb(37,48,66)));b.setOnClickListener(v->action.run());parent.addView(b,mp(8));}
 void financeThemeDialog(){String[] names={"Klasik • Buz Mavisi","Uzay • Kozmik Mavi","Neon • Mor","Altın • Mars","Orman • Yeşil"};new AlertDialog.Builder(this).setTitle("Renk Teması").setSingleChoiceItems(names,themeIndex,(dialog,selected)->{themeIndex=selected;ACCENT=THEMES[selected];getPreferences(MODE_PRIVATE).edit().putInt("theme",selected).apply();dialog.dismiss();build();root.setAlpha(0f);root.animate().alpha(1f).setDuration(260).start();}).setNegativeButton("Vazgeç",null).show();}
 void brokerDemo(){
  // Single paper-order entry point: broker demo and chart trading use the same ledger.
  // This avoids showing a disconnected calculator that never records an order.
  paperOrderDialog();
 }

 final java.util.ArrayList<PaperOrder> paperOrders=new java.util.ArrayList<>();
 final java.util.HashMap<String,java.math.BigDecimal> paperHoldings=new java.util.HashMap<>();
 final java.util.HashMap<String,java.math.BigDecimal> paperCost=new java.util.HashMap<>();
 final java.util.HashMap<String,java.math.BigDecimal> paperLastClose=new java.util.HashMap<>();
 final java.util.HashMap<String,Long> paperLastCandleTime=new java.util.HashMap<>();
 java.math.BigDecimal paperCash=new java.math.BigDecimal("100000");
 int paperSequence=0;
 static final class PaperOrder{
  final int id;final String symbol,side,type;final java.math.BigDecimal qty,price;
  final long createdAtEpochSeconds;
  String status;
  PaperOrder(int id,String symbol,String side,String type,java.math.BigDecimal qty,java.math.BigDecimal price,String status){this(id,symbol,side,type,qty,price,status,System.currentTimeMillis()/1000L);}
  PaperOrder(int id,String symbol,String side,String type,java.math.BigDecimal qty,java.math.BigDecimal price,String status,long createdAt){
   this.id=id;this.symbol=symbol;this.side=side;this.type=type;this.qty=qty;this.price=price;this.status=status;this.createdAtEpochSeconds=createdAt;
  }
 }
 void paperOrderDialog(){paperOrderDialog(null,Float.NaN);}
 void paperOrderDialog(String preferredSymbol){paperOrderDialog(preferredSymbol,Float.NaN);}
 void paperOrderDialog(String preferredSymbol,float preferredPrice){
  LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(24,8,24,8);
  // Reuse the chart market universe to avoid silently placing a demo order on a different asset.
  if(marketAsset==null||marketAsset.getCount()==0){new AlertDialog.Builder(this).setTitle("Demo emir kullanılamıyor").setMessage("Piyasa sembolleri henüz yüklenmedi. Önce Piyasalar ekranını açın.").setPositiveButton("Tamam",null).show();return;}
  String[] paperSymbols=new String[marketAsset.getCount()];for(int i=0;i<paperSymbols.length;i++)paperSymbols[i]=marketAsset.getItemAtPosition(i).toString();
  Spinner symbol=spin(paperSymbols,0);
  // Start a demo order with the asset currently visible on the chart.
  if(preferredSymbol==null&&marketAsset.getSelectedItem()!=null)preferredSymbol=marketAsset.getSelectedItem().toString();
  if(preferredSymbol!=null){boolean supported=false;for(int i=0;i<symbol.getCount();i++)if(preferredSymbol.equals(symbol.getItemAtPosition(i).toString())){symbol.setSelection(i);supported=true;break;}if(!supported){new AlertDialog.Builder(this).setTitle("Demo emir desteklenmiyor").setMessage(preferredSymbol+" için demo emir desteği henüz yok. Yanlış sembole emir açılmasını önlemek için işlem durduruldu.").setPositiveButton("Tamam",null).show();return;}}
  Spinner side=spin(new String[]{"BUY","SELL"},0);
  Spinner type=spin(new String[]{"LIMIT","MARKET (devre dışı)","STOP_LOSS (devre dışı)","TAKE_PROFIT (devre dışı)"},0);
  EditText qty=new EditText(this);qty.setHint("Adet");qty.setInputType(2|8192);
  EditText price=new EditText(this);price.setHint("Demo fiyat (USD)");price.setInputType(2|8192);if(Float.isFinite(preferredPrice)&&preferredPrice>0){price.setText(new java.math.BigDecimal(Float.toString(preferredPrice)).setScale(6,java.math.RoundingMode.HALF_UP).stripTrailingZeros().toPlainString());}
  form.addView(label("Sembol"));form.addView(symbol);form.addView(label("Yön"));form.addView(side);
  form.addView(label("Emir tipi"));form.addView(type);form.addView(label("Adet"));form.addView(qty);
  form.addView(label("Simüle edilen fiyat / limit"));form.addView(price);TextView exposure=label("Risk önizlemesi: miktar ve limit fiyatını girin.");form.addView(exposure);android.text.TextWatcher preview=new android.text.TextWatcher(){public void beforeTextChanged(CharSequence t,int start,int count,int after){}public void onTextChanged(CharSequence t,int start,int before,int count){try{java.math.BigDecimal q=new java.math.BigDecimal(qty.getText().toString().trim()),p=new java.math.BigDecimal(price.getText().toString().trim());if(q.signum()<=0||p.signum()<=0)throw new IllegalArgumentException();java.math.BigDecimal notional=q.multiply(p),reserved=java.math.BigDecimal.ZERO;for(PaperOrder o:paperOrders)if(o!=null&&"PENDING".equals(o.status)&&"BUY".equals(o.side)&&o.qty!=null&&o.price!=null&&o.qty.signum()>0&&o.price.signum()>0)reserved=reserved.add(o.qty.multiply(o.price));exposure.setText("Tahmini emir tutarı: $"+notional.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()+" • Kullanılabilir demo nakit: $"+paperCash.subtract(reserved).max(java.math.BigDecimal.ZERO).setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()+" • Ücret/spread hariç");}catch(Exception ex){exposure.setText("Risk önizlemesi: geçerli miktar ve fiyat girin.");}}public void afterTextChanged(android.text.Editable e){}};qty.addTextChangedListener(preview);price.addTextChangedListener(preview);
  AlertDialog d=new AlertDialog.Builder(this).setTitle("DEMO emir • gerçek işlem yok").setView(form).setNegativeButton("İptal",null).setPositiveButton("Kaydet",null).create();
  d.setOnShowListener(v->d.getButton(-1).setOnClickListener(w->{
   try{
    String q=qty.getText().toString().trim(),p=price.getText().toString().trim();
    if(!q.matches("[0-9]+(\\.[0-9]{1,6})?")||!p.matches("[0-9]+(\\.[0-9]{1,6})?"))throw new IllegalArgumentException();
    java.math.BigDecimal units=new java.math.BigDecimal(q),px=new java.math.BigDecimal(p);
    if(units.signum()<=0||px.signum()<=0||units.multiply(px).compareTo(new java.math.BigDecimal("1000000"))>0)throw new IllegalArgumentException();
    String sym=symbol.getSelectedItem().toString(),direction=side.getSelectedItem().toString(),kind=type.getSelectedItem().toString();
    if(sym.startsWith("FX:")||sym.startsWith("INDEX:")||sym.startsWith("CMD:")){price.setError("Bu piyasanın para birimi ve sözleşme çarpanı doğrulanmadan demo emir açılamaz.");return;}
    int removable=-1;
    if(paperOrders.size()>=200){
     for(int idx=0;idx<paperOrders.size();idx++){PaperOrder existing=paperOrders.get(idx);if(existing==null||!"PENDING".equals(existing.status)){removable=idx;break;}}
     if(removable<0){qty.setError("En fazla 200 açık demo emri; önce bekleyen emri iptal et");return;}
    }
    if("SELL".equals(direction)&&(paperHoldings.get(sym)==null||paperHoldings.get(sym).compareTo(units.add(paperOrders.stream().filter(o->o!=null&&"PENDING".equals(o.status)&&"SELL".equals(o.side)&&sym.equals(o.symbol)&&o.qty!=null&&o.qty.signum()>0).map(o->o.qty).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add)))<0)){qty.setError("Satış miktarı eldeki demo pozisyonunu aşamaz.");return;}if("BUY".equals(direction)&&paperCash.compareTo(units.multiply(px).add(paperOrders.stream().filter(o->o!=null&&"PENDING".equals(o.status)&&"BUY".equals(o.side)&&o.qty!=null&&o.price!=null&&o.qty.signum()>0&&o.price.signum()>0).map(o->o.qty.multiply(o.price)).reduce(java.math.BigDecimal.ZERO,java.math.BigDecimal::add)))<0){qty.setError("Bekleyen alış emirleri dahil demo nakit bakiyesi yetersiz.");return;}
    if(!"LIMIT".equals(kind)){
     price.setError("Yalnızca LIMIT demo emirleri etkin. MARKET / STOP_LOSS / TAKE_PROFIT güvenli yürütme ve tetikleme testleri tamamlanana kadar kapalı.");
     return;
    }
    if("BUY".equals(direction)&&paperCash.subtract(units.multiply(px)).signum()<0){qty.setError("Demo nakit bakiyesi yetersiz.");return;}
    if("SELL".equals(direction)&&(paperHoldings.get(sym)==null||paperHoldings.get(sym).compareTo(units)<0)){qty.setError("Demo pozisyon bakiyesi yetersiz.");return;}
    if(removable>=0)paperOrders.remove(removable);
    paperOrders.add(new PaperOrder(++paperSequence,sym,direction,kind,units,px,"PENDING"));persistPaperState();
    d.dismiss();if(chartView!=null)chartView.invalidate();paperDashboard();
   }catch(IllegalArgumentException e){qty.setError("Pozitif adet ve fiyat gir; maksimum 1 milyon USD");}
  }));
  d.show();
 }
 boolean paperFill(String sym,String side,java.math.BigDecimal qty,java.math.BigDecimal px){
  if(qty==null||px==null||sym==null||sym.trim().isEmpty()||side==null||qty.signum()<=0||px.signum()<=0||(!"BUY".equals(side)&&!"SELL".equals(side)))return false;
  java.math.BigDecimal value=qty.multiply(px);
  if(value.compareTo(new java.math.BigDecimal("1000000"))>0)return false;
  if(paperCash==null||paperCash.signum()<0)return false;
  java.math.BigDecimal held=paperHoldings.getOrDefault(sym,java.math.BigDecimal.ZERO);
  if(held==null||held.signum()<0)return false;
  java.math.BigDecimal storedCost=paperCost.getOrDefault(sym,java.math.BigDecimal.ZERO);
  if(storedCost==null||storedCost.signum()<0)return false;
  if(side.equals("BUY")){
   if(paperCash.compareTo(value)<0)return false;
   paperCash=paperCash.subtract(value);
   paperHoldings.put(sym,held.add(qty));
   paperCost.put(sym,storedCost.add(value));
  }else{
   if(held.compareTo(qty)<0)return false;
   java.math.BigDecimal oldCost=storedCost;
   if(oldCost==null||oldCost.signum()<0)return false;
   java.math.BigDecimal remaining=held.subtract(qty);
   paperCash=paperCash.add(value);paperHoldings.put(sym,remaining);
   paperCost.put(sym,remaining.signum()==0?java.math.BigDecimal.ZERO:oldCost.multiply(remaining).divide(held,16,java.math.RoundingMode.HALF_UP));
  }
  persistPaperState();return true;
 }
 void matchPaperLimits(String symbol,double lastClose,long completedCandleTime,long completedCandleEnd){if(symbol==null||symbol.trim().isEmpty()||!Double.isFinite(lastClose)||lastClose<=0||completedCandleTime<=0||completedCandleEnd<=completedCandleTime||completedCandleEnd>System.currentTimeMillis()/1000L)return;java.math.BigDecimal current=java.math.BigDecimal.valueOf(lastClose);boolean changed=false;for(PaperOrder order:paperOrders){if(order==null||!"PENDING".equals(order.status)||!"LIMIT".equals(order.type)||!symbol.equals(order.symbol)||completedCandleTime<order.createdAtEpochSeconds||order.qty==null||order.price==null||order.qty.signum()<=0||order.price.signum()<=0)continue;boolean crossed="BUY".equals(order.side)?current.compareTo(order.price)<=0:current.compareTo(order.price)>=0;if(!crossed)continue;// Use the recorded LIMIT price as the conservative simulated execution price.
 // Filling at a better candle close without storing that execution price corrupts P/L reports.
 java.math.BigDecimal simulatedFill=order.price;if(paperFill(order.symbol,order.side,order.qty,simulatedFill)){order.status="FILLED";changed=true;persistPaperState();}else if("BUY".equals(order.side)&&paperCash.compareTo(order.qty.multiply(simulatedFill))<0){order.status="REJECTED";changed=true;persistPaperState();}else if("SELL".equals(order.side)&&(paperHoldings.get(order.symbol)==null||paperHoldings.get(order.symbol).compareTo(order.qty)<0)){order.status="REJECTED";changed=true;persistPaperState();}}if(changed&&chartView!=null)chartView.invalidate();}
 void persistPaperState(){
  try{
   JSONObject data=new JSONObject();data.put("version",1);data.put("cash",paperCash.toPlainString());data.put("sequence",paperSequence);
   JSONObject holdings=new JSONObject(),costs=new JSONObject();
   for(String key:paperHoldings.keySet())holdings.put(key,paperHoldings.get(key).toPlainString());
   for(String key:paperCost.keySet())costs.put(key,paperCost.get(key).toPlainString());
   data.put("holdings",holdings);data.put("costs",costs);
   JSONArray orders=new JSONArray();
   for(PaperOrder o:paperOrders){if(o==null||o.qty==null||o.price==null||o.qty.signum()<=0||o.price.signum()<=0)continue;JSONObject item=new JSONObject();item.put("id",o.id);item.put("symbol",o.symbol);item.put("side",o.side);item.put("type",o.type);item.put("qty",o.qty.toPlainString());item.put("price",o.price.toPlainString());item.put("status",o.status);item.put("createdAt",o.createdAtEpochSeconds);orders.put(item);}
   data.put("orders",orders);
   getPreferences(MODE_PRIVATE).edit().putString("paper_state_v1",data.toString()).apply();
  }catch(Exception ignored){}
 }
 void restorePaperState(){
  try{
   String raw=getPreferences(MODE_PRIVATE).getString("paper_state_v1",null);if(raw==null)return;
   JSONObject data=new JSONObject(raw);if(data.optInt("version")!=1)return;
   java.math.BigDecimal cash=new java.math.BigDecimal(data.getString("cash"));
   if(cash.signum()<0||cash.compareTo(new java.math.BigDecimal("100000000"))>0)return;
   java.util.HashMap<String,java.math.BigDecimal> holdings=new java.util.HashMap<>(),costs=new java.util.HashMap<>();
   JSONObject h=data.getJSONObject("holdings"),c=data.getJSONObject("costs");
   java.util.Iterator<String> keys=h.keys();
   while(keys.hasNext()){String key=keys.next();java.math.BigDecimal qty=new java.math.BigDecimal(h.getString(key)),cost=new java.math.BigDecimal(c.getString(key));if(qty.signum()<0||cost.signum()<0)return;holdings.put(key,qty);costs.put(key,cost);}
   JSONArray arr=data.getJSONArray("orders");if(arr.length()>200)return;
   java.util.ArrayList<PaperOrder> restored=new java.util.ArrayList<>();int highest=0;
   for(int i=0;i<arr.length();i++){JSONObject item=arr.getJSONObject(i);int id=item.getInt("id");if(id<=0)return;String status=item.getString("status");if(!"PENDING".equals(status)&&!"FILLED".equals(status)&&!"CANCELLED".equals(status)&&!"REJECTED".equals(status))return;
    java.math.BigDecimal qty=new java.math.BigDecimal(item.getString("qty")),price=new java.math.BigDecimal(item.getString("price"));if(qty.signum()<=0||price.signum()<=0)return;
    PaperOrder order=new PaperOrder(id,item.getString("symbol"),item.getString("side"),item.getString("type"),qty,price,status,item.optLong("createdAt",0L));restored.add(order);highest=Math.max(highest,id);
   }
   paperCash=cash;paperHoldings.clear();paperHoldings.putAll(holdings);paperCost.clear();paperCost.putAll(costs);paperOrders.clear();paperOrders.addAll(restored);paperSequence=Math.max(highest,data.optInt("sequence"));
  }catch(Exception ignored){}
 }
 void paperDashboard(){
  StringBuilder out=new StringBuilder("DEMO • yerel cihazda kayıtlı • başlangıç 100.000 USD\n");
  int pendingCount=0,filledCount=0,cancelledCount=0,rejectedCount=0;
  for(PaperOrder o:paperOrders){if(o==null)continue;if("PENDING".equals(o.status))pendingCount++;else if("FILLED".equals(o.status))filledCount++;else if("CANCELLED".equals(o.status))cancelledCount++;else if("REJECTED".equals(o.status))rejectedCount++;}
  out.append("Açık pozisyonlar: ").append(paperHoldings.values().stream().filter(v->v!=null&&v.signum()>0).count()).append(" • Bekleyen: ").append(pendingCount).append(" • Gerçekleşen: ").append(filledCount).append(" • İptal: ").append(cancelledCount).append(" • Reddedilen: ").append(rejectedCount).append("\n");
  java.math.BigDecimal markedValue=java.math.BigDecimal.ZERO,unrealized=java.math.BigDecimal.ZERO;
  int missingQuotes=0;
  for(String asset:paperHoldings.keySet()){
   java.math.BigDecimal held=paperHoldings.get(asset);
   if(held==null||held.signum()<=0)continue;
   java.math.BigDecimal last=paperLastClose.get(asset);
   java.math.BigDecimal cost=paperCost.get(asset);
   if(last==null||last.signum()<=0||cost==null||cost.signum()<0){missingQuotes++;continue;}
   markedValue=markedValue.add(held.multiply(last));
   unrealized=unrealized.add(held.multiply(last).subtract(cost));
  }
  out.append("Fiyatı doğrulanamayan açık pozisyon: ").append(missingQuotes).append(" (toplam hesap değeri ve getiri eksik olabilir)\n");
  out.append("Gerçekleşmemiş K/Z (fiyatı bulunanlar): $").append(unrealized.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\n");
  if(missingQuotes==0){
   out.append("Tahmini toplam hesap değeri: $").append(paperCash.add(markedValue).setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\n");
  }else{
   out.append("Toplam hesap değeri hesaplanamadı: ").append(missingQuotes).append(" pozisyon için geçerli fiyat veya maliyet bilgisi yok.\n");
  }
  out.append("Not: Son kapanış fiyatları gecikmeli olabilir; komisyon ve spread dahil değildir.\n");
  java.math.BigDecimal realized=java.math.BigDecimal.ZERO,buyNotional=java.math.BigDecimal.ZERO,sellNotional=java.math.BigDecimal.ZERO;int buyFills=0,sellFills=0;for(PaperOrder order:paperOrders){if(order==null||!"FILLED".equals(order.status)||order.qty==null||order.price==null||order.qty.signum()<=0||order.price.signum()<=0)continue;java.math.BigDecimal amount=order.qty.multiply(order.price);if("BUY".equals(order.side)){buyNotional=buyNotional.add(amount);buyFills++;}else if("SELL".equals(order.side)){sellNotional=sellNotional.add(amount);sellFills++;}}java.math.BigDecimal heldCost=java.math.BigDecimal.ZERO;for(java.math.BigDecimal basis:paperCost.values())if(basis!=null&&basis.signum()>=0)heldCost=heldCost.add(basis);realized=paperCash.subtract(new java.math.BigDecimal("100000")).add(heldCost);out.append("DEMO PERFORMANS (komisyon/spread hariç)\n");out.append("Gerçekleşmiş K/Z: $").append(realized.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append(" • Açık K/Z: $").append(unrealized.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\n");out.append("Gerçekleşen alış/satış: ").append(buyFills).append("/").append(sellFills).append(" • İşlem hacmi: $").append(buyNotional.add(sellNotional).setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\n");if(missingQuotes==0)out.append("Toplam getiri: ").append(paperCash.add(markedValue).subtract(new java.math.BigDecimal("100000")).multiply(new java.math.BigDecimal("100")).divide(new java.math.BigDecimal("100000"),2,java.math.RoundingMode.HALF_UP).toPlainString()).append("%\n");  java.math.BigDecimal reservedBuy=java.math.BigDecimal.ZERO;for(PaperOrder order:paperOrders)if(order!=null&&"PENDING".equals(order.status)&&"BUY".equals(order.side)&&order.qty!=null&&order.price!=null&&order.qty.signum()>0&&order.price.signum()>0)reservedBuy=reservedBuy.add(order.qty.multiply(order.price));out.append("Nakit: $").append(paperCash.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\nBekleyen alış rezervi: $").append(reservedBuy.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\nKullanılabilir nakit: $").append(paperCash.subtract(reservedBuy).setScale(2,java.math.RoundingMode.HALF_UP).toPlainString()).append("\n\nPozisyonlar:\n");
  for(String sym:paperHoldings.keySet()){
   java.math.BigDecimal qty=paperHoldings.get(sym);
   if(qty!=null&&qty.signum()>0){java.math.BigDecimal basis=paperCost.getOrDefault(sym,java.math.BigDecimal.ZERO);if(basis==null||basis.signum()<0)basis=java.math.BigDecimal.ZERO;java.math.BigDecimal reservedUnits=java.math.BigDecimal.ZERO;for(PaperOrder pending:paperOrders)if(pending!=null&&"PENDING".equals(pending.status)&&"SELL".equals(pending.side)&&sym.equals(pending.symbol)&&pending.qty!=null&&pending.qty.signum()>0)reservedUnits=reservedUnits.add(pending.qty);out.append(sym).append(": ").append(qty.toPlainString()).append(" adet • satılabilir ").append(qty.subtract(reservedUnits).max(java.math.BigDecimal.ZERO).toPlainString()).append(" • rezerve ").append(reservedUnits.toPlainString()).append(" • maliyet $").append(basis.toPlainString());java.math.BigDecimal quote=paperLastClose.get(sym);if(quote!=null&&quote.signum()>0){java.math.BigDecimal marketValue=qty.multiply(quote),pnl=marketValue.subtract(basis);out.append(" • son kapanış $").append(quote.toPlainString()).append(" • gerçekleşmemiş K/Z $").append(pnl.setScale(2,java.math.RoundingMode.HALF_UP).toPlainString());}else out.append(" • K/Z: fiyat bekleniyor");out.append("\n");}
  }
  out.append("\nEmirler (LIMIT yalnızca tamamlanmış yeni mum kapanışında kontrol edilir):\n");
  out.append("Emir yürütme uyarısı: Simülasyon yalnızca kapanmış mumlarla çalışır; gerçek emir, anlık likidite veya garanti edilen dolum değildir.\n");
  out.append("Bekleyen satış rezervleri:\n");java.util.HashMap<String,java.math.BigDecimal> reservedSell=new java.util.HashMap<>();for(PaperOrder order:paperOrders)if(order!=null&&"PENDING".equals(order.status)&&"SELL".equals(order.side)&&order.symbol!=null&&order.qty!=null&&order.qty.signum()>0)reservedSell.put(order.symbol,reservedSell.getOrDefault(order.symbol,java.math.BigDecimal.ZERO).add(order.qty));if(reservedSell.isEmpty())out.append("Yok\n");else for(String asset:reservedSell.keySet()){java.math.BigDecimal held=paperHoldings.getOrDefault(asset,java.math.BigDecimal.ZERO);if(held==null||held.signum()<0)held=java.math.BigDecimal.ZERO;out.append(asset).append(": ").append(reservedSell.get(asset).toPlainString()).append(" rezerve • ").append(held.subtract(reservedSell.get(asset)).max(java.math.BigDecimal.ZERO).toPlainString()).append(" kullanılabilir\n");}
  for(int i=paperOrders.size()-1;i>=0;i--){
   PaperOrder o=paperOrders.get(i);
   if(o==null)continue;
   out.append("#").append(o.id).append(" ").append(o.symbol).append(" ").append(o.side).append(" ").append(o.type).append(" ").append(o.qty).append(" × $").append(o.price).append(" ").append(o.status).append("\n");
  }
  new AlertDialog.Builder(this).setTitle("DEMO portföy").setMessage(out.toString()).setPositiveButton("Kapat",null).setNeutralButton("Bekleyen emri iptal et",(d,w)->paperCancelDialog()).show();
 }
 void paperCancelDialog(){
  java.util.ArrayList<PaperOrder> pending=new java.util.ArrayList<>();
  for(PaperOrder o:paperOrders)if(o!=null&&"PENDING".equals(o.status)&&o.qty!=null&&o.price!=null&&o.qty.signum()>0&&o.price.signum()>0)pending.add(o);
  if(pending.isEmpty()){new AlertDialog.Builder(this).setMessage("Bekleyen demo emir yok.").setPositiveButton("Tamam",null).show();return;}
  String[] names=new String[pending.size()];
  for(int i=0;i<pending.size();i++){PaperOrder o=pending.get(i);names[i]="#"+o.id+" "+o.symbol+" "+o.side+" "+o.qty+" @ "+o.price+" USD • "+o.type;}
  new AlertDialog.Builder(this).setTitle("Bekleyen demo emri yönet").setItems(names,(d,index)->{
   PaperOrder selected=pending.get(index);
   new AlertDialog.Builder(this).setTitle("Emir #"+selected.id).setItems(new String[]{"Emri iptal et","Limit fiyatını düzenle","Miktarı düzenle"},(dialog,action)->{
    if(action==0){selected.status="CANCELLED";persistPaperState();if(chartView!=null)chartView.invalidate();paperDashboard();return;}
    EditText input=new EditText(this);input.setInputType(2|8192);input.setSingleLine(true);input.setText((action==2?selected.qty:selected.price).toPlainString());
    new AlertDialog.Builder(this).setTitle((action==2?"Yeni miktar":"Yeni LIMIT fiyatı")+" • #"+selected.id).setView(input).setNegativeButton("Vazgeç",null).setPositiveButton("Kaydet",(confirm,which)->{
     try{
      String raw=input.getText().toString().trim();if(!raw.matches("[0-9]+(\\.[0-9]{1,6})?"))throw new IllegalArgumentException();
      java.math.BigDecimal entered=new java.math.BigDecimal(raw);java.math.BigDecimal newPrice=action==2?selected.price:entered,newQty=action==2?entered:selected.qty;
      if(!"PENDING".equals(selected.status)||selected.qty==null||selected.price==null||newQty==null||newPrice==null||newQty.signum()<=0||newPrice.signum()<=0||newQty.multiply(newPrice).compareTo(new java.math.BigDecimal("1000000"))>0)throw new IllegalArgumentException("Emir artık beklemede değil veya miktar/fiyat geçersiz");
      java.math.BigDecimal reserved=java.math.BigDecimal.ZERO;
      if("BUY".equals(selected.side)){
       for(PaperOrder o:paperOrders)if(o!=null&&o!=selected&&"PENDING".equals(o.status)&&"BUY".equals(o.side)&&o.qty!=null&&o.price!=null&&o.qty.signum()>0&&o.price.signum()>0)reserved=reserved.add(o.qty.multiply(o.price));
       if(paperCash.compareTo(reserved.add(newQty.multiply(newPrice)))<0)throw new IllegalArgumentException("Yetersiz demo bakiye");
      }else if("SELL".equals(selected.side)){
       for(PaperOrder o:paperOrders)if(o!=null&&o!=selected&&"PENDING".equals(o.status)&&"SELL".equals(o.side)&&selected.symbol!=null&&selected.symbol.equals(o.symbol)&&o.qty!=null&&o.qty.signum()>0)reserved=reserved.add(o.qty);
       if(paperHoldings.getOrDefault(selected.symbol,java.math.BigDecimal.ZERO).compareTo(reserved.add(newQty))<0)throw new IllegalArgumentException("Yetersiz demo pozisyon");
      }
      selected.status="CANCELLED";
      paperOrders.add(new PaperOrder(++paperSequence,selected.symbol,selected.side,selected.type,newQty,newPrice,"PENDING"));
      persistPaperState();if(chartView!=null)chartView.invalidate();paperDashboard();
     }catch(Exception ex){new AlertDialog.Builder(this).setTitle("Demo emir değiştirilemedi").setMessage(ex instanceof IllegalArgumentException&&ex.getMessage()!=null?ex.getMessage():"Geçersiz fiyat veya miktar; emir değiştirilmedi.").setPositiveButton("Tamam",null).show();}
    }).show();
   }).show();
  }).setNegativeButton("Vazgeç",null).show();
 }
 void financePreview(String title){new AlertDialog.Builder(this).setTitle(title).setMessage("MARS-X Finance arayüz önizlemesi. Gerçek işlem veya hesap değişikliği yapılmaz.").setPositiveButton("Tamam",null).show();}
 void financeLine(LinearLayout parent,String key,String value){LinearLayout r=row();r.setPadding(18,18,18,18);r.setBackground(panel(RAISED,14,Color.rgb(37,48,66)));TextView left=t(key,14,Color.WHITE);r.addView(left,new LinearLayout.LayoutParams(0,-2,1));r.addView(t(value,12,MUTED));parent.addView(r,mp(7));}
 void health(){new Thread(()->{try{JSONObject j=get("/convert/health");boolean ok=j.optBoolean("configured",false);runOnUiThread(()->{status.setText(ok?"● Fiyat API hazır":"● Bağlantı Bekleniyor");status.setTextColor(ok?Color.rgb(0,220,160):Color.LTGRAY);});}catch(Exception e){runOnUiThread(()->status.setText("● Hizmet Bekleniyor"));}}).start();}
 void brokerHealth(){new Thread(()->{try{JSONObject j=get("/broker/health");JSONArray p=j.optJSONArray("providers");JSONObject b=p==null||p.length()==0?null:p.optJSONObject(0);boolean configured=b!=null&&b.optBoolean("configured",false);JSONObject prod=j.optJSONObject("production");boolean trading=prod!=null&&prod.optBoolean("liveTrading",false);String text=(configured?"lemon bağlantısı hazır":"lemon API anahtarı bekleniyor")+" • "+(trading?"production review hazır":"güvenlik kapıları kilitli");runOnUiThread(()->{brokerStatus.setText(text);brokerStatus.setTextColor(trading?Color.rgb(0,220,160):(configured?Color.rgb(255,190,90):Color.LTGRAY));});}catch(Exception e){runOnUiThread(()->brokerStatus.setText("Broker durumu alınamadı. Paper mod korunuyor."));}}).start();}
 void marketProviders(){new Thread(()->{try{JSONObject j=get("/market/providers");JSONArray p=j.optJSONArray("providers");ArrayList<String> ready=new ArrayList<>();if(p!=null)for(int i=0;i<p.length();i++){JSONObject x=p.optJSONObject(i);if(x!=null&&"DATA_READY".equals(x.optString("status")))ready.add(x.optString("id"));}String label=ready.isEmpty()?"Coinbase public feed • backend provider listesi boş":"Backend providers: "+String.join(" + ",ready);runOnUiThread(()->{if(marketProviders!=null)marketProviders.setText(label);});}catch(Exception e){runOnUiThread(()->{if(marketProviders!=null)marketProviders.setText("Coinbase public feed • backend provider listesi erişilemiyor");});}}).start();}
 String[] comparisonSymbols(){if(marketAsset==null)return new String[]{"Ana piyasa ile eşitle"};String[] symbols=new String[marketAsset.getCount()+1];symbols[0]="Ana piyasa ile eşitle";for(int i=0;i<marketAsset.getCount();i++)symbols[i+1]=marketAsset.getItemAtPosition(i).toString();return symbols;}
 void loadComparisonCrypto(ChartView target,String symbol){final int requestId=++target.comparisonRequestId;final int seconds=target.comparisonSeconds;new Thread(()->{try{String tf=seconds==60?"1m":seconds==300?"5m":seconds==900?"15m":seconds==3600?"1h":seconds==86400?"1D":seconds==14400?"4h":"6h";boolean crypto=symbol.endsWith("-USD")&&!symbol.startsWith("FX:")&&!symbol.startsWith("INDEX:")&&!symbol.startsWith("CMD:");if(!crypto&&seconds==21600)throw new IOException("6h not supported for Yahoo comparisons");if(crypto&&seconds==14400)throw new IOException("4h is currently for stocks and FX only");JSONArray data=crypto?getPublicCoinbaseCandles(symbol,seconds):symbol.startsWith("FX:")||symbol.startsWith("INDEX:")||symbol.startsWith("CMD:")?getPublicMacroCandles(symbol,tf):getPublicStockCandles(symbol,tf);if(data.length()==0)throw new IOException("No candles");JSONObject last=data.getJSONObject(data.length()-1);long candleTime=last.getLong("time"),now=System.currentTimeMillis()/1000L;if(candleTime>now+120L||now-candleTime>(crypto?Math.max(900L,3L*seconds):Math.max(259200L,3L*seconds)))throw new IOException("Stale comparison candles");double close=last.getDouble("close");if(!Double.isFinite(close)||close<=0)throw new IOException("Invalid comparison close");runOnUiThread(()->{if(screenActive&&comparisonCharts.contains(target)&&requestId==target.comparisonRequestId&&symbol.equals(target.drawingSymbol)){target.cryptoSession=crypto;target.setCandles(data);}});}catch(Exception ignored){runOnUiThread(()->{if(comparisonCharts.contains(target)&&requestId==target.comparisonRequestId&&symbol.equals(target.drawingSymbol))target.clear();});}}).start();}
 void chartSnapshot(){if(!screenActive||!tradingScreenVisible||marketAsset==null||marketTimeframe==null||chartView==null)return;final int requestGeneration=++chartRequestGeneration;final String symbol=marketAsset.getSelectedItem().toString(),tf=marketTimeframe.getSelectedItem().toString();final int seconds=new int[]{60,300,900,3600,21600,86400,14400}[marketTimeframe.getSelectedItemPosition()];String chartKey=symbol+"|"+tf;if(!chartKey.equals(displayedChartKey)){chartView.clear();for(ChartView extra:comparisonCharts)if(extra.drawingSymbol.isEmpty())extra.clear();displayedChartKey=chartKey;}marketPrice.setText(symbol+" • yükleniyor");new Thread(()->{try{boolean stock=!symbol.endsWith("-USD");boolean extended=symbol.startsWith("FX:")||symbol.startsWith("INDEX:")||symbol.startsWith("CMD:");if(stock&&tf.equals("6h"))throw new IOException("6h unsupported for Yahoo charts");if(!stock&&tf.equals("4h"))throw new IOException("4h is currently for stocks and FX only");JSONArray candles=extended?getPublicMacroCandles(symbol,tf):stock?getPublicStockCandles(symbol,tf):getPublicCoinbaseCandles(symbol,seconds);if(candles.length()==0)throw new IOException("No candles");long candleTime=candles.getJSONObject(candles.length()-1).getLong("time");long now=System.currentTimeMillis()/1000L;if(candleTime>now+120L||now-candleTime>(stock?Math.max(259200L,3L*seconds):Math.max(900L,3L*seconds)))throw new IOException("Stale candles");double close=candles.getJSONObject(candles.length()-1).getDouble("close");if(!Double.isFinite(close)||close<=0)throw new IOException("Invalid candle close");int completedIndex=candles.length()-1;while(completedIndex>=0&&candles.getJSONObject(completedIndex).getLong("time")+seconds>now)completedIndex--;final long completedTime=completedIndex>=0?candles.getJSONObject(completedIndex).getLong("time"):-1L;final double completedClose=completedIndex>=0?candles.getJSONObject(completedIndex).getDouble("close"):Double.NaN;runOnUiThread(()->{if(!screenActive||!tradingScreenVisible||requestGeneration!=chartRequestGeneration||marketAsset==null||!symbol.equals(marketAsset.getSelectedItem().toString())||!tf.equals(marketTimeframe.getSelectedItem().toString()))return;if(!symbol.equals(chartView.drawingSymbol)||!Float.isFinite(chartView.horizontalLevel)&&!Float.isFinite(chartView.trendX1)&&!Float.isFinite(chartView.trendX2)){chartView.horizontalLevel=Float.NaN;chartView.trendX1=Float.NaN;chartView.trendY1=Float.NaN;chartView.trendX2=Float.NaN;chartView.trendY2=Float.NaN;chartView.placeLevelOnTap=false;chartView.placeTrendOnTap=false;chartView.drawingSymbol=symbol;try{String raw=getPreferences(MODE_PRIVATE).getString("drawing_v1_"+symbol,null);if(raw!=null){JSONObject d=new JSONObject(raw);chartView.horizontalLevel=d.isNull("level")?Float.NaN:(float)d.getDouble("level");chartView.trendX1=d.isNull("x1")?Float.NaN:(float)d.getDouble("x1");chartView.trendY1=d.isNull("y1")?Float.NaN:(float)d.getDouble("y1");chartView.trendX2=d.isNull("x2")?Float.NaN:(float)d.getDouble("x2");chartView.trendY2=d.isNull("y2")?Float.NaN:(float)d.getDouble("y2");}}catch(Exception ignored){}}chartView.cryptoSession=!stock;chartView.setCandles(candles);paperLastClose.put(symbol,java.math.BigDecimal.valueOf(close));if(completedTime>=0){Long previousCandleTime=paperLastCandleTime.get(symbol);if(Double.isFinite(completedClose)&&completedClose>0&&(previousCandleTime==null||completedTime>previousCandleTime)){paperLastCandleTime.put(symbol,completedTime);if(previousCandleTime!=null)matchPaperLimits(symbol,completedClose,completedTime,completedTime+seconds);}}for(ChartView extra:comparisonCharts){if(extra.drawingSymbol.isEmpty()){extra.cryptoSession=!stock;extra.setCandles(candles);}}marketPrice.setText(symbol+"     "+String.format(Locale.ROOT,"%,.2f",close)+"     "+"Piyasa verisi"+" • "+tf);marketProviders.setText("Piyasa verisi"+" • "+tf+" • salt okunur");});}catch(Exception e){runOnUiThread(()->{if(screenActive&&tradingScreenVisible&&requestGeneration==chartRequestGeneration&&marketAsset!=null&&marketTimeframe!=null&&symbol.equals(marketAsset.getSelectedItem().toString())&&tf.equals(marketTimeframe.getSelectedItem().toString())){marketPrice.setText(symbol+" • veri alınamadı");marketProviders.setText("Canlı piyasa bağlantısı başarısız • yeniden seçim yaparak dene");chartView.clear();for(ChartView extra:comparisonCharts)if(extra.drawingSymbol.isEmpty())extra.clear();}});}}).start();}
 JSONArray getPublicMacroCandles(String symbol,String timeframe)throws Exception{String ticker;switch(symbol){case "FX:EUR/USD":ticker="EURUSD=X";break;case "FX:GBP/USD":ticker="GBPUSD=X";break;case "FX:USD/JPY":ticker="JPY=X";break;case "INDEX:SP500":ticker="^GSPC";break;case "INDEX:NASDAQ":ticker="^IXIC";break;case "INDEX:DOW":ticker="^DJI";break;case "CMD:GOLD":ticker="GC=F";break;case "CMD:SILVER":ticker="SI=F";break;case "CMD:OIL":ticker="CL=F";break;default:throw new IOException("Unsupported macro symbol");}return getYahooCandles(ticker,timeframe);}
 JSONArray getPublicStockCandles(String symbol,String timeframe)throws Exception{
  if(!Arrays.asList("AAPL","MSFT","NVDA","TSLA","SPY","AMZN","GOOGL","GOOG","META","NFLX","AMD","INTC","AVGO","ORCL","CRM","ADBE","QCOM","TXN","MU","AMAT","ASML","IBM","CSCO","NOW","PLTR","UBER","ABNB","SHOP","PYPL","SQ","COIN","HOOD","JPM","BAC","WFC","GS","MS","C","V","MA","AXP","BRK-B","UNH","JNJ","PFE","MRK","ABBV","LLY","TMO","ABT","MDT","ISRG","NVO","WMT","COST","TGT","HD","LOW","NKE","MCD","SBUX","KO","PEP","PG","CL","DIS","CMCSA","T","VZ","TMUS","BA","CAT","DE","GE","HON","LMT","RTX","NOC","F","GM","RIVN","LCID","XOM","CVX","COP","SLB","OXY","EOG","NEM","FCX","GLD","SLV","USO","IWM","QQQ","DIA","VOO","VTI","XLK","XLF","XLE","XLI","XLY","XLP","XLU","XLV","XLB","ARKK","TLT","IEF","HYG","LQD","EEM","EFA","EWJ","FXI","BABA","PDD","JD","BIDU","TSM","SAP","SONY","RY","TD","BMO","ENB","SU","BP","SHEL","RIO","BHP","VALE").contains(symbol))throw new IOException("Unsupported stock");
  String interval,range;
  if(symbol==null||symbol.length()>16||!symbol.matches("[A-Z0-9.\\-]+"))throw new IOException("Invalid stock ticker");
  switch(timeframe){
   case "1m":interval="1m";range="5d";break;
   case "5m":interval="5m";range="5d";break;
   case "15m":interval="15m";range="5d";break;
   case "1h":interval="60m";range="1mo";break;case "4h":interval="60m";range="1mo";break;
   case "1D":interval="1d";range="6mo";break;
   default:throw new IOException("Unsupported stock timeframe");
  }
  return getYahooCandles(symbol,timeframe);
 }
 JSONArray getYahooCandles(String symbol,String timeframe)throws Exception{
  String interval,range;
  switch(timeframe){case "1m":interval="1m";range="5d";break;case "5m":interval="5m";range="5d";break;case "15m":interval="15m";range="5d";break;case "1h":interval="60m";range="1mo";break;case "4h":interval="60m";range="1mo";break;case "1D":interval="1d";range="6mo";break;default:throw new IOException("Unsupported timeframe");}
  URL url=new URL("https://query1.finance.yahoo.com/v8/finance/chart/"+enc(symbol)+"?interval="+interval+"&range="+range);
  HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","Mozilla/5.0");
  JSONObject json;try{if(c.getResponseCode()!=200)throw new IOException("Stock data HTTP "+c.getResponseCode());json=new JSONObject(read(c.getInputStream()));}finally{c.disconnect();}
  JSONArray results=json.getJSONObject("chart").getJSONArray("result");if(results.length()==0)throw new IOException("No stock data");
  JSONObject r=results.getJSONObject(0);JSONArray times=r.getJSONArray("timestamp");JSONObject q=r.getJSONObject("indicators").getJSONArray("quote").getJSONObject(0);
  JSONArray opens=q.getJSONArray("open"),highs=q.getJSONArray("high"),lows=q.getJSONArray("low"),closes=q.getJSONArray("close"),volumes=q.getJSONArray("volume");
  JSONArray candles=new JSONArray();
  for(int i=0;i<times.length();i++){
   if(i>=opens.length()||i>=highs.length()||i>=lows.length()||i>=closes.length()||i>=volumes.length()||opens.isNull(i)||highs.isNull(i)||lows.isNull(i)||closes.isNull(i))continue;
   double o=opens.getDouble(i),h=highs.getDouble(i),l=lows.getDouble(i),close=closes.getDouble(i),v=volumes.isNull(i)?0:volumes.getDouble(i);
   if(!Double.isFinite(o)||!Double.isFinite(h)||!Double.isFinite(l)||!Double.isFinite(close)||!Double.isFinite(v)||l<=0||o<=0||close<=0||h<l||h<Math.max(o,close)||l>Math.min(o,close)||v<0)continue;
   JSONObject item=new JSONObject();item.put("time",times.getLong(i));item.put("open",o);item.put("high",h);item.put("low",l);item.put("close",close);item.put("volume",v);candles.put(item);
  }
  return "4h".equals(timeframe)?aggregateFourHourCandles(candles):candles;
 }
 JSONArray aggregateFourHourCandles(JSONArray hourly)throws Exception{
  JSONArray result=new JSONArray();JSONObject bar=null;long bucket=Long.MIN_VALUE;
  for(int i=0;i<hourly.length();i++){JSONObject c=hourly.getJSONObject(i);long timestamp=c.getLong("time");long b=(timestamp/14400L)*14400L;if(b!=bucket){if(bar!=null)result.put(bar);bar=new JSONObject();bar.put("time",b);bar.put("open",c.getDouble("open"));bar.put("high",c.getDouble("high"));bar.put("low",c.getDouble("low"));bar.put("close",c.getDouble("close"));bar.put("volume",c.getDouble("volume"));bucket=b;}else{bar.put("high",Math.max(bar.getDouble("high"),c.getDouble("high")));bar.put("low",Math.min(bar.getDouble("low"),c.getDouble("low")));bar.put("close",c.getDouble("close"));bar.put("volume",bar.getDouble("volume")+c.getDouble("volume"));}}
  if(bar!=null)result.put(bar);return result;
 }
 JSONArray getPublicCoinbaseCandles(String symbol,int granularity)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL("https://api.exchange.coinbase.com/products/"+enc(symbol)+"/candles?granularity="+granularity).openConnection();c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","MARS-X-Finance/0.9");int code=c.getResponseCode();if(code!=200){c.disconnect();throw new IOException("Coinbase HTTP "+code);}JSONArray raw;try(InputStream stream=c.getInputStream()){raw=new JSONArray(read(stream));}finally{c.disconnect();}JSONArray candles=new JSONArray();for(int i=raw.length()-1;i>=0;i--){JSONArray x=raw.getJSONArray(i);JSONObject item=new JSONObject();item.put("time",x.getLong(0));item.put("open",x.getDouble(3));item.put("high",x.getDouble(2));item.put("low",x.getDouble(1));item.put("close",x.getDouble(4));item.put("volume",x.getDouble(5));candles.put(item);}return candles;}
 void quote(){
  final int requestGeneration=++quoteRequestGeneration;
  String f=asset(from),tt=asset(to),a=amount.getText().toString().trim(),fn=net(fromNet),tn=net(toNet);
  if(!a.matches("[0-9]+(\\.[0-9]{1,12})?")){result.setText("Geçerli bir miktar gir.");return;}
  final double quantity;
  try{quantity=Double.parseDouble(a);}catch(NumberFormatException e){result.setText("Geçerli bir miktar gir.");return;}
  if(!Double.isFinite(quantity)||quantity<=0){result.setText("Miktar sıfırdan büyük olmalı.");return;}
  if(quantity>1000000000d){result.setText("Önizleme miktarı çok büyük.");return;}
  if(f.equals(tt)){result.setText("Aynı coin için dönüşüm teklifi verilmez. Ağlar arası transfer bu önizlemede desteklenmiyor.");return;}
  result.setText("Minimum tutar ve fiyat hesaplanıyor…");
  new Thread(()->{
   try{
    String route="fromCurrency="+enc(f)+"&toCurrency="+enc(tt)+"&fromNetwork="+enc(fn)+"&toNetwork="+enc(tn)+"&flow=standard";
    JSONObject m=get("/convert/min-amount?"+route);JSONObject md=m.optJSONObject("data");
    double min=md==null?Double.NaN:md.optDouble("minAmount",Double.NaN);
    if(!Double.isFinite(min)||min<=0){throw new IOException("Minimum amount unavailable");}
    if(quantity<min){
     String msg="Minimum tutar: "+min+" "+f.toUpperCase(Locale.ROOT)+"\\nSeçilen ağ: "+fn.toUpperCase(Locale.ROOT)+" → "+tn.toUpperCase(Locale.ROOT)+"\\nİşlem oluşturulmadı.";
     runOnUiThread(()->{if(screenActive&&tradingScreenVisible&&requestGeneration==quoteRequestGeneration&&result!=null)result.setText(msg);});return;
    }
    JSONObject j=get("/convert/quote?"+route+"&fromAmount="+enc(a));JSONObject d=j.optJSONObject("data");
    String est=d==null?"":d.optString("toAmount",d.optString("estimatedAmount",""));
    double received;
    try{received=Double.parseDouble(est);}catch(NumberFormatException badQuote){throw new IOException("Invalid provider quote");}
    if(!Double.isFinite(received)||received<=0)throw new IOException("Invalid provider quote");
    String fee=d.optString("fee",d.optString("networkFee","—"));
    String minText=Double.isFinite(min)?String.valueOf(min):"—";
    String out="Minimum tutar: "+minText+" "+f.toUpperCase(Locale.ROOT)+"\\nTahmini alacağın miktar: "+est+" "+tt.toUpperCase(Locale.ROOT)+"\\nAğ/komisyon: "+fee+"\\nİşlem oluşturulmadı.";
    runOnUiThread(()->{if(screenActive&&tradingScreenVisible&&requestGeneration==quoteRequestGeneration&&result!=null)result.setText(out);});
   }catch(ApiException e){runOnUiThread(()->{if(screenActive&&tradingScreenVisible&&requestGeneration==quoteRequestGeneration&&result!=null)result.setText(errorMessage(e));});}
   catch(Exception e){runOnUiThread(()->{if(screenActive&&tradingScreenVisible&&requestGeneration==quoteRequestGeneration&&result!=null)result.setText("Fiyat servisi şu anda kullanılamıyor. İşlem oluşturulmadı.");});}
  }).start();
 }
 String errorMessage(ApiException e){String k=e.body.optString("kind","");if("authentication".equals(k))return "Fiyat API anahtarı backend tarafında hazır değil. İşlem oluşturulmadı.";if("request_rejected".equals(k))return "Bu coin/ağ çifti desteklenmiyor ya da minimum tutarın altında. İşlem oluşturulmadı.";if("timeout".equals(k)||"provider_unavailable".equals(k)||"rate_limited".equals(k))return "Fiyat sağlayıcı şu an yanıt vermiyor. Biraz sonra tekrar dene. İşlem oluşturulmadı.";return "Fiyat servisi şu anda kullanılamıyor. İşlem oluşturulmadı.";}
 JSONObject get(String p)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.MARSX_FINANCE_API_BASE_URL+p).openConnection();
  try{
   c.setConnectTimeout(7000);c.setReadTimeout(7000);c.setRequestProperty("Accept","application/json");
   int code=c.getResponseCode();
   InputStream in=code>=400?c.getErrorStream():c.getInputStream();
   String body=in==null?"":read(in);
   if(code>=400)throw new ApiException(code,body);
   if(code<200||code>=300)throw new IOException("Unexpected HTTP "+code);
   return new JSONObject(body);
  }finally{c.disconnect();}
 }
 String read(InputStream in)throws Exception{try(BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){StringBuilder b=new StringBuilder();char[] buf=new char[8192];int n;while((n=r.read(buf))!=-1){if(b.length()+n>262144)throw new IOException("Response too large");b.append(buf,0,n);}return b.toString();}}
 String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}String asset(Spinner s){return s.getSelectedItem().toString().split(" ")[0].toLowerCase(Locale.ROOT);}String net(Spinner s){String v=s.getSelectedItem().toString().toLowerCase(Locale.ROOT);if(v.contains("bitcoin"))return "btc";if(v.contains("ethereum"))return "eth";if(v.contains("solana"))return "sol";return "bsc";}
 static final class ApiException extends IOException{final int code;final JSONObject body;ApiException(int c,String b){super("HTTP "+c);code=c;JSONObject j;try{j=new JSONObject(b==null?"{}":b);}catch(Exception e){j=new JSONObject();}body=j;}}
 Spinner spin(String[] a,int i){Spinner s=new Spinner(this);ArrayAdapter<String>d=new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,a){public View getView(int p,View v,android.view.ViewGroup g){TextView x=(TextView)super.getView(p,v,g);x.setTextColor(Color.WHITE);x.setTextSize(17);x.setPadding(18,18,18,18);x.setBackgroundColor(CARD);return x;}};s.setAdapter(d);s.setSelection(i);return s;}
 TextView label(String x){TextView v=t(x,12,MUTED);v.setLetterSpacing(.05f);return v;}
 void feature(LinearLayout r,String x){TextView v=t(x,12,Color.WHITE);v.setBackground(pill(Color.rgb(12,17,27),Color.rgb(38,49,68)));v.setPadding(12,8,12,8);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(3,0,3,0);r.addView(v,p);}
 LinearLayout card(){LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setPadding(22,20,22,22);c.setBackground(round(CARD,22));return c;}LinearLayout row(){LinearLayout r=new LinearLayout(this);r.setOrientation(LinearLayout.HORIZONTAL);r.setGravity(Gravity.CENTER_VERTICAL);return r;}
 TextView t(String x,int z,int col){TextView v=new TextView(this);v.setText(x);v.setTextSize(z);v.setTextColor(col);v.setPadding(0,8,0,8);return v;}void oneLine(TextView v){v.setSingleLine(true);v.setEllipsize(android.text.TextUtils.TruncateAt.END);}void title(String x,int z){TextView v=t(x,z,Color.WHITE);v.setTypeface(null,Typeface.BOLD);root.addView(v);}void muted(String x){root.addView(t(x,14,MUTED));}
 LinearLayout.LayoutParams mp(int top){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.topMargin=top;return p;}GradientDrawable round(int col,int rad){GradientDrawable g=new GradientDrawable();g.setColor(col);g.setCornerRadius(rad);return g;}GradientDrawable pill(int col,int stroke){GradientDrawable g=round(col,999);g.setStroke(1,stroke);return g;}GradientDrawable panel(int col,int rad,int stroke){GradientDrawable g=round(col,rad);g.setStroke(2,stroke);return g;}GradientDrawable box(){GradientDrawable g=round(Color.rgb(16,23,34),16);g.setStroke(1,Color.rgb(56,32,82));return g;}
 final class ChartView extends View{
  final Paint p=new Paint(3); final ArrayList<float[]> candles=new ArrayList<>(); int accent=Color.rgb(255,112,0);
  boolean replayActive=false,volumeProfileEnabled=false;int replayEnd=0;int visibleCount=48,scrollBack=0,chartStyle=0,smaPeriod=20,emaPeriod=21;String drawingSymbol="";int comparisonRequestId=0,comparisonSeconds=60;boolean cryptoSession=false,placeLevelOnTap=false,placeTrendOnTap=false;float horizontalLevel=Float.NaN,trendX1=Float.NaN,trendY1=Float.NaN,trendX2=Float.NaN,trendY2=Float.NaN;float downX,downY,touchStartX,touchStartY;boolean dragging=false,touchMoved=false;
  ChartView(Context context){super(context);setBackgroundColor(Color.rgb(7,12,19));}
  void clear(){replayActive=false;replayEnd=0;candles.clear();horizontalLevel=Float.NaN;trendX1=Float.NaN;trendY1=Float.NaN;trendX2=Float.NaN;trendY2=Float.NaN;placeLevelOnTap=false;placeTrendOnTap=false;scrollBack=0;invalidate();setContentDescription("Piyasa verisi bekleniyor");}
  void setCandles(JSONArray raw){
   ArrayList<float[]> valid=new ArrayList<>();long lastTime=Long.MIN_VALUE;
   for(int i=0;i<raw.length();i++)try{
    JSONObject x=raw.getJSONObject(i);long time=x.getLong("time");
    double o=x.getDouble("open"),h=x.getDouble("high"),l=x.getDouble("low"),close=x.getDouble("close"),vol=x.getDouble("volume");
    if(time<=lastTime||!Double.isFinite(o)||!Double.isFinite(h)||!Double.isFinite(l)||!Double.isFinite(close)||!Double.isFinite(vol)||l<=0||o<=0||close<=0||h<Math.max(o,close)||l>Math.min(o,close)||l>h||vol<0||h>Float.MAX_VALUE||o>Float.MAX_VALUE||l>Float.MAX_VALUE||close>Float.MAX_VALUE||vol>Float.MAX_VALUE)continue;
    valid.add(new float[]{(float)o,(float)h,(float)l,(float)close,(float)vol,(float)(time/86400L)});lastTime=time;
   }catch(Exception ignored){}
   candles.clear();candles.addAll(valid);replayActive=false;replayEnd=0;scrollBack=0;invalidate();
   setContentDescription(valid.isEmpty()?"Piyasa verisi bekleniyor":valid.size()+" mum; yakınlaştırma ve yatay kaydırma destekleniyor");
  }
  void zoom(int direction){visibleCount=Math.max(12,Math.min(120,visibleCount+direction*12));scrollBack=Math.min(scrollBack,Math.max(0,candles.size()-visibleCount));invalidate();}
  @Override public boolean onTouchEvent(android.view.MotionEvent event){
   if(event.getActionMasked()==android.view.MotionEvent.ACTION_DOWN){downX=event.getX();downY=event.getY();touchStartX=downX;touchStartY=downY;touchMoved=false;dragging=true;return true;}
   if(event.getActionMasked()==android.view.MotionEvent.ACTION_MOVE&&dragging){if(Math.abs(event.getX()-touchStartX)>18f||Math.abs(event.getY()-touchStartY)>18f)touchMoved=true;if(placeLevelOnTap||placeTrendOnTap)return true;float dx=event.getX()-downX;float cell=Math.max(4,getWidth()/(float)Math.max(12,visibleCount));int shift=(int)(dx/cell);if(shift!=0){scrollBack=Math.max(0,Math.min(Math.max(0,candles.size()-visibleCount),scrollBack+shift));downX=event.getX();invalidate();}return true;}
   if(event.getActionMasked()==android.view.MotionEvent.ACTION_UP){if(placeTrendOnTap&&!touchMoved&&event.getY()>=24f&&event.getY()<=24f+getHeight()*.52f&&Math.abs(event.getX()-touchStartX)<18f&&Math.abs(event.getY()-touchStartY)<18f){int e=Math.max(0,candles.size()-scrollBack),st=Math.max(0,e-visibleCount),n=e-st;float hi=Float.NEGATIVE_INFINITY,lo=Float.POSITIVE_INFINITY;for(int k=st;k<e;k++){hi=Math.max(hi,candles.get(k)[1]);lo=Math.min(lo,candles.get(k)[2]);}if(n>0&&hi>=lo){float spread=Math.max(.000001f,hi-lo);hi+=spread*.04f;lo=Math.max(0,lo-spread*.04f);float cellWidth=(getWidth()-26f)/n;float index=st+(event.getX()-14f)/Math.max(.0001f,cellWidth)-.5f;float price=hi-Math.max(0,Math.min(1,(event.getY()-24f)/Math.max(1f,getHeight()*.52f)))*(hi-lo);if(!Float.isFinite(trendX1)||Float.isFinite(trendX2)){trendX1=index;trendY1=price;trendX2=Float.NaN;trendY2=Float.NaN;}else{trendX2=index;trendY2=price;placeTrendOnTap=false;}invalidate();}}if(placeLevelOnTap&&!touchMoved&&event.getY()>=24f&&event.getY()<=24f+getHeight()*.52f&&Math.abs(event.getX()-touchStartX)<18f&&Math.abs(event.getY()-touchStartY)<18f&&!candles.isEmpty()){int end=replayActive?Math.min(candles.size(),Math.max(0,replayEnd)):Math.max(0,candles.size()-scrollBack),start=Math.max(0,end-visibleCount);float hi=Float.NEGATIVE_INFINITY,lo=Float.POSITIVE_INFINITY;for(int i=start;i<end;i++){hi=Math.max(hi,candles.get(i)[1]);lo=Math.min(lo,candles.get(i)[2]);}if(hi>lo){float range=hi-lo;hi+=range*.04f;lo=Math.max(0,lo-range*.04f);float fraction=Math.max(0,Math.min(1,(event.getY()-24f)/Math.max(1f,getHeight()*.52f)));horizontalLevel=hi-fraction*(hi-lo);placeLevelOnTap=false;invalidate();}}dragging=false;performClick();return true;}
   if(event.getActionMasked()==android.view.MotionEvent.ACTION_CANCEL){dragging=false;return true;}
   return super.onTouchEvent(event);
  }
  @Override public boolean performClick(){super.performClick();return true;}
  @Override protected void onDraw(Canvas canvas){
   super.onDraw(canvas);int w=getWidth(),h=getHeight();if(w<20||h<20)return;
   int left=14,right=12,top=24,plotH=(int)(h*.52f),volumeTop=top+plotH+12,volumeH=Math.max(12,(int)(h*.12f));
   p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);p.setColor(Color.rgb(36,46,59));
   for(int k=0;k<=4;k++){float y=top+plotH*k/4f;canvas.drawLine(left,y,w-right,y,p);}
   if(candles.isEmpty()){p.setStyle(Paint.Style.FILL);p.setTextSize(26);p.setTextAlign(Paint.Align.CENTER);p.setColor(Color.LTGRAY);canvas.drawText("VERİ BEKLENİYOR",w/2f,h/2f,p);p.setTextAlign(Paint.Align.LEFT);return;}
   int end=replayActive?Math.min(candles.size(),Math.max(0,replayEnd)):Math.max(0,candles.size()-scrollBack),start=Math.max(0,end-visibleCount),count=end-start;if(count<=0)return;
   float high=Float.NEGATIVE_INFINITY,low=Float.POSITIVE_INFINITY,maxVol=1;
   for(int i=start;i<end;i++){float[] a=candles.get(i);high=Math.max(high,a[1]);low=Math.min(low,a[2]);maxVol=Math.max(maxVol,a[4]);}
   float range=Math.max(.000001f,high-low);high+=range*.04f;low=Math.max(0,low-range*.04f);
   if(volumeProfileEnabled&&high>low){final int bins=24;double[] totals=new double[bins];double maxBucket=0;for(int k=start;k<end;k++){float[] bar=candles.get(k);if(bar[4]<=0)continue;int a=Math.max(0,Math.min(bins-1,(int)((bar[2]-low)/(high-low)*bins)));int b=Math.max(0,Math.min(bins-1,(int)((bar[1]-low)/(high-low)*bins)));int covered=b-a+1;for(int n=a;n<=b;n++){totals[n]+=bar[4]/covered;maxBucket=Math.max(maxBucket,totals[n]);}}if(maxBucket>0){canvas.save();canvas.clipRect(left,top,w-right,top+plotH);p.setStyle(Paint.Style.FILL);p.setColor(Color.argb(80,255,140,35));float maxWidth=(w-left-right)*.24f;for(int n=0;n<bins;n++){float barWidth=(float)(maxWidth*totals[n]/maxBucket);float yTop=top+plotH*(1f-(n+1f)/bins),yBottom=top+plotH*(1f-n/(float)bins);canvas.drawRect(w-right-barWidth,yTop,w-right,yBottom,p);}canvas.restore();}}float cell=(w-left-right)/(float)count,body=Math.max(2,cell*.60f);
   Path closeLine=new Path(),sma=new Path(),ema=new Path(),upperBand=new Path(),lowerBand=new Path(),vwapPath=new Path();boolean started=false,emaStarted=false,bandStarted=false,vwapStarted=false;double vwapPV=0,vwapVol=0;
   double emaValue=0,alpha=2.0/(emaPeriod+1.0);long lastSession=Long.MIN_VALUE;
   for(int j=0;j<start;j++){float[] b=candles.get(j);float price=b[3];emaValue=j==0?price:alpha*price+(1-alpha)*emaValue;long session=(long)b[5];if(session!=lastSession){vwapPV=0;vwapVol=0;}lastSession=session;double vol=b[4];vwapPV+=((b[1]+b[2]+b[3])/3.0)*vol;vwapVol+=vol;}

   for(int i=start;i<end;i++){
    float[] a=candles.get(i);float cx=left+(i-start+.5f)*cell;
    float yo=y(a[0],high,low,top,plotH),yh=y(a[1],high,low,top,plotH),yl=y(a[2],high,low,top,plotH),yc=y(a[3],high,low,top,plotH);if(i==start)closeLine.moveTo(cx,yc);else closeLine.lineTo(cx,yc);
    p.setColor(a[3]>=a[0]?Color.rgb(22,199,132):Color.rgb(234,57,67));p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);if(chartStyle==0)canvas.drawLine(cx,yh,cx,yl,p);
    p.setStyle(Paint.Style.FILL);if(chartStyle==0)canvas.drawRect(cx-body/2,Math.min(yo,yc),cx+body/2,Math.max(yo,yc)+1,p);
    p.setColor(Color.argb(140,148,165,185));canvas.drawRect(cx-body/2,volumeTop+volumeH*(1-a[4]/maxVol),cx+body/2,volumeTop+volumeH,p);
    if(i>=smaPeriod-1){double sum=0,sumSq=0;for(int j=i-smaPeriod+1;j<=i;j++){double v=candles.get(j)[3];sum+=v;sumSq+=v*v;}double avg=sum/smaPeriod;float sy=y((float)avg,high,low,top,plotH);if(!started){sma.moveTo(cx,sy);started=true;}else sma.lineTo(cx,sy);
     double bbSum=0,bbSq=0;for(int j=i-19;j<=i;j++){double v=candles.get(j)[3];bbSum+=v;bbSq+=v*v;}double bbAvg=bbSum/20;double deviation=Math.sqrt(Math.max(0,bbSq/20-bbAvg*bbAvg));float uy=y((float)(bbAvg+2*deviation),high,low,top,plotH),ly=y((float)(bbAvg-2*deviation),high,low,top,plotH);if(i>=19&&!bandStarted){upperBand.moveTo(cx,uy);lowerBand.moveTo(cx,ly);bandStarted=true;}else if(i>=19){upperBand.lineTo(cx,uy);lowerBand.lineTo(cx,ly);}
    }
    if(i>=19&&i<smaPeriod-1){double bbSum=0,bbSq=0;for(int j=i-19;j<=i;j++){double close=candles.get(j)[3];bbSum+=close;bbSq+=close*close;}double avg20=bbSum/20;double dev20=Math.sqrt(Math.max(0,bbSq/20-avg20*avg20));float uy=y((float)(avg20+2*dev20),high,low,top,plotH),ly=y((float)(avg20-2*dev20),high,low,top,plotH);if(!bandStarted){upperBand.moveTo(cx,uy);lowerBand.moveTo(cx,ly);bandStarted=true;}else{upperBand.lineTo(cx,uy);lowerBand.lineTo(cx,ly);}}
    long session=(long)a[5];if(session!=lastSession){vwapPV=0;vwapVol=0;vwapStarted=false;}lastSession=session;double v=a[4];vwapPV+=((a[1]+a[2]+a[3])/3.0)*v;vwapVol+=v;if(vwapVol>0){float vy=y((float)(vwapPV/vwapVol),high,low,top,plotH);if(!vwapStarted){vwapPath.moveTo(cx,vy);vwapStarted=true;}else vwapPath.lineTo(cx,vy);}emaValue=i==0?a[3]:alpha*a[3]+(1-alpha)*emaValue;float ey=y((float)emaValue,high,low,top,plotH);if(!emaStarted){ema.moveTo(cx,ey);emaStarted=true;}else ema.lineTo(cx,ey);
   }
   canvas.save();canvas.clipRect(left,top,w-right,top+plotH);if(chartStyle!=0){p.setColor(accent);p.setStrokeWidth(2.5f);p.setStyle(Paint.Style.STROKE);if(chartStyle==2){Path area=new Path(closeLine);area.lineTo(left+(count-.5f)*cell,top+plotH);area.lineTo(left+.5f*cell,top+plotH);area.close();p.setColor(Color.argb(65,Color.red(accent),Color.green(accent),Color.blue(accent)));p.setStyle(Paint.Style.FILL);canvas.drawPath(area,p);}p.setStyle(Paint.Style.STROKE);p.setColor(accent);canvas.drawPath(closeLine,p);}p.setStyle(Paint.Style.STROKE);p.setColor(accent);p.setStrokeWidth(2.5f);canvas.drawPath(sma,p);p.setColor(Color.rgb(66,176,245));canvas.drawPath(ema,p);p.setColor(Color.argb(160,175,120,245));p.setStrokeWidth(1.5f);canvas.drawPath(upperBand,p);canvas.drawPath(lowerBand,p);p.setColor(Color.rgb(245,189,75));p.setStrokeWidth(2);canvas.drawPath(vwapPath,p);canvas.restore();
   if(Float.isFinite(trendX1)&&Float.isFinite(trendX2)){canvas.save();canvas.clipRect(left,top,w-right,top+plotH);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(3);p.setColor(Color.CYAN);canvas.drawLine(left+(trendX1-start+.5f)*cell,top+(high-trendY1)/Math.max(.000001f,high-low)*plotH,left+(trendX2-start+.5f)*cell,top+(high-trendY2)/Math.max(.000001f,high-low)*plotH,p);canvas.restore();}if(this==chartView&&marketAsset!=null&&marketAsset.getSelectedItem()!=null){String currentSymbol=marketAsset.getSelectedItem().toString();java.math.BigDecimal positionQty=paperHoldings.get(currentSymbol),positionCost=paperCost.get(currentSymbol);if(positionQty!=null&&positionCost!=null&&positionQty.signum()>0){float entry=positionCost.divide(positionQty,8,java.math.RoundingMode.HALF_UP).floatValue();if(Float.isFinite(entry)&&entry>=low&&entry<=high){float entryY=y(entry,high,low,top,plotH);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(3);p.setColor(Color.CYAN);canvas.drawLine(left,entryY,w-right,entryY,p);p.setStyle(Paint.Style.FILL);p.setTextSize(17);p.setColor(Color.CYAN);canvas.drawText("DEMO POZISYON • GIRIS "+String.format(Locale.ROOT,"%.4f",entry),left+6,Math.max(top+18,Math.min(top+plotH-3,entryY-5)),p);}}for(PaperOrder order:paperOrders){if(!"PENDING".equals(order.status)||!currentSymbol.equals(order.symbol))continue;float orderPrice=order.price.floatValue();if(!Float.isFinite(orderPrice)||orderPrice<low||orderPrice>high)continue;float orderY=y(orderPrice,high,low,top,plotH);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor("BUY".equals(order.side)?Color.GREEN:Color.RED);canvas.drawLine(left,orderY,w-right,orderY,p);p.setStyle(Paint.Style.FILL);p.setTextSize(17);String orderLabel="#"+order.id+" "+order.side+" LIMIT "+order.price.toPlainString();float labelX=Math.max(left,Math.min(w-right-p.measureText(orderLabel),left+6));canvas.drawText(orderLabel,labelX,Math.max(top+18,Math.min(top+plotH-3,orderY-4)),p);}}if(Float.isFinite(horizontalLevel)&&horizontalLevel>=low&&horizontalLevel<=high){float levelY=y(horizontalLevel,high,low,top,plotH);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor(Color.YELLOW);canvas.drawLine(left,levelY,w-right,levelY,p);p.setStyle(Paint.Style.FILL);p.setTextSize(19);p.setColor(Color.YELLOW);String priceLabel=String.format(Locale.ROOT,horizontalLevel<1f?"%.6f":"%.2f",horizontalLevel);float labelWidth=p.measureText(priceLabel);float labelX=Math.max(left,Math.min(w-right-labelWidth,w-right-labelWidth-4));float labelY=Math.max(top+20,Math.min(top+plotH-4,levelY-5));canvas.drawText(priceLabel,labelX,labelY,p);}
   p.setStyle(Paint.Style.FILL);p.setColor(Color.LTGRAY);p.setTextSize(22);canvas.drawText("SMA"+smaPeriod+" EMA"+emaPeriod+" BB20"+" VWAP (UTC day; not exchange session)",left+6,top+22,p);canvas.drawText("VOL",left+6,volumeTop+volumeH+19,p);int rsiTop=volumeTop+volumeH+27,rsiHeight=Math.max(30,(h-rsiTop-24)/2);p.setColor(Color.rgb(36,46,59));p.setStrokeWidth(1);p.setStyle(Paint.Style.STROKE);canvas.drawLine(left,rsiTop+rsiHeight*.3f,w-right,rsiTop+rsiHeight*.3f,p);canvas.drawLine(left,rsiTop+rsiHeight*.7f,w-right,rsiTop+rsiHeight*.7f,p);Path rsiPath=new Path();boolean rsiStarted=false;double[] rsiValues=new double[end];java.util.Arrays.fill(rsiValues,Double.NaN);double gain=0,loss=0;for(int i=1;i<end;i++){double delta=candles.get(i)[3]-candles.get(i-1)[3];if(i<=14){gain+=Math.max(0,delta);loss+=Math.max(0,-delta);if(i==14){gain/=14;loss/=14;}}else{gain=(gain*13+Math.max(0,delta))/14;loss=(loss*13+Math.max(0,-delta))/14;}if(i>=14)rsiValues[i]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);}for(int i=start;i<end;i++){double rv=rsiValues[i];if(!Double.isFinite(rv)){rsiStarted=false;continue;}float px=left+(i-start+.5f)*cell,py=rsiTop+(float)((100-rv)/100.0)*rsiHeight;if(!rsiStarted){rsiPath.moveTo(px,py);rsiStarted=true;}else rsiPath.lineTo(px,py);}p.setColor(Color.rgb(245,189,75));p.setStrokeWidth(2);canvas.drawPath(rsiPath,p);p.setStyle(Paint.Style.FILL);p.setTextSize(15);canvas.drawText("RSI 14",left+6,rsiTop+16,p);double rsi=rsi14(candles,end);if(Double.isFinite(rsi)){p.setTextSize(18);p.setColor(Color.rgb(245,189,75));canvas.drawText(String.format(Locale.ROOT,"RSI14 %.1f",rsi),w-160,rsiTop+16,p);}int macdTop=rsiTop+rsiHeight+8,macdHeight=Math.max(24,h-macdTop-12);double[][] mv=new double[count][2];double maxAbs=0;double fast=0,slow=0,signal=0;for(int i=0;i<end;i++){double close=candles.get(i)[3];fast=i==0?close:fast+(close-fast)*2.0/13;slow=i==0?close:slow+(close-slow)*2.0/27;double macdValue=fast-slow;signal=i==0?macdValue:signal+(macdValue-signal)*2.0/10;if(i<start)continue;double[] v=i<34?new double[]{Double.NaN,Double.NaN}:new double[]{macdValue,signal};mv[i-start]=v;if(Double.isFinite(v[0])&&Double.isFinite(v[1]))maxAbs=Math.max(maxAbs,Math.max(Math.abs(v[0]),Math.max(Math.abs(v[1]),Math.abs(v[0]-v[1]))));}maxAbs=Math.max(0.000001,maxAbs*1.15);float zero=macdTop+macdHeight/2f;p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);p.setColor(Color.rgb(60,69,81));canvas.drawLine(left,zero,w-right,zero,p);Path macdLine=new Path(),signalLine=new Path();boolean hasMacd=false;for(int j=0;j<count;j++){double[] v=mv[j];if(!Double.isFinite(v[0])||!Double.isFinite(v[1])){hasMacd=false;continue;}float px=left+(j+.5f)*cell,my=zero-(float)(v[0]/maxAbs)*(macdHeight*.46f),sy=zero-(float)(v[1]/maxAbs)*(macdHeight*.46f);if(!hasMacd){macdLine.moveTo(px,my);signalLine.moveTo(px,sy);hasMacd=true;}else{macdLine.lineTo(px,my);signalLine.lineTo(px,sy);}p.setColor(v[0]>=v[1]?Color.rgb(22,199,132):Color.rgb(234,57,67));canvas.drawLine(px,zero,px,zero-(float)((v[0]-v[1])/maxAbs)*(macdHeight*.46f),p);}p.setStrokeWidth(2);p.setColor(Color.rgb(66,176,245));canvas.drawPath(macdLine,p);p.setColor(Color.rgb(245,189,75));canvas.drawPath(signalLine,p);p.setStyle(Paint.Style.FILL);p.setTextSize(13);p.setColor(Color.LTGRAY);canvas.drawText("MACD 12/26/9",left+5,macdTop+13,p);
  }
  static double[] macd12269(ArrayList<float[]> candles,int end){if(end<35)return new double[]{Double.NaN,Double.NaN,Double.NaN};double fast=0,slow=0,signal=0,macd=0;for(int i=0;i<end;i++){double close=candles.get(i)[3];fast=i==0?close:fast+(close-fast)*2.0/13;slow=i==0?close:slow+(close-slow)*2.0/27;macd=fast-slow;signal=i==0?macd:signal+(macd-signal)*2.0/10;}return new double[]{macd,signal,macd-signal};}
  static double rsi14(ArrayList<float[]> candles,int end){if(end<15)return Double.NaN;double gain=0,loss=0;for(int i=1;i<=14;i++){double d=candles.get(i)[3]-candles.get(i-1)[3];gain+=Math.max(0,d);loss+=Math.max(0,-d);}gain/=14;loss/=14;for(int i=15;i<end;i++){double d=candles.get(i)[3]-candles.get(i-1)[3];gain=(gain*13+Math.max(0,d))/14;loss=(loss*13+Math.max(0,-d))/14;}return loss==0?(gain==0?50:100):100-100/(1+gain/loss);}
  float y(float value,float high,float low,int top,int height){return top+(high-value)/Math.max(.000001f,high-low)*height;}
 }
 static final class MarsFinanceHero extends View{
  Paint p=new Paint(1);int accent=Color.rgb(255,106,0);long started=SystemClock.uptimeMillis();
  MarsFinanceHero(android.content.Context c){super(c);setContentDescription("MARS-X Finance hareketli grafik kahraman alanı");}
  protected void onDraw(Canvas c){int w=getWidth(),h=getHeight();float phase=((SystemClock.uptimeMillis()-started)%4000)/4000f;p.setShader(new LinearGradient(0,0,w,h,Color.rgb(6,10,18),Color.rgb(18,25,40),Shader.TileMode.CLAMP));c.drawRoundRect(0,0,w,h,26,26,p);p.setShader(null);
   p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);p.setColor(Color.argb(70,120,150,180));for(int i=1;i<5;i++){c.drawLine(0,h*i/5f,w,h*i/5f,p);c.drawLine(w*i/5f,0,w*i/5f,h,p);}
   p.setStyle(Paint.Style.FILL);p.setColor(Color.argb(48,Color.red(accent),Color.green(accent),Color.blue(accent)));c.drawCircle(w*.78f,h*.34f,86+18*(float)Math.sin(phase*6.28),p);p.setColor(Color.argb(220,207,76,38));c.drawCircle(w*.78f,h*.34f,58,p);p.setColor(Color.argb(40,255,255,255));c.drawCircle(w*.75f,h*.29f,16,p);
   Path line=new Path();for(int i=0;i<42;i++){float x=w*(.05f+i/43f),y=(float)(h*.68f+Math.sin(i*.43+phase*6.28)*25-Math.cos(i*.21)*18);if(i==0)line.moveTo(x,y);else line.lineTo(x,y);}p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(5);p.setColor(accent);c.drawPath(line,p);p.setStrokeWidth(2);p.setColor(Color.argb(160,255,255,255));for(int i=0;i<24;i++){float x=w*(.06f+i/25f),mid=(float)(h*.58f+Math.sin(i*.55+phase*4)*32);boolean up=i%3!=0;p.setColor(up?Color.rgb(22,199,132):Color.rgb(234,57,67));c.drawLine(x,mid-28,x,mid+28,p);p.setStyle(Paint.Style.FILL);c.drawRoundRect(x-5,mid-(up?20:2),x+5,mid+(up?2:20),3,3,p);p.setStyle(Paint.Style.STROKE);}
   p.setStyle(Paint.Style.FILL);p.setColor(Color.WHITE);p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(28);c.drawText("GLOBAL MARKET ENGINE",26,42,p);p.setTextSize(18);p.setTypeface(Typeface.DEFAULT);p.setColor(Color.argb(210,210,220,235));c.drawText("Charts • Wallet • Swap • Portfolio",26,72,p);p.setColor(accent);p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(22);c.drawText("READ-ONLY LIVE DATA",26,h-28,p);postInvalidateDelayed(33);}
 }
 static final class MiniGraph extends View{
  Paint p=new Paint(1);int accent=Color.rgb(255,106,0);
  MiniGraph(android.content.Context c){super(c);setContentDescription("MARS-X mini performans grafiği");}
  protected void onDraw(Canvas c){int w=getWidth(),h=getHeight();p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1);p.setColor(Color.argb(90,80,96,120));for(int i=1;i<4;i++)c.drawLine(0,h*i/4f,w,h*i/4f,p);Path area=new Path(),line=new Path();for(int i=0;i<36;i++){float x=w*i/35f,y=(float)(h*.64f-Math.sin(i*.31)*22-Math.cos(i*.14)*18);if(i==0){line.moveTo(x,y);area.moveTo(x,h);area.lineTo(x,y);}else{line.lineTo(x,y);area.lineTo(x,y);}}area.lineTo(w,h);area.close();p.setStyle(Paint.Style.FILL);p.setShader(new LinearGradient(0,0,0,h,Color.argb(110,Color.red(accent),Color.green(accent),Color.blue(accent)),Color.TRANSPARENT,Shader.TileMode.CLAMP));c.drawPath(area,p);p.setShader(null);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(4);p.setColor(accent);c.drawPath(line,p);}
 }
}
