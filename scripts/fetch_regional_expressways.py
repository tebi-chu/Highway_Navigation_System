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
    ("C4", "首都圏中央連絡自動車道|圏央道", "35.10,139.10,36.30,140.70"),
    ("E20", "中央自動車道|中央道", "35.10,136.70,36.30,139.80"),
    ("E17", "関越自動車道", "35.60,138.50,37.70,140.00"),
    ("E18", "上信越自動車道", "36.00,137.90,37.40,139.30"),
    ("E50", "北関東自動車道", "36.10,138.90,36.70,140.75"),
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
        cache = ROOT / f"data-osm-regional-{road[0].lower()}.json"
        if cache.exists():
            payload = json.loads(cache.read_text(encoding="utf-8"))
        else:
            payload = fetch(*road)
            cache.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        elements.extend(payload["elements"])
        print(f"{road[0]}: {len(payload['elements']):,} elements")
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
