# Fiverr Search & Gigs Scraper (Apify Actor)

A TypeScript-based Apify Actor that searches and extracts gigs from [Fiverr](https://www.fiverr.com). It extracts complete gig metadata, pricing tiers, seller profile details, reviews/ratings, and high-resolution gig image assets directly from Fiverr's server-rendered payload.

## Features

- **Multi-query search**: Scrape multiple keywords in a single run.
- **Deep gig details**:
  - **Gig Information**: Gig ID, title, full Fiverr gig URL, slug.
  - **Pricing**: Starting package price, currency code and symbol.
  - **Seller Information**: Seller ID, username, display name, country, level badge, avatar URL, online status.
  - **Ratings & Reviews**: Average review score, total review count.
  - **Badges**: Fiverr Pro, Fiverr's Choice.
  - **Media**: Direct links to all high-resolution gig preview images.
- **Pagination support**: Scrape 1 to multiple pages (48 gigs per page).
- **Sorting options**: Sort by Relevance, Top Rated, Best Selling, or Newest.

---

## Input Configuration

The Actor accepts input in JSON format:

```json
{
  "queries": ["logo design", "wordpress developer"],
  "maxPagesPerQuery": 2,
  "sortBy": "relevance",
  "cookie": "u_guid=...; _px3=...;"
}
```

### Parameters

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `queries` | `Array<string>` | Yes | `["logo design"]` | Search terms or keywords to query. |
| `maxPagesPerQuery` | `number` | No | `1` | Maximum pages to scrape per query (48 gigs/page). |
| `sortBy` | `string` | No | `"relevance"` | Sort results: `relevance`, `rating`, `best_selling`, `newest`. |
| `cookie` | `string` | No | `process.env.FIVERR_COOKIE` | Browser session cookie from Fiverr to bypass bot challenges. |

---

## Output Data Structure

Each scraped gig is saved as an item in the Apify default dataset:

```json
{
  "id": 210867357,
  "title": "design a modern minimalist business logo",
  "url": "https://www.fiverr.com/mac_logos/create-modern-minimalist-business-logo-design-in-24-hrs",
  "searchQuery": "logo design",
  "page": 1,
  "price": {
    "amount": 20,
    "currency": "USD",
    "currencySymbol": "$"
  },
  "seller": {
    "id": "55437072",
    "username": "mac_logos",
    "displayName": "Mac",
    "country": "US",
    "avatar": "https://fiverr-res.cloudinary.com/...",
    "level": "level_two_seller",
    "isOnline": true
  },
  "rating": {
    "score": 4.9,
    "count": 389
  },
  "badges": {
    "isPro": false,
    "isChoice": false
  },
  "images": [
    "https://fiverr-res.cloudinary.com/t_main1,q_auto,f_auto/gigs/..."
  ],
  "scrapedAt": "2026-10-05T12:00:00.000Z"
}
```

---

## Getting the Session Cookie

Fiverr employs anti-bot protection (PerimeterX). To ensure seamless scraping:
1. Open [fiverr.com](https://www.fiverr.com) in your browser.
2. Open DevTools (`F12`) -> Network tab.
3. Search for any term on Fiverr.
4. Right-click the search request (`gigs?query=...`) -> **Copy as cURL** or copy the `Cookie` header.
5. Provide this cookie in the Actor input or in your `.env` file as `FIVERR_COOKIE`.

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `FIVERR_COOKIE`:
   ```bash
   FIVERR_COOKIE="u_guid=...; _px3=...;"
   ```

3. Build and run:
   ```bash
   npm run build
   npm start
   ```

Or run in development mode with `tsx`:
   ```bash
   npm run start:dev
   ```

---

## Deploy to Apify

You can push this repository directly to Apify using the [Apify CLI](https://docs.apify.com/cli):

```bash
apify login
apify push
```
Or link this GitHub repository directly to an Actor on Apify Console.
