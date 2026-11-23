"""Add directed Higashi-Meihan geometry and verified Isewangan exit access.

Download OSM relations 7573693/7573695 as data-osm-tomeihan-down/up.json
(OSM /api/0.6/relation/{id}/full.json). Existing Ise extract supplies the
short Seki boundary section missing from the upstream upbound relation.
"""
import heapq
import importlib.util
import json
import math
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('base', ROOT/'scripts/build_ebina_aomori_route.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

ROMAJI = {'名古屋西':'Nagoya-nishi','蟹江':'Kanie','弥富':'Yatomi','長島':'Nagashima',
    '桑名東':'Kuwana-higashi','桑名':'Kuwana','四日市':'Yokkaichi','四日市東':'Yokkaichi-higashi',
    '鈴鹿':'Suzuka','亀山':'Kameyama','関':'Seki','伊勢関':'Ise-Seki','大山田':'Oyamada','御在所':'Gozaisho'}
# These ICs have an exit on just this driving direction, not the other one.
# Source: NEXCO Chubu tollgate maps 06_isewangan.pdf, both sheets.
ISEWANGAN_EXIT_DIRECTION = {'名古屋南':'上り','湾岸弥富':'下り',
    '弥富木曽岬':'上り','みえ朝日':'上り'}

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def directed_graph(elements):
    graph = {}
    for way in elements:
        tags = way.get('tags', {})
        if tags.get('highway') != 'motorway' or tags.get('name') not in {'東名阪自動車道','伊勢自動車道'}:
            continue
        geometry = way.get('geometry', [])
        if tags['name'] == '伊勢自動車道' and any(p['lat'] < 34.83 for p in geometry):
            continue
        line = [(p['lat'],p['lon']) for p in geometry]
        if tags.get('oneway') == '-1':
            line.reverse()
        for a,b in zip(line,line[1:]):
            graph.setdefault(a,[]).append((b,base.distance(a,b)))
            graph.setdefault(b,[])
            if tags.get('oneway') not in {'yes','1','-1'}:
                graph[b].append((a,base.distance(a,b)))
    return graph

def route(graph,start,end):
    starts=sorted(graph,key=lambda p:base.distance(p,start))[:12]
    targets=set(sorted(graph,key=lambda p:base.distance(p,end))[:12])
    costs={p:base.distance(p,start)*3 for p in starts}
    queue=[(cost,p) for p,cost in costs.items()]
    heapq.heapify(queue)
    previous={}
    best=(math.inf,None)
    while queue:
        cost,p=heapq.heappop(queue)
        if cost != costs[p]:
            continue
        if cost > best[0]:
            break
        if p in targets:
            candidate=cost+base.distance(p,end)*3
            if candidate < best[0]:
                best=(candidate,p)
        for neighbor,length in graph[p]:
            candidate=cost+length
            if candidate < costs.get(neighbor,math.inf):
                costs[neighbor]=candidate
                previous[neighbor]=p
                heapq.heappush(queue,(candidate,neighbor))
    if best[1] is None:
        raise RuntimeError('Disconnected directional mainline')
    line=[best[1]]
    while line[-1] in previous:
        line.append(previous[line[-1]])
    line.reverse()
    if base.distance(line[0],start)>150 or base.distance(line[-1],end)>150:
        raise RuntimeError('Road does not reach both boundary anchors')
    return line

def build():
    elements={}
    for filename in ['data-osm-regional-e23-ise.json','data-osm-tomeihan-down.json','data-osm-tomeihan-up.json']:
        for item in read(ROOT/filename)['elements']:
            elements[(item['type'],item['id'])]=item
    nodes={item['id']:item for item in elements.values() if item['type']=='node'}
    for item in elements.values():
        if item['type']=='way' and 'nodes' in item:
            item['geometry']=[{'lat':nodes[n]['lat'],'lon':nodes[n]['lon']} for n in item['nodes']]
    graph=directed_graph(elements.values())
    links=[]
    points=[]
    north=(35.15825,136.81599)
    south=(34.8371,136.4233)
    for suffix,direction,destination,start,end in [('down','下り','亀山・伊勢方面',north,south),('up','上り','名古屋方面',south,north)]:
        raw=route(graph,start,end)
        on_route=set(raw)
        line=base.simplify(raw)
        length=sum(base.distance(a,b) for a,b in zip(line,line[1:]))
        if not 54000<length<57000:
            raise RuntimeError(f'Unexpected full-road length {length}')
        link_id=f'e23-tomeihan-{suffix}'
        links.append({'id':link_id,'highwayName':'東名阪自動車道','routeNumber':'E23','directionName':direction,
            'destinationName':destination,'lengthMeters':round(length,1),'standardSpeedKPH':80,
            'polyline':base.coordinates_json(line),'nextLinkIDs':['e23-ise-south'] if suffix=='down' else []})
        for node in nodes.values():
            tags=node.get('tags',{})
            if tags.get('highway')!='motorway_junction' or (node['lat'],node['lon']) not in on_route:
                continue
            label=unicodedata.normalize('NFKC',tags.get('name',''))
            if not label:
                continue
            coordinate=(node['lat'],node['lon'])
            _,offset=base.project(coordinate,line)
            if '亀山PA' in label:
                names=[('亀山','PA'),('亀山スマート','IC')]
            else:
                names=base.point_names(label)
            for name,kind in names:
                romanized=ROMAJI.get(name.replace('スマート',''))
                if not romanized:
                    raise RuntimeError(f'Unverified name {label}')
                facilities=[]
                brands=[]
                if kind in {'PA','SA'}:
                    facilities=['restroom','restaurant']
                    if name=='亀山' and suffix=='down':
                        facilities+=['convenienceStore']
                        brands=['ministop']
                    if name=='御在所':
                        facilities+=['convenienceStore','cafe','fuel']
                        brands=['familyMart','starbucks']
                points.append({'id':f'{link_id}-{node["id"]}-{kind.lower()}','linkID':link_id,
                    'name':name,'kind':kind,'offsetMeters':round(offset,1),'romanizedName':romanized,
                    'facilities':facilities,'brands':brands})
        # Nagoya-nishi JCT downbound is not tagged on the mainline in OSM.
        if not any(p['linkID']==link_id and p['name']=='名古屋西' and p['kind']=='JCT' for p in points):
            points.append({'id':f'{link_id}-boundary-nagoya-jct','linkID':link_id,'name':'名古屋西','kind':'JCT',
                'offsetMeters':0 if suffix=='down' else round(length,1),'romanizedName':'Nagoya-nishi','facilities':[],'brands':[]})
        expected={'蟹江','弥富','長島','桑名東','桑名','四日市東','四日市','鈴鹿','大山田','御在所','亀山'}
        actual={p['name'] for p in points if p['linkID']==link_id}
        if expected-actual:
            raise RuntimeError(f'Missing points on {link_id}: {expected-actual}')
        print(link_id,round(length/1000,2),[(p['name'],p['kind']) for p in points if p['linkID']==link_id])
    # Do not show an entry merge at the Ise-Seki boundary as an exit.
    for point in points:
        if point['name']=='伊勢関' and point['kind']=='IC':
            point['exitAvailable']=False
        if point['name']=='亀山' and point['kind']=='IC':
            point['separateFromArea']=True
    # Record the mainline exit splits of every Isewangan IC by carriageway.
    # Following a one-way motorway_link FROM its first coordinate establishes
    # an exit; a ramp ending at the mainline would instead be an entrance.
    ise=read(ROOT/'data-osm-regional-e1a-isewangan.json')['elements']
    regional=read(ROOT/'web/data/regional-expressways.json')
    exits=[]
    outgoing={}
    for way in ise:
        if way.get('tags',{}).get('highway')=='motorway_link' and way.get('geometry'):
            p=way['geometry'][0]
            outgoing.setdefault((p['lat'],p['lon']),[]).append(way)
    for node in ise:
        tags=node.get('tags',{})
        if node['type']!='node' or tags.get('highway')!='motorway_junction':
            continue
        coordinate=(node['lat'],node['lon'])
        if coordinate not in outgoing:
            continue
        for name,kind in base.point_names(tags.get('name','')):
            if kind!='IC':
                continue
            for link in regional['links']:
                if link['id'] not in {'e1a-isewangan-west','e1a-isewangan-east'}:
                    continue
                line=[(p['latitude'],p['longitude']) for p in link['polyline']]
                for way in ise:
                    if way.get('tags',{}).get('highway')!='motorway' or way['tags'].get('name')!='伊勢湾岸自動車道':
                        continue
                    geometry=[(p['lat'],p['lon']) for p in way.get('geometry',[])]
                    if coordinate not in geometry or len(geometry)<2:
                        continue
                    i=geometry.index(coordinate)
                    before=geometry[max(0,i-1)]
                    after=geometry[min(len(geometry)-1,i+1)]
                    if way['tags'].get('oneway')=='-1':
                        before,after=after,before
                    if base.project(after,line)[1]-base.project(before,line)[1]>0.5:
                        lateral,offset=base.project(coordinate,line)
                        if lateral<100:
                            record={'linkID':link['id'],'name':name,'sourceID':node['id'],'offsetMeters':round(offset,1)}
                            if record not in exits:
                                exits.append(record)
    ramps=[]
    for way in list(elements.values())+ise:
        if way.get('tags',{}).get('highway')=='motorway_link' and len(way.get('geometry',[]))>1:
            ramps.append(base.coordinates_json([(p['lat'],p['lon']) for p in way['geometry']]))
    return {'version':1,'sourceAttribution':'© OpenStreetMap contributors, ODbL 1.0; access verified with NEXCO Chubu.',
        'links':links,'points':points,'isewanganExits':exits,'junctionRamps':ramps}

def apply_catalogue(data,catalogue):
    ids={link['id'] for link in catalogue['links']}
    data['links']=[link for link in data['links'] if link['id'] not in ids]+catalogue['links']
    data['points']=[point for point in data['points'] if point['linkID'] not in ids]+catalogue['points']
    for link in data['links']:
        if link['id']=='e23-ise-north':
            link['nextLinkIDs']=['e23-tomeihan-up']
    by_id={link['id']:link for link in data['links']}
    for point in data['points']:
        if point['linkID'] not in {'e1a-isewangan-west','e1a-isewangan-east'} or point['kind']!='IC':
            continue
        allowed=ISEWANGAN_EXIT_DIRECTION.get(point['name'])
        point['exitAvailable']=not allowed or allowed==by_id[point['linkID']]['directionName']
        exits=[p for p in catalogue['isewanganExits'] if p['linkID']==point['linkID'] and p['name']==point['name']]
        if point['exitAvailable'] and exits:
            point['offsetMeters']=min(exits,key=lambda p:abs(p['offsetMeters']-point['offsetMeters']))['offsetMeters']
    # Keep the existing PA and its facilities/notes, and add the smart IC
    # at that PA's position so the existing UI combines both badges.
    for area in list(data['points']):
        if area['linkID'] not in {'e1a-isewangan-west','e1a-isewangan-east'} or area['name']!='刈谷' or area['kind']!='PA':
            continue
        point_id=f'{area["linkID"]}-kariya-smart-ic'
        if not any(p['id']==point_id for p in data['points']):
            data['points'].append({'id':point_id,'linkID':area['linkID'],'name':'刈谷','kind':'IC',
                'offsetMeters':area['offsetMeters'],'romanizedName':'Kariya','facilities':[],'brands':[],'exitAvailable':True})
    # Nagoya-minami local-road exit is eastbound only and shares the JCT ramp.
    link=by_id['e1a-isewangan-east']
    point_id='e1a-isewangan-east-nagoya-minami-local-ic'
    if not any(p['id']==point_id for p in data['points']):
        _,offset=base.project((35.0461332,136.9329943),[(p['latitude'],p['longitude']) for p in link['polyline']])
        data['points'].append({'id':point_id,'linkID':link['id'],'name':'名古屋南','kind':'IC','offsetMeters':round(offset,1),
            'romanizedName':'Nagoya-minami','facilities':[],'brands':[],'exitAvailable':True})

if __name__=='__main__':
    catalogue=build()
    (ROOT/'web/data/tomeihan.json').write_text(json.dumps(catalogue,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    path=ROOT/'web/data/regional-expressways.json'
    data=read(path)
    apply_catalogue(data,catalogue)
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
