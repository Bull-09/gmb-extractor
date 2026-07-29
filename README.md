# MapMint by Nivaro

A Nivaro internal free-only Google Business lead extractor built around the
official Google Places API. MapMint runs searches, removes duplicate Place IDs,
caches results on the user's device, and exports clean CSV files.

## Safety model

- No paid proxy or scraping infrastructure
- Server-side API key (never sent to the browser)
- Maximum 60 results per run
- No photos or full reviews
- Local result caching and Place ID deduplication
- Google Cloud quota recommended as the definitive billing hard stop

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add a Google Places API key to `GOOGLE_PLACES_API_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

Without a key, the application uses clearly labelled sample results so the
interface can still be evaluated.
