"""Compact the cached Overture extract (tools/overture_extract.py) into the
JavaScript data modules the app imports from src/data/geo/.

    python tools/build_geo.py

Coordinates are stored as integer micro-degrees relative to a per-file origin
and delta-encoded per ring or line ([x0, y0, dx1, dy1, ...]); decode them with
src/data/geo/codec.js. Geometry is real open data. Heights missing from the
source are estimated and flagged.
"""

import hashlib
import json
import math
import os
import re
import sys

import shapely
import shapely.affinity
from shapely.geometry import LineString, MultiLineString, Point, Polygon, shape
from shapely.ops import linemerge

HERE = os.path.dirname(__file__)
CACHE = os.path.join(HERE, "..", ".cache", "overture")
OUT = os.path.join(HERE, "..", "src", "data", "geo")
SCALE = 1_000_000
KX = 111320 * math.cos(math.radians(25.2))
# Catchment radius (m) of each plot area, matching catchmentRadiusM in plots.js.
CATCHMENT = {"warqaa": 2500, "jaddaf": 2000}
# Full-resolution community geometry by id, filled by build_region().
COMMUNITY_GEOMS = {}


def load(name):
    with open(os.path.join(CACHE, f"{name}.json"), encoding="utf-8") as fh:
        return json.load(fh)


def area_m2(g):
    return g.area * KX * 111320


def seeded(*parts):
    h = hashlib.sha1("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:4], "big") / 2**32


def is_arabic(s):
    return bool(s) and bool(re.search(r"[؀-ۿ]", s))


# English names for Arabic-only road names in the extract.
ROAD_EN = {
    "شارع الرباط": "Al Rebat Street",
    "شارع الروية": "Al Ruwayyah Street",
    "دوار السطوه": "Satwa Roundabout",
    "معبر الخليج التجاري": "Business Bay Crossing",
    "شارع ند الشبا": "Nad Al Sheba Street",
    "جسر إنفينيتي": "Infinity Bridge",
    "جسر القرهود": "Al Garhoud Bridge",
    "طريق الشيخ راشد": "Sheikh Rashid Road",
    "شارع الشيخ راشد": "Sheikh Rashid Road",
    "الجسر العائم": "Floating Bridge",
    "جسر آل مكتوم": "Al Maktoum Bridge",
    "شارع الورقاء 1": "Al Warqa'a 1 Street",
    "شارع عود ميثاء": "Oud Metha Road",
    "شارع ند الحمر": "Nad Al Hamar Road",
    "نفق المطار": "Airport Tunnel",
    "طريق دبي - العين": "Dubai–Al Ain Road",
    "نفق الشندغة": "Al Shindagha Tunnel",
    "شارع الشيخ زايد": "Sheikh Zayed Road",
    "شارع قصر زعبيل": "Za'abeel Palace Street",
    "طريق الاتحاد": "Al Ittihad Road",
    "طريق الخيل": "Al Khail Road",
    "شارع رأس الخور": "Ras Al Khor Road",
    "طريق الخوانيج": "Al Khawaneej Road",
    "شارع طرابلس": "Tripoli Street",
    "شارع الجداف": "Al Jadaf Street",
    "شارع الأصايل": "Al Asayel Street",
    "شارع المنامة": "Al Manama Street",
    "شارع الصفا": "Al Safa Street",
    "شارع المركز المالي": "Financial Centre Street",
    "شارع المجلس": "Al Majlis Street",
    "شارع مركز التجارة": "Trade Centre Street",
    "طريق أبو بكر الصديق": "Abu Baker Al Siddique Road",
    "شارع مراكش": "Marrakech Street",
    "شارع نواكشوط": "Nouakchott Street",
}


def label(r):
    """English display name (falls back to the primary name) and Arabic name."""
    en = r.get("en") or (r.get("name") if not is_arabic(r.get("name")) else None)
    ar = r.get("ar") or (r.get("name") if is_arabic(r.get("name")) else None)
    if not en and ar:
        m = re.fullmatch(r"شارع\s*(\d+\w?)|(\d+\w?)\s*شارع", ar)
        en = ROAD_EN.get(ar) or (f"{m.group(1) or m.group(2)} Street" if m else None)
    return en or ar, ar


class Codec:
    def __init__(self, origin):
        self.ox, self.oy = origin

    def line(self, coords):
        out, px, py = [], None, None
        for x, y in coords:
            ix, iy = round((x - self.ox) * SCALE), round((y - self.oy) * SCALE)
            if px is None:
                out += [ix, iy]
            elif ix != px or iy != py:
                out += [ix - px, iy - py]
            px, py = ix, iy
        return out

    def ring(self, ring):
        coords = list(ring.coords)
        return self.line(coords[:-1] if coords[0] == coords[-1] else coords)

    def polygons(self, g):
        polys = [g] if g.geom_type == "Polygon" else [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]
        return [[self.ring(p.exterior), *[self.ring(i) for i in p.interiors]] for p in polys if not p.is_empty]

    def lines(self, g):
        if g.is_empty:
            return []
        if g.geom_type == "LineString":
            return [self.line(g.coords)]
        return [self.line(x.coords) for x in getattr(g, "geoms", []) if x.geom_type == "LineString" and len(x.coords) > 1]

    def point(self, xy):
        return [round((xy[0] - self.ox) * SCALE), round((xy[1] - self.oy) * SCALE)]


def merge_lines(features, key, tol, clip=None):
    groups = {}
    for f in features:
        g = shape(f["geometry"])
        if clip is not None:
            g = g.intersection(clip)
        if g.is_empty:
            continue
        parts = [g] if g.geom_type == "LineString" else [p for p in getattr(g, "geoms", []) if p.geom_type == "LineString"]
        groups.setdefault(key(f), (f, []))[1].extend(parts)
    out = []
    for k, (f, parts) in groups.items():
        merged = linemerge(MultiLineString(parts)) if len(parts) > 1 else parts[0]
        out.append((f, merged.simplify(tol)))
    return out


# ---------------------------------------------------------------------------
# Dubai Metro stations: English name, line and status. Blue Line stations are
# under construction (RTA target opening 2029).

STATIONS = {
    "الاتحاد": ("Union", "red"),
    "بني ياس": ("Baniyas Square", "green"),
    "عود ميثاء": ("Oud Metha", "green"),
    "برجمان": ("BurJuman", "red"),
    "بنك أبو ظبي التجاري": ("ADCB", "red"),
    "شرف دي جي": ("Sharaf DG", "green"),
    "سوق الذهب": ("Gold Souq", "green"),
    "الرأس": ("Al Ras", "green"),
    "الغبيبة": ("Al Ghubaiba", "green"),
    "ماكس": ("max", "red"),
    "المركز التجاري العالمي": ("World Trade Centre", "red"),
    "المركز المالي": ("Financial Centre", "red"),
    "أبراج الإمارات": ("Emirates Towers", "red"),
    "سنتربوينت": ("Centrepoint", "red"),
    "سيتي سنتر مردف": ("City Centre Mirdif", "blue"),
    "الورقاء": ("Al Warqa'a", "blue"),
    "مدينة العالمية 2": ("International City 2", "blue"),
    "مدينة العالمية 1": ("International City 1", "blue"),
    "سوق التنبن": ("Dragon Mart", "blue"),
    "سوق السيارات": ("Ras Al Khor Auto Market", "blue"),
    "إعمار العقارية": ("Dubai Creek Harbour", "blue"),
    "دبي فيستيفال سيتي": ("Dubai Festival City", "blue"),
    "طيران الإمارات": ("Emirates", "red"),
    "الخور": ("Creek", "green"),
    "الجداف": ("Al Jadaf", "green"),
    "مدينة دبي الطبية": ("Dubai Healthcare City", "green"),
    "ديرة سيتي سنتر": ("Deira City Centre", "red"),
    "القرهود": ("Al Garhoud", "red"),
    "الرقة": ("Al Rigga", "red"),
    "صلاح الدين": ("Salah Al Din", "green"),
    "أبو بكر الصديق": ("Abu Baker Al Siddique", "green"),
    "أبو هيل": ("Abu Hail", "green"),
    "القيادة": ("Al Qiyadah", "green"),
    "الاستاد": ("Stadium", "green"),
    "النهدة": ("Al Nahda", "green"),
    "المنطقة الحرة بمطار دبي": ("Dubai Airport Free Zone", "green"),
    "المطار - مبنى رقم 1": ("Airport Terminal 1", "red"),
    "المطار - مبنى رقم 3": ("Airport Terminal 3", "red"),
    "القصيص": ("Al Qusais", "green"),
    "اي اند": ("e&", "green"),
}
LINE_NAMES = {"Red Line Metro": "red", "Green Line Metro": "green", "Blue Line Metro": "blue"}


def build_region():
    R = load("region")
    bbox = R["bbox"]
    box = shapely.box(*bbox)
    # Clip to a wider frame so cut edges never show inside the map's working area.
    frame = shapely.box(bbox[0] - 0.06, bbox[1] - 0.05, bbox[2] + 0.06, bbox[3] + 0.05)
    c = Codec(bbox[:2])

    # Communities: drop parent macrohoods whose area is mostly covered by
    # their own sub-communities, so outlines and labels do not stack.
    raw = []
    for r in R["communities"]:
        g = shape(r["geometry"]).buffer(0)
        name, ar = label(r)
        if not g.is_empty and name:
            raw.append((r, g, name, ar))
    macro = [x for x in raw if x[0]["subtype"] == "macrohood"]
    keep = []
    for r, g, name, ar in raw:
        if r["subtype"] == "macrohood":
            others = [h for (rr, h, n, _) in macro if n != name and h.area < g.area * 0.8 and g.intersection(h).area > h.area * 0.8]
            covered = shapely.union_all(others).intersection(g).area if others else 0
            if covered > g.area * 0.6:
                continue
        keep.append((r, g, name, ar))
    communities, seen = [], {}
    for r, g, name, ar in sorted(keep, key=lambda x: (x[0]["subtype"] != "macrohood", x[2])):
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        seen[slug] = seen.get(slug, 0) + 1
        if seen[slug] > 1:
            slug = f"{slug}-{seen[slug]}"
        full = g
        COMMUNITY_GEOMS[slug] = (full, r["subtype"], name)
        g = g.simplify(0.00004)
        if g.is_empty:
            continue
        lp = full.representative_point() if box.contains(full.representative_point()) else g.representative_point()
        communities.append({"id": slug, "name": name, "ar": ar, "sub": "m" if r["subtype"] == "macrohood" else "n", "km2": round(area_m2(full) / 1e6, 2), "lp": c.point((lp.x, lp.y)), "g": c.polygons(g)})

    water = []
    for r in R["water"]:
        g = shape(r["geometry"]).buffer(0).intersection(frame).simplify(0.00003)
        if area_m2(g) >= 4000:
            water.append({"name": label(r)[0], "g": c.polygons(g)})

    roads = []
    for f, g in merge_lines(R["roads"], lambda f: (f["class"], label(f)[0]), 0.00003):
        name, ar = label(f)
        roads.append({"cls": f["class"], "name": name, "ar": ar, "g": c.lines(g)})

    named = [(LINE_NAMES[r["en"] or r["name"]], shape(r["geometry"])) for r in R["rail"] if (r["en"] or r["name"]) in LINE_NAMES]
    rail = []
    for r in R["rail"]:
        nm = r["en"] or r["name"]
        if nm in LINE_NAMES:
            line = LINE_NAMES[nm]
        elif r["class"] == "subway" and nm is None:
            g = shape(r["geometry"])
            d, line = min((g.distance(ng), ln) for ln, ng in named)
            if d > 0.004:
                continue
        else:
            continue
        rail.append({"line": line, "status": "construction" if line == "blue" else "operational", "g": c.lines(shape(r["geometry"]).intersection(frame).simplify(0.00002))})

    stations, placed = [], []
    for s in R["stations"]:
        entry = STATIONS.get(s["name"] or "")
        if not entry:
            continue
        name, line = entry
        if any(n == name and math.dist(p, s["coord"]) < 0.002 for n, p in placed):
            continue
        placed.append((name, s["coord"]))
        stations.append({"name": name, "ar": s["name"], "line": line, "status": "construction" if line == "blue" else "operational", "c": c.point(s["coord"])})

    airport = []
    for r in R["airport"]:
        g = shape(r["geometry"])
        if r["class"] in ("runway", "apron"):
            if g.geom_type in ("Polygon", "MultiPolygon"):
                airport.append({"cls": r["class"], "g": c.polygons(g.simplify(0.00002))})
            elif r["class"] == "runway":
                airport.append({"cls": "runway-line", "g": c.lines(g)})

    return {"release": R["release"], "origin": bbox[:2], "bbox": bbox, "communities": communities, "water": water, "roads": roads, "rail": rail, "stations": stations, "airport": airport}


# ---------------------------------------------------------------------------
# Plot areas

LANDUSE = [
    (("construction", None), "vacant"),
    (("residential", None), "residential"),
    (("developed", "commercial"), "commercial"),
    (("developed", "retail"), "commercial"),
    (("developed", "industrial"), "industrial"),
    (("education", None), "education"),
    (("medical", None), "medical"),
    (("religious", None), "religious"),
    (("cemetery", None), "cemetery"),
    (("golf", "golf_course"), "golf"),
    (("park", None), "park"),
    (("recreation", "beach_resort"), "leisure"),
    (("recreation", "resort"), "leisure"),
    (("recreation", "marina"), "leisure"),
    (("recreation", "stadium"), "sport"),
    (("recreation", "pitch"), "sport"),
    (("recreation", "track"), "sport"),
    (("recreation", None), "park"),
    (("entertainment", None), "leisure"),
    (("horticulture", None), "green"),
    (("managed", "grass"), "green"),
    (("agriculture", None), "green"),
    (("pedestrian", "plaza"), "plaza"),
]


def landuse_class(sub, cls):
    for (s, k), out in LANDUSE:
        if s == sub and (k is None or k == cls):
            return out
    return None


# Overture place category -> app category (POI_CATEGORIES in context.js).
PLACE_MAP = {
    "grocery_store": "supermarket",
    "supermarket": "supermarket",
    "hypermarket": "supermarket",
    "organic_grocery_store": "supermarket",
    "public_market": "supermarket",
    "convenience_store": "convenience",
    "shopping_mall": "retail",
    "shopping_center": "retail",
    "hotel": "hotel",
    "resort": "hotel",
    "service_apartment": "serviced-apartments",
    "corporate_or_business_office": "office",
    "coworking_space": "office",
    "school": "school",
    "private_school": "school",
    "public_school": "school",
    "high_school": "school",
    "middle_school": "school",
    "elementary_school": "school",
    "preschool": "nursery",
    "day_care_preschool": "nursery",
    "hospital": "clinic",
    "outpatient_care_facility": "clinic",
    "doctors_office": "clinic",
    "pediatric_clinic": "clinic",
    "public_health_clinic": "clinic",
    "health_care": "clinic",
    "emergency_department": "clinic",
    "pharmacy": "pharmacy",
    "gym": "sports",
    "sports_and_recreation": "sports",
    "sport_or_fitness_facility": "sports",
    "swimming_pool": "sports",
    "martial_arts_club": "sports",
    "gymnastics_center": "sports",
    "park": "park",
    "playground": "park",
    "muslim_place_of_worship": "mosque",
    "museum": "attraction",
    "contemporary_art_museum": "attraction",
    "textile_museum": "attraction",
    "art_gallery": "attraction",
    "amusement_park": "attraction",
    "water_park": "attraction",
    "gas_station": "fuel",
    "fueling_station": "fuel",
    "bus_station": "bus",
}
FNB_LEVEL2 = ("restaurant", "casual_eatery", "non_alcoholic_beverage_venue")
SERVICED = re.compile(r"apartment|residence|citadines|suites|staybridge|aparthotel", re.I)
# Places that name one building several times (offices, schools) are merged.
CLUSTER_M = {"office": 45, "school": 90, "clinic": 25, "hotel": 30, "serviced-apartments": 30, "retail": 60}


# Open place data is noisy: names that show a place is mis-categorised.
NOT_A = {
    "retail": re.compile(r"store|shop\b|pop ?up|pub\b|restaurant|cafe|iqos|^dubai( uae)?$", re.I),
    "school": re.compile(r"learning|education|eduscope|tutor|coaching|clinic|building|centre for|center for|training", re.I),
    "clinic": re.compile(r"metro station|club|hostel|نادي|بلدية|biobank|diagnostic|institute|pharma|supply", re.I),
}
MALL_WORD = re.compile(r"mall|centre|center|souq|souk|market|plaza|avenue|walk|arcade|أسواق|مول|سوق|مركز", re.I)


def place_category(p):
    raw = p["category"]
    cat = PLACE_MAP.get(raw)
    name = p.get("name") or ""
    if cat in NOT_A and NOT_A[cat].search(name):
        return None
    if cat == "retail" and not MALL_WORD.search(name):
        return None
    if cat != "metro" and re.search(r"metro station", name, re.I):
        return None
    h = p.get("hierarchy") or []
    if cat is None and len(h) > 1 and h[0] == "food_and_drink" and h[1] in FNB_LEVEL2:
        cat = "fnb"
    if cat in ("hotel", None) and raw in ("hotel", "resort", "lodging") and SERVICED.search(p.get("name") or ""):
        cat = "serviced-apartments"
    return cat


def building_height(b, region_key, poly):
    if b["h"]:
        return b["h"], 0
    if b["floors"]:
        return round(b["floors"] * 3.4, 1), 1
    a = area_m2(poly)
    cls = b.get("class") or ""
    r = seeded(region_key, round(poly.centroid.x, 6), round(poly.centroid.y, 6))
    if cls in ("carport", "roof", "shelter") or b.get("subtype") == "outbuilding" or a < 60:
        return 3.5, 1
    if region_key == "warqaa":
        if cls in ("house", "detached", "residential") or a < 700:
            return 7.5 + round(r * 3, 1), 1
        return 12 + round(r * 6, 1), 1
    if a < 300:
        return 7 + round(r * 4, 1), 1
    if a < 1200:
        return 16 + round(r * 20, 1), 1
    return 28 + round(r * 50, 1), 1


def build_area(key):
    A = load(key)
    R = load("region")
    bbox = A["bbox"]
    box = shapely.box(*bbox)
    c = Codec(bbox[:2])
    center = Point(A["center"])

    parcel = next(shape(l["geometry"]) for l in A["landuse"] if l["subtype"] == "construction" and shape(l["geometry"]).contains(center))

    minor = [r for r in A["roads"] if r["class"] in ("tertiary", "residential", "unclassified", "living_street", "service")]
    roads = []
    for f, g in merge_lines(minor, lambda f: (f["class"], label(f)[0]), 0.00001, clip=box):
        name, ar = label(f)
        roads.append({"cls": f["class"], "name": name, "ar": ar, "g": c.lines(g)})

    landuse = []
    for l in A["landuse"]:
        cat = landuse_class(l["subtype"], l["class"])
        g = shape(l["geometry"]).buffer(0)
        if not cat or g.equals(parcel) or g.area > box.area * 1.5:
            continue
        # Keep real outlines; only very large areas are cut to a wide frame.
        if area_m2(g) > 5e6:
            g = g.intersection(box.buffer(0.02))
        if area_m2(g) < 250:
            continue
        name, _ = label(l)
        item = {"cls": cat, "g": c.polygons(g.simplify(0.000006))}
        if name and cat not in ("residential",):
            item["name"] = name
        landuse.append(item)

    buildings = []
    for b in A["buildings"]:
        g = shape(b["geometry"]).simplify(0.000003)
        if g.is_empty or g.intersects(parcel):
            continue
        h, est = building_height(b, key, g)
        buildings.append([round(h), est, *c.ring(g.exterior)])

    places = []
    for p in A["places"]:
        cat = place_category(p)
        if not cat:
            continue
        name, ar = label(p)
        radius = CLUSTER_M.get(cat, 12)
        dup = next((q for q in places if q["cat"] == cat and math.dist(q["xy"], p["coord"]) * 105000 < radius), None)
        if dup:
            dup["n"] += 1
            continue
        places.append({"cat": cat, "raw": p["category"], "name": name, "ar": ar if ar != name else None, "xy": p["coord"], "n": 1})
    places_out = [[q["cat"], q["raw"], q["name"], q["ar"], *c.point(q["xy"]), q["n"]] for q in places]

    bus = [c.point(shape(i["geometry"]).centroid.coords[0]) for i in A["infrastructure"] if i["class"] == "bus_stop"]
    power = [{"cls": i["class"], "g": c.lines(shape(i["geometry"]).simplify(0.00001))} for i in A["infrastructure"] if i["class"] in ("power_line", "minor_line", "cable")]
    substations = [[label(i)[0], *c.point(shape(i["geometry"]).centroid.coords[0])] for i in A["infrastructure"] if i["class"] == "substation"]

    # Communities overlapping the catchment: share of each community's area
    # inside it and the distance to the centroid of that inside part.
    radius = CATCHMENT[key] / 111320
    circle = shapely.affinity.scale(center.buffer(radius, 64), xfact=111320 / KX, yfact=1)
    catchment = []
    for cid, (g, sub, name) in COMMUNITY_GEOMS.items():
        if sub != "macrohood" or not g.intersects(circle):
            continue
        inside = g.intersection(circle)
        share = inside.area / g.area
        if share < 0.02 and not g.contains(center):
            continue
        cc = inside.centroid
        catchment.append([cid, round(share, 3), round(math.hypot((cc.x - center.x) * KX, (cc.y - center.y) * 111320))])
    catchment.sort(key=lambda x: x[2])

    return {
        "release": A["release"],
        "origin": bbox[:2],
        "catchment": catchment,
        "bbox": bbox,
        "center": A["center"],
        "parcel": c.ring(parcel.exterior),
        "parcelAreaM2": round(area_m2(parcel)),
        "roads": roads,
        "landuse": landuse,
        "buildings": buildings,
        "places": places_out,
        "busStops": bus,
        "power": power,
        "substations": substations,
    }


def write(name, data, comment):
    path = os.path.join(OUT, f"{name}.js")
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"// Generated by tools/build_geo.py from Overture Maps release {data['release']} — do not edit.\n// {comment}\n// © OpenStreetMap contributors (ODbL) · © Overture Maps Foundation (CDLA Permissive 2.0). See ATTRIBUTION.md.\nexport default {body};\n")
    print(path, os.path.getsize(path) // 1024, "KB", {k: len(v) for k, v in data.items() if isinstance(v, list)}, file=sys.stderr)


def main():
    os.makedirs(OUT, exist_ok=True)
    region = build_region()
    write("region", region, "Central-east Dubai: communities, water, major roads, Dubai Metro lines and stations, airport.")
    write("warqaa", build_area("warqaa"), "Al Warqa'a plot area: minor roads, land use, buildings, places, bus stops, power network.")
    write("jaddaf", build_area("jaddaf"), "Al Jaddaf plot area: minor roads, land use, buildings, places, bus stops, power network.")
    with open(os.path.join(OUT, "ATTRIBUTION.md"), "w", encoding="utf-8") as fh:
        fh.write(
            f"# Map data attribution\n\n"
            f"The map data in this folder was extracted from [Overture Maps](https://overturemaps.org) release `{region['release']}` "
            "by `tools/overture_extract.py` and compacted by `tools/build_geo.py`.\n\n"
            "- © OpenStreetMap contributors, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).\n"
            "- © Overture Maps Foundation and contributors. Overture data is available under CDLA Permissive 2.0 where applicable; "
            "individual source licences are listed at <https://docs.overturemaps.org/attribution/>.\n\n"
            "## What is real and what is representative\n\n"
            "- **Real open data:** community boundaries, water, roads, Dubai Metro lines and stations (the Blue Line is under construction), "
            "airport runways, land use, building footprints, named places, bus stops and the power network.\n"
            "- **Estimated:** building heights that the source does not record (flagged in the data).\n"
            "- **Representative:** the two prototype plots are drawn on real vacant parcels from open land-use data, but their plot numbers, "
            "planning controls and affection-plan details are simulated. Official DM cadastral plot boundaries are not open data.\n"
            "- **Simulated:** demographics, facility capacities, market benchmarks, DLD transactions and comparable-plot records.\n"
        )


if __name__ == "__main__":
    main()
