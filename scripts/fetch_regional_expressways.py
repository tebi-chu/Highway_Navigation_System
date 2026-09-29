"""Fetch OSM geometry and named highway points for the five-road test region."""

import json
import time
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "data-osm-regional-expressways.json"

ROADS = [
    ("c4", "C4", "首都圏中央連絡自動車道|圏央道", "35.10,139.10,36.30,140.70"),
    ("e20", "E20", "中央自動車道|中央道", "35.10,136.70,36.30,139.80"),
    ("e17", "E17", "関越自動車道", "35.60,138.50,37.70,140.00"),
    ("e18", "E18", "上信越自動車道", "36.00,137.90,37.40,139.30"),
    ("e50", "E50", "北関東自動車道", "36.10,138.90,36.70,140.75"),
    ("e1-tomei", "E1", "東名高速道路|東名高速|東名", "34.65,136.75,35.85,139.80"),
    ("e1a-shintomei", "E1A", "新東名高速道路|新東名", "34.70,136.80,35.65,139.50"),
    ("e1a-isewangan", "E1A", "伊勢湾岸自動車道|伊勢湾岸道", "34.75,136.45,35.25,137.35"),
    ("e23-ise", "E23", "伊勢自動車道|伊勢道", "34.35,136.25,34.95,136.85"),
]


def fetch(ref, name_pattern, bounds):
    query = f'''[out:json][timeout:300];
    (
      way["highway"="motorway"]["ref"="{ref}"]({bounds});
      way["highway"="motorway"]["name"~"{name_pattern}"]({bounds});
      way["highway"="motorway_link"]({bounds});
      node["highway"="motorway_junction"]({bounds});
      nwr["highway"="services"]({bounds});
      nwr["highway"="rest_area"]({bounds});
      nwr["amenity"="parking"]["name"~"(SA|ＳＡ|PA|ＰＡ)"]({bounds});
    );
    out tags center geom;'''
    body = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for endpoint in (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter",
    ):
        request = urllib.request.Request(endpoint, data=body, headers={
            "User-Agent": "Highway-Navigation-System/1.0 route-data-builder"
        })
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                return json.loads(response.read())
        except (urllib.error.HTTPError, urllib.error.URLError) as error:
            last_error = error
    raise last_error


def main():
    # Reuse the already verified full E4 extract to keep Overpass requests small.
    elements = []
    for filename in ("data-osm-e4.json", "data-osm-e4-route.json", "data-osm-e4-gap.json"):
        elements.extend(json.loads((ROOT / filename).read_text(encoding="utf-8"))["elements"])
    for index, road in enumerate(ROADS):
        cache_key, ref, name_pattern, bounds = road
        cache = ROOT / f"data-osm-regional-{cache_key}.json"
        if cache.exists():
            payload = json.loads(cache.read_text(encoding="utf-8"))
        else:
            payload = fetch(ref, name_pattern, bounds)
            cache.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        elements.extend(payload["elements"])
        print(f"{cache_key}: {len(payload['elements']):,} elements")
        if index + 1 < len(ROADS):
            time.sleep(2)
    unique = {(item["type"], item["id"]): item for item in elements}
    DESTINATION.write_text(
        json.dumps({"version": 0.6, "elements": list(unique.values())}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Saved {len(unique):,} unique elements to {DESTINATION.name}")


if __name__ == "__main__":
    main()
