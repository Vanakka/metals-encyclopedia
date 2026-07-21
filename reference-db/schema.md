# Assembled element record shape

Each `assembled/elements/{key}.json`:

```json
{
  "key": "lithium",
  "name": "Lithium",
  "symbol": "Li",
  "atomicNumber": 3,
  "fetchedAt": "ISO-8601",
  "sources": {
    "pubchemCsv": { "...row fields..." },
    "pubchemPug": { "...raw JSON or error..." },
    "wikipedia": { "title", "extract", "content_urls", "..." },
    "usgs": { "chapter": "mcs2025-lithium.txt", "text": "...", "url": "..." },
    "rsc": { "appearance", "uses", "naturalAbundance", "biologicalRole", "url" }
  }
}
```

Missing source → `null` or `{ "ok": false, "error": "..." }`.
Wikipedia is Tier 3 — for comparison / leads only, not as sole app truth.
