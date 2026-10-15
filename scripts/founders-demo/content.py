"""Node-specific archive content, extracted from SQL text without executing SQL."""
import json,re

def make_content(project, nodes):
    rows=[]
    for filename in ['add_longevity_actions.sql','add_missing_node_actions.sql']:
        text=(project/'archive-originals'/filename).read_text()
        # All needed text fields are the first three SQL string literals of an INSERT row.
        for match in re.finditer(r"\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'",text):
            aid,node,label=(s.replace("''", "'") for s in match.groups())
            rows.append(dict(id=aid,node_id=node,label=label,source='v0.3-crt-gold-josef:migrations/'+filename))
    preferred={'telo':'chůze_20min','mysl':'meditace_5','vyziva':'protein_check','zdravi':'krev_check','metabolicke':'pust_12h','rovnovaha':'rovnovaha_habit','spanek':'spanek_bez_obrazovky','stres':'stres_pauza','nervovy_system':'ns_pohyb','vytrvalost':'vytrvalost_chuze'}
    selected={}
    for row in rows:
        if row['node_id'] not in selected or row['id']==preferred.get(row['node_id']):selected[row['node_id']]=row
    result={}
    for node in nodes:
        row=selected.get(node['id'])
        result[node['id']]={
          'node_id':node['id'],'node_label':node['label'],'node_version':'UKÁZKA',
          # Native component requires this object; CSS excludes all personal metrics.
          'life_battery':{'percent':0,'trend':'stable','trend_label':''},'metrics':{},
          'killer':{'label':node['label'],'description':node.get('definition','')},
          'action':{'id':row['id'] if row else 'unavailable','label':row['label'] if row else 'Pro tuto oblast zatím nemáme ukázkovou akci.','type':'habit','status':'UKÁZKA' if row else 'BEZ AKCE'},
          'action_origin':row['source'] if row else None,
          'sources':[], 'verdict':None,'today_count':0,'all_done_today':False,'streak':0,
          'day_type':'KATALOG' if row else 'BEZ AKCE'
        }
    return result
