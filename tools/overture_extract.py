"""Extract real Dubai map data from Overture Maps (https://overturemaps.org)
for the prototype: community boundaries, water, roads, rail and metro
stations, land use, buildings, places, bus stops and power lines.

    pip install pyarrow shapely
    python tools/overture_extract.py        # writes .cache/overture/*.json
    python tools/build_geo.py               # compacts them into src/data/geo/

The raw extract is cached outside the source tree; only the compact modules
written by build_geo.py are committed. Overture data is © OpenStreetMap
contributors (ODbL) and Overture Maps Foundation contributors (CDLA
Permissive 2.0) — see src/data/geo/ATTRIBUTION.md.
"""

import json
import math
import os
import sys

import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs
import shapely
from shapely.geometry import mapping

RELEASE = os.environ.get("OVERTURE_RELEASE", "2026-09-23.0")
ROOT = f"overturemaps-us-west-2/release/{RELEASE}/"
OUT = os.path.join(os.path.dirname(__file__), "..", ".cache", "overture")

# City-scale overview, and a detailed area around each prototype plot site
# (centre, context radius and building radius in metres).
REGION = (55.27, 25.13, 55.50, 25.285)
AREAS = {
    "warqaa": {"center": (55.40105, 25.18861), "radius": 3200, "buildings": 1300},
    "jaddaf": {"center": (55.33853, 25.22972), "radius": 2800, "buildings": 1300},
}

fs = pafs.S3FileSystem(anonymous=True, region="us-west-2")


def box_around(center, radius_m):
    dlon = radius_m / (111320 * math.cos(math.radians(center[1])))
    dlat = radius_m / 111320
    return (center[0] - dlon, center[1] - dlat, center[0] + dlon, center[1] + dlat)


def query(path, bb, cols, extra=None):
    d = ds.dataset(ROOT + path, filesystem=fs, format="parquet")
    f = (pc.field("bbox", "xmax") > bb[0]) & (pc.field("bbox", "xmin") < bb[2]) & (pc.field("bbox", "ymax") > bb[1]) & (pc.field("bbox", "ymin") < bb[3])
    if extra is not None:
        f = f & extra
    return d.to_table(columns=cols, filter=f).to_pylist()


def rnd(geom, digits=6):
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], digits), round(c[1], digits)]
        return [r(x) for x in c]

    m = mapping(geom)
    return {"type": m["type"], "coordinates": r(m["coordinates"])}


def names(r):
    n = r.get("names") or {}
    common = dict(n.get("common") or [])
    return {"name": n.get("primary"), "en": common.get("en"), "ar": common.get("ar")}


def extract_region():
    print("region: divisions, water, major roads, rail, stations", file=sys.stderr)
    box = shapely.box(*REGION)
    communities = []
    for r in query("theme=divisions/type=division_area/", REGION, ["names", "subtype", "class", "geometry"]):
        if r["subtype"] not in ("macrohood", "neighborhood") or r["class"] != "land":
            continue
        g = shapely.from_wkb(r["geometry"])
        if g.intersects(box):
            communities.append({"subtype": r["subtype"], **names(r), "geometry": rnd(g)})
    water = []
    for r in query("theme=base/type=water/", REGION, ["names", "subtype", "class", "geometry"]):
        g = shapely.from_wkb(r["geometry"])
        if g.geom_type in ("Polygon", "MultiPolygon") and g.area >= 2e-7 and g.intersects(box):
            water.append({"class": r["class"], **names(r), "geometry": rnd(g)})
    roads = []
    for r in query("theme=transportation/type=segment/", REGION, ["names", "subtype", "class", "geometry"], pc.field("subtype") == "road"):
        if r["class"] in ("motorway", "trunk", "primary", "secondary"):
            roads.append({"class": r["class"], **names(r), "geometry": rnd(shapely.from_wkb(r["geometry"]))})
    rail = []
    for r in query("theme=transportation/type=segment/", REGION, ["names", "subtype", "class", "geometry"], pc.field("subtype") == "rail"):
        rail.append({"class": r["class"], **names(r), "geometry": rnd(shapely.from_wkb(r["geometry"]))})
    stations = []
    for r in query("theme=base/type=infrastructure/", REGION, ["names", "subtype", "class", "geometry"], pc.field("subtype") == "transit"):
        if r["class"] in ("subway_station", "railway_station", "light_rail_station", "monorail_station"):
            c = shapely.from_wkb(r["geometry"]).centroid
            stations.append({"class": r["class"], **names(r), "coord": [round(c.x, 6), round(c.y, 6)]})
    airport = []
    for r in query("theme=base/type=infrastructure/", REGION, ["names", "subtype", "class", "geometry"], pc.field("subtype") == "airport"):
        if r["class"] in ("runway", "taxiway", "apron"):
            airport.append({"class": r["class"], "geometry": rnd(shapely.from_wkb(r["geometry"]))})
    return {"bbox": REGION, "communities": communities, "water": water, "roads": roads, "rail": rail, "stations": stations, "airport": airport}


def extract_area(key, cfg):
    bb = box_around(cfg["center"], cfg["radius"])
    print(f"{key}: roads, land use, places, infrastructure, buildings", file=sys.stderr)
    roads = []
    keep = ("motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "service")
    for r in query("theme=transportation/type=segment/", bb, ["names", "subtype", "class", "geometry"], pc.field("subtype") == "road"):
        if r["class"] in keep:
            roads.append({"class": r["class"], **names(r), "geometry": rnd(shapely.from_wkb(r["geometry"]))})
    landuse = []
    for r in query("theme=base/type=land_use/", bb, ["names", "subtype", "class", "geometry"]):
        g = shapely.from_wkb(r["geometry"])
        if g.geom_type in ("Polygon", "MultiPolygon") and g.intersects(shapely.box(*bb)):
            landuse.append({"subtype": r["subtype"], "class": r["class"], **names(r), "geometry": rnd(g)})
    places = []
    for r in query("theme=places/type=place/", bb, ["names", "basic_category", "taxonomy", "confidence", "operating_status", "geometry"]):
        tax = r.get("taxonomy") or {}
        cat = tax.get("primary") or r.get("basic_category")
        if not cat or (r.get("confidence") or 0) < 0.5 or r.get("operating_status") not in (None, "open"):
            continue
        p = shapely.from_wkb(r["geometry"])
        places.append({"category": cat, "basic": r.get("basic_category"), "hierarchy": tax.get("hierarchy") or [], **names(r), "confidence": round(r["confidence"], 2), "coord": [round(p.x, 6), round(p.y, 6)]})
    infrastructure = []
    for r in query("theme=base/type=infrastructure/", bb, ["names", "subtype", "class", "geometry"]):
        if r["class"] in ("bus_stop", "bus_station", "power_line", "minor_line", "cable", "substation"):
            infrastructure.append({"subtype": r["subtype"], "class": r["class"], **names(r), "geometry": rnd(shapely.from_wkb(r["geometry"]))})
    buildings = []
    for r in query("theme=buildings/type=building/", box_around(cfg["center"], cfg["buildings"]), ["height", "num_floors", "class", "subtype", "names", "geometry"]):
        g = shapely.from_wkb(r["geometry"])
        if g.geom_type == "Polygon":
            buildings.append({"h": round(r["height"], 1) if r.get("height") else None, "floors": r.get("num_floors"), "class": r.get("class"), "subtype": r.get("subtype"), **names(r), "geometry": rnd(g)})
    return {"center": cfg["center"], "bbox": bb, "roads": roads, "landuse": landuse, "places": places, "infrastructure": infrastructure, "buildings": buildings}


def main():
    os.makedirs(OUT, exist_ok=True)
    out = {"region": extract_region(), **{k: extract_area(k, cfg) for k, cfg in AREAS.items()}}
    for k, data in out.items():
        data["release"] = RELEASE
        path = os.path.join(OUT, f"{k}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        print(path, os.path.getsize(path) // 1024, "KB", {kk: len(v) for kk, v in data.items() if isinstance(v, list)}, file=sys.stderr)


if __name__ == "__main__":
    main()
