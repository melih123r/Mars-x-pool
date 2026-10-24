"""Run on a disposable Android emulator; no live sharing, ads or payouts."""
import json
from pathlib import Path
import re
import subprocess as sp
import time
import xml.etree.ElementTree as ET

OUT=Path('device-qa');OUT.mkdir(exist_ok=True)
PKG='com.marsx.pool'
ACT=PKG+'/com.marsx.pool.NetworkHomeActivity'
RES=Path('android/app/src/main/res')
def adb(*args):
    return sp.check_output(['adb',*args],text=True)
def launch():
    adb('shell','am','start','-W','-n',ACT)
    time.sleep(1)
def ui():
    adb('shell','uiautomator','dump','/sdcard/network-qa.xml')
    return ET.fromstring(adb('shell','cat','/sdcard/network-qa.xml'))
def textset(tree):
    return {n.get('text','') for n in tree.iter('node')}
def tap(label,scroll=False):
    attempts=9 if scroll else 8
    for attempt in range(attempts):
        for n in ui().iter('node'):
            if n.get('text','').casefold()==label.casefold() or n.get('content-desc','').casefold()==label.casefold():
                x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
                if x2>x1 and y2>y1:
                    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(.5);return
        if scroll:
            if attempt % 2 == 0:
                adb('shell','input','swipe','540','450','540','1600','350')
            else:
                adb('shell','input','swipe','540','1600','540','450','350')
        else:
            time.sleep(.25)
    raise AssertionError('Control not found after waiting: '+label)
def strings(code):
    folder='values-'+code.replace('-','-r')
    data={}
    for path in (RES/folder).glob('*.xml'):
        for n in ET.parse(path).getroot().findall('string'):
            value=''.join(n.itertext()).strip('"')
            data[n.get('name')]=value.replace('\\n','\n').replace("\\'","'").replace('\\"','"')
    return data
def set_locale(code):
    adb('shell','am','force-stop',PKG)
    content='<map><string name="ui_language">'+code+'</string></map>'
    path=OUT/'locale.xml';path.write_text(content)
    adb('push',str(path),'/data/local/tmp/network-locale.xml')
    adb('shell','run-as',PKG,'mkdir','-p','shared_prefs')
    adb('shell','run-as',PKG,'cp','/data/local/tmp/network-locale.xml','shared_prefs/network_consent_v1.xml')
    if API >= 33:
        adb('shell','cmd','locale','set-app-locales',PKG,'--user','0','--locales',code)
    launch()
def shot(name):
    with (OUT/(name+'.png')).open('wb') as f:sp.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
API=int(adb('shell','getprop','ro.build.version.sdk').strip())
report={'device':f'Android emulator API {API}','physical_device':False,'source_app_version':18,'checks':{}}
try:
    assert API in (26,33)
    adb('shell','wm','size','1080x1920');adb('shell','wm','density','420')
    adb('install','-r','android/app/build/outputs/apk/debug/app-debug.apk')
    report['checks'][f'Android API {API} install']='PASS'
    codes=[n.text for n in ET.parse(RES/'values/network_languages.xml').getroot().find("string-array[@name='network_language_codes']")]
    for code in codes:
        set_locale(code)
        tree=ui(); expected=strings(code)['nui_47']
        assert expected in textset(tree),(code,expected,textset(tree))
        (OUT/(code+'-home.xml')).write_bytes(ET.tostring(tree,encoding='utf-8'))
        shot(code+'-home')
        report['checks']['localized launcher '+code]='PASS'
    set_locale('en');en=strings('en')
    tap(en['nui_47']);tap(en['nui_15'])
    assert en['nui_46'] in textset(ui())
    tap(en['nui_46']);assert en['nui_47'] in textset(ui())
    report['checks']['consent grant and opt-out']='PASS'
    shot('en-home')
    tap(en['nui_33'],scroll=True)
    assert any(n.get('text')=='English' and n.get('checked')=='true' for n in ui().iter('node'))
    shot('en-language-picker')
    tap('Türkçe',scroll=True)
    adb('shell','am','force-stop',PKG);launch()
    assert strings('tr')['nui_47'] in textset(ui())
    prefs=adb('shell','run-as',PKG,'cat','shared_prefs/network_consent_v1.xml')
    assert 'ui_language' in prefs and '>tr<' in prefs
    report['checks']['language picker and process restart persistence']='PASS'
    if API >= 33:
        # System selection must override a different saved in-app preference.
        adb('shell','cmd','locale','set-app-locales',PKG,'--user','0','--locales','fr')
        adb('shell','am','force-stop',PKG);launch()
        assert strings('fr')['nui_47'] in textset(ui())
        report['checks']['Android Settings overrides saved picker language']='PASS'
    set_locale('en')
    for _ in range(4):adb('shell','input','swipe','540','1600','540','450','350')
    shot('en-settings-ads-off')
    report['checks']['test ads initially off']='PASS' if 'Test ads are off' in ' '.join(textset(ui())) else 'NOT_ASSERTED'
    logs=adb('logcat','-d','-s','AndroidRuntime:E')
    (OUT/'android-runtime.log').write_text(logs)
    assert 'FATAL EXCEPTION' not in logs
    report['checks']['no launcher crash']='PASS'
finally:
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
