"""Build additive Izu/Hakone/Yokohama links without editing existing points."""
import importlib.util
import json
import math
import heapq
import re
import unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('base',ROOT/'scripts/build_ebina_aomori_route.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
def load(index):return json.loads((ROOT/f'data-osm-local-{index}.json').read_text(encoding='utf-8-sig'))['elements']
all_items={}
for filename in ROOT.glob('data-osm-local-*.json'):
    if filename.name in {'data-osm-local-roads.json','data-osm-local-11.json'}:continue
    payload=json.loads(filename.read_text(encoding='utf-8-sig'))
    for item in payload.get('elements',[]):all_items[(item['type'],item['id'])]=item
nodes={item['id']:item for item in all_items.values() if item['type']=='node'}
for item in all_items.values():
    if item['type']=='way':item['geometry']=[{'lat':nodes[node]['lat'],'lon':nodes[node]['lon']} for node in item['nodes']]
elements=list(all_items.values())
def ways(indices):
    ids={item['id'] for index in indices for item in load(index) if item['type']=='way'}
    return [item for item in elements if item['type']=='way' and item['id'] in ids]
maps=[item for item in elements if item['type']=='way']
izu=ways([1,10])+[w for w in maps if '伊豆縦貫' in w.get('tags',{}).get('name','') and min(p['lat'] for p in w['geometry'])>35.07]
izu += [w for w in maps if w.get('tags',{}).get('highway') in {'motorway_link','trunk_link'} and all(35.078<p['lat']<35.085 and 138.926<p['lon']<138.936 for p in w['geometry'])]
central=ways([4])+[w for w in maps if w.get('tags',{}).get('name')=='伊豆中央道']
central += [w for w in maps if w.get('tags',{}).get('highway') in {'trunk','trunk_link'} and w.get('tags',{}).get('name')=='国道136号' and all(35.068<p['lat']<35.084 and 138.92<p['lon']<138.935 for p in w['geometry'])]
hakone=ways([6]);turnpike=ways([7]);hodogaya=ways([8]);yokohama=ways([9])
yokohama_branch=[w for w in maps if w.get('tags',{}).get('name')=='横浜横須賀道路' or (w.get('tags',{}).get('highway') in {'motorway_link','trunk_link'} and all(35.44<p['lat']<35.455 and 139.565<p['lon']<139.582 for p in w['geometry']))]
def coord(lat,lon):return (lat,lon)
# The intentionally disconnected Kawazu and Turnpike connector sections have
# no nextLinkIDs across the intervening ordinary roads/unopened sections.
CONFIGS=[
 ('e70-izu-main','伊豆縦貫自動車道','E70',izu,(35.1408,138.8634),(35.0801,138.9294),60,'沼津方面','伊豆・下田方面',14000,20000),
 ('izu-chuo','伊豆中央道','R136',central,(35.0801,138.9294),(35.0111503,138.9404624),50,'函南・沼津方面','修善寺方面',7000,11000),
 ('shuzenji','修善寺道路','R136',ways([5]),(35.0111503,138.9404624),(34.9762224,138.9372),60,'大仁・沼津方面','修善寺方面',3500,6000),
 ('e70-izu-amagi','伊豆縦貫自動車道','E70',ways([2]),(34.9762224,138.9372),(34.9223,138.9308),60,'修善寺・沼津方面','月ケ瀬方面',5500,8000),
 ('e70-izu-kawazu','伊豆縦貫自動車道','E70',ways([3,12]),(34.7771324,138.9464587),(34.755454,138.9450236),60,'河津七滝方面','河津逆川方面',2400,3800),
 ('hakone-shindo','箱根新道','R1',hakone,(35.23403,139.11368),(35.184,139.0183),40,'小田原方面','箱根峠・三島方面',12000,15500),
 ('turnpike-main','箱根ターンパイク','TP',[w for w in turnpike if '箱根伊豆連絡線' not in w.get('tags',{}).get('name','')],(35.2423573,139.1409311),(35.1836822,139.0485164),40,'小田原方面','大観山方面',12500,15000),
 ('turnpike-izu','箱根ターンパイク','TP',[w for w in turnpike if '箱根伊豆連絡線' in w.get('tags',{}).get('name','')],(35.1766544,139.0344141),(35.1688382,139.0294827),40,'芦ノ湖方面','湯河原峠方面',1400,2100),
 ('hodogaya','保土ヶ谷バイパス','R16',hodogaya,(35.513606,139.46647),(35.4510079,139.56774),60,'町田・八王子方面','新保土ヶ谷方面',11000,15000),
 ('e83-yokohama','横浜新道','E83',yokohama,(35.4819396,139.5946698),(35.4123,139.5326),60,'保土ヶ谷・東京方面','戸塚方面',9000,12000),
 ('e83-yokohama-branch','横浜新道','E83',yokohama_branch,(35.4493,139.5717),(35.44297,139.57805),60,'新保土ヶ谷方面','狩場方面',600,2200),
]
ROMAJI={'沼津岡宮':'Numazu-Okamiya','長泉':'Nagaizumi','三島萩':'Mishima-Hagi','三島加茂':'Mishima-Kamo','三島塚原':'Mishima-Tsukahara','三島玉沢':'Mishima-Tamazawa','大場・函南':'Daiba-Kannami','函南塚本':'Kannami-Tsukamoto','江間':'Ema','長岡北':'Nagaoka-kita','伊豆長岡':'Izu-Nagaoka','大仁中央':'Ohito-chuo','大仁南':'Ohito-minami','熊坂':'Kumasaka','修善寺':'Shuzenji','大平':'Odaira','月ケ瀬':'Tsukigase','河津七滝':'Kawazu-Nanadaru','河津逆川':'Kawazu-Sakasagawa','山崎':'Yamazaki','須雲川':'Sukumogawa','芦ノ湖大観':'Ashinoko-Taikan','箱根峠':'Hakone-toge','南町田':'Minami-Machida','横浜町田':'Yokohama-Machida','上川井':'Kamikawai','下川井':'Shimokawai','本村':'Honmura','南本宿':'Minamihonjuku','新桜ヶ丘':'Shinsakuragaoka','新保土ヶ谷':'Shin-Hodogaya','保土ヶ谷':'Hodogaya','常盤台':'Tokiwadai','峰岡':'Mineoka','星川':'Hoshikawa','藤塚':'Fujitsuka','今井':'Imai','川上':'Kawakami','上矢部':'Kamiyabe','戸塚':'Totsuka','戸塚終点':'Totsuka','小田原口':'Odawara','箱根大観山口':'Hakone-Taikanzan','箱根芦ノ湖口':'Hakone-Ashinoko','湯河原峠口':'Yugawara-toge','大観山':'Taikanzan','狩場':'Kariba'}
EXPECTED={
 'e70-izu-main':{'沼津岡宮','長泉','三島萩','三島加茂','三島塚原','三島玉沢','大場・函南','函南塚本'},
 'izu-chuo':{'函南塚本','江間','長岡北','伊豆長岡','大仁中央'},
 'shuzenji':{'大仁中央','大仁南','熊坂','修善寺'},'e70-izu-amagi':{'修善寺','大平','月ケ瀬'},'e70-izu-kawazu':{'河津七滝','河津逆川'},
 'hakone-shindo':{'山崎','須雲川','芦ノ湖大観','箱根峠'},
 'hodogaya':{'南町田','横浜町田','上川井','下川井','本村','南本宿','新桜ヶ丘','新保土ヶ谷'},
 'e83-yokohama':{'保土ヶ谷','常盤台','峰岡','星川','藤塚','新保土ヶ谷','今井','川上','上矢部','戸塚終点'},
 'e83-yokohama-branch':{'新保土ヶ谷','狩場'},
}
def clean(name):
    name=unicodedata.normalize('NFKC',name).replace('ケ','ケ').replace('月ヶ瀬','月ケ瀬').replace('新桜ケ丘','新桜ヶ丘').replace('保土ケ谷','保土ヶ谷')
    name=re.sub(r'(IC|JCT|PA|SA|出口|入口|インターチェンジ|パーキングエリア|\s|\([^)]*\))','',name,flags=re.I)
    name=name.replace('横浜新道戸塚始点','戸塚終点').replace('横浜新道戸塚終点','戸塚終点')
    return name
def build_graph(selected):
    graph={};coordinates={};tangents={}
    allowed={'motorway','trunk','primary','secondary','tertiary','motorway_link','trunk_link'}
    for way in selected:
        tags=way.get('tags',{})
        if tags.get('highway') not in allowed or tags.get('access')=='no':continue
        ids=way['nodes'];geo=way['geometry']
        for node,p in zip(ids,geo):coordinates[node]=(p['lat'],p['lon'])
        for a,b in zip(ids,ids[1:]):
            length=base.distance(coordinates[a],coordinates[b])
            if tags.get('oneway')!='-1':graph.setdefault(a,[]).append((b,length))
            if tags.get('oneway') not in {'yes','1'}:graph.setdefault(b,[]).append((a,length))
        if tags.get('oneway') in {'yes','1','-1'} and not tags['highway'].endswith('_link'):
            for i,node in enumerate(ids):
                a=coordinates[ids[max(0,i-1)]];b=coordinates[ids[min(len(ids)-1,i+1)]]
                tangents.setdefault(node,[]).append((a,b) if tags['oneway']!='-1' else (b,a))
    return graph,coordinates,tangents
def directed_route(graph,coordinates,start,end):
    starts=sorted(coordinates,key=lambda node:base.distance(coordinates[node],start))[:12]
    targets=set(sorted(coordinates,key=lambda node:base.distance(coordinates[node],end))[:12])
    costs={node:base.distance(coordinates[node],start)*3 for node in starts}
    queue=[(cost,node) for node,cost in costs.items()];heapq.heapify(queue);previous={};best=(math.inf,None)
    while queue:
        cost,node=heapq.heappop(queue)
        if cost!=costs[node]:continue
        if cost>best[0]:break
        if node in targets:
            total=cost+base.distance(coordinates[node],end)*3
            if total<best[0]:best=(total,node)
        for neighbor,length in graph.get(node,[]):
            candidate=cost+length
            if candidate<costs.get(neighbor,math.inf):costs[neighbor]=candidate;previous[neighbor]=node;heapq.heappush(queue,(candidate,neighbor))
    if best[1] is None:raise RuntimeError(f'No directed path: {start} -> {end}')
    path=[best[1]]
    while path[-1] in previous:path.append(previous[path[-1]])
    return [coordinates[node] for node in reversed(path)]
def heading(a,b):return math.degrees(math.atan2((b[1]-a[1])*math.cos(math.radians(a[0])),b[0]-a[0]))%360
def main():
    links=[];points=[]
    for key,name,number,selected,start,end,speed,north,south,min_length,max_length in CONFIGS:
        graph,coordinates,tangents=build_graph(selected)
        for suffix,direction,destination,first,last in [('down','下り',south,start,end),('up','上り',north,end,start)]:
            line=directed_route(graph,coordinates,first,last)
            if base.distance(line[0],first)>180 or base.distance(line[-1],last)>180:raise RuntimeError(f'{key}: disconnected endpoints {line[0]} {line[-1]}')
            length=sum(base.distance(a,b) for a,b in zip(line,line[1:]))
            if not min_length<=length<=max_length:raise RuntimeError(f'{key}: unexpected route length {length:.0f}m')
            link_id=f'{key}-{suffix}'
            simplified=base.simplify(line)
            actual_length=sum(base.distance(a,b) for a,b in zip(simplified,simplified[1:]))
            links.append({'id':link_id,'highwayName':name,'routeNumber':number,'directionName':direction,'destinationName':destination,'lengthMeters':round(actual_length,1),'standardSpeedKPH':speed,'polyline':[{'latitude':a,'longitude':b} for a,b in simplified],'nextLinkIDs':[]})
            chosen={}
            for node in nodes.values():
                tags=node.get('tags',{});raw=tags.get('name','');label=clean(raw)
                if tags.get('highway')!='motorway_junction' or label not in (EXPECTED.get(key,set())|{'長泉'}):continue
                coordinate=(node['lat'],node['lon']);lateral,offset=base.project(coordinate,simplified)
                if lateral>100:continue
                hint=tangents.get(node['id'],[])
                if hint:
                    # Use projection progress to estimate the local driving bearing.
                    before=min(range(len(simplified)),key=lambda i:base.distance(simplified[i],coordinate));a=simplified[max(0,before-1)];b=simplified[min(len(simplified)-1,before+1)]
                    route_heading=heading(a,b)
                    if all(abs((heading(a,b)-route_heading+540)%360-180)>100 for a,b in hint):continue
                kind='JCT' if 'JCT' in unicodedata.normalize('NFKC',raw).upper() or label in {'新保土ヶ谷','狩場'} else 'IC'
                score=lateral
                point_key=(label,kind)
                if point_key not in chosen or score<chosen[point_key][0]:chosen[point_key]=(score,{'id':f'{link_id}-{node["id"]}-{kind.lower()}','name':label,'kind':kind,'linkID':link_id,'offsetMeters':round(offset,1),'romanizedName':ROMAJI[label],'facilities':[],'brands':[]})
            # Road termini have no motorway_junction tags on some ordinary
            # bypasses/tourist roads. Label actual access points explicitly.
            termini={
              'e70-izu-main':('沼津岡宮','函南塚本'),'izu-chuo':('函南塚本','大仁中央'),'shuzenji':('大仁中央','修善寺'),'e70-izu-amagi':('修善寺','月ケ瀬'),
              'e70-izu-kawazu':('河津七滝','河津逆川'),'hakone-shindo':('山崎','箱根峠'),
              'turnpike-main':('小田原口','箱根大観山口'),'turnpike-izu':('箱根芦ノ湖口','湯河原峠口'),
              'hodogaya':('南町田','新保土ヶ谷'),'e83-yokohama':('保土ヶ谷','戸塚終点'),
              'e83-yokohama-branch':('新保土ヶ谷','狩場'),
            }[key]
            for label,offset in zip(termini if suffix=='down' else termini[::-1],[0,actual_length]):
                if not any(point_key[0]==label for point_key in chosen):chosen[(label,'IC')]=(0,{'id':f'{link_id}-access-{offset>0 and "end" or "start"}','name':label,'kind':'JCT' if label in {'新保土ヶ谷','狩場'} else 'IC','linkID':link_id,'offsetMeters':round(offset,1),'romanizedName':ROMAJI[label],'facilities':[],'brands':[]})
            if key=='e83-yokohama':
                for area_id in ([165610386] if suffix=='down' else [279485561]):
                    area=all_items.get(('way',area_id));coordinate=base.center(area)
                    if coordinate:
                        lateral,offset=base.project(coordinate,simplified)
                        chosen['戸塚']=(lateral,{'id':f'{link_id}-{area_id}-pa','name':'戸塚','kind':'PA','linkID':link_id,'offsetMeters':round(offset,1),'romanizedName':'Totsuka','facilities':['restroom','convenienceStore'] if suffix=='down' else ['restroom'],'brands':['familyMart'] if suffix=='down' else []})
            if key=='turnpike-main':
                lateral,offset=base.project((35.1842413,139.049001),simplified)
                chosen['大観山']=(lateral,{'id':f'{link_id}-taikanzan-pa','name':'大観山','kind':'PA','linkID':link_id,'offsetMeters':round(offset,1),'romanizedName':'Taikanzan','facilities':['restaurant','cafe','viewArea'],'brands':[]})
            values=[value[1] for value in chosen.values()];points.extend(sorted(values,key=lambda p:p['offsetMeters']))
            for point in values:
                if key=='e70-izu-main' and point['name']=='長泉' and point['kind']=='JCT':point['connectionGroup']='長泉沼津'
                elif key=='e70-izu-main' and point['name']=='沼津岡宮':point['connectionGroup']='沼津'
                elif key=='hodogaya' and point['name']=='横浜町田':point['connectionGroup']='横浜町田'
            print(f'{link_id}: {actual_length/1000:.2f}km {len(values)} points',flush=True)
    by_id={link['id']:link for link in links}
    for a,b in [('e70-izu-main-down','izu-chuo-down'),('izu-chuo-down','shuzenji-down'),('shuzenji-down','e70-izu-amagi-down'),('e70-izu-amagi-up','shuzenji-up'),('shuzenji-up','izu-chuo-up'),('izu-chuo-up','e70-izu-main-up')]:by_id[a]['nextLinkIDs']=[b]
    output={'version':1,'sourceAttribution':'Road geometry © OpenStreetMap contributors, ODbL 1.0. Open sections checked against road operator route maps.','links':links,'points':points,
      'junctionRamps':[[{'latitude':p['lat'],'longitude':p['lon']} for p in way['geometry']] for way in elements if way.get('tags',{}).get('highway') in {'motorway_link','trunk_link'} and len(way.get('geometry',[]))>1]}
    (ROOT/'web/data/local-roads.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    existing_path=ROOT/'web/data/regional-expressways.json';existing=json.loads(existing_path.read_text(encoding='utf-8'))
    ids=set(by_id);existing['links']=[link for link in existing['links'] if link['id'] not in ids]+links
    existing['points']=[point for point in existing['points'] if point['linkID'] not in ids]+points
    existing_path.write_text(json.dumps(existing,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
if __name__=='__main__':main()
