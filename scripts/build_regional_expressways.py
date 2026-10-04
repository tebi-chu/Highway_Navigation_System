"""Build bidirectional navigation data for five major expressways."""

import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data-osm-regional-expressways.json"
DESTINATION = ROOT / "web" / "data" / "regional-expressways.json"

spec = importlib.util.spec_from_file_location("route_builder", ROOT / "scripts" / "build_ebina_aomori_route.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

ROADS = {
    "e4": ("E4", "東北自動車道"),
    "c4": ("C4", "首都圏中央連絡自動車道"),
    "e20": ("E20", "中央自動車道"),
    "e19": ("E19", "中央自動車道"),
    "e17": ("E17", "関越自動車道"),
    "e18": ("E18", "上信越自動車道"),
    "e50": ("E50", "北関東自動車道"),
    # Name-only matching keeps roads which share a route number (E1A/E23)
    # separate.  第二東海自動車道横浜名古屋線 is the statutory route name;
    # its open sections are presented by their signed names, 新東名 and
    # 伊勢湾岸道, rather than duplicated as another road.
    "e1-tomei": (None, "東名高速道路"),
    # E1A matching also includes the short 新御殿場IC～御殿場JCT connector,
    # whose OSM name is not consistently 新東名高速道路.  Endpoint routing
    # and the explicit point allow-list below keep 伊勢湾岸道 separate.
    "e1a-shintomei": ("E1A", "新東名高速道路"),
    "e1a-isewangan": (None, "伊勢湾岸自動車道"),
    "e23-ise": (None, "伊勢自動車道"),
}

ANCHORS = {
    "kawaguchi": (35.8447, 139.7380), "aomori": (40.7935, 140.6725),
    "chigasaki": (35.3543, 139.4049), "daiei": (35.8290, 140.4070),
    "matsuo": (35.6365, 140.4570), "kisarazu": (35.3660, 139.9465),
    "takaido": (35.6805, 139.6047), "okaya": (36.0500, 138.0359),
    "komaki": (35.2884, 136.9810),
    "nerima": (35.7483, 139.5990), "nagaoka": (37.4380, 138.8195),
    "fujioka": (36.2418, 139.0730), "joetsu": (37.1510, 138.2375),
    "takasaki": (36.3305, 139.0665), "hitachinaka": (36.3975, 140.5635),
    "iwafune": (36.3155, 139.6525),
    "tokyo": (35.6258, 139.6225), "tomei-komaki": (35.3030, 136.9160),
    "ebina-minami": (35.4145, 139.3810), "shin-hadano": (35.3710, 139.1740),
    "new-gotemba": (35.3233, 138.9169), "toyota-higashi": (35.0550, 137.1780),
    "yokkaichi-jct": (35.0340, 136.5710),
    "ise-seki": (34.8371, 136.4233), "ise": (34.4805, 136.7310),
}

# id, graph, road name, direction, destination, start, end, speed
DEFINITIONS = [
    ("e4-north", "e4", "東北自動車道", "下り", "青森方面", "kawaguchi", "aomori", 100),
    ("e4-south", "e4", "東北自動車道", "上り", "東京方面", "aomori", "kawaguchi", 100),
    ("c4-east", "c4", "首都圏中央連絡自動車道", "外回り", "成田方面", "chigasaki", "daiei", 80),
    ("c4-west", "c4", "首都圏中央連絡自動車道", "内回り", "茅ヶ崎方面", "daiei", "chigasaki", 80),
    ("c4-chiba-south", "c4", "首都圏中央連絡自動車道", "内回り", "木更津方面", "matsuo", "kisarazu", 80),
    ("c4-chiba-north", "c4", "首都圏中央連絡自動車道", "外回り", "松尾横芝方面", "kisarazu", "matsuo", 80),
    ("e20-west", "e20", "中央自動車道", "下り", "名古屋方面", "takaido", "okaya", 100),
    ("e19-west", "e19", "中央自動車道", "下り", "名古屋方面", "okaya", "komaki", 100),
    ("e19-east", "e19", "中央自動車道", "上り", "東京方面", "komaki", "okaya", 100),
    ("e20-east", "e20", "中央自動車道", "上り", "東京方面", "okaya", "takaido", 100),
    ("e17-north", "e17", "関越自動車道", "下り", "新潟方面", "nerima", "nagaoka", 100),
    ("e17-south", "e17", "関越自動車道", "上り", "東京方面", "nagaoka", "nerima", 100),
    ("e18-west", "e18", "上信越自動車道", "下り", "上越方面", "fujioka", "joetsu", 100),
    ("e18-east", "e18", "上信越自動車道", "上り", "藤岡方面", "joetsu", "fujioka", 100),
    ("e50-east-west", "e50", "北関東自動車道", "下り", "ひたちなか方面", "takasaki", "iwafune", 100),
    ("e50-east-east", "e50", "北関東自動車道", "下り", "ひたちなか方面", "iwafune", "hitachinaka", 100),
    ("e50-west-east", "e50", "北関東自動車道", "上り", "高崎方面", "hitachinaka", "iwafune", 100),
    ("e50-west-west", "e50", "北関東自動車道", "上り", "高崎方面", "iwafune", "takasaki", 100),
    ("e1-tomei-west", "e1-tomei", "東名高速道路", "下り", "名古屋方面", "tokyo", "tomei-komaki", 100),
    ("e1-tomei-east", "e1-tomei", "東名高速道路", "上り", "東京方面", "tomei-komaki", "tokyo", 100),
    # 新秦野IC～新御殿場IC is not open yet, so the two open sections must
    # remain separate and must never be joined by dead-reckoning.
    ("e1a-shintomei-kanagawa-west", "e1a-shintomei", "新東名高速道路", "下り", "新秦野方面", "ebina-minami", "shin-hadano", 100),
    ("e1a-shintomei-kanagawa-east", "e1a-shintomei", "新東名高速道路", "上り", "海老名方面", "shin-hadano", "ebina-minami", 100),
    ("e1a-shintomei-west", "e1a-shintomei", "新東名高速道路", "下り", "名古屋方面", "new-gotemba", "toyota-higashi", 120),
    ("e1a-shintomei-east", "e1a-shintomei", "新東名高速道路", "上り", "東京方面", "toyota-higashi", "new-gotemba", 120),
    ("e1a-isewangan-west", "e1a-isewangan", "伊勢湾岸自動車道", "下り", "四日市方面", "toyota-higashi", "yokkaichi-jct", 100),
    ("e1a-isewangan-east", "e1a-isewangan", "伊勢湾岸自動車道", "上り", "豊田方面", "yokkaichi-jct", "toyota-higashi", 100),
    ("e23-ise-south", "e23-ise", "伊勢自動車道", "下り", "伊勢方面", "ise-seki", "ise", 100),
    ("e23-ise-north", "e23-ise", "伊勢自動車道", "上り", "名古屋方面", "ise", "ise-seki", 100),
]

NEXT_LINKS = {
    "e4-north": ["e4a-east"],
    "e4a-west": ["e4-south"],
    "e50-east-west": ["e50-east-east"],
    "e50-west-east": ["e50-west-west"],
    "e20-west": ["e19-west"],
    "e19-east": ["e20-east"],
    "e1a-shintomei-west": ["e1a-isewangan-west"],
    "e1a-isewangan-east": ["e1a-shintomei-east"],
}

CHUO_LINKS = {"e20-west", "e19-west", "e19-east", "e20-east"}
CHUO_SHOWER_AREAS = {"双葉", "駒ヶ岳"}
NEW_SERVICE_LINKS = {
    "e1-tomei-west", "e1-tomei-east",
    "e1a-shintomei-kanagawa-west", "e1a-shintomei-kanagawa-east",
    "e1a-shintomei-west", "e1a-shintomei-east",
    "e1a-isewangan-west", "e1a-isewangan-east",
    "e23-ise-south", "e23-ise-north",
}

# 東名 and 新東名 run close together in several places, so proximity alone
# cannot establish road membership. These type-aware catalogues are the
# authoritative boundary used after projecting an OSM point onto a route.
# They intentionally exclude unopened/planned facilities.
TOMEI_POINTS = {
    "IC": {
        "東京", "東名川崎", "横浜青葉", "横浜町田", "綾瀬", "厚木",
        "秦野中井", "大井松田", "御殿場", "裾野", "沼津", "富士", "清水",
        "日本平久能山", "静岡", "焼津", "大井川焼津藤枝スマート", "吉田",
        "相良牧之原", "菊川", "掛川", "袋井", "磐田", "浜松", "浜松西",
        "舘山寺", "三ヶ日", "豊川", "音羽蒲郡", "岡崎", "豊田", "東名三好",
        "名古屋", "春日井", "小牧",
    },
    "JCT": {"横浜青葉", "海老名", "伊勢原", "御殿場", "清水", "三ヶ日", "豊田", "日進", "小牧"},
    "SA": {"海老名", "足柄", "富士川", "牧之原", "浜名湖", "豊田上郷"},
    "PA": {
        "港北", "中井", "鮎沢", "駒門", "愛鷹", "由比", "日本平", "日本坂",
        "小笠", "遠州豊田", "三方原", "新城", "豊橋", "赤塚", "美合", "東郷", "守山",
    },
}

SHINTOMEI_POINTS = {
    "IC": {
        "海老名南", "厚木南", "伊勢原大山", "新秦野", "新御殿場", "長泉沼津", "駿河湾沼津", "新富士",
        "新清水", "新静岡", "藤枝岡部", "島田金谷", "森掛川", "新磐田",
        "静岡", "遠州森町", "浜松浜北", "浜松", "浜松いなさ", "新城", "岡崎東", "岡崎",
    },
    "JCT": {"海老名南", "伊勢原", "御殿場", "新清水", "浜松いなさ", "豊田東"},
    "SA": {"駿河湾沼津", "静岡", "浜松", "岡崎"},
    "PA": {"清水", "藤枝", "掛川", "遠州森町", "長篠設楽原"},
}

# Some directional PA polygons are OSM relations without a usable centre in
# the downloaded extract. Their named motorway-junction nodes are reliable
# fallbacks and prevent one carriageway from losing the area entirely.
SHINTOMEI_AREA_NODE_FALLBACKS = {"藤枝", "掛川"}
SHINTOMEI_SMART_AREAS = {"駿河湾沼津", "静岡", "遠州森町", "浜松", "岡崎"}
SHINTOMEI_KANAGAWA_EXPECTED = {
    ("海老名南", "JCT"), ("厚木南", "IC"), ("伊勢原", "JCT"),
    ("伊勢原大山", "IC"), ("新秦野", "IC"),
}
SHINTOMEI_MAIN_EXPECTED = {
    (name, kind) for kind, names in SHINTOMEI_POINTS.items() for name in names
    # 岡崎SA does not have a smart IC, so do not synthesize an 岡崎IC.
    if name not in {"海老名南", "厚木南", "伊勢原", "伊勢原大山", "新秦野"}
    and not (name == "岡崎" and kind == "IC")
}

E4_SERVICE_AREAS = {
    "蓮田", "羽生", "佐野", "都賀西方", "大谷", "上河内", "矢板北", "黒磯",
    "那須高原", "阿武隈", "鏡石", "安積", "安達太良", "福島松川", "吾妻",
    "国見", "蔵王", "菅生", "泉", "鶴巣", "三本木", "長者原", "志波姫",
    "金成", "中尊寺", "前沢", "北上金ヶ崎", "花巻", "紫波", "矢巾", "滝沢",
    "岩手山", "前森山", "畑", "田山", "湯瀬", "花輪", "小坂", "阿闍羅",
    "津軽", "高舘",
}

# These four directional facility nodes and the two adjoining IC nodes are
# absent from the regional source extract. Coordinates are the current OSM
# nodes verified against the NEXCO East SA/PA catalogue.
E4_MANUAL_POINTS = {
    "下り": [
        (1022661265, "紫波", "SA", (39.5110307, 141.1016950), "Shiwa"),
        (218548250, "矢巾", "PA", (39.6146980, 141.1295999), "Yahaba"),
    ],
    "上り": [
        (1022661027, "紫波", "SA", (39.5189311, 141.1034715), "Shiwa"),
        (1270325745, "矢巾", "PA", (39.6226151, 141.1294552), "Yahaba"),
    ],
}
E4_MANUAL_ICS = [
    (4252012072, "紫波", "IC", (39.5527596, 141.1129561), "Shiwa"),
    (7142509462, "矢巾", "IC", (39.6176069, 141.1296931), "Yahaba"),
]
E4_MANUAL_FACILITIES = {
    ("紫波", "SA"): ["restroom", "accessibility", "restaurant", "cafe", "evCharging"],
    ("矢巾", "PA"): ["restroom", "accessibility"],
}


def canonical_point_name(graph_id, raw_name, kind):
    """Return a canonical signed name, or None when it is not on this road."""
    name = base.normalize_name(raw_name)
    if graph_id == "e1-tomei":
        # OSM contains several ramp-specific labels for the one 綾瀬 smart IC.
        if name.startswith("綾瀬"):
            name = "綾瀬"
        if name == "三ケ日":
            name = "三ヶ日"
        return name if name in TOMEI_POINTS.get(kind, set()) else None
    if graph_id == "e1a-shintomei":
        return name if name in SHINTOMEI_POINTS.get(kind, set()) else None
    return name


def facilities_for(link_id, name, kind):
    if kind not in {"SA", "PA"}:
        return []
    facilities = ["restroom", "accessibility"]
    if link_id in CHUO_LINKS:
        # Central Expressway service-area data is intentionally explicit here:
        # these are staffed food/shop areas, while SA additionally provide the
        # main fuel and cafe services. Only categories shown by the driving UI
        # are added, so cards no longer appear blank.
        facilities.append("restaurant")
        if kind == "SA":
            facilities.extend(["cafe", "fuel"])
        if name in CHUO_SHOWER_AREAS:
            facilities.append("shower")
        if name == "諏訪湖":
            facilities.extend(["hotSpring", "viewArea"])
    if link_id in NEW_SERVICE_LINKS:
        # Keep these cards useful until the editable cloud facility catalogue
        # supplies operator-maintained details.  Every motorway SA/PA offers
        # food service; SA cards also expose the principal fuel/cafe categories.
        facilities.append("restaurant")
        if kind == "SA":
            facilities.extend(["cafe", "fuel"])
    return list(dict.fromkeys(facilities))


def build_e50_graph(elements):
    """Include junction connectors and short E4/E6 overlaps used by E50."""
    coordinates, graph = {}, {}
    for way in elements:
        tags = way.get("tags", {})
        geometry = way.get("geometry", [])
        nodes = way.get("nodes") or [(item["lat"], item["lon"]) for item in geometry]
        if way.get("type") != "way" or len(nodes) != len(geometry):
            continue
        highway, ref = tags.get("highway"), tags.get("ref", "")
        if highway != "motorway_link" and not (highway == "motorway" and ref in {"E50", "E4", "E6"}):
            continue
        if not geometry or not all(36.0 <= item["lat"] <= 36.8 and 138.8 <= item["lon"] <= 140.8 for item in geometry):
            continue
        if tags.get("oneway") == "-1":
            nodes, geometry = list(reversed(nodes)), list(reversed(geometry))
        for node, item in zip(nodes, geometry):
            coordinates[node] = item["lat"], item["lon"]
        for first, second in zip(nodes, nodes[1:]):
            length = base.distance(coordinates[first], coordinates[second])
            graph.setdefault(first, []).append((second, length))
            graph.setdefault(second, []).append((first, length))
    return graph, coordinates


def connect_nearby_sections(graph, coordinates, maximum=140):
    """Join carriageway/route sections split by OSM tagging boundaries."""
    cell_size = 0.002
    buckets = {}
    for node, (latitude, longitude) in coordinates.items():
        cell = int(latitude / cell_size), int(longitude / cell_size)
        for latitude_cell in range(cell[0] - 1, cell[0] + 2):
            for longitude_cell in range(cell[1] - 1, cell[1] + 2):
                for other in buckets.get((latitude_cell, longitude_cell), []):
                    length = base.distance(coordinates[other], coordinates[node])
                    if length <= maximum:
                        graph.setdefault(node, []).append((other, length))
                        graph.setdefault(other, []).append((node, length))
        buckets.setdefault(cell, []).append(node)
    return graph, coordinates


def main():
    elements = json.loads(SOURCE.read_text(encoding="utf-8"))["elements"]
    graphs = {key: base.build_graph(elements, value) for key, value in ROADS.items()}
    graphs["e20"] = connect_nearby_sections(*graphs["e20"])
    graphs["e19"] = graphs["e20"]
    graphs["e50"] = build_e50_graph(elements)
    for graph_id in ("e1-tomei", "e1a-shintomei", "e1a-isewangan", "e23-ise"):
        graphs[graph_id] = connect_nearby_sections(*graphs[graph_id])
    ramps = base.motorway_links(elements)
    candidates = []
    for element in elements:
        tags, coordinate = element.get("tags", {}), base.center(element)
        if not tags.get("name") or coordinate is None:
            continue
        if "仮称" in tags["name"] or "簡易" in tags["name"]:
            continue
        # Only accept the OSM object types that actually represent road
        # facilities.  A name containing the letters "PA"/"SA" is not enough:
        # nearby shops and ordinary car parks otherwise become fake motorway
        # service areas (for example "J-STYLE JAPAN").
        osm_highway = tags.get("highway")
        if osm_highway not in {"motorway_junction", "services", "rest_area"}:
            continue
        english = base.romanized_parts(tags.get("name:en"))
        parsed_points = base.point_names(tags["name"])
        for index, (name, kind) in enumerate(parsed_points):
            normalized_candidate = base.normalize_name(name)
            area_node_fallback = (
                kind in {"SA", "PA"}
                and osm_highway == "motorway_junction"
                and normalized_candidate in SHINTOMEI_AREA_NODE_FALLBACKS
            )
            if kind in {"SA", "PA"} and osm_highway not in {"services", "rest_area"} and not area_node_fallback:
                continue
            if kind in {"SA", "PA"} and element.get("type") == "node" and not area_node_fallback:
                continue
            if kind in {"IC", "JCT"} and osm_highway != "motorway_junction":
                continue
            romanized = english[min(index, len(english) - 1)] if english else base.ROMAJI_FALLBACKS.get(name, "")
            candidates.append((element["id"], name, kind, coordinate, romanized, base.direction_hint(tags["name"])))
        # OSM commonly labels a SA/PA smart-IC junction as one combined name.
        # Add its IC identity separately so the UI can merge the two signed
        # types into one card instead of silently dropping the smart IC.
        if osm_highway == "motorway_junction" and "スマート" in tags["name"]:
            for smart_name in SHINTOMEI_SMART_AREAS:
                if smart_name in tags["name"]:
                    candidates.append((element["id"], smart_name, "IC", coordinate, base.ROMAJI_FALLBACKS.get(smart_name, ""), base.direction_hint(tags["name"])))
                    break
    # The source extract currently contains mojibake for 海老名南JCT. Keep a
    # stable, verified junction coordinate until that upstream object is fixed.
    candidates.append(("manual-ebina-minami-jct", "海老名南", "JCT", (35.4098208, 139.3740684), "Ebina-minami", None))

    links, points = [], []
    for link_id, graph_id, highway, direction, destination, start, end, speed in DEFINITIONS:
        graph, coordinates = graphs[graph_id]
        route, _, _ = base.route(graph, coordinates, ANCHORS[start], ANCHORS[end])
        route = base.simplify(route)
        length = sum(base.distance(a, b) for a, b in zip(route, route[1:]))
        # The currently open Kanagawa section of Shin-Tomei is only about
        # 21 km; reject anything shorter than 15 km while still accepting it.
        if length < 15_000:
            raise RuntimeError(f"Unexpectedly short route: {link_id} {length/1000:.1f} km")
        links.append({
            "id": link_id, "highwayName": highway, "directionName": direction,
            "destinationName": destination, "lengthMeters": round(length, 1),
            "standardSpeedKPH": speed, "polyline": base.coordinates_json(route),
            "nextLinkIDs": NEXT_LINKS.get(link_id, []),
        })
        selected = {}
        for source_id, raw_name, kind, coordinate, romanized, point_direction in candidates:
            lateral, offset = base.project(coordinate, route)
            strict_road_catalogue = graph_id in {"e1-tomei", "e1a-shintomei"}
            limit = 1500 if strict_road_catalogue else (1100 if kind in {"SA", "PA"} else 450)
            if lateral > limit:
                continue
            name = canonical_point_name(graph_id, raw_name, kind)
            if name is None:
                continue
            # Direction-labelled OSM objects represent a single carriageway.
            # Do not duplicate them onto the opposite direction.
            if strict_road_catalogue and point_direction and point_direction != direction:
                continue
            key = name, kind
            if key in selected and selected[key][0] <= lateral:
                continue
            selected[key] = lateral, offset, source_id, romanized, coordinate
        if graph_id == "e4":
            for source_id, name, kind, coordinate, romanized in E4_MANUAL_POINTS[direction] + E4_MANUAL_ICS:
                lateral, offset = base.project(coordinate, route)
                if lateral > 1500:
                    raise RuntimeError(f"Manual E4 point is too far from route: {name} {kind} {lateral:.0f}m")
                selected[(name, kind)] = lateral, offset, source_id, romanized, coordinate
        for (name, kind), (_, offset, source_id, romanized, coordinate) in selected.items():
            offset = base.exit_branch_offset(name, coordinate, route, ramps, offset)
            facilities = E4_MANUAL_FACILITIES.get((name, kind), facilities_for(link_id, name, kind))
            points.append({
                "id": f"{link_id}-{source_id}-{kind.lower()}", "name": name, "kind": kind,
                "linkID": link_id, "offsetMeters": round(offset, 1),
                "romanizedName": romanized, "facilities": facilities, "brands": [],
            })
        print(f"{link_id:16} {length/1000:7.1f} km {len(selected):3} points")

    order = {link["id"]: index for index, link in enumerate(links)}
    points.sort(key=lambda point: (order[point["linkID"]], point["offsetMeters"], point["kind"]))
    for link_id in ("e1a-shintomei-kanagawa-west", "e1a-shintomei-kanagawa-east"):
        actual = {(point["name"], point["kind"]) for point in points if point["linkID"] == link_id}
        missing = SHINTOMEI_KANAGAWA_EXPECTED - actual
        if missing:
            raise RuntimeError(f"Missing open Shin-Tomei Kanagawa points on {link_id}: {sorted(missing)}")
    for link_id in ("e1a-shintomei-west", "e1a-shintomei-east"):
        actual = {(point["name"], point["kind"]) for point in points if point["linkID"] == link_id}
        missing = SHINTOMEI_MAIN_EXPECTED - actual
        if missing:
            raise RuntimeError(f"Missing open Shin-Tomei points on {link_id}: {sorted(missing)}")
    for link_id in ("e4-north", "e4-south"):
        actual = {point["name"] for point in points if point["linkID"] == link_id and point["kind"] in {"SA", "PA"}}
        missing = E4_SERVICE_AREAS - actual
        if missing:
            raise RuntimeError(f"Missing Tohoku SA/PA on {link_id}: {sorted(missing)}")
    # Preserve the already tested Aomori JCT–Aomori-chuo IC continuation.
    previous = json.loads((ROOT / "web" / "data" / "ebina-aomori.json").read_text(encoding="utf-8"))
    links.extend(link for link in previous["links"] if link["id"] in {"e4a-east", "e4a-west"})
    points.extend(point for point in previous["points"] if point["linkID"] in {"e4a-east", "e4a-west"})
    output = {
        "version": 4,
        "sourceAttribution": "Road geometry and point coordinates © OpenStreetMap contributors, ODbL 1.0. Verify current road operation and facilities with the road operator before travel.",
        "coverage": "東北道・圏央道・中央道・関越道・上信越道・北関東道・東名・新東名・伊勢湾岸道・伊勢道（開通済み区間、上下線）",
        "links": links, "points": points,
    }
    DESTINATION.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
