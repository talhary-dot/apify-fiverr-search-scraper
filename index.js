import fs from 'fs';
import http from 'http';

// Load .env automatically if present in Node 20.6+
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (err) {
    // .env might not exist or already loaded
  }
}

/**
 * Parse raw Fiverr HTML and extract gigs and metadata.
 * @param {string} html - HTML string from Fiverr search page
 * @returns {object} Extracted search payload
 */
export function parseFiverrHtml(html) {
  const scriptMatch = html.match(
    /<script\s+type="application\/json"\s+id="perseus-initial-props">([\s\S]*?)<\/script>/i
  );

  if (!scriptMatch) {
    if (html.includes('Press & Hold') || html.includes('captcha') || html.includes('_px3')) {
      throw new Error(
        'Blocked by Fiverr anti-bot challenge (PerimeterX). Please refresh FIVERR_COOKIE in your .env file.'
      );
    }
    throw new Error('Unable to find perseus-initial-props payload in Fiverr HTML response.');
  }

  const data = JSON.parse(scriptMatch[1]);
  const rawGigs = data.items || data.rawListingData?.gigs || [];
  const currencyInfo = data.currency || { name: 'USD', symbol: '$' };
  const totalResults = data.rawListingData?.num_found ?? data.tracking?.numberOfResults ?? rawGigs.length;
  const pageSize = data.listingAttributes?.pageSize || 48;
  const hasMore = Boolean(data.rawListingData?.has_more);

  const results = rawGigs.map((item) => {
    const images = Array.isArray(item.assets)
      ? item.assets
          .filter((asset) => asset.cloud_img_main_gig)
          .map((asset) => asset.cloud_img_main_gig)
      : [];

    const price = item.price_i ?? item.packages?.recommended?.price ?? null;
    const gigUrl = item.gig_url
      ? `https://www.fiverr.com${item.gig_url}`
      : item.cached_slug
      ? `https://www.fiverr.com/${item.seller_name}/${item.cached_slug}`
      : null;

    return {
      id: item.gigId ?? item.gig_id,
      title: item.title,
      url: gigUrl,
      price: {
        amount: price,
        currency: currencyInfo.name,
        currencySymbol: currencyInfo.symbol
      },
      seller: {
        id: item.sellerId ?? item.seller_id,
        username: item.seller_name,
        displayName: item.seller_display_name,
        country: item.seller_country,
        avatar: item.seller_img,
        level: item.seller_level,
        isOnline: Boolean(item.seller_online)
      },
      rating: {
        score: item.buying_review_rating ?? item.seller_rating?.score ?? null,
        count: item.buying_review_rating_count ?? item.seller_rating?.count ?? 0
      },
      badges: {
        isPro: Boolean(item.is_pro),
        isChoice: Boolean(item.is_fiverr_choice)
      },
      images
    };
  });

  return {
    totalResults,
    resultsCount: results.length,
    pageSize,
    totalPages: totalResults ? Math.ceil(totalResults / pageSize) : 1,
    hasMore,
    results
  };
}

/**
 * Perform a live search on Fiverr.
 * @param {string} query - The search query (e.g. "logo design")
 * @param {object} [options] - Additional search options
 * @param {number} [options.page=1] - Page number
 * @param {string} [options.sortBy] - Sort order ('relevance', 'rating', 'best_selling', 'newest')
 * @param {string} [options.cookie] - Custom cookie string (defaults to FIVERR_COOKIE env variable)
 * @param {number} [options.timeoutMs=15000] - Request timeout in milliseconds
 * @returns {Promise<object>}
 */
export async function searchFiverr(query, options = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Search query is required.');
  }

  const {
    page = 1,
    sortBy,
    cookie = process.env.FIVERR_COOKIE,
    timeoutMs = 15000
  } = options;

  if (!cookie) {
    throw new Error(
      'FIVERR_COOKIE is not defined. Please add FIVERR_COOKIE to your .env file or pass it in options.'
    );
  }

  const url = new URL('https://www.fiverr.com/search/gigs');
  url.searchParams.set('query', query.trim());
  url.searchParams.set('source', 'main_banner');
  url.searchParams.set('search_in', 'everywhere');
  url.searchParams.set('search-autocomplete-original-term', query.trim());

  if (page > 1) {
    url.searchParams.set('page', String(page));
  }

  if (sortBy) {
    url.searchParams.set('sort_by', sortBy);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'priority': 'u=0, i',
      'upgrade-insecure-requests': '1',
      'referer': 'https://www.fiverr.com/',
      'cookie': cookie
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Fiverr request failed with status: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const parsed = parseFiverrHtml(html);

  return {
    query: query.trim(),
    page: Number(page),
    ...parsed
  };
}

/**
 * Start a lightweight HTTP API server.
 * @param {number} port
 */
export function startApiServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (parsedUrl.pathname === '/api/search') {
      const q = parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query');
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const sortBy = parsedUrl.searchParams.get('sort_by') || undefined;

      if (!q) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required query parameter "q" or "query"' }));
        return;
      }

      try {
        const data = await searchFiverr(q, { page, sortBy });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        endpoint: '/api/search?q=<query>&page=<page>',
        example: '/api/search?q=logo+design&page=1'
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`Fiverr Search API running at http://localhost:${port}`);
    console.log(`Try: http://localhost:${port}/api/search?q=logo+design`);
  });

  return server;
}

// CLI / Standalone execution
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const args = process.argv.slice(2);

  if (args.includes('--server')) {
    const portIndex = args.indexOf('--server') + 1;
    const port = parseInt(args[portIndex], 10) || 3000;
    startApiServer(port);
  } else {
    const query = args[0] || 'logo design';
    const page = parseInt(args[1] || '1', 10);

    console.log(`Searching Fiverr for: "${query}" (page ${page})...`);
    searchFiverr(query, { page })
      .then((data) => {
        console.log(`\nFound ${data.totalResults} total results (${data.resultsCount} on page ${data.page}/${data.totalPages}):\n`);
        data.results.slice(0, 5).forEach((gig, idx) => {
          console.log(`${idx + 1}. [${gig.price.currencySymbol}${gig.price.amount}] ${gig.title}`);
          console.log(`   Seller: ${gig.seller.name || gig.seller.username} (@${gig.seller.username}) | Rating: ${gig.rating.score || 'N/A'} (${gig.rating.count} reviews)`);
          console.log(`   Link: ${gig.url}`);
          console.log('');
        });

        // Save latest search result to search_result.json
        fs.writeFileSync('search_result.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Full response saved to search_result.json');
      })
      .catch((err) => {
        console.error('Search failed:', err.message);
      });
  }
}