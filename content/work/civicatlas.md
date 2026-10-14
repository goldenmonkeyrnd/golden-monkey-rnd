---
images: ["social/civicatlas-monkey.png"]
social_image_alt: "CivicAtlas, a Maryland public-data application by Golden Monkey R&D."
title: "CivicAtlas"
eyebrow: "Public data · Working application"
description: "Explore Maryland neighborhoods, compare outreach locations, and inspect the public data and directed-road calculations behind the result."
lead: "Where could three additional outreach sites bring benefits assistance closer?"
---
[Try the Maryland Outreach Lab](https://atlas.goldenmonkey.dev/?view=plan) · [Inspect the source code](https://github.com/goldenmonkeyrnd/civicatlas)

## A decision you can explore

CivicAtlas joins neighborhood conditions, documented assistance locations, public libraries, and a real street network into an interactive outreach-planning demonstration. Start in Baltimore, suggest additional library sites, replace a location, or close a road. The map and comparison show what changes; source inspection explains where the inputs came from.

The public-data foundation covers **4,079 Maryland block groups, 1,475 census tracts, and all 24 county-equivalent jurisdictions**. Explore household income, poverty, rent burden, vehicle availability, internet access, and workforce estimates. County employment and nominal pay retain their own geography, with 2010–2024 history. The commuting layer shows Maryland home–work relationships from 2021.

## The work behind the map

This project grew from a local public-data corpus. The acquisition step extracts bounded Maryland records and pins their source hashes. Routine publication builds run offline. Python and DuckDB preserve geographic identifiers, estimates, margins of error, denominators, source periods, and unavailable observations; validation checks the actual geographic joins and byte reproduction.

The location inventory required reconciliation. Official map points can lag relocations and closures. Current library directories and public-assistance records supply verification evidence. Corrected, closed, unresolved, and excluded records remain inspectable, and automatic suggestions use verified candidate locations.

The published release includes **172 verified library candidates and 38 benefits-assistance sites** across all 24 jurisdictions. Thirty address-correction records retain their evidence; six documented closures and 51 unresolved or excluded locations remain visible. The default Baltimore scenario adds **19,201 represented households** within three modeled road miles. A road-closure example moves 573 represented households beyond the threshold, and reopening restores the original routes and coverage.

| Layer | Responsibility |
| --- | --- |
| Python + DuckDB | Bounded acquisition, statistical transformations, reconciliation, reproducible artifacts |
| Cloudflare D1 + Worker | Published observations, source inspection, parameterized queries, explicit failures |
| React + TypeScript + MapLibre | Neighborhood exploration, comparisons, scenario controls, accessible tables |
| Browser Web Worker | Directed-road coverage and deterministic site suggestions |
| GitHub Actions | Data reproduction, contract checks, tests, and checked deployment |

## An explicit model

Each neighborhood is represented by its Census internal point snapped to an existing motor-road node. The graph preserves shared-node junctions, recorded one-way directions, and motor-vehicle access restrictions. County study areas include surrounding roads to avoid artificial administrative barriers.

The recommendation selects the candidate adding the most previously uncovered represented households, repeats, and breaks ties consistently. Visitors can use total households, households without vehicles, or households without internet as separate scenarios. They can export and replay the exact site choices, closures, distance threshold, and data revisions.

Physarum-inspired route reinforcement makes the assigned routes visible. Its animation follows the calculated demand; pausing it does not change the result. Coverage describes neighborhood points within a modeled road distance. It does not establish household eligibility, attendance, travel time, site capacity, or an optimal deployment plan.

## Follow the evidence

Every displayed observation links to its source, period, universe, transformation, and raw fields. Comparison CSVs retain denominators and margins of error. A printable briefing records the scenario and its assumptions. Reconciliation and release manifests expose the data-quality decisions behind publication.

Application and data releases are checked separately, with a production recovery export retained before rollout. The [repository](https://github.com/goldenmonkeyrnd/civicatlas) contains the runnable setup and verification commands. The [Sentinels lab](/labs/sentinels/) lets visitors inspect the same released structural checker used for the pipeline's declared integration requirements.

The street-graph reduction was checked against the original Baltimore network at one, three, and ten miles, preserving coverage, recommendations, and route distances. Across all jurisdictions, 120 scenario runs checked replay, conservation, alternative measures, additions, and closures. On the demonstration machine, Baltimore's calculation took 701 ms after loading the graph; the slowest county took 1,262 ms. [Recorded qualification evidence](https://github.com/goldenmonkeyrnd/civicatlas/blob/main/data/qualification/simulation.json) separates those engine measurements from browser startup.

The demonstration draws on [Nava Labs' Maryland benefits-access work](https://www.navapbc.com/news/nava-labs-casey-foundation) and [Pratt Library's assistance programs](https://www.prattlibrary.org/services/social-impact-programs/social-worker-in-the-library): a concrete public-service question, supported by inspectable engineering.
