"""Download OSM motorway-link geometry near the currently shipped test route."""

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTE = ROOT / "web" / "data" / "ebina-aomori.json"
DESTINATION = ROOT / "data-osm-ramps.json"


def main():
    data = json.loads(ROUTE.read_text(encoding="utf-8"))
    links = {item["id"]: item for item in data["links"]}
    coordinates = []
    for link_id in ("c4-north", "e4-north", "e4a-east"):
        line = links[link_id]["polyline"]
        coordinates.extend(line[::8])
        coordinates.append(line[-1])
    path = ",".join(f'{item["latitude"]},{item["longitude"]}' for item in coordinates)
    query = f'[out:json][timeout:180];way["highway"="motorway_link"](around:1800,{path});out geom;'
    request = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "Highway-Navigation-System route-data builder"},
    )
    with urllib.request.urlopen(request, timeout=240) as response:
        payload = response.read()
    json.loads(payload)
    DESTINATION.write_bytes(payload)
    print(f"Saved {len(payload):,} bytes to {DESTINATION.name}")


if __name__ == "__main__":
    main()
