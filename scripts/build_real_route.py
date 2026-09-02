import heapq
import json
import math
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def haversine(a, b):
    radius = 6_371_000.0
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def load_graph(filename):
    data = json.loads((ROOT / filename).read_text(encoding="utf-8"))
    coordinates = {}
    graph = {}
    for way in data["elements"]:
        if way.get("type") != "way" or len(way.get("nodes", [])) != len(way.get("geometry", [])):
            continue
        nodes = way["nodes"]
        geometry = way["geometry"]
        for node_id, coordinate in zip(nodes, geometry):
            coordinates[node_id] = (coordinate["lat"], coordinate["lon"])
        for first, second in zip(nodes, nodes[1:]):
            distance = haversine(coordinates[first], coordinates[second])
            graph.setdefault(first, []).append((second, distance))
    return graph, coordinates


def nearest_nodes(coordinates, target, count=24):
    return sorted(coordinates, key=lambda node: haversine(coordinates[node], target))[:count]


def dijkstra(graph, starts, targets):
    targets = set(targets)
    queue = [(0.0, node) for node in starts]
    heapq.heapify(queue)
    distances = {node: 0.0 for node in starts}
    previous = {}
    destination = None
    while queue:
        distance, node = heapq.heappop(queue)
        if distance != distances.get(node):
            continue
        if node in targets:
            destination = node
            break
        for neighbor, edge_distance in graph.get(node, []):
            candidate = distance + edge_distance
            if candidate < distances.get(neighbor, math.inf):
                distances[neighbor] = candidate
                previous[neighbor] = node
                heapq.heappush(queue, (candidate, neighbor))
    if destination is None:
        raise RuntimeError("Directed route was not found")
    route = [destination]
    while route[-1] in previous:
        route.append(previous[route[-1]])
    route.reverse()
    return route, distances[destination]


def perpendicular_distance(point, start, end):
    origin_lat = math.radians(point[0])
    x_scale = 111_320.0 * math.cos(origin_lat)
    y_scale = 111_132.0
    ax = (start[1] - point[1]) * x_scale
    ay = (start[0] - point[0]) * y_scale
    bx = (end[1] - point[1]) * x_scale
    by = (end[0] - point[0]) * y_scale
    dx, dy = bx - ax, by - ay
    denominator = dx * dx + dy * dy
    ratio = 0 if denominator == 0 else max(0, min(1, -(ax * dx + ay * dy) / denominator))
    return math.hypot(ax + ratio * dx, ay + ratio * dy), ratio


def project(point, route):
    best = None
    traversed = 0.0
    for start, end in zip(route, route[1:]):
        length = haversine(start, end)
        lateral, ratio = perpendicular_distance(point, start, end)
        candidate = (lateral, traversed + length * ratio)
        if best is None or candidate[0] < best[0]:
            best = candidate
        traversed += length
    return best


def rdp(points, tolerance=8.0):
    if len(points) <= 2:
        return points
    maximum, index = 0.0, 0
    for candidate_index in range(1, len(points) - 1):
        distance, _ = perpendicular_distance(points[candidate_index], points[0], points[-1])
        if distance > maximum:
            maximum, index = distance, candidate_index
    if maximum <= tolerance:
        return [points[0], points[-1]]
    return rdp(points[: index + 1], tolerance)[:-1] + rdp(points[index:], tolerance)


def load_named_points(filename):
    data = json.loads((ROOT / filename).read_text(encoding="utf-8"))
    result = []
    for element in data["elements"]:
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        center = element.get("center", {})
        lat = element.get("lat", center.get("lat"))
        lon = element.get("lon", center.get("lon"))
        if lat is not None and lon is not None:
            result.append({"name": name, "coordinate": (lat, lon)})
    return result


def select_point(candidates, route, aliases):
    normalized_aliases = [unicodedata.normalize("NFKC", alias) for alias in aliases]
    matches = [
        candidate for candidate in candidates
        if any(alias in unicodedata.normalize("NFKC", candidate["name"]) for alias in normalized_aliases)
    ]
    if not matches:
        raise RuntimeError(f"Point was not found: {aliases}")
    scored = [(project(candidate["coordinate"], route), candidate) for candidate in matches]
    scored = [item for item in scored if item[0] is not None]
    (lateral, offset), candidate = min(scored, key=lambda item: item[0][0])
    if lateral > 2_000:
        raise RuntimeError(f"Point too far from route: {candidate['name']} ({lateral:.0f}m)")
    return candidate, offset, lateral


def coordinate_json(coordinate):
    return {"latitude": round(coordinate[0], 7), "longitude": round(coordinate[1], 7)}


def build():
    c4_graph, c4_coordinates = load_graph("data-overpass-c4-full.json")
    e4_graph, e4_coordinates = load_graph("data-overpass-e4-full.json")
    c4_nodes, c4_length = dijkstra(
        c4_graph,
        nearest_nodes(c4_coordinates, (35.4386, 139.3810)),
        nearest_nodes(c4_coordinates, (36.0450, 139.6550)),
    )
    e4_nodes, e4_length = dijkstra(
        e4_graph,
        nearest_nodes(e4_coordinates, (36.0470, 139.6550)),
        nearest_nodes(e4_coordinates, (36.5390, 139.8000)),
    )
    c4_route = [c4_coordinates[node] for node in c4_nodes]
    e4_route = [e4_coordinates[node] for node in e4_nodes]
    if not 90_000 < c4_length < 150_000:
        raise RuntimeError(f"Unexpected C4 length: {c4_length}")
    if not 50_000 < e4_length < 90_000:
        raise RuntimeError(f"Unexpected E4 length: {e4_length}")

    definitions = [
        ("ebina-ic", "海老名", "IC", "c4-up", ["海老名ＩＣ", "海老名IC"]),
        ("keno-atsugi-ic", "圏央厚木", "IC", "c4-up", ["圏央厚木"]),
        ("atsugi-pa", "厚木", "PA", "c4-up", ["厚木PA"]),
        ("sagamihara-aikawa-ic", "相模原愛川", "IC", "c4-up", ["相模原愛川"]),
        ("sagamihara-ic", "相模原", "IC", "c4-up", ["相模原IC", "相模原ＩＣ"]),
        ("takaosan-ic", "高尾山", "IC", "c4-up", ["高尾山"]),
        ("hachioji-jct", "八王子", "JCT", "c4-up", ["八王子JCT"]),
        ("hachioji-nishi-ic", "八王子西", "IC", "c4-up", ["八王子西"]),
        ("akiruno-ic", "あきる野", "IC", "c4-up", ["あきる野"]),
        ("hinode-ic", "日の出", "IC", "c4-up", ["日の出IC"]),
        ("ome-ic", "青梅", "IC", "c4-up", ["青梅IC"]),
        ("iruma-ic", "入間", "IC", "c4-up", ["入間IC"]),
        ("sayama-pa", "狭山", "PA", "c4-up", ["狭山PA"]),
        ("sayama-hidaka-ic", "狭山日高", "IC", "c4-up", ["狭山日高"]),
        ("keno-tsurugashima-ic", "圏央鶴ヶ島", "IC", "c4-up", ["圏央鶴ヶ島"]),
        ("tsurugashima-jct", "鶴ヶ島", "JCT", "c4-up", ["鶴ヶ島JCT"]),
        ("sakado-ic", "坂戸", "IC", "c4-up", ["坂戸ＩＣ", "坂戸IC"]),
        ("kawajima-ic", "川島", "IC", "c4-up", ["川島ＩＣ", "川島IC"]),
        ("okegawa-kitamoto-ic", "桶川北本", "IC", "c4-up", ["桶川北本"]),
        ("okegawa-kano-ic", "桶川加納", "IC", "c4-up", ["桶川加納"]),
        ("shobu-pa", "菖蒲", "PA", "c4-up", ["菖蒲PA"]),
        ("shiraoka-shobu-ic", "白岡菖蒲", "IC", "c4-up", ["白岡菖蒲"]),
        ("kuki-shiraoka-jct", "久喜白岡", "JCT", "c4-up", ["久喜白岡JCT"]),
        ("kazo-ic", "加須", "IC", "e4-down", ["加須IC"]),
        ("hanyu-ic", "羽生", "IC", "e4-down", ["羽生IC"]),
        ("hanyu-pa", "羽生", "PA", "e4-down", ["羽生PA"]),
        ("tatebayashi-ic", "館林", "IC", "e4-down", ["館林IC"]),
        ("sano-fujioka-ic", "佐野藤岡", "IC", "e4-down", ["佐野藤岡"]),
        ("sano-sa", "佐野", "SA", "e4-down", ["佐野SA"]),
        ("iwafune-jct", "岩舟", "JCT", "e4-down", ["岩舟JCT"]),
        ("tochigi-ic", "栃木", "IC", "e4-down", ["栃木IC"]),
        ("tochigi-tsuga-jct", "栃木都賀", "JCT", "e4-down", ["栃木都賀JCT"]),
        ("tsuga-nishikata-pa", "都賀西方", "PA", "e4-down", ["都賀西方PA"]),
        ("kanuma-ic", "鹿沼", "IC", "e4-down", ["鹿沼IC"]),
    ]
    candidates = load_named_points("data-overpass-c4-points.json") + load_named_points("data-overpass-e4-points.json")
    # Facilities verified against the operators' official SA/PA pages on 2026-08-30.
    # Brand values drive original text badges only; no third-party logo artwork is bundled.
    facility_data = {
        "atsugi-pa": {
            "facilities": ["restaurant", "restroom", "evCharging", "accessibility"],
            "brands": [],
        },
        "sayama-pa": {
            "facilities": ["restaurant", "restroom", "evCharging", "accessibility"],
            "brands": [],
        },
        "shobu-pa": {
            "facilities": ["restaurant", "restroom", "fuel", "cafe", "evCharging", "accessibility"],
            "brands": ["apollostation"],
        },
        "hanyu-pa": {
            "facilities": ["restaurant", "restroom", "convenienceStore", "cafe", "evCharging", "accessibility"],
            "brands": ["starbucks", "familyMart"],
        },
        "sano-sa": {
            "facilities": ["restaurant", "restroom", "fuel", "cafe", "evCharging", "lodging", "dogRun", "accessibility"],
            "brands": ["starbucks", "apollostation"],
        },
        "tsuga-nishikata-pa": {
            "facilities": ["restaurant", "restroom", "evCharging", "accessibility"],
            "brands": [],
        },
    }
    points = []
    diagnostics = []
    for point_id, name, kind, link_id, aliases in definitions:
        route = c4_route if link_id == "c4-up" else e4_route
        candidate, offset, lateral = select_point(candidates, route, aliases)
        verified = facility_data.get(point_id, {"facilities": [], "brands": []})
        points.append({
            "id": point_id,
            "name": name,
            "kind": kind,
            "linkID": link_id,
            "offsetMeters": round(offset, 1),
            "coordinate": coordinate_json(candidate["coordinate"]),
            "facilities": verified["facilities"],
            "brands": verified["brands"],
        })
        diagnostics.append((link_id, offset, name, lateral, candidate["name"]))
    points.sort(key=lambda point: (0 if point["linkID"] == "c4-up" else 1, point["offsetMeters"]))
    output = {
        "version": 2,
        "sourceAttribution": "Road geometry and point coordinates © OpenStreetMap contributors, ODbL 1.0. SA/PA facilities verified from NEXCO official pages (2026-08-30).",
        "links": [
            {
                "id": "c4-up",
                "highwayName": "首都圏中央連絡自動車道",
                "directionName": "上り",
                "destinationName": "久喜方面",
                "lengthMeters": round(c4_length, 1),
                "standardSpeedKPH": 80,
                "polyline": [coordinate_json(point) for point in rdp(c4_route)],
                "nextLinkIDs": ["e4-down"],
            },
            {
                "id": "e4-down",
                "highwayName": "東北自動車道",
                "directionName": "下り",
                "destinationName": "宇都宮方面",
                "lengthMeters": round(e4_length, 1),
                "standardSpeedKPH": 100,
                "polyline": [coordinate_json(point) for point in rdp(e4_route)],
                "nextLinkIDs": [],
            },
        ],
        "points": points,
    }
    destination = ROOT / "HighwayAssist" / "Resources" / "real_highway.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"C4 {c4_length / 1000:.1f}km / {len(c4_route)} nodes -> {len(output['links'][0]['polyline'])} points")
    print(f"E4 {e4_length / 1000:.1f}km / {len(e4_route)} nodes -> {len(output['links'][1]['polyline'])} points")
    for diagnostic in diagnostics:
        print(f"{diagnostic[0]:7} {diagnostic[1]/1000:7.1f}km {diagnostic[2]:12} lateral={diagnostic[3]:5.0f}m source={diagnostic[4]}")


if __name__ == "__main__":
    build()
