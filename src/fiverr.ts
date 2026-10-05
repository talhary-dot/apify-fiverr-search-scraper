import { ParsedSearchResult } from './types.js';

export interface SearchOptions {
  page?: number;
  sortBy?: 'relevance' | 'rating' | 'best_selling' | 'newest';
  cookie?: string;
  timeoutMs?: number;
}

/**
 * Parses raw HTML string from Fiverr search page and extracts gig listings and metadata.
 */
export function parseFiverrHtml(html: string): ParsedSearchResult {
  const scriptMatch = html.match(
    /<script\s+type="application\/json"\s+id="perseus-initial-props">([\s\S]*?)<\/script>/i
  );

  if (!scriptMatch) {
    if (html.includes('Press & Hold') || html.includes('captcha') || html.includes('_px3')) {
      throw new Error(
        'Blocked by Fiverr anti-bot challenge (PerimeterX). Please provide a fresh session cookie.'
      );
    }
    throw new Error('Unable to locate perseus-initial-props in Fiverr search response.');
  }

  const data = JSON.parse(scriptMatch[1]);
  const rawGigs: Record<string, any>[] = data.items || data.rawListingData?.gigs || [];
  const currencyInfo = data.currency || { name: 'USD', symbol: '$' };
  const totalResults = data.rawListingData?.num_found ?? data.tracking?.numberOfResults ?? rawGigs.length;
  const pageSize = data.listingAttributes?.pageSize || 48;
  const hasMore = Boolean(data.rawListingData?.has_more);

  const results = rawGigs.map((item) => {
    const images: string[] = Array.isArray(item.assets)
      ? item.assets
          .filter((asset: any) => asset?.cloud_img_main_gig)
          .map((asset: any) => asset.cloud_img_main_gig)
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
        id: item.sellerId ?? item.seller_id ?? null,
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
 * Searches Fiverr for gigs matching the query and returns structured results.
 */
export async function searchFiverr(
  query: string,
  options: SearchOptions = {}
): Promise<ParsedSearchResult> {
  const {
    page = 1,
    sortBy,
    cookie,
    timeoutMs = 15000
  } = options;

  if (!cookie) {
    throw new Error(
      'Fiverr session cookie is required to bypass anti-bot verification. Please provide it in input or FIVERR_COOKIE.'
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
    throw new Error(`Fiverr HTTP error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseFiverrHtml(html);
}
