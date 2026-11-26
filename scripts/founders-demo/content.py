"""Archived per-node text/catalogue. Parse source text only; never execute SQL/seed scripts."""
import json,re,html
from pathlib import Path

def action_rows(project):
    rows=[]
    for filename in ['add_longevity_actions.sql','add_missing_node_actions.sql','add_overhead_and_plyometrie.sql']:
        text=(project/'archive-originals'/filename).read_text()
        for block in re.finditer(r'INSERT INTO\s+longevity_actions\b[\s\S]*?\bVALUES\b([\s\S]*?)(?:ON CONFLICT|;\s*(?:--|$))',text):
            for match in re.finditer(r"\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'",block[1]):
                aid,node,label=(s.replace("''", "'") for s in match.groups())
                if aid in ['step_down','jump_squat','box_jump']:node='plyometrie'
                rows.append(dict(id=aid,node_id=node,label=label,source='v0.3-crt-gold-josef:migrations/'+filename))
    text=(project/'archive-originals'/'seed-missing.mjs').read_text().split('const newActions = [',1)[1].split('].map(',1)[0]
    for i,m in enumerate(re.finditer(r"\{\s*node_id:\s*'([^']+)',\s*label:\s*'([^']+)'",text)):
        node,label=m.groups();node='bílkoviny' if node=='bilkoviny' else node
        rows.append(dict(id='seed-'+node+'-'+str(i),node_id=node,label=label,source='v0.3-crt-gold-josef:scripts/seed-missing.mjs'))
    return rows

def render_article(article):
    # Plain archived markdown with escaped inline content; no raw HTML/scripts.
    blocks=[]
    for text in re.split(r'\n\s*\n',article['text'].strip()):
        escaped=html.escape(text.strip());escaped=re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',escaped)
        if text.startswith('#'):
            m=re.match(r'^(#{1,4})\s+(.+)$',escaped);blocks.append(f'<h{len(m[1])}>{m[2]}</h{len(m[1])}>' if m else '<p>'+escaped+'</p>')
        else:blocks.append('<p>'+escaped.replace('\n','<br>')+'</p>')
    return '<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+html.escape(article['title'])+'</title><style>body{margin:0;background:#0b1220;color:#c0ccdc;font:16px/1.7 system-ui,sans-serif}header{position:sticky;top:0;padding:10px 18px;background:#0b1220;border-bottom:1px solid #27354a}button{background:transparent;border:1px solid #516b87;color:#d4e3f4;padding:8px 12px;border-radius:7px;cursor:pointer;font:inherit}main{max-width:760px;padding:18px 22px 50px;margin:auto;overflow-wrap:anywhere}h1,h2,h3{color:#d5e4f1;line-height:1.3}small{color:#91a5bc}p{margin:1em 0}</style></head><body><header><button onclick="if(parent!==window)parent.postMessage({type:\'archive:source:close\'},location.origin);else history.back()">← Zpět</button></header><main><small>Původní text Chytrého já · archivní ukázka, bez individuálního posouzení.</small>'+''.join(blocks)+'</main></body></html>'

def make_content(project, nodes, dist):
    rows=action_rows(project);articles=json.loads((project/'archived-articles.json').read_text())
    (dist/'sources').mkdir(exist_ok=True)
    for a in articles:
        a['url']='sources/'+a['node_id']+'--'+a['slug']+'.html'
        (dist/a['url']).write_text(render_article(a))
    preferred={'telo':'chůze_20min','mysl':'meditace_5','vyziva':'protein_check','zdravi':'krev_check','metabolicke':'pust_12h','rovnovaha':'rovnovaha_habit','spanek':'spanek_bez_obrazovky','stres':'stres_pauza','nervovy_system':'ns_pohyb'}
    result={}
    for node in nodes:
        catalogue=[r for r in rows if r['node_id']==node['id']]
        # Stable deduplication without changing original labels.
        catalogue=list({r['id']:r for r in catalogue}.values())
        row=next((r for r in catalogue if r['id']==preferred.get(node['id'])),catalogue[0] if catalogue else None)
        sources=[dict(med_id=a['slug'],type='article',title=a['title'],url=a['url'],lang='cs',status='ARCHIV',origin=a['source']) for a in articles if a['node_id']==node['id']]
        result[node['id']]={
          'node_id':node['id'],'node_label':node['label'],'node_version':'UKÁZKA',
          'life_battery':{'percent':0,'trend':'stable','trend_label':''},'metrics':{},
          'killer':{'label':node['label'],'description':node.get('definition','')},
          'action':{'id':row['id'] if row else 'unavailable','label':row['label'] if row else 'Pro tuto oblast zatím nemáme ukázkovou akci.','type':'habit','status':'UKÁZKA' if row else 'BEZ AKCE'},
          'action_origin':row['source'] if row else None,'catalogue':catalogue,
          'sources':sources,'verdict':None,'today_count':0,'all_done_today':False,'streak':0,
          'day_type':'KATALOG' if row else 'BEZ AKCE'
        }
    return result
