from pathlib import Path
import subprocess, json, re, hashlib, colorsys

PROJECT=Path(__file__).resolve().parent
REPO=PROJECT.parents[1]
DIST=REPO/'app'/'ukazka'
(DIST/'vendor').mkdir(parents=True,exist_ok=True)
(DIST/'vendor'/'vis-network.min.js').write_bytes((PROJECT/'archive-originals'/'vis-network.min.js').read_bytes())
ORIGINALS=PROJECT/'archive-originals'
ORIGINALS.mkdir(exist_ok=True)
DIST.mkdir(exist_ok=True)

def git(ref,path):
    return subprocess.check_output(['git','show',ref+':'+path],cwd=REPO,text=True)
def original(name,ref,path):
    target=ORIGINALS/name
    if not target.exists(): target.write_text(git(ref,path))
    return target.read_text()
def safe_json(value):
    return json.dumps(value,ensure_ascii=False).replace('<','\\u003c')
def sanitize_model(data):
    node_keys=['id','label','label_layman','label_expert','type','_type','level','branch','x','y','_inferred','panel_text','behavior_warning','detail']
    return dict(title=data.get('title','Kauzální mapa zdraví'),subtitle='Uložený příklad',
      nodes=[{k:n[k] for k in node_keys if k in n} for n in data['nodes']],
      edges=data['edges'],and_joins=data.get('and_joins',[]),
      medications_map=data.get('medications_map',[]),supplements_map=data.get('supplements_map',[]),
      injections=data.get('injections',[]),behavior_flags=data.get('behavior_flags',{}))

CSP="default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; img-src 'self' data: https:; connect-src 'none'; frame-src 'self'; object-src 'none'; base-uri 'self'"
def common_head(s,title):
    s=re.sub(r'<title>.*?</title>','<title>'+title+'</title>',s,flags=re.S)
    s=re.sub(r'<link[^>]+(?:manifest|apple-touch-icon)[^>]*>','',s)
    s=re.sub(r'src="https://ui-avatars\.com/[^\"]*"','src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="',s)
    extra='<meta http-equiv="Content-Security-Policy" content="'+CSP+'"><meta name="robots" content="noindex"><style>.user-profile-wrapper,#crtRegenBtn,#cmd-mic-btn,#header-mic-btn,.header-controls{display:none!important}</style>'
    if title!='Chytré já — ukázka oblastí':extra='<link rel="stylesheet" href="/app/assets/landing/demo-view.css?v=3">'+extra
    return s.replace('</head>',extra+'</head>',1)

provenance={}
for name,tag,cachepath in [
 ('kovarova','v0.2-crt-gold-kovarova','data/crt/cache-backup/7MeCzqiyVWh9NOR0cRJOTMMWaJj1.json'),
 ('josef','v0.3-crt-gold-josef','data/crt/cache-backup/qE09cLyXXGRBRxOBCGNZqTM2XRW2.json')]:
    src=original('crt-'+name+'.html',tag,'app/crt.html')
    cached_path=PROJECT/('model-'+name+'.json')
    if not cached_path.exists():
        raw=json.loads(git('58e472bcc5b3b7fc63433cf8fc11cf8169304150',cachepath))['crt_cache']
        cached_path.write_text(json.dumps(sanitize_model(raw),ensure_ascii=False,indent=2))
    data=json.loads(cached_path.read_text())
    data['title']='Strom souvislostí — '+('žena, 83 let' if name=='kovarova' else 'muž, 59 let')
    code=src
    def script(m):
        attrs,body=m.group(1),m.group(2)
        if 'src=' in attrs:
            return '<script src="vendor/vis-network.min.js"></script>' if 'vis-network' in attrs else ''
        if 'serviceWorker' in body or 'firebase-app' in body: return ''
        body=re.sub(r"^import .*?;\s*$",'',body,flags=re.M)
        body=re.sub(r"let userId = [^\n]+",'let userId = null;',body)
        body=re.sub(r"const userRole = [^\n]+","const userRole = 'longevity';",body)
        body=body.replace('async function loadCRT() {','async function loadCRT() {\n  return structuredClone(window.ARCHIVE_MODEL);')
        body=body.replace('async function loadCRTOpus(force = false, model = undefined) {','async function loadCRTOpus(force = false, model = undefined) {\n  return structuredClone(window.ARCHIVE_MODEL);')
        body=body.replace('async function enrichContraMap(data) {','async function enrichContraMap(data) {\n  return;')
        body=body.replace('let _medsVisible = false;','let _medsVisible = true;')
        body=body.replace('let _lastCrtData = null;', 'let _lastCrtData = structuredClone(window.ARCHIVE_MODEL);')
        old_resize='const _rerender = () => { if (_lastCrtData) setTimeout(() => _origRenderTree(_lastCrtData), 300); };'
        new_resize="let _archiveResizeTimer; const _rerender=()=>{clearTimeout(_archiveResizeTimer);_archiveResizeTimer=setTimeout(()=>{if(_lastCrtData)_origRenderTree(_lastCrtData)},180)};"
        assert old_resize in body if 'const _rerender' in body else True
        body=body.replace(old_resize,new_resize)
        body=body.replace('arrows: { to: { enabled: true, scaleFactor: 0.9 } },',"arrows: { to: { enabled: true, scaleFactor: 1.6, type: 'arrow' } },")
        body=body.replace("color: { color: '#2a4a68', highlight: '#5a8ab8', hover: '#4a7aa8' },","color: { color: '#4a8aaa', highlight: '#7ab8d8', hover: '#6aacc8', inherit: false },")
        body=body.replace('smooth: { enabled: false },\n        width: 1.5,','smooth: { enabled: false },\n        width: 2,')
        # Snapshot independent edge styles and explicit widths before hover changes.
        body=body.replace("_savedEdgeColors = ed.get().map(e => ({ id: e.id, color: e.color, width: e.width }))", "_savedEdgeColors = ed.get().map(e => ({ id: e.id, color: structuredClone(e.color), width: Number.isFinite(e.width) ? e.width : 2 }))")
        body=body.replace("color: { color: '#2a4a68', highlight: '#2a4a68', hover: '#4a7aa8' },", "color: { color: '#4a8aaa', highlight: '#7ab8d8', hover: '#6aacc8', inherit: false, opacity: 1 },")


        body=body.replace('    enrichContraMap(data);','    _applyMedsState();\n    enrichContraMap(data);')
        body=body.replace('async function regenCRT() {','async function regenCRT() {\n  return;')
        for declaration in ['window.completeCrtAction = function(nodeId, actionId, isSecond) {','window.acceptCrtSecond = function(nodeId) {','window.declineCrtSecond = function(nodeId) {']:
            body=body.replace(declaration,declaration+'\n  return;')
        # No action-pool requests or local action-state access in an archival viewer.
        body=body.replace('if (pool.length > 0) {','if (false && pool.length > 0) {')
        return '<script'+attrs+'>'+body+'</script>'
    code=re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>',script,code)
    code=common_head(code,'Ukázka — '+('žena, 83 let' if name=='kovarova' else 'muž, 59 let'))
    seed='<script>window.ARCHIVE_MODEL='+safe_json(data)+';window._crtActionPool={};</script>'
    code=code.replace('<head>','<head>'+seed,1)
    # Only the transport and external account controls change; renderer/styles above stay original.
    tail='<script>window.goBack=function(){parent.postMessage({archiveReturn:true},location.origin)};document.addEventListener("click",function(e){const a=e.target.closest("a");if(a&&a.origin!==location.origin)e.preventDefault();});</script>'
    pos=code.rfind('</body>');code=code[:pos]+tail+'<script src="/app/assets/landing/demo-navigation.js?v=2" defer></script>'+code[pos:]
    (DIST/('crt-'+name+'.html')).write_text(code)
    pinned={'kovarova':'f9a82e228581afa2db781b90141cbc0602fd6038','josef':'e616bcd8a4ee87608aac7c284368f60bf2e2e58e'}
    provenance[name]={'renderer_tag':tag,'renderer_commit':pinned[name],'original_source_sha256':hashlib.sha256(src.encode()).hexdigest(),'data_commit':'58e472bcc5b3b7fc63433cf8fc11cf8169304150','nodes':len(data['nodes']),'medications':len(data['medications_map'])}

tag='v0.3-crt-gold-josef'
universe=original('universe.html',tag,'app/index.html')
universe=re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>',lambda m:'<script src="vendor/vis-network.min.js"></script>' if 'vis-network' in m.group(1) else '',universe)
universe=common_head(universe,'Archiv — Vesmír Dlouhověkosti')
for old,new in [('/app/css/universe-core.css?v=3','universe-core.css'),('/app/css/universe-header.css?v=3','universe-header.css')]:
    universe=universe.replace(old,new)
for basename in ['universe-core.css','universe-header.css']:
    css=original(basename,tag,'app/css/'+basename)
    (DIST/basename).write_text(css)
core=original('universe-core.js',tag,'app/js/universe/universe-core.js')
core=core.replace('import { showPanel, closePanel } from "./universe-panel.js";','')
# The archived model has category colors, not personal traffic-light states.
# Preserve those colors in the historical sphere overlay as well as the base dot.
core=core.replace("const rgb         = colorMap[node.state] || '148,163,184';", "const rgb         = archiveNodeRGB(node, colorMap);")
core=core.replace("(colorMap[node.state] || '148,163,184').split(',').map(Number)", "archiveNodeRGB(node, colorMap).split(',').map(Number)")

model_path=PROJECT/'model-universe.json'
if not model_path.exists():model_path.write_text(git(tag,'data/universes/longevity/models/longevity.json'))
model_data=json.loads(model_path.read_text())
# Presentation palette only: retain category hues without clinical state claims.
for item in model_data:
    color=item.get('color','')
    if re.fullmatch(r'#[0-9a-fA-F]{6}',color):
        rgb=[int(color[i:i+2],16)/255 for i in (1,3,5)]
        h,l,sat=colorsys.rgb_to_hls(*rgb)
        # Warm branches: distinctly red/yellow instead of dusty pink/brown.
        warm=(h<=.18 or h>=.94)
        if h<=.065 or h>=.94:h=.005
        elif h<=.18:h=.13
        muted=colorsys.hls_to_rgb(h,min(.54,max(.46,l*.95)),min(.62 if warm else .40,sat*(.80 if warm else .60)))
        item['color']='#'+''.join(f'{round(c*255):02x}' for c in muted)
model=json.dumps(model_data,ensure_ascii=False)
# Preserve the actual historical Svelte HUD distribution, not a replacement panel.
hud=original('hud.html',tag,'app/hud.html')
asset_names=re.findall(r'/assets/([^"\s]+)',hud)
(DIST/'assets').mkdir(exist_ok=True)
for name in asset_names:
    asset=original(name,tag,'app/assets/'+name)
    (DIST/'assets'/name).write_text(asset)
# Keep native components. Supply per-node archived descriptions/catalogue entries.
from content import make_content
hud_data=make_content(PROJECT,model_data,DIST)
(DIST/'content-provenance.json').write_text(json.dumps({key:{'action_id':v['action']['id'],'origin':v['action_origin'],'actions':v['catalogue'],'sources':v['sources']} for key,v in hud_data.items()},ensure_ascii=False,indent=2))
hud_script='hud-DNhFxP-v.js'
original_bundle=(DIST/'assets'/hud_script).read_text()
old_data='let e=c&&!l&&n()?n():oe;'
new_data='let e=c&&!l&&n()?n():(window.ARCHIVE_HUD_DATA[K(u)]||window.ARCHIVE_HUD_DATA.dlouhovekost);'
assert original_bundle.count(old_data)==1
adapted_bundle=original_bundle.replace(old_data,new_data).replace('`KILLER:`','`OBLAST:`').replace('SYSTEM_ONLINE','UKÁZKA MODELU').replace('DATA_ENCRYPTED','ULOŽENÁ DATA')
(DIST/'assets'/'hud-archive.js').write_text(adapted_bundle)
hud=hud.replace('/assets/'+hud_script,'/assets/hud-archive.js')
hud=hud.replace('<head>','<head><script>window.ARCHIVE_HUD_DATA='+safe_json(hud_data)+';</script>',1)
hud=common_head(hud,'Chytré já — ukázka oblastí').replace('/assets/','assets/')
# Narrow iframe + fixed 420px shell caused clipping. Keep historical assets
# unchanged; layout and label changes live in documented archive adapters.
hud=hud.replace('</head>', '''<style id="archive-hud-layout">
html,body,#hud-root{width:100%;max-width:100%;margin:0;overflow-x:hidden}
.hud-panel-enter{width:100%;min-width:0;flex:0 0 100%}
/* No personal metrics are computed in this catalogue preview. */
.hud-shell .p-4.space-y-4>div:first-child{display:none}
/* Actions are catalogue examples, not executable recommendations. */
.hud-shell .hud-c4 button{display:none!important}
/* The native DEV_MODE footer is a flex sibling: keep its disclosure in the Universe header instead. */
#hud-root .min-h-screen>.hud-mono{display:none}
.hud-shell{width:100%!important;max-width:100%;box-sizing:border-box;overflow-wrap:break-word}
.hud-shell .flex>*,.hud-shell .grid>*{min-width:0}
.hud-shell p,.hud-shell span{overflow-wrap:anywhere}
@media(max-width:480px){.hud-shell{border-radius:0!important}}
</style></head>''',1)
hud=hud.replace('</head>', '''<style>
#archive-catalogue{border-top:1px solid #304054;padding-top:12px;color:#b9cce0;font-size:14px}#archive-catalogue summary{cursor:pointer;padding:10px 0}#archive-catalogue li{margin:10px 0;line-height:1.5}
</style><script>
(function(){
 const id=new URLSearchParams(location.search).get('nodeId')||'dlouhovekost';
 const data=window.ARCHIVE_HUD_DATA[id];
 const install=()=>{
  const host=document.querySelector('#hud-root .p-4.space-y-4');
  if(!host)return;
  observer.disconnect();
  const others=(data?.catalogue||[]).filter(a=>a.id!==data.action.id);
  if(!others.length)return;
  const details=document.createElement('details');details.id='archive-catalogue';
  const summary=document.createElement('summary');summary.textContent='Další ukázkové akce ('+others.length+')';details.append(summary);
  const list=document.createElement('ul');others.forEach(a=>{const li=document.createElement('li');li.textContent=a.label;list.append(li)});details.append(list);
  const note=document.createElement('p');note.textContent='Původní katalog. Výběr vhodné akce pro tebe provádí aplikace podle tvých údajů.';note.style.color='#91a5bc';details.append(note);if(host.children?.[2])host.insertBefore(details,host.children[2]);else host.append(details);
 };
 const observer=new MutationObserver(install);observer.observe(document,{childList:true,subtree:true});install();
})();
</script></head>''',1)
(DIST/'hud.html').write_text(hud)
universe=universe.replace('</head>','''<style id="archive-hud-width">
#hud-overlay{justify-content:flex-end!important}
#hud-panel-wrap{width:min(520px,100vw)!important;max-width:100vw!important;flex:0 0 auto;margin-left:auto!important;margin-right:0!important}
</style></head>''',1)
# The native overlay markup is copied verbatim from the original application.
overlay_start=universe.index('<div id="hud-overlay"')
overlay_end=universe.index('    <!-- Tool Overlay',overlay_start)
# This markup was already retained by the HTML/script filtering above.
panel='''
const ARCHIVE_UNIVERSE=window.ARCHIVE_UNIVERSE;
function archiveNodeRGB(node, stateColors){
 if(stateColors[node.state])return stateColors[node.state];
 const color=typeof node.color==='string'?node.color:node.color?.background;
 if(/^#[0-9a-f]{6}$/i.test(color||''))return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',');
 return '148,163,184';
}
function closePanel(){
 document.getElementById('hud-overlay').style.display='none';
 document.getElementById('hud-panel-wrap').style.transform='translateX(100%)';
 document.getElementById('sidePanel').classList.remove('open','visible');
 window._hudOverlayOpen=false;
 document.body.classList.remove('panel-open');
}
function showPanel(node){
 const overlay=document.getElementById('hud-overlay');
 const frame=document.getElementById('hud-iframe');
 // Native dev=1 is the original bundled demonstration, without account/API.
 frame.src='hud.html?dev=1&nodeId='+encodeURIComponent(node.id)+'&nodeLabel='+encodeURIComponent(node.label);
 frame.title='Ukázka oblasti — '+node.label;
 overlay.style.display='flex';
 document.getElementById('hud-panel-wrap').style.transform='translateX(0)';
 window._hudOverlayOpen=true;
 document.body.classList.add('panel-open');
 const label=document.getElementById('headerNodeLabel');
 if(label){label.textContent=node.label+' • ukázka modelu';label.classList.add('visible');}
}
window.closeHudOverlay=closePanel;
window.addEventListener('message',e=>{
 if(e.origin!==location.origin)return;
 const sourceDialog=document.getElementById('archive-source');
 if(e.source===document.getElementById('archive-source-frame').contentWindow&&e.data?.type==='archive:source:close'){sourceDialog.close();return;}
 if(e.source!==document.getElementById('hud-iframe').contentWindow)return;
 if(e.data==='chj:hud:close')closePanel();
 if(e.data?.type==='chj:source:open'){
  const url=new URL(e.data.source?.url||'',location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/ukazka/sources/')||!url.pathname.endsWith('.html'))return;
  document.getElementById('archive-source-frame').src=url.href;
  sourceDialog.showModal();
 }
});
'''
boot='''
const root=ARCHIVE_UNIVERSE.find(n=>n.id==='dlouhovekost');
window.MAIN_UNIVERSE_DATA=ARCHIVE_UNIVERSE;
renderUniverse(ARCHIVE_UNIVERSE,ARCHIVE_UNIVERSE.filter(n=>n.id===root.id||n.parent===root.id),root.id);
let _archiveUniverseResizeTimer;
function archiveResizeUniverse(){
 clearTimeout(_archiveUniverseResizeTimer);
 _archiveUniverseResizeTimer=setTimeout(()=>{
  if(lastRenderedNodes.length)renderUniverse(ARCHIVE_UNIVERSE,[...lastRenderedNodes],currentCenter);
 },180);
}
window.addEventListener('resize',archiveResizeUniverse);
if(screen.orientation)screen.orientation.addEventListener('change',archiveResizeUniverse);
document.getElementById('closePanel').onclick=closePanel;
document.getElementById('closePanel').textContent='×';
document.getElementById('closePanel').setAttribute('aria-label','Zavřít panel');
'''
code='<script>window.ARCHIVE_UNIVERSE='+safe_json(json.loads(model))+';</script><script type="module">'+panel+core+boot+'</script>'
source_viewer='''<style>#archive-source{padding:0;border:1px solid #40536d;border-radius:14px;width:min(820px,94vw);height:90dvh;background:#0b1220;color:#d4e3f4}#archive-source::backdrop{background:#020617d9}#archive-source-frame{border:0;width:100%;height:100%}</style><dialog id="archive-source"><iframe title="Původní text modelu" id="archive-source-frame"></iframe></dialog>'''
pos=universe.rfind('</body>');universe=universe[:pos]+source_viewer+code+'<script src="/app/assets/landing/demo-navigation.js?v=2" defer></script>'+universe[pos:]
(DIST/'vesmir.html').write_text(universe)
provenance['universe']={'source_tag':tag,'renderer_source_sha256':hashlib.sha256(core.encode()).hexdigest(),'nodes':len(json.loads(model)),'original_renderer':True,'account_services':False,'panel':'native Svelte HUD with archived node descriptions and SQL catalogue actions, no personal metrics or live results','hud_assets':asset_names}
(PROJECT/'PROVENANCE.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2))

# The three-way launcher is new and deliberately separate from the archived views.
index='''<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/ukazka/"><title>Chytré já — ukázka souvislostí</title><link rel="stylesheet" href="/app/assets/landing/demo-view.css?v=5"><meta name="robots" content="noindex"><style>
*{box-sizing:border-box}html,body{height:100%;margin:0;background:#0b0f1a;color:#cbd5e1;font:14px system-ui,sans-serif}body{display:flex;flex-direction:column}header{padding:12px 16px;border-bottom:1px solid #263449;display:flex;gap:12px;align-items:center;flex-wrap:wrap}strong{margin-right:auto;color:#e2e8f0}nav{display:flex;gap:8px;flex-wrap:wrap}button{background:transparent;color:#a7c7df;border:1px solid #344b64;border-radius:7px;padding:9px 14px;cursor:pointer;font:inherit}button[aria-pressed=true]{background:#182c40;color:#fff;border-color:#79b1d9}small{font-size:12px;color:#94a3b8}iframe{flex:1;min-height:0;width:100%;border:0}footer{padding:7px 16px;color:#64748b;font-size:11px}@media(max-width:600px){header{gap:8px;padding:10px}strong{width:100%}nav button{padding:8px 10px}}
@media(orientation:landscape) and (max-height:500px){header{padding:5px 10px;gap:6px}header strong,header small{display:none}nav button{padding:6px 10px;font-size:12px}footer{padding:4px 10px;font-size:10px}footer #origin{display:none}}
</style></head><body><header><a class="demo-logo" href="/" aria-label="Chytré já — zpět"><span class="demo-logo-cursor" aria-hidden="true"></span><span class="demo-logo-text" aria-hidden="true"><span>chytr<span class="demo-logo-ac">e</span></span><b>j<span class="demo-logo-ac">a</span></b></span></a><nav aria-label="Archivní pohledy"><button data-view="kovarova" aria-pressed="true">Žena, 83 let</button><button data-view="josef" aria-pressed="false">Muž, 59 let</button><button data-view="vesmir" aria-pressed="false">Vesmír Dlouhověkosti</button></nav><small>Ukázkové případy · bez osobního výpočtu</small><details class="demo-help"><summary>Jak ovládat <span aria-hidden="true">?</span></summary><div class="demo-help-panel"><div id="demo-help-crt"><h2>Jak ovládat strom</h2><ul><li><strong>Klikni na uzel</strong> — otevřeš jeho vysvětlení a souvislosti.</li><li><strong>Léky</strong> — zobrazíš nebo skryješ léky v grafu.</li><li><strong>Přepínače nahoře</strong> — otevřeš druhý příklad nebo Vesmír.</li><li><strong>← Zpět</strong> — vrátíš se na stránku, odkud jsi přišel.</li></ul></div><div id="demo-help-universe" hidden><h2>Jak ovládat Vesmír</h2><ul><li><strong>Klikni na uzel</strong> — otevřeš panel s vysvětlením, články a příklady akcí.</li><li><strong>Dvojklik na uzel</strong> — otevřeš podrobnější mapu oblasti.</li><li><strong>← Zpět</strong> — vrátíš se na stránku, odkud jsi přišel.</li></ul></div><p>Na mobilu klepni. Pro dvojklik klepni dvakrát rychle za sebou.</p></div></details></header><iframe title="Historická aplikace" src="crt-kovarova.html?opus=1" sandbox="allow-scripts allow-same-origin allow-downloads allow-modals"></iframe><script>
const files={kovarova:'crt-kovarova.html?opus=1',josef:'crt-josef.html?opus=1',vesmir:'vesmir.html'};
function select(view){if(!files[view])return;document.getElementById('demo-help-crt').hidden=view==='vesmir';document.getElementById('demo-help-universe').hidden=view!=='vesmir';document.querySelector('.demo-help').open=false;document.querySelector('iframe').src=files[view];document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));history.replaceState(null,'',location.pathname+location.search+'#'+view);}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.demo-help').open=false;});document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>select(b.dataset.view));window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.querySelector('iframe').contentWindow&&files[e.data?.archiveView])select(e.data.archiveView)});if(files[location.hash.slice(1)])select(location.hash.slice(1));
</script></body></html>'''
(DIST/'index.html').write_text(index.replace('</body>','<script src="/app/assets/landing/demo-navigation.js?v=2" defer></script></body>'))
print(json.dumps({'built':list(provenance),'views':3,'live_database':False},ensure_ascii=False))
