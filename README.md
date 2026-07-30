# MapMint by Nivaro

A Nivaro prospecting tool that discovers niche businesses through open-web
search, checks public business websites for phone numbers and emails, preserves
source provenance, removes duplicates, and exports clean CSV files.

## Safety model

- No paid proxy or scraping infrastructure
- Server-side API key (never sent to the browser)
- Maximum 20 discovery results per run
- No photos or full reviews
- Local result caching and URL deduplication
- One Brave Search request per run to preserve the monthly free credit

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add a Brave Search API key to `BRAVE_SEARCH_API_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

Without a key, the application explains that open-web discovery is not connected
and does not show fabricated results.
