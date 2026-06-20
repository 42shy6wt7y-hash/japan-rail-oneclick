# Japan Rail OneClick Assistant

A no-server Japanese rail itinerary planner and official booking-page assistant prototype.

## What changed

The planner is now data-driven instead of relying only on hand-written example routes.
It imports Japan MLIT National Land Numerical Information railway data (N02, 2022) and generates a browser-loadable station and rail network:

- 9,000+ station groups
- 9,000+ adjacent rail edges
- station aliases for common Chinese / Japanese / English inputs
- transfer grouping by official booking channel where known

This fixes the core architectural problem: station recognition and basic routing are no longer a tiny demo list.

## Important limits

This project still does not provide live train times, live seat availability, exact fares, or automatic payment/ticketing.
Final booking and payment must happen on official rail-company pages.

The MLIT N02 dataset is useful for national station and railway topology, but it is not a timetable or ticketing API.
Long-distance limited-express and Shinkansen services may need additional service-pattern data for production-grade routing.

## Local Use

```bash
node scripts/serve.mjs
```

Open:

```text
http://localhost:4173
```

You can also load the project root as an unpacked Chrome / Edge extension. The extension shows a Chinese booking-task overlay on supported official railway pages.

## Data Import

Download and unzip MLIT N02 railway data, then run:

```bash
node scripts/import-mlit-n02.mjs work/n02/N02-22/UTF-8/N02-22_Station.geojson js/generated/rail-network.generated.js
```

The generated file is committed so the app works without a server.

Official MLIT source:

https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v3_1.html

## Tests

```bash
node --test tests\engine.test.js
```

## Booking Channels

Known online booking channels are mapped conservatively:

- Smart EX
- JR-EAST Train Reservation
- JR-WEST ONLINE TRAIN RESERVATION
- JR KYUSHU
- JR Hokkaido
- JR-CENTRAL informational fallback

Unknown operators fall back to manual official confirmation.
