# Ethan's Hangar

A tracker for a die-cast model aircraft collection, built with Next.js for Vercel.

- **Hangar** – a featured plane that changes on every visit, with real-aircraft specs and facts, plus collection stats.
- **Collection** – grid or sortable list of every plane, with per-plane notes, price paid, own photos, market price and price history.
- **Museum** – a 3D hall where every plane sits on a plinth with a plaque. Models are generated from the aircraft type and airline colours.
- **Catalogue** – about 3,650 models from GeminiJets, JC Wings, NG Models, Aviation 400, InFlight200, Herpa Wings, Phoenix Models and AeroClassics, with photos and retailer prices.
- **Add a plane** – pick a manufacturer and type to search, identify a plane from a photo (Claude Opus 5.5), or enter it by hand.

## Deploying to Vercel

1. Import this repository as a new Vercel project (framework preset: Next.js).
2. In the project's **Storage** tab, create a **Blob** store and connect it. This adds `BLOB_READ_WRITE_TOKEN`.
3. In **Settings → Environment Variables** add `ANTHROPIC_API_KEY` (for photo identification) and, ideally, `SITE_PASSCODE` and `CRON_SECRET`. See `.env.example`.
4. Redeploy.

Without a passcode anyone who knows the address can change the collection and use the Anthropic key, so setting `SITE_PASSCODE` is strongly recommended.

## Where things are stored

| What | Where |
| --- | --- |
| Catalogue (models, specs, prices at build time) | `data/catalog.json` in this repo |
| Catalogue photos | `public/catalog/*.webp` in this repo |
| Collection, notes, prices paid, display currency | Vercel Blob (`planetracker/collection-*.json`, newest wins, last 8 kept as backups) |
| Ethan's own photos | Vercel Blob (`planetracker/photos/`), linked to the plane model |
| Price history | Vercel Blob, updated daily by the cron job in `vercel.json` |

Notes are stored only on the collection entry. Own photos are stored against the model, so they also show in the catalogue.

## Prices

Airplane Model SG is the preferred price source; Aviation Retail Direct (GBP) and The Airplane Shop (USD) fill in the rest.
Everything is shown in the display currency chosen in the header, converted with daily European Central Bank reference rates.
A daily job re-reads Airplane Model SG prices for the planes in the collection and records changes.

## Refreshing the catalogue

```bash
python3 scripts/build_catalog.py --fetch
```

```bash
python3 scripts/fetch_images.py
```

```bash
python3 scripts/build_catalog.py
```

The first command downloads the retailer feeds, the second stores new photos (needs Pillow), the third points the records at the local photos. Commit `data/` and `public/catalog/` afterwards.

## Local development

```bash
npm install
```

```bash
npm run dev
```

Without `BLOB_READ_WRITE_TOKEN` the collection is kept in `./.data`.
