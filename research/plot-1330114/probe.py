#!/usr/bin/env python3
"""Ask the public Dubai government services what they hold on one plot.

Run it from a network that can reach the Dubai hosts. A GitHub-hosted runner
reaches some of them; many sandboxes reach none. Every request and its outcome
goes to OUT/log.jsonl, so the report can cite exactly what each source said and
which sources refused to answer.

    PLOT_ID=1330114 AREA_NAME="Hor Al Anz East" python3 probe.py OUT_DIR
"""

import csv
import io
import json
import os
import re
import sys
import time
from datetime import date
from html import escape
from urllib.parse import urljoin

import requests

PLOT = os.environ.get("PLOT_ID", "1330114").strip()
COMMUNITY_NO, PARCEL_NO = PLOT[:3], PLOT[3:]
PLOT_DASHED = f"{COMMUNITY_NO}-{PARCEL_NO}"
AREA_NAME = os.environ.get("AREA_NAME", "Hor Al Anz East").strip()
PLOT_KEYS = {PLOT, PLOT_DASHED, f"{COMMUNITY_NO}/{PARCEL_NO}"}

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "out")
os.makedirs(OUT, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
S = requests.Session()
S.headers["User-Agent"] = UA
LOG = open(os.path.join(OUT, "log.jsonl"), "w", encoding="utf-8")
STARTED = time.time()


def log(**kw):
    kw["t"] = round(time.time() - STARTED, 1)
    line = json.dumps(kw, ensure_ascii=False)
    LOG.write(line + "\n")
    LOG.flush()
    print(line[:500], flush=True)


def save(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        if isinstance(data, (dict, list)):
            json.dump(data, f, ensure_ascii=False, indent=1)
        else:
            f.write(data)


def fetch(method, url, **kw):
    # Geo-fenced Dubai hosts drop packets rather than refuse, so keep the
    # connect timeout short and let only the read wait.
    kw.setdefault("timeout", 30)
    if isinstance(kw["timeout"], (int, float)):
        kw["timeout"] = (10, kw["timeout"])
    try:
        r = S.request(method, url, **kw)
        log(
            src="http",
            method=method,
            url=url,
            status=r.status_code,
            ctype=r.headers.get("content-type"),
            bytes=None if kw.get("stream") else len(r.content),
        )
        return r
    except Exception as e:  # network refusals are findings, not failures
        log(src="http", method=method, url=url, error=f"{type(e).__name__}: {e}"[:400])
        return None


def matches_plot(value):
    text = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    return any(k in text for k in PLOT_KEYS)


# ── 1. Reachability ──────────────────────────────────────────────────────────

REACH = [
    "https://gateway.dubailand.gov.ae/open-data",
    "https://dubailand.gov.ae/en/open-data/real-estate-data/",
    "https://www.dubaipulse.gov.ae/",
    "https://data.dubai/",
    "https://www.dsc.gov.ae/",
    "https://www.dm.gov.ae/",
    "https://gis.dm.gov.ae/",
    "https://geodubai.dm.gov.ae/",
    "https://www.makani.ae/",
    "https://www.makani.ae/MakaniPublicDataService/MakaniPublic.svc",
    "https://nominatim.openstreetmap.org/status",
    "https://overpass-api.de/api/status",
]


def reachability():
    out = []
    for url in REACH:
        r = fetch("GET", url, timeout=25)
        row = {"url": url}
        if r is None:
            row["reachable"] = False
        else:
            row.update(
                reachable=True,
                status=r.status_code,
                ctype=r.headers.get("content-type"),
                final_url=r.url,
                head=r.text[:600],
            )
            slug = re.sub(r"[^a-z0-9]+", "_", url.lower()).strip("_")[:60]
            if "html" in (r.headers.get("content-type") or ""):
                save(f"page_{slug}.html", r.text)
        out.append(row)
    save("reachability.json", out)


# ── 2. Dubai Land Department open-data gateway ───────────────────────────────

GW = "https://gateway.dubailand.gov.ae/open-data/"
GW_HDR = {
    "Content-Type": "application/json",
    "Accept": "application/json, */*",
    "Origin": "https://dubailand.gov.ae",
    "Referer": "https://dubailand.gov.ae/en/open-data/real-estate-data/",
}
# The identifier the DLD open-data page itself sends; tried only when a plain
# request is refused.
GW_CONSUMER = "gkb3WvEG0rY9eilwXC0P2pTz8UzvLj9F"


def gw(cmd, payload):
    for hdr in (GW_HDR, {**GW_HDR, "consumer-id": GW_CONSUMER}):
        r = fetch("POST", GW + cmd, json=payload, headers=hdr, timeout=90)
        if r is None:
            continue
        try:
            d = r.json()
        except ValueError:
            log(src="gw", cmd=cmd, note="non-json", body=r.text[:300])
            continue
        res = (d.get("response") or {}).get("result") if isinstance(d, dict) else None
        if isinstance(res, list):
            return res
        log(src="gw", cmd=cmd, note="no result", body=json.dumps(d, ensure_ascii=False)[:600])
    return None


def gw_all(cmd, base, take=1000, cap=60000):
    rows, skip, total = [], 0, None
    while True:
        page = gw(cmd, {**base, "P_TAKE": str(take), "P_SKIP": str(skip)})
        if page is None:
            break
        if total is None and page:
            total = page[0].get("TOTAL")
        rows.extend(page)
        skip += take
        if len(page) < take or (total and skip >= total) or len(rows) >= cap:
            break
        time.sleep(0.4)
    log(src="gw", cmd=cmd, rows=len(rows), total=total)
    return rows, total


def area_ids_from_lookup(rows):
    """Area ids for AREA_NAME, as the lookup gives them (e.g. "A-234") and bare."""
    ids = []
    for row in rows or []:
        if str(row.get("NAME_EN", "")).strip().lower() != AREA_NAME.lower():
            continue
        for k, v in row.items():
            if "ID" in k.upper() and str(v).strip():
                v = str(v).strip()
                ids += [v, re.sub(r"^\D+", "", v)]
    return list(dict.fromkeys(i for i in ids if i))


def dld_gateway():
    result = {"area_ids": [], "plot_hits": {}}
    for cmd in ("carea-lookup", "area-lookup", "zone-lookup", "land-type-lookup",
                "prop-sub-type-lookup", "projects-lookup"):
        rows = gw(cmd, {})
        if rows is not None:
            save(f"dld_{cmd}.json", rows)
            if cmd in ("carea-lookup", "area-lookup") and not result["area_ids"]:
                result["area_ids"] = area_ids_from_lookup(rows)
    log(src="gw", area_ids=result["area_ids"])
    today = date.today().strftime("%m/%d/%Y")
    # Use the first id spelling the lands register accepts.
    usable = []
    for aid in result["area_ids"]:
        probe = gw("lands", {"P_PROJECT": "", "P_MASTER_PROJECT": "", "P_LAND_TYPE_ID": "",
                             "P_AREA_ID": aid, "P_ZONE_ID": "", "P_IS_FREE_HOLD": "",
                             "P_PROP_SB_TYPE_ID": "", "P_SORT": "AREA_EN_ASC",
                             "P_TAKE": "5", "P_SKIP": "0"})
        log(src="gw", probe_area_id=aid, rows=None if probe is None else len(probe))
        if probe:
            usable = [aid]
            break
    for aid in usable or result["area_ids"][:1]:
        queries = {
            "lands": {"P_PROJECT": "", "P_MASTER_PROJECT": "", "P_LAND_TYPE_ID": "",
                      "P_AREA_ID": aid, "P_ZONE_ID": "", "P_IS_FREE_HOLD": "",
                      "P_PROP_SB_TYPE_ID": "", "P_SORT": "AREA_EN_ASC"},
            "buildings": {"P_FROM_DATE": "", "P_TO_DATE": "", "P_IS_FREE_HOLD": "",
                          "P_AREA_ID": aid, "P_ZONE_ID": "", "P_IS_LEASE_HOLD": "",
                          "P_IS_OFFPLAN": "", "P_SORT": "CREATION_DATE_DESC"},
            "units": {"P_AREA_ID": aid, "P_ZONE_ID": "", "P_IS_FREE_HOLD": "",
                      "P_IS_LEASE_HOLD": "", "P_IS_OFFPLAN": "", "P_SORT": "UNIT_NUMBER_ASC"},
            "valuations": {"P_FROM_DATE": "01/01/2010", "P_TO_DATE": today, "P_AREA_ID": aid,
                           "P_PROP_TYPE_ID": "", "P_SORT": "INSTANCE_DATE_DESC"},
            "transactions": {"P_FROM_DATE": "01/01/2000", "P_TO_DATE": today, "P_GROUP_ID": "",
                             "P_IS_OFFPLAN": "", "P_IS_FREE_HOLD": "", "P_AREA_ID": aid,
                             "P_USAGE_ID": "", "P_PROP_TYPE_ID": "",
                             "P_SORT": "INSTANCE_DATE_DESC"},
        }
        for cmd, base in queries.items():
            rows, total = gw_all(cmd, base)
            if cmd == "transactions" and not rows:
                rows, total = gw_all(cmd, {**base, "P_FROM_DATE": "01/01/2026"})
            save(f"dld_{cmd}_area{aid}.json", {"total": total, "rows": rows})
            hits = [r for r in rows if matches_plot(r) or str(r.get("LAND_NUMBER", "")).strip() in (PARCEL_NO, PARCEL_NO.lstrip("0"))]
            if hits:
                result["plot_hits"][f"{cmd}:{aid}"] = hits
    save("dld_gateway_summary.json", result)
    return result


# ── 3. Dubai Pulse bulk files (DLD registers), filtered to the community ─────

PULSE = "https://www.dubaipulse.gov.ae/dataset/"
PULSE_FILES = {
    "land_registry": "e4e01f57-6e07-469f-86c6-87a2d8a636b2/resource/02410e57-6979-4006-9143-d5088c9b79a3/download/land_registry.csv",
    "buildings": "04168da5-9d10-4fe3-bd29-6dba97751435/resource/6450b4a5-f9c5-4aca-8e64-b38aa8db4c5a/download/buildings.csv",
    "valuation": "ff09ccad-6047-4793-a776-9d282abb5cdb/resource/5921b912-d938-4d04-a4d1-a391b125a459/download/valuation.csv",
    "map_requests": "9f7d502c-b93d-4603-bba5-02ccb6dcf017/resource/426cfbc5-206c-45fe-ab74-813352344811/download/map_requests.csv",
    "units": "85462a5b-08dc-4325-9242-676a0de4afc4/resource/7d4deadf-c9bc-47a4-85de-998d0ce38bf3/download/units.csv",
    "transactions": "3b25a6f5-9077-49d7-8a1e-bc6d5dea88fd/resource/a37511b0-ea36-485d-bccd-2d6cb24507e7/download/transactions.csv",
}


def pulse(area_ids, budget_s=480):
    for name, path in PULSE_FILES.items():
        r = fetch("GET", PULSE + path, stream=True, timeout=(20, 120))
        if r is None or r.status_code != 200:
            continue
        r.raw.decode_content = True
        rdr = csv.reader(io.TextIOWrapper(r.raw, encoding="utf-8-sig", errors="replace", newline=""))
        try:
            header = next(rdr)
        except StopIteration:
            continue
        low = [h.strip().lower() for h in header]
        area_cols = [i for i, h in enumerate(low) if h == "area_id"]
        kept, seen, start, done = [], 0, time.time(), True
        for row in rdr:
            seen += 1
            line = "\x1f".join(row)
            if (
                AREA_NAME.lower() in line.lower()
                or any(k in line for k in PLOT_KEYS)
                or any(i < len(row) and row[i].strip() in area_ids for i in area_cols)
            ):
                kept.append(row)
            if time.time() - start > budget_s:
                done = False
                break
        r.close()
        with open(os.path.join(OUT, f"pulse_{name}.csv"), "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(kept)
        log(src="pulse", file=name, scanned=seen, kept=len(kept), complete=done)


# ── 4. Makani (Dubai Municipality geo-addressing, public SOAP) ───────────────

MAKANI = "https://www.makani.ae/MakaniPublicDataService/MakaniPublic.svc"


def makani_call(op, fields):
    parts = "".join(f"<{k}>{escape(str(v))}</{k}>" for k, v in fields.items())
    body = (
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
        f'<{op} xmlns="http://tempuri.org/">{parts}</{op}></s:Body></s:Envelope>'
    )
    r = fetch(
        "POST",
        MAKANI + "/basic",
        data=body.encode(),
        headers={"Content-Type": "text/xml; charset=utf-8",
                 "SOAPAction": f'"http://tempuri.org/IMakaniPublic/{op}"'},
        timeout=40,
    )
    if r is None:
        return None
    m = re.search(rf"<{op}Result>(.*?)</{op}Result>", r.text, re.S)
    text = m.group(1) if m else r.text[:2000]
    text = text.replace("&quot;", '"').replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    try:
        return json.loads(text)
    except ValueError:
        return {"raw": text}


def makani():
    ops = {}
    for suffix in ("?singleWsdl", "?wsdl", "?xsd=xsd0"):
        r = fetch("GET", MAKANI + suffix, timeout=30)
        if r is not None and r.status_code == 200 and "<" in r.text[:10]:
            save(f"makani_wsdl{re.sub(r'[^a-z0-9]', '_', suffix)}.xml", r.text)
            for op in re.findall(r'<(?:wsdl:)?operation name="(\w+)"', r.text):
                ops.setdefault(op, [])
            for op, seq in re.findall(r'<xs:element name="(\w+)"><xs:complexType><xs:sequence>(.*?)</xs:sequence>', r.text, re.S):
                ops.setdefault(op, [])
                ops[op] = re.findall(r'name="(\w+)"', seq)
    save("makani_operations.json", ops)
    results = {}
    for op, fields in ops.items():
        if op.endswith("Response") or not re.search(r"parcel|plot|land|affect", op, re.I):
            continue
        args = {}
        for f in fields or ["parcelid", "remarks"]:
            if re.search(r"parcel|plot|land", f, re.I):
                args[f] = PLOT
            elif f.lower() == "remarks":
                args[f] = "plot research"
            elif "comm" in f.lower():
                args[f] = COMMUNITY_NO
            else:
                args[f] = ""
        results[op] = {"args": args, "response": makani_call(op, args)}
    # Confirms the service answers at all, at the Hor Al Anz East taxi rank.
    results["GetMakaniInfoFromCoord(test)"] = makani_call(
        "GetMakaniInfoFromCoord", {"latitude": "25.278079", "longitude": "55.346062", "remarks": "plot research"}
    )
    save("makani_results.json", results)


# ── 5. Dubai Municipality GIS discovery ──────────────────────────────────────

GIS_ROOTS = [
    "https://gis.dm.gov.ae/arcgis/rest/services",
    "https://gis.dm.gov.ae/server/rest/services",
    "https://gis.dm.gov.ae/gis/rest/services",
    "https://gis.dm.gov.ae/dmgis/rest/services",
    "https://geodubai.dm.gov.ae/arcgis/rest/services",
    "https://geodubai.dm.gov.ae/server/rest/services",
    "https://www.makani.ae/arcgis/rest/services",
]
PLOT_FIELD = re.compile(r"(parcel|plot|land).*(id|no|num)|^(parcel|plot|pid|land_no)", re.I)


def arc_json(url, **params):
    r = fetch("GET", url, params={**params, "f": "json"}, timeout=30)
    if r is None or r.status_code != 200:
        return None
    try:
        return r.json()
    except ValueError:
        return None


DLD_GIS_ROOTS = [
    "https://gis.dubailand.gov.ae/arcgis/rest/services",
    "https://gis.dubailand.gov.ae/server/rest/services",
    "https://gis.dubailand.gov.ae/gis/rest/services",
    "https://gis.dubailand.gov.ae/portal/sharing/rest",
]


def dm_gis(budget_s=900, roots=GIS_ROOTS, prefix="dm_gis"):
    catalog, hits, start = [], [], time.time()
    for root in roots:
        top = arc_json(root)
        if not top or ("services" not in top and "folders" not in top):
            continue
        queue = [(root, top)]
        for folder in top.get("folders", []):
            sub = arc_json(f"{root}/{folder}")
            if sub:
                queue.append((f"{root}/{folder}", sub))
        for base, listing in queue:
            for svc in listing.get("services", []):
                if time.time() - start > budget_s:
                    break
                if svc.get("type") not in ("MapServer", "FeatureServer"):
                    continue
                url = f"{root}/{svc['name']}/{svc['type']}"
                layers = arc_json(f"{url}/layers") or {}
                entry = {"url": url, "layers": []}
                for lyr in layers.get("layers", []):
                    fields = [f.get("name") for f in lyr.get("fields") or []]
                    entry["layers"].append({"id": lyr.get("id"), "name": lyr.get("name"), "fields": fields})
                    for fld in fields:
                        if fld and PLOT_FIELD.search(fld):
                            for val in (f"'{PLOT}'", PLOT, f"'{PLOT_DASHED}'"):
                                q = arc_json(f"{url}/{lyr['id']}/query", where=f"{fld}={val}",
                                             outFields="*", returnGeometry="true", outSR="4326")
                                if q and q.get("features"):
                                    hits.append({"layer": f"{url}/{lyr['id']}", "name": lyr.get("name"),
                                                 "where": f"{fld}={val}", "features": q["features"]})
                                    break
                if svc["type"] == "MapServer":
                    for text in (PLOT, PLOT_DASHED):
                        fd = arc_json(f"{url}/find", searchText=text, contains="false",
                                      layers="all:" + ",".join(str(l["id"]) for l in entry["layers"]) if entry["layers"] else "",
                                      returnGeometry="true", sr="4326")
                        if fd and fd.get("results"):
                            hits.append({"layer": url, "find": text, "results": fd["results"]})
                catalog.append(entry)
    save(f"{prefix}_catalog.json", catalog)
    save(f"{prefix}_plot_hits.json", hits)
    log(src=prefix, services=len(catalog), hits=len(hits))


def dld_gis():
    """DLD runs its own GIS host (gisJobServiceApi in the DLD web config)."""
    for url in ("https://gis.dubailand.gov.ae/", "https://gis.dubailand.gov.ae/jobservice"):
        r = fetch("GET", url, timeout=25)
        if r is not None:
            save(f"dld_gis_{re.sub(r'[^a-z0-9]+', '_', url[8:].lower()).strip('_')}.txt",
                 f"{r.status_code} {r.headers.get('content-type')}\n{r.text[:20000]}")
    dm_gis(roots=DLD_GIS_ROOTS, prefix="dld_gis")


def dld_site():
    """Scripts behind the DLD open-data and Land Status pages, to learn their request shapes."""
    base = "https://dubailand.gov.ae"
    for path in ("/scripts/publicData.js?v=10", "/scripts/api/OpenDataApi.js",
                 "/en/eservices/land-status/", "/en/eservices/land-status-overview/",
                 "/en/eservices/property-status-overview/property-status/"):
        r = fetch("GET", base + path, timeout=30)
        if r is not None and r.status_code == 200:
            save("dld_site_" + re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_")[:60] + ".txt", r.text)


def dld_indexes():
    """DLD rental index and community price index for the area."""
    ext = "https://ext.dubailand.gov.ae"
    for path in ("/rentalindex-v2/GetResidentialSubAreas", "/rentalindex/GetResidentialSubAreas",
                 "/rentalindex/GetCommercialSubAreas"):
        r = fetch("GET", ext + path, timeout=30)
        if r is not None and r.status_code == 200:
            save("dld_" + re.sub(r"[^a-z0-9]+", "_", path.lower()).strip("_") + ".txt", r.text)
    idx = "https://gateway.dubailand.gov.ae/indexes-api/"
    for name in ("communityindex", "priceindex", "residentialindex", "volumeindex"):
        for method in ("GET", "POST"):
            kw = {"headers": GW_HDR, "timeout": 40}
            if method == "POST":
                kw["json"] = {}
            r = fetch(method, idx + name, **kw)
            if r is not None and r.status_code == 200 and r.text.strip():
                save(f"dld_index_{name}.json", r.text)
                break


# ── 7. OpenStreetMap features inside the community boundary ──────────────────

OVERPASS = "https://overpass-api.de/api/interpreter"


def overpass():
    """What OSM maps inside Hor Al Anz East, and the transit around it."""
    hits = json.load(open(os.path.join(OUT, "osm_nominatim_area.json"), encoding="utf-8")) \
        if os.path.exists(os.path.join(OUT, "osm_nominatim_area.json")) else []
    way = next((h["osm_id"] for h in hits if h.get("osm_type") == "way"), 396533652)
    queries = {
        "features": f"""[out:json][timeout:120];way({way});map_to_area->.a;
            (nwr(area.a)[amenity];nwr(area.a)[shop];nwr(area.a)[leisure];nwr(area.a)[landuse];
             nwr(area.a)[healthcare];nwr(area.a)[office];nwr(area.a)[tourism];nwr(area.a)[building][name];
             nwr(area.a)[place];);out center tags;""",
        "roads": f"""[out:json][timeout:120];way({way});map_to_area->.a;
            way(area.a)[highway];out center tags;""",
        "building_count": f"""[out:json][timeout:120];way({way});map_to_area->.a;
            way(area.a)[building];out count;""",
        "boundary": f"""[out:json][timeout:60];way({way});out geom tags;""",
        "transit": """[out:json][timeout:120];
            (node[railway=station](25.255,55.320,25.305,55.380);node[public_transport=station](25.255,55.320,25.305,55.380);
             node[highway=bus_stop](25.270,55.333,25.295,55.362););out tags;""",
    }
    for name, q in queries.items():
        r = fetch("POST", OVERPASS, data={"data": q}, timeout=180,
                  headers={"User-Agent": "plot-research/1.0 (github actions)"})
        if r is not None and r.status_code == 200:
            save(f"osm_overpass_{name}.json", r.text)
        time.sleep(2)


def page_endpoints():
    """Pull service URLs out of the public Makani and DM GIS web apps."""
    found = {}
    for page in ("https://www.makani.ae/", "https://gis.dm.gov.ae/", "https://geodubai.dm.gov.ae/"):
        r = fetch("GET", page, timeout=25)
        if r is None or r.status_code != 200:
            continue
        scripts = re.findall(r'<script[^>]+src="([^"]+)"', r.text)[:25]
        texts = [r.text]
        for src in scripts:
            js = fetch("GET", urljoin(r.url, src), timeout=25)
            if js is not None and js.status_code == 200:
                texts.append(js.text)
        urls = set()
        for t in texts:
            urls.update(re.findall(r"https?://[A-Za-z0-9.\-]+(?:/[A-Za-z0-9_\-./?=&%]*)?", t))
            urls.update(re.findall(r"[\"'](/[A-Za-z0-9_\-./]*(?:svc|api|rest|Service|Parcel|Plot)[A-Za-z0-9_\-./]*)[\"']", t))
        found[page] = sorted(u for u in urls if re.search(r"svc|api|rest|service|parcel|plot|gis|makani|kharetati", u, re.I))
    save("web_app_endpoints.json", found)


# ── 6. OpenStreetMap context for the community ───────────────────────────────

def osm():
    r = fetch(
        "GET",
        "https://nominatim.openstreetmap.org/search",
        params={"q": f"{AREA_NAME}, Dubai", "format": "jsonv2", "polygon_geojson": 1, "limit": 5},
        headers={"User-Agent": "plot-research/1.0 (github actions)"},
    )
    if r is not None and r.status_code == 200:
        save("osm_nominatim_area.json", r.json())


if __name__ == "__main__":
    all_steps = ["reach", "dld", "dldsite", "dldgis", "indexes", "makani", "gis", "pages", "osm",
                 "overpass", "pulse"]
    steps = [s for s in (sys.argv[2] if len(sys.argv) > 2 else "").split(",") if s] or all_steps
    log(src="probe", plot=PLOT, community=COMMUNITY_NO, parcel=PARCEL_NO, area=AREA_NAME, steps=steps)
    area_ids = []
    for step in steps:
        try:
            if step == "reach":
                reachability()
            elif step == "dld":
                area_ids = dld_gateway()["area_ids"]
            elif step == "makani":
                makani()
            elif step == "gis":
                dm_gis()
            elif step == "pages":
                page_endpoints()
            elif step == "dldsite":
                dld_site()
            elif step == "dldgis":
                dld_gis()
            elif step == "indexes":
                dld_indexes()
            elif step == "osm":
                osm()
            elif step == "overpass":
                overpass()
            elif step == "pulse":
                pulse(set(area_ids))
        except Exception as e:
            log(src="probe", step=step, error=f"{type(e).__name__}: {e}"[:400])
    log(src="probe", done=True)
