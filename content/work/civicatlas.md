---
images: ["social/civicatlas-monkey.png"]
social_image_alt: "CivicAtlas: Maryland, at work. A map of all 24 Maryland jurisdictions. 2024 private-sector employment snapshot."
title: "CivicAtlas"
eyebrow: "Public data · Working application"
description: "Compare 24 Maryland jurisdictions using a reproducible 2024 BLS private-sector employment snapshot, with sources behind every figure."
lead: "Where is Maryland’s private-sector employment concentrated, and how do two jurisdictions compare?"
---
[Open CivicAtlas](https://atlas.goldenmonkey.dev/) · [Inspect the source code](https://github.com/goldenmonkeyrnd/civicatlas)

## A comparison you can check

CivicAtlas brings together employment, establishments, average annual pay and industry composition for Maryland’s 24 county-equivalent jurisdictions. Baltimore city and Baltimore County remain distinct. A county map and equivalent selectors let you compare two jurisdictions; the source inspector explains the numbers behind the view.

The application uses a **2024 private-sector employment snapshot** from the Bureau of Labor Statistics Quarterly Census of Employment and Wages. These are covered workplace jobs, not a count of residents who work. The display preserves suppressed and missing observations as unavailable, and computes sector shares against the matching county private-sector total.

## From published data to a working API

Python acquires official county CSVs and records their hashes. DuckDB validates identifiers and observations, then produces Parquet and a D1 import artifact. Census boundary geometry supplies the map. The production application queries Cloudflare D1 through a Worker API; React and TypeScript present the comparison and source evidence.

The snapshot is deliberately fixed. Source URLs, retrieval dates, definitions and transformation details make it possible to reproduce a displayed figure. Application deployments retain the data revision; importing a new snapshot is a separate checked action.

| Layer | Responsibility |
| --- | --- |
| Python + DuckDB | Acquisition, validation and reproducible data artifacts |
| Cloudflare D1 | Published county totals, sector observations and provenance |
| Cloudflare Worker | Parameterized public queries and explicit errors |
| React + TypeScript | County comparison, map and source inspector |
| GitHub Actions | Validation and deployment automation |

## Engineering choices that matter

- FIPS identifiers stay strings, preserving leading zeros and jurisdiction identity.
- Suppression is represented explicitly. An encoded zero in a withheld observation is not reported as a measured zero.
- The public API supports specific queries; visitors cannot submit arbitrary SQL.
- A service failure produces an error and a retry action. It does not substitute invented results.
- Aggregate engagement events measure interactions without storing persistent visitor identifiers.

## Check the sources

The [BLS CSV data slices documentation](https://www.bls.gov/cew/additional-resources/open-data/csv-data-slices.htm) explains the annual fields and disclosure conventions. Map geometry comes from the [Census cartographic boundary files](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html).

The [repository](https://github.com/goldenmonkeyrnd/civicatlas) contains acquisition and validation commands, the API, the application and the data manifest. The [Sentinels lab](/labs/sentinels/) lets you edit examples and inspect the same released analyzer used for this pipeline’s declared integration contracts.
