# Retrieving Dubai plot information: instructions for Claude

This document tells a Claude agent inside a standalone web platform how to find everything public about a Dubai plot from its plot number, and tells the platform's backend which tools to give it. It is based on a live investigation of plot 1330114 (Hor Al Anz East) in October 2026; every endpoint marked **verified** answered real requests then.

It has four parts:

- **Part A:** the system prompt for the platform's Claude agent. Paste it as the `system` prompt.
- **Part B:** the tools the backend must implement, as Claude API tool definitions.
- **Part C:** the endpoint reference the backend uses to implement those tools.
- **Part D:** a worked example and test case (plot 1330114) with the expected results.

---

## Part A: System prompt

Copy everything inside the block below into the `system` field of the Claude API request.

````text
You are the plot research agent of a Dubai real-estate investment platform. Given a Dubai plot reference, you find what public government data says about that plot and its community, and you present it to an investor with a source for every fact.

# What a Dubai plot reference means

- A Dubai Municipality (DM) plot number has 7 digits: the first 3 are the DM community code, the last 4 are the plot number inside that community. 1330114 means community 133, plot 0114, written 133-0114. Users may also type 133-114, 133/0114, "plot 114 in Hor Al Anz East", or a community name with a plot number.
- The DM community code (133) and the Dubai Land Department (DLD) area id (234 for the same community) are different numbering systems. Never use one where the other is required. Map between them by community name.
- In the DLD land register, PARCEL_ID equals the 7-digit DM number, DM_ZIP_CODE is the DM community code, and MUNICIPALITY_NUMBER is the plot number without leading zeros. LAND_NUMBER is DLD's own land number and is NOT the plot number; it is what DLD's own e-services ask for, so always report it.
- A Makani number is a 10-digit building-entrance address, not a plot number.

# How to research a plot

Work through these steps, calling tools as needed. Run independent calls in parallel.

1. Resolve the reference with resolve_plot. If it returns several candidate communities, use dld_find_parcel on each candidate until one contains the parcel. If none does, say so; do not guess.
2. Find the plot's official record with dld_find_parcel. This is the anchor of the answer: land type, sub-type, area in m², freehold status, registration, project, and whether the plot was separated from another one.
3. Read the plot's position in its community from the same result: its size rank, how it compares with the median parcel, the land-use mix, and the neighbouring plot numbers. Neighbouring numbers are likely, not certainly, adjacent; say so.
4. Gather market evidence with dld_open_data (valuations for the area, current-year sales and rents) and transaction_history (older sales, mortgages and grants). Look for any record whose area matches the plot's area; if none matches, report that the plot has no recorded transaction in the data searched, and name the period covered.
5. Try to locate the plot with makani_lookup and dm_gis_find. These services answer only from inside the UAE; if a tool reports not_reachable, do not retry it and do not estimate coordinates. Fall back to the community boundary from osm_context and say the exact position is not available.
6. Describe the community with osm_context (boundary, amenities, roads, metro stations, bus stops) and community_population.
7. List what is still missing and give the user the exact manual steps to get it (see "Manual steps" below).

# Rules

- Report only what a tool returned. Never invent coordinates, zoning, owners, prices or plot boundaries. If a fact is not available, say "not available from public data" and explain where it lives.
- Cite a source and retrieval date for every fact. Mark each fact as one of: official (a government service answered), mirror (a third-party copy of government open data), or derived (your calculation from the above).
- An estimate of value is never a valuation. If you give one, label it "indicative", show the rate per sq ft and the comparable records it comes from, and state what would change it (whether the plot is built on, permitted floor area, frontage, affection plan). A formal valuation needs a RERA-certified valuer.
- Treat valuations at rates far above vacant-land comparables as likely including a building, and say so rather than averaging them in.
- Convert units explicitly: 1 m² = 10.7639 sq ft. DLD records both ACTUAL_AREA and PROCEDURE_AREA; when a sale covers part of a plot, price per sq ft uses PROCEDURE_AREA.
- Explain what tenure means for the investor: Non Free Hold property can be bought by UAE and GCC nationals; Free Hold is open to all nationalities.
- A DLD land type of "Commercial" with sub-type "Residential" is common for ordinary villa plots in older communities. Report both fields as given; do not reinterpret them.
- Never try to get past a captcha, a login, UAE PASS, or a geo-restriction. If a tool reports captcha_required, login_required or not_reachable, record it in the source log and move on.
- Do not seek or report personal data about owners or tenants.

# Manual steps to offer when data is missing

- Coordinates, land photo, height, land use, parking and setback regulations, zone code, DM violations, property blocks, rental disputes, DEWA premise number: DLD Property Status Enquiry at https://dubailand.gov.ae/en/eservices/property-status-overview/property-status/ using the Land Number tab (area = community name, property type = Land, land number = the DLD LAND_NUMBER, sub-number = LAND_SUB_NUMBER), or the Municipality Number tab with the 7-digit number. It requires solving a captcha in a browser.
- Makani number and plot outline: search the 7-digit plot number in the Makani or Dubai Now app, or makani.ae, from a UAE connection.
- Affection plan: Dubai Municipality planning services, with an owner or consultant account.
- Ownership: DLD title deed; not public.

# Output

Return two things, in this order:

1. A JSON object matching this shape (use null for anything not available):

{
  "plot": {"dm_number": "1330114", "plot_number": "133-0114", "community_code": "133",
           "community_en": "...", "community_ar": "...", "dld_area_id": "234",
           "dld_land_number": "...", "land_sub_number": 0, "land_type": "...", "sub_type": "...",
           "area_m2": 0, "area_sqft": 0, "tenure": "...", "registered": true, "off_plan": false,
           "project": null, "separated_from": null},
  "position_in_community": {"parcels": 0, "rank_by_area": 0, "median_parcel_m2": 0,
           "same_type_parcels": 0, "rank_in_same_type": 0, "neighbours": []},
  "location": {"latitude": null, "longitude": null, "makani": null, "source": null,
           "community_boundary_available": true, "nearest_metro": []},
  "market": {"plot_transactions": [], "comparable_land": [], "valuations": [], "rents": [],
           "indicative_value": {"low_aed": null, "high_aed": null, "rate_basis": null}},
  "community": {"area_km2": null, "population": [], "amenities": {}, "roads": []},
  "missing": [{"item": "...", "where": "...", "how": "..."}],
  "sources": [{"name": "...", "url": "...", "status": "answered|mirror|not_reachable|captcha_required|login_required|error", "retrieved_at": "..."}]
}

2. A short report for an investor: the plot's identity, what it is, how it compares, what the market evidence says, what the location offers, what is missing and how to get it. Lead with the facts that matter most for an investment decision. Keep every number traceable to the JSON.
````

### API settings for the agent

| Setting | Value | Why |
|---|---|---|
| `model` | `claude-opus-5-5` | Current default Opus model. |
| `thinking` | omit, or `{"type": "adaptive"}` | Thinking is always on for this model; `{"type": "disabled"}` returns a 400. |
| `output_config.effort` | `"high"` | The model's default is `medium`; multi-step research benefits from `high`. |
| `tool_choice` | `{"type": "auto"}` | Forced tool use (`any` / `tool`) returns a 400 on this model. Steer tool use from the prompt. |
| Tool definitions | `strict: true`, `additionalProperties: false` | Guarantees tool inputs match the schemas in Part B. |
| Streaming | on, `max_tokens` about 64000 | A research run makes many calls and writes a long report. With streaming and client tools, set `eager_input_streaming: true` on each tool and validate inputs before running them. |
| Refusal fallback | beta `server-side-fallback-2026-07-01` with `fallbacks: "default"` | Lets a declined request continue on a fallback model instead of stopping. Remove if you don't want it. |
| Parallel tools | allowed | Return every `tool_result` from one assistant turn in a single user message. |
| Prompt caching | `cache_control` on the system prompt | The system prompt and tool list are stable; keep the tool order fixed so the cache holds. |

---

## Part B: Tools the backend must implement

Every tool returns the same envelope, so the agent can build its source log:

```json
{
  "ok": true,
  "status": "answered | mirror | not_found | not_reachable | captcha_required | login_required | error",
  "source": "human-readable source name",
  "url": "the URL that was called",
  "retrieved_at": "2026-10-13T07:00:00Z",
  "data": {},
  "error": null
}
```

In strict mode every property must appear in `required`; optional inputs are typed with `null` allowed.

```json
[
  {
    "name": "resolve_plot",
    "description": "Parse a Dubai plot reference (e.g. 1330114, 133-0114, 'plot 114 Hor Al Anz East') into its Dubai Municipality community code and plot number, and resolve the community's names, DM area and DLD area id. Returns several candidates when the community name maps to more than one DLD area.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {"type": "string", "description": "The plot reference as the user typed it."}
      },
      "required": ["query"],
      "additionalProperties": false
    }
  },
  {
    "name": "dld_find_parcel",
    "description": "Fetch the DLD land register for one DLD area and return the parcel whose PARCEL_ID matches, plus a summary of the area's register: parcel count, total and median area, the parcel's size rank overall and within its land type and sub-type, the land-use mix, and the parcels with the 15 nearest municipality numbers on either side.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "dld_area_id": {"type": "string", "description": "Numeric DLD area id, e.g. '234'. Not the DM community code."},
        "parcel_id": {"type": "string", "description": "7-digit DM plot number, e.g. '1330114'."}
      },
      "required": ["dld_area_id", "parcel_id"],
      "additionalProperties": false
    }
  },
  {
    "name": "dld_open_data",
    "description": "Query the DLD open-data gateway. Commands: valuations (land and property valuations by area), transactions (sales, mortgages and gifts; served from January 2026 onward), rents (Ejari contracts), lands, buildings, units, carea-lookup, projects-lookup. Area filtering for transactions and rents is done by the backend on AREA_EN, because the gateway's own area filter returns no rows for those commands.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "command": {"type": "string", "enum": ["valuations", "transactions", "rents", "lands", "buildings", "units", "carea-lookup", "projects-lookup"]},
        "dld_area_id": {"type": ["string", "null"], "description": "Numeric DLD area id, or null for all areas."},
        "area_name_en": {"type": ["string", "null"], "description": "DLD area name for client-side filtering, e.g. 'Hor Al Anz East'."},
        "from_date": {"type": ["string", "null"], "description": "YYYY-MM-DD."},
        "to_date": {"type": ["string", "null"], "description": "YYYY-MM-DD."},
        "property_type": {"type": ["string", "null"], "description": "Optional client-side filter on PROP_TYPE_EN / PROPERTY_TYPE_EN, e.g. 'Land'."},
        "max_rows": {"type": "integer", "description": "Upper limit on rows returned to the agent, e.g. 200."}
      },
      "required": ["command", "dld_area_id", "area_name_en", "from_date", "to_date", "property_type", "max_rows"],
      "additionalProperties": false
    }
  },
  {
    "name": "transaction_history",
    "description": "Historical DLD transactions (1997 onward) for a community from the platform's own copy of DLD transaction data. Can filter by property type and by an area range in m², to find records that match a specific plot's area. Marks each row with its dataset.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "area_name_en": {"type": "string"},
        "property_type": {"type": ["string", "null"], "description": "e.g. 'Land'."},
        "min_area_m2": {"type": ["number", "null"]},
        "max_area_m2": {"type": ["number", "null"]}
      },
      "required": ["area_name_en", "property_type", "min_area_m2", "max_area_m2"],
      "additionalProperties": false
    }
  },
  {
    "name": "makani_lookup",
    "description": "Dubai Municipality Makani geo-addressing. by_number returns building, community and coordinates for a 10-digit Makani number; by_coordinates returns the Makani numbers and buildings at a point. Answers only from a UAE network; returns status not_reachable otherwise.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "mode": {"type": "string", "enum": ["by_number", "by_coordinates"]},
        "makani_number": {"type": ["string", "null"]},
        "latitude": {"type": ["number", "null"]},
        "longitude": {"type": ["number", "null"]}
      },
      "required": ["mode", "makani_number", "latitude", "longitude"],
      "additionalProperties": false
    }
  },
  {
    "name": "dm_gis_find",
    "description": "Search Dubai Municipality GIS map services for a plot number and return matching features with geometry in WGS84. Answers only from a UAE network; returns status not_reachable otherwise.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "plot_number": {"type": "string", "description": "7-digit DM plot number."}
      },
      "required": ["plot_number"],
      "additionalProperties": false
    }
  },
  {
    "name": "osm_context",
    "description": "OpenStreetMap context for a Dubai community: boundary polygon and its area, named amenities by category, building count, named roads, metro stations with distance to the boundary, and bus stops.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "community_name_en": {"type": "string"},
        "community_name_ar": {"type": ["string", "null"]}
      },
      "required": ["community_name_en", "community_name_ar"],
      "additionalProperties": false
    }
  },
  {
    "name": "community_population",
    "description": "Dubai Statistics Center population estimates for a community by year.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "community_code": {"type": "string", "description": "3-digit DM community code."}
      },
      "required": ["community_code"],
      "additionalProperties": false
    }
  }
]
```

---

## Part C: Endpoint reference for the backend

### Where the backend must run

| Host | Reachable from outside the UAE? | Used by |
|---|---|---|
| `gateway.dubailand.gov.ae` (DLD open data) | **Yes** (verified from a US cloud runner) | `dld_find_parcel`, `dld_open_data` |
| `dubailand.gov.ae` (DLD website, Land Status area list) | Yes | `resolve_plot` (fallback name list) |
| `www.makani.ae` (Makani SOAP) | **No**, connection times out | `makani_lookup` |
| `gis.dm.gov.ae`, `geodubai.dm.gov.ae` (DM GIS) | **No**, connection times out | `dm_gis_find` |
| `www.dubaipulse.gov.ae` (bulk DLD files) | **No**, connection times out | loading `transaction_history`, population, community codes |
| `data.dubai`, `www.dsc.gov.ae` | **No**, the firewall returns "Request Rejected" | population |
| `nominatim.openstreetmap.org`, `overpass-api.de` | Yes | `osm_context` |
| `huggingface.co` (mirrors of DLD data) | Yes | loading `transaction_history` when Dubai Pulse is unreachable |

Run the tool backend on servers with a UAE egress IP (a cloud region in the UAE) to reach Makani, DM GIS and Dubai Pulse. The DLD gateway and OpenStreetMap work from anywhere.

General rules for every call: connect timeout 10 s, read timeout 60–120 s; at most about one request per second per host; retry twice with backoff on timeouts and 5xx; cache responses (lookups for a week, registers for a day); log every request with URL, status and time for the source log.

### DLD open-data gateway (verified)

`POST https://gateway.dubailand.gov.ae/open-data/{command}`

Headers:

```http
Content-Type: application/json
Accept: application/json, */*
Origin: https://dubailand.gov.ae
Referer: https://dubailand.gov.ae/en/open-data/real-estate-data/
User-Agent: <a normal browser User-Agent string>
```

Response envelope (HTTP status is 200 even for errors):

```json
{"timeStamp": "...", "responseCode": 200, "validationErrorsList": [], "response": {"result": [ ... ]}}
```

Treat anything other than `responseCode` 200 with an array in `response.result` as a failure. An unknown command returns `responseCode` 420 `INVALID_REQUEST`. Every row carries `TOTAL` (the full result count) and `RN` (row number). Paging uses `P_TAKE` and `P_SKIP`, both as strings. Dates are `MM/DD/YYYY` strings.

The DLD website shows a reCAPTCHA in its open-data forms, but in October 2026 the gateway served `carea-lookup`, `projects-lookup`, `lands` and `valuations` without one. If a response ever reports a captcha, return `captcha_required` and stop; do not try to obtain or replay captcha tokens.

**`carea-lookup`** — body `{}`. Returns 437 areas:

```json
{"AREA_ID": "A-234", "NAME_EN": "Hor Al Anz East", "NAME_AR": "هور العنز شرق"}
```

For every other command use the numeric part only (`"234"`). Sending `"A-234"` to `lands` returns HTTP 500.

**`projects-lookup`** — body `{}`. Returns `{ID, NAME_EN, NAME_AR}` for about 4,200 registered projects.

**`lands`** — the land register for an area:

```json
{"P_PROJECT": "", "P_MASTER_PROJECT": "", "P_LAND_TYPE_ID": "", "P_AREA_ID": "234",
 "P_ZONE_ID": "", "P_IS_FREE_HOLD": "", "P_PROP_SB_TYPE_ID": "",
 "P_TAKE": "1000", "P_SKIP": "0", "P_SORT": "AREA_EN_ASC"}
```

Fields per row:

| Field | Meaning |
|---|---|
| `PARCEL_ID` | 7-digit DM plot number (integer); null for some government parcels |
| `DM_ZIP_CODE` | DM community code, e.g. `"133"` |
| `MUNICIPALITY_NUMBER` | plot number inside the community, without leading zeros, e.g. `"114"` |
| `LAND_NUMBER`, `LAND_SUB_NUMBER` | DLD land number and sub-number (used by DLD e-services) |
| `LAND_TYPE_EN` / `_AR` | DLD land type: Commercial, Residential, Industrial, Agricultural, Public Facilities, Government Authorities |
| `PROP_SUB_TYPE_EN` / `_AR` | sub-type, e.g. Commercial, Residential, School, Electricity Station, Mosque |
| `ACTUAL_AREA` | area in m² |
| `AREA_EN` / `_AR`, `ZONE_EN` / `_AR` | DLD area and zone names |
| `IS_FREE_HOLD`, `IS_FREE_HOLD_EN` | 0 / "Non Free Hold" or 1 / "Free Hold" |
| `IS_REGISTERED` | 1 if registered |
| `IS_OFFPLAN_EN` | "Ready" or "Off-Plan" |
| `PROJECT_EN`, `MASTER_PROJECT_EN`, `PROJECT_NUMBER` | development, if any |
| `SEPARATED_FROM`, `SEPARATED_REFERENCE` | set when the plot was split from another |
| `PRE_REGISTRATION_NUMBER` | off-plan pre-registration |

`dld_find_parcel` fetches every page for the area, matches `PARCEL_ID == int(parcel_id)`, falls back to `DM_ZIP_CODE + MUNICIPALITY_NUMBER`, and computes the summary described in its tool description.

**`valuations`** — DLD valuation procedures by area:

```json
{"P_FROM_DATE": "01/01/2010", "P_TO_DATE": "10/13/2026", "P_AREA_ID": "234",
 "P_PROP_TYPE_ID": "", "P_TAKE": "1000", "P_SKIP": "0", "P_SORT": "INSTANCE_DATE_DESC"}
```

Fields: `INSTANCE_DATE`, `PROPERTY_TYPE_EN`, `PROP_SUB_TYPE_EN`, `ACTUAL_AREA`, `PROCEDURE_AREA`, `ACTUAL_WORTH`, `PROPERTY_TOTAL_VALUE`, `PROCEDURE_NUMBER`, `PROCEDURE_YEAR`, `ROW_STATUS_CODE`.

**`transactions`** — served from January 2026 onward. Query one calendar month at a time with no area filter and filter rows on `AREA_EN` in the backend; with `P_AREA_ID` set, the gateway returned no rows. This method is used daily by a public monitor ([GusCurrie/dubai-property-monitor](https://github.com/GusCurrie/dubai-property-monitor)); one other developer reports the command being refused behind a captcha, so treat a refusal as `captcha_required`.

```json
{"P_FROM_DATE": "10/01/2026", "P_TO_DATE": "11/01/2026", "P_GROUP_ID": "", "P_IS_OFFPLAN": "",
 "P_IS_FREE_HOLD": "", "P_AREA_ID": "", "P_USAGE_ID": "", "P_PROP_TYPE_ID": "",
 "P_TAKE": "2000", "P_SKIP": "0", "P_SORT": ""}
```

`P_GROUP_ID` `"1"` restricts to sales. Fields: `TRANSACTION_NUMBER`, `INSTANCE_DATE`, `PROCEDURE_EN`, `IS_OFFPLAN`, `IS_FREE_HOLD`, `AREA_EN`, `TRANS_VALUE`, `ACTUAL_AREA`, `PROCEDURE_AREA`, `USAGE_EN`, `PROP_TYPE_EN`, `PROP_SB_TYPE_EN`, `ROOMS_EN`, `PROJECT_EN`, `MASTER_PROJECT_EN`.

**`rents`** — Ejari contracts; same windowing and client-side area filter. Split each month into windows of about six days to keep paging stable.

```json
{"P_FROM_DATE": "10/01/2026", "P_TO_DATE": "10/07/2026", "P_DATE_TYPE": "1", "P_IS_FREE_HOLD": "",
 "P_VERSION": "", "P_AREA_ID": "", "P_USAGE_ID": "", "P_PROP_TYPE_ID": "",
 "P_TAKE": "2000", "P_SKIP": "0", "P_SORT": ""}
```

Fields: `REGISTRATION_DATE`, `START_DATE`, `END_DATE`, `VERSION_EN` (New / Renewed), `AREA_EN`, `ANNUAL_AMOUNT`, `CONTRACT_AMOUNT`, `ACTUAL_AREA`, `PROP_TYPE_EN`, `PROP_SUB_TYPE_EN`, `USAGE_EN`, `IS_FREE_HOLD`, `PROJECT_EN`, `ROOMS`.

**`buildings`** and **`units`** — strata registers; they return no rows for non-freehold communities such as Hor Al Anz East.

### DLD Land Status area list (verified)

`GET https://dubailand.gov.ae/umbraco/surface/LandStatus/GetAreaList` with header `X-Requested-With: XMLHttpRequest` returns `{"Result": [{"AreaID": 451, "EnglishName": "...", "ArabicName": "..."}]}`. Useful as a second name list for matching communities.

### DLD Property Status Enquiry (do not automate)

The page `https://dubailand.gov.ae/en/eservices/property-status-overview/property-status/` searches by title deed, land number, Makani number or municipality number, and returns location, land photo, zoning (height, land use, parking, setback, zone code), DM violations, blocks and rental disputes. Each search sends a reCAPTCHA response that DLD's server checks. The platform must not call it; the agent offers it as a manual step.

### Makani public service (from a UAE network only)

SOAP 1.1, `POST https://www.makani.ae/MakaniPublicDataService/MakaniPublic.svc/basic`

```http
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://tempuri.org/IMakaniPublic/GetMakaniInfoFromCoord"
```

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>
  <GetMakaniInfoFromCoord xmlns="http://tempuri.org/">
    <latitude>25.2832</latitude><longitude>55.3463</longitude><remarks>your-platform-name</remarks>
  </GetMakaniInfoFromCoord>
</s:Body></s:Envelope>
```

Operations: `GetMakaniDetails(makanino, remarks)`, `IsValidMakani(makanino, remarks)`, `GetMakaniInfoFromCoord(latitude, longitude, remarks)`. The `<OperationResult>` element holds a JSON string; parse it and read `MAKANI_INFO`. Fetch `...MakaniPublic.svc?singleWsdl` once from the UAE server to list any further operations, such as a parcel search. Dubai Municipality's service licence requires attribution to Dubai Municipality. (Operations confirmed by the open-source MCP-Dubai project in July 2026; not reachable from this research's servers.)

### Dubai Municipality GIS (from a UAE network only, discovery required)

`gis.dm.gov.ae` timed out from outside the UAE, so its service list could not be confirmed. From the UAE server: request `https://gis.dm.gov.ae/arcgis/rest/services?f=json` (and `/server/rest/services`), list the MapServer and FeatureServer services, and for each MapServer call `.../MapServer/find?searchText=1330114&contains=false&layers=all&returnGeometry=true&sr=4326&f=json`. For layers with a field named like `PARCEL_ID`, `PLOT_NO` or `LAND_NO`, query `.../{layer}/query?where=FIELD='1330114'&outFields=*&returnGeometry=true&outSR=4326&f=json`. Store the service paths that work; do not rediscover on every request.

### Dubai Pulse bulk files (from a UAE network only)

These DLD CSV files back `transaction_history` and register snapshots. Dubai Pulse has been moving to the data.dubai portal, so check each link before relying on it.

| File | URL |
|---|---|
| Land registry | `https://www.dubaipulse.gov.ae/dataset/e4e01f57-6e07-469f-86c6-87a2d8a636b2/resource/02410e57-6979-4006-9143-d5088c9b79a3/download/land_registry.csv` |
| Transactions | `https://www.dubaipulse.gov.ae/dataset/3b25a6f5-9077-49d7-8a1e-bc6d5dea88fd/resource/a37511b0-ea36-485d-bccd-2d6cb24507e7/download/transactions.csv` |
| Valuations | `https://www.dubaipulse.gov.ae/dataset/ff09ccad-6047-4793-a776-9d282abb5cdb/resource/5921b912-d938-4d04-a4d1-a391b125a459/download/valuation.csv` |
| Buildings | `https://www.dubaipulse.gov.ae/dataset/04168da5-9d10-4fe3-bd29-6dba97751435/resource/6450b4a5-f9c5-4aca-8e64-b38aa8db4c5a/download/buildings.csv` |
| Units | `https://www.dubaipulse.gov.ae/dataset/85462a5b-08dc-4325-9242-676a0de4afc4/resource/7d4deadf-c9bc-47a4-85de-998d0ce38bf3/download/units.csv` |
| Rent contracts | `https://www.dubaipulse.gov.ae/dataset/00768c45-f014-4cc6-937d-2b17dcab53fb/resource/765b5a69-ca16-4bfd-9852-74612f3c4ea6/download/rent_contracts.csv` |
| Map (site plan) requests | `https://www.dubaipulse.gov.ae/dataset/9f7d502c-b93d-4603-bba5-02ccb6dcf017/resource/426cfbc5-206c-45fe-ab74-813352344811/download/map_requests.csv` |

Load them on a schedule into the platform's database rather than at question time; the transactions file has over a million rows.

### Mirrors when Dubai Pulse is unreachable (verified)

Third-party copies of DLD open data on Hugging Face, reachable from anywhere. Label rows from them as `mirror`.

| Dataset | Rows | Coverage and columns |
|---|---|---|
| `dubairealestatedata/dubai-real-estate-sales-transactions` (`dld_sales_transactions.parquet`) | 1,372,277 | 1997 to October 2026; `transaction_id`, `instance_date`, `area_id`, `area_name_en`, `property_type_label`, `property_sub_type`, `usage_label`, `area_sqm`, `price_aed`, `procedure_name_en` |
| `viewit-ai/full-dubai-pulse` (`Transactions_clean.csv`) | 1,276,960 | includes mortgages and grants; sizes in sq ft (`built_up_area_(sqft)`), dates as DD-MM-YYYY |

### Reference data to ship with the platform

Static tables the backend can load once:

- **DM communities:** community code, English and Arabic names, area in km². Official source: Dubai Municipality; a copy is in `AlekseiRiabinin/uae_db` (`data/communities.csv`) on GitHub.
- **DM-code-to-DLD-area map:** built by matching DM names to `carea-lookup` names (case-insensitive, ignoring spacing and "Al-"/"Al " variants). Confirm each match by checking that the area's land register contains parcels whose `DM_ZIP_CODE` equals the DM code; that check is decisive.
- **Population by community:** Dubai Statistics Center, published on Dubai Pulse as `communitynumber_communityname_en` (e.g. `133-HOR AL ANZ EAST`) by year.

### OpenStreetMap (verified)

Send a descriptive `User-Agent` with contact details; Overpass returns 406 without one, and sometimes 504 under load (retry after a pause).

- Boundary: `GET https://nominatim.openstreetmap.org/search?q={community}, Dubai&format=jsonv2&polygon_geojson=1&limit=5`. Prefer the result with `osm_type` "way" or "relation" and a Polygon. Compare its area with the DM area; a large mismatch means the wrong polygon.
- Features inside the boundary (Overpass `POST https://overpass-api.de/api/interpreter`, field `data`):

```text
[out:json][timeout:120];way(<osm_id>);map_to_area->.a;
(nwr(area.a)[amenity];nwr(area.a)[shop];nwr(area.a)[leisure];nwr(area.a)[healthcare];
 nwr(area.a)[office];nwr(area.a)[tourism];nwr(area.a)[building][name];);out center tags;
```

- Building count: `way(area.a)[building];out count;`
- Roads: `way(area.a)[highway];out center tags;`
- Metro stations near the community: `node[railway=station](<south>,<west>,<north>,<east>);out;` on a box 1.5 km larger than the boundary, then measure each station's distance to the boundary polygon.

Attribute OpenStreetMap data: "© OpenStreetMap contributors (ODbL)".

### Pitfalls found in testing

- DLD area ids from `carea-lookup` carry an `A-` prefix; strip it. `"A-234"` makes `lands` fail with HTTP 500.
- The gateway returns HTTP 200 for errors; check `responseCode`.
- `transactions` and `rents` ignore the area filter in practice; filter on `AREA_EN` yourself.
- `LAND_NUMBER` is not the plot number. The plot number is `PARCEL_ID` (7 digits) or `DM_ZIP_CODE` + `MUNICIPALITY_NUMBER`.
- Most villa plots in older Deira communities are land type "Commercial" with sub-type "Residential".
- DLD registers built plots as land, so "land" valuations can include buildings.
- A standard villa plot is 11,000 sq ft (1,021.93 m²); repeated sizes are plot types, not the same plot.
- Overpass needs a descriptive `User-Agent`.

---

## Part D: Test case, plot 1330114

Use this to check an implementation end to end. Values were retrieved on 13 October 2026.

| Step | Expected result |
|---|---|
| `resolve_plot("1330114")` | community code 133, plot 0114, "133-0114", Hor Al Anz East / هور العنز شرق, DM area 1.377 km², DLD area id 234 |
| `dld_find_parcel("234", "1330114")` | `LAND_NUMBER` 1928, sub-number 0, Commercial / Commercial, 5,370.32 m² (57,806 sq ft), Non Free Hold, registered, Ready, no project, not separated |
| register summary | 386 parcels, 856,883 m² in total, median 1,021.93 m²; the plot ranks 30th of 386 by area and 10th of 75 Commercial / Commercial parcels |
| neighbours | 133-0115 (3,335.22 m², Commercial), 133-0116 (6,578.74 m², Commercial / Residential), 133-0118 (3,355.56 m², Commercial), 133-0123 (3,716.12 m², Commercial) |
| `dld_open_data("valuations", "234", ...)` | 9 valuations in 2026, including a 7,051.25 m² commercial plot at AED 75,898,950 (AED 1,000 per sq ft) |
| `transaction_history("Hor Al Anz East", "Land", 5300, 5450)` | no records: the plot has no recorded sale, mortgage or grant from 1997 to October 2026 |
| commercial land evidence | a 2018 grant of a 9,136 m² commercial plot at AED 1,300 per sq ft; 2007 sales of a 1,413 m² plot at AED 660 and 900 per sq ft |
| indicative value | AED 58–75 million as vacant land (57,806 sq ft at AED 1,000–1,300 per sq ft), labelled indicative |
| `osm_context("Hor Al Anz East")` | OSM way 396533652, 1.383 km²; 1,246 buildings; Al Qiyadah Metro about 50 m and Abu Hail Metro about 155 m from the boundary (Green Line) |
| `community_population("133")` | 19,453 (2015), 20,847 (2018), 22,143 (2022), 22,739 (2023) |
| `makani_lookup`, `dm_gis_find` | `not_reachable` from outside the UAE; coordinates come from the DLD Property Status Enquiry (manual step) |

A complete answer for this plot, with charts and a source log, is in `research/plot-1330114/` in this repository (`README.md`, `dossier.html`, `plot-1330114.json`).
