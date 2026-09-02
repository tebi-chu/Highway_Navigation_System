"""Build the bidirectional Ebina IC <-> Aomori-chuo IC test corridor.

Input is an Overpass JSON export containing motorway ways for the Ken-O,
Tohoku and Aomori expressways plus nearby junction/service objects.
"""

import heapq
import json
import math
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ROOT / "data-osm-c4.json",
    ROOT / "data-osm-e4.json",
    ROOT / "data-osm-e4-route.json",
    ROOT / "data-osm-e4a.json",
]
DESTINATION = ROOT / "web" / "data" / "ebina-aomori.json"

ROADS = {
    "c4": ("C4", "首都圏中央連絡自動車道"),
    "e4": ("E4", "東北自動車道"),
    "e4a": ("E4A", "青森自動車道"),
}

# Direction-specific brands verified against NEXCO East's Drive Plaza pages.
# Values are internal badge identifiers; no corporate logo artwork is bundled.
BRANDS = {
    ("e4-north", "羽生"): ["starbucks"],
    ("e4-north", "佐野"): ["starbucks"],
    ("e4-north", "吾妻"): ["familyMart", "apollostation"],
    ("e4-south", "吾妻"): ["familyMart"],
    ("e4-north", "金成"): ["sevenEleven"],
    ("e4-south", "金成"): ["sevenEleven"],
    ("e4-north", "津軽"): ["sevenEleven"],
    ("e4-south", "津軽"): ["familyMart"],
    ("e4-north", "安積"): ["eneos"],
    ("e4-south", "安積"): ["eneos"],
}

MANNED_PA = {
    "厚木PA", "狭山", "菖蒲", "羽生", "都賀西方", "大谷", "安積",
    "福島松川", "吾妻", "菅生", "鶴巣", "金成", "花巻", "滝沢",
}

FUEL_AREAS = {
    "菖蒲", "佐野", "上河内", "那須高原", "安積", "安達太良", "吾妻",
    "国見", "菅生", "鶴巣", "長者原", "前沢", "岩手山", "花輪",
}


def facilities_for(link_id, name, kind):
    if kind not in {"SA", "PA"}:
        return []
    facilities = ["restroom", "accessibility"]
    brands = BRANDS.get((link_id, name), [])
    is_convenience = any(brand in {"sevenEleven", "familyMart"} for brand in brands)
    if kind == "SA" and not is_convenience:
        facilities.extend(["restaurant", "cafe", "evCharging"])
    elif kind == "SA":
        facilities.append("evCharging")
    elif name in MANNED_PA and not is_convenience:
        facilities.extend(["restaurant", "cafe"])
    if is_convenience:
        facilities.append("convenienceStore")
    if name in FUEL_AREAS:
        facilities.append("fuel")
    if (link_id, name) in {("e4-north", "金成"), ("e4-south", "安積")}:
        facilities.append("shower")
    return list(dict.fromkeys(facilities))


def distance(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[1] - a[1]) * 111_320 * math.cos(lat), (b[0] - a[0]) * 110_540)


def point_segment(point, start, end):
    lat = math.radians(point[0])
    scale_x, scale_y = 111_320 * math.cos(lat), 110_540
    dx, dy = (end[1] - start[1]) * scale_x, (end[0] - start[0]) * scale_y
    px, py = (point[1] - start[1]) * scale_x, (point[0] - start[0]) * scale_y
    ratio = max(0, min(1, (px * dx + py * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ratio * dx, py - ratio * dy), ratio


def project(point, route):
    best, travelled = None, 0.0
    for start, end in zip(route, route[1:]):
        length = distance(start, end)
        lateral, ratio = point_segment(point, start, end)
        candidate = lateral, travelled + length * ratio
        if best is None or candidate < best:
            best = candidate
        travelled += length
    return best


def simplify(points, tolerance=18):
    if len(points) <= 2:
        return points
    maximum, index = 0.0, 0
    for current in range(1, len(points) - 1):
        value, _ = point_segment(points[current], points[0], points[-1])
        if value > maximum:
            maximum, index = value, current
    if maximum <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)


def build_graph(elements, road):
    road_ref, road_name = road
    coordinates, graph = {}, {}
    for way in elements:
        tags = way.get("tags", {})
        tagged_names = (tags.get("name") or "").split(";")
        if way.get("type") != "way" or tags.get("highway") != "motorway":
            continue
        if tags.get("ref") != road_ref and road_name not in tagged_names and not way.get("_e4_gap"):
            continue
        geometry = way.get("geometry", [])
        nodes = way.get("nodes") or [(item["lat"], item["lon"]) for item in geometry]
        if len(nodes) != len(geometry):
            continue
        if tags.get("oneway") == "-1":
            nodes, geometry = list(reversed(nodes)), list(reversed(geometry))
        for node, coordinate in zip(nodes, geometry):
            coordinates[node] = coordinate["lat"], coordinate["lon"]
        for first, second in zip(nodes, nodes[1:]):
            length = distance(coordinates[first], coordinates[second])
            # Build a geometric centerline graph. Direction-specific links are
            # generated later from the requested endpoint order; this remains
            # robust where OSM splits the two carriageways differently.
            graph.setdefault(first, []).append((second, length))
            graph.setdefault(second, []).append((first, length))
    return graph, coordinates


def route(graph, coordinates, start, end):
    # Motorway carriageways and junction ramps are often separate OSM graph
    # components. Select the component that comes closest to both requested
    # endpoints instead of accidentally snapping to a disconnected ramp.
    remaining = set(coordinates)
    components = []
    while remaining:
        seed = remaining.pop()
        component = {seed}
        stack = [seed]
        while stack:
            node = stack.pop()
            for neighbor, _ in graph.get(node, []):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    stack.append(neighbor)
        components.append(component)
    component = min(
        components,
        key=lambda nodes: min(distance(coordinates[node], start) for node in nodes)
        + min(distance(coordinates[node], end) for node in nodes)
        + 2_000 / math.sqrt(len(nodes)),
    )
    start_node = min(component, key=lambda node: distance(coordinates[node], start))
    target_node = min(component, key=lambda node: distance(coordinates[node], end))
    targets = {target_node}
    queue = [(0.0, start_node)]
    heapq.heapify(queue)
    distances = {start_node: 0.0}
    previous, destination = {}, None
    while queue:
        current_distance, node = heapq.heappop(queue)
        if current_distance != distances.get(node):
            continue
        if node in targets:
            destination = node
            break
        for neighbor, length in graph.get(node, []):
            candidate = current_distance + length
            if candidate < distances.get(neighbor, math.inf):
                distances[neighbor] = candidate
                previous[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    if destination is None:
        raise RuntimeError(f"Route not found between {start} and {end}")
    nodes = [destination]
    while nodes[-1] in previous:
        nodes.append(previous[nodes[-1]])
    nodes.reverse()
    return [coordinates[node] for node in nodes], distances[destination]


def center(element):
    if "lat" in element:
        return element["lat"], element["lon"]
    value = element.get("center")
    return (value["lat"], value["lon"]) if value else None


def normalize_name(value):
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"[（(](上り|下り|内回り|外回り|内廻り|外廻り)[）)]", "", value)
    value = value.split(";")[0].split(":")[0].strip()
    value = re.sub(r"(スマート)?(IC|JCT|SA|PA)$", "", value, flags=re.IGNORECASE)
    return value.rstrip(" /・").strip()


def point_kind(name):
    normalized = unicodedata.normalize("NFKC", name).upper()
    if "SA" in normalized:
        return "SA"
    if "PA" in normalized:
        return "PA"
    if "JCT" in normalized:
        return "JCT"
    if "IC" in normalized or "スマート" in normalized:
        return "IC"
    return None


def coordinates_json(route_points):
    return [{"latitude": round(lat, 7), "longitude": round(lon, 7)} for lat, lon in route_points]


def build():
    elements = []
    for filename in SOURCES:
        elements.extend(json.loads(filename.read_text(encoding="utf-8"))["elements"])
    unique = {(item["type"], item["id"]): item for item in elements}
    elements = list(unique.values())
    gap_elements = json.loads((ROOT / "data-osm-e4-gap.json").read_text(encoding="utf-8"))["elements"]
    for item in gap_elements:
        item["_e4_gap"] = True
    elements.extend(gap_elements)
    graphs = {key: build_graph(elements, road) for key, road in ROADS.items()}

    anchors = {
        "ebina": (35.4418974, 139.3758992),
        "kuki": (36.0497837, 139.6498543),
        "aomori_jct": (40.79351, 140.6725467),
        "aomori_chuo": (40.7967901, 140.7393908),
    }
    definitions = [
        ("c4-north", "c4", "首都圏中央連絡自動車道", "外回り", "久喜方面", "ebina", "kuki", "e4-north"),
        ("e4-north", "e4", "東北自動車道", "下り", "青森方面", "kuki", "aomori_jct", "e4a-east"),
        ("e4a-east", "e4a", "青森自動車道", "下り", "青森中央方面", "aomori_jct", "aomori_chuo", None),
        ("e4a-west", "e4a", "青森自動車道", "上り", "東北道方面", "aomori_chuo", "aomori_jct", "e4-south"),
        ("e4-south", "e4", "東北自動車道", "上り", "東京方面", "aomori_jct", "kuki", "c4-south"),
        ("c4-south", "c4", "首都圏中央連絡自動車道", "内回り", "海老名方面", "kuki", "ebina", None),
    ]

    links, raw_routes = [], {}
    for link_id, graph_id, highway, direction, destination, start, end, next_id in definitions:
        graph, coordinates = graphs[graph_id]
        route_points, length = route(graph, coordinates, anchors[start], anchors[end])
        if length < 3_000:
            raise RuntimeError(f"Unexpectedly short route: {link_id} {length}")
        raw_routes[link_id] = route_points
        links.append({
            "id": link_id,
            "highwayName": highway,
            "directionName": direction,
            "destinationName": destination,
            "lengthMeters": round(length, 1),
            "standardSpeedKPH": 100 if graph_id == "e4" else 80,
            "polyline": coordinates_json(simplify(route_points)),
            "nextLinkIDs": [next_id] if next_id else [],
        })

    candidates = []
    for element in elements:
        tags, coordinate = element.get("tags", {}), center(element)
        name = tags.get("name")
        kind = point_kind(name or "")
        if not name or not kind or coordinate is None:
            continue
        candidates.append((element["id"], name, kind, coordinate))

    points = []
    for link in links:
        route_points = raw_routes[link["id"]]
        selected = {}
        for source_id, source_name, kind, coordinate in candidates:
            lateral, offset = project(coordinate, route_points)
            if lateral > (900 if kind in {"SA", "PA"} else 350):
                continue
            name = normalize_name(source_name)
            key = name, kind
            if not name or (key in selected and selected[key][0] <= lateral):
                continue
            selected[key] = lateral, offset, source_id
        for (name, kind), (_, offset, source_id) in selected.items():
            points.append({
                "id": f"{link['id']}-{source_id}",
                "name": name,
                "kind": kind,
                "linkID": link["id"],
                "offsetMeters": round(offset, 1),
                "facilities": facilities_for(link["id"], name, kind),
                "brands": BRANDS.get((link["id"], name), []) if kind in {"SA", "PA"} else [],
            })

    points.sort(key=lambda item: (next(i for i, link in enumerate(links) if link["id"] == item["linkID"]), item["offsetMeters"]))
    output = {
        "version": 3,
        "sourceAttribution": "Road geometry and point coordinates © OpenStreetMap contributors, ODbL 1.0. Facility and brand data compiled from NEXCO East Drive Plaza public pages; verify current availability before travel.",
        "coverage": "海老名IC～青森中央IC（往復・検証中）",
        "links": links,
        "points": points,
    }
    DESTINATION.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    for link in links:
        count = sum(point["linkID"] == link["id"] for point in points)
        print(f"{link['id']:11} {link['lengthMeters']/1000:7.1f} km {count:3} points")


if __name__ == "__main__":
    build()
