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
]

NEXT_LINKS = {
    "e4-north": ["e4a-east"],
    "e4a-west": ["e4-south"],
    "e50-east-west": ["e50-east-east"],
    "e50-west-east": ["e50-west-west"],
    "e20-west": ["e19-west"],
    "e19-east": ["e20-east"],
}

CHUO_LINKS = {"e20-west", "e19-west", "e19-east", "e20-east"}
CHUO_SHOWER_AREAS = {"双葉", "駒ヶ岳"}


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
        for index, (name, kind) in enumerate(base.point_names(tags["name"])):
            if kind in {"SA", "PA"} and osm_highway not in {"services", "rest_area"}:
                continue
            if kind in {"SA", "PA"} and element.get("type") == "node":
                continue
            if kind in {"IC", "JCT"} and osm_highway != "motorway_junction":
                continue
            romanized = english[min(index, len(english) - 1)] if english else base.ROMAJI_FALLBACKS.get(name, "")
            candidates.append((element["id"], name, kind, coordinate, romanized, base.direction_hint(tags["name"])))

    links, points = [], []
    for link_id, graph_id, highway, direction, destination, start, end, speed in DEFINITIONS:
        graph, coordinates = graphs[graph_id]
        route, _, _ = base.route(graph, coordinates, ANCHORS[start], ANCHORS[end])
        route = base.simplify(route)
        length = sum(base.distance(a, b) for a, b in zip(route, route[1:]))
        if length < 25_000:
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
            limit = 1100 if kind in {"SA", "PA"} else 450
            if lateral > limit:
                continue
            name = base.normalize_name(raw_name)
            key = name, kind
            if key in selected and selected[key][0] <= lateral:
                continue
            selected[key] = lateral, offset, source_id, romanized, coordinate
        for (name, kind), (_, offset, source_id, romanized, coordinate) in selected.items():
            offset = base.exit_branch_offset(name, coordinate, route, ramps, offset)
            facilities = facilities_for(link_id, name, kind)
            points.append({
                "id": f"{link_id}-{source_id}-{kind.lower()}", "name": name, "kind": kind,
                "linkID": link_id, "offsetMeters": round(offset, 1),
                "romanizedName": romanized, "facilities": facilities, "brands": [],
            })
        print(f"{link_id:16} {length/1000:7.1f} km {len(selected):3} points")

    order = {link["id"]: index for index, link in enumerate(links)}
    points.sort(key=lambda point: (order[point["linkID"]], point["offsetMeters"], point["kind"]))
    # Preserve the already tested Aomori JCT–Aomori-chuo IC continuation.
    previous = json.loads((ROOT / "web" / "data" / "ebina-aomori.json").read_text(encoding="utf-8"))
    links.extend(link for link in previous["links"] if link["id"] in {"e4a-east", "e4a-west"})
    points.extend(point for point in previous["points"] if point["linkID"] in {"e4a-east", "e4a-west"})
    output = {
        "version": 4,
        "sourceAttribution": "Road geometry and point coordinates © OpenStreetMap contributors, ODbL 1.0. Verify current road operation and facilities with the road operator before travel.",
        "coverage": "東北道・圏央道・中央道・関越道・上信越道・北関東道（開通済み区間、上下線）",
        "links": links, "points": points,
    }
    DESTINATION.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
