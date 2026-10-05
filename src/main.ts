import { Actor, log } from 'apify';
import { searchFiverr } from './fiverr.js';
import { ActorInput, FiverrGig } from './types.js';

// Auto-load .env if available in development
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile();
  } catch {
    // Ignore if not present
  }
}

await Actor.init();

try {
  const input = (await Actor.getInput<ActorInput>()) || ({} as ActorInput);
  const {
    queries = ['logo design'],
    maxPagesPerQuery = 1,
    sortBy = 'relevance',
    cookie = process.env.FIVERR_COOKIE
  } = input;

  if (!cookie) {
    throw new Error(
      'Missing Fiverr session cookie! Provide "cookie" in Actor input or set "FIVERR_COOKIE" in environment.'
    );
  }

  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error('Please provide at least one search query in "queries".');
  }

  log.info(`Starting Fiverr Search Scraper for ${queries.length} queries...`);

  let totalGigsSaved = 0;

  const allGigs: FiverrGig[] = [];

  for (const query of queries) {
    log.info(`Processing query: "${query}" (max ${maxPagesPerQuery} pages)`);

    for (let page = 1; page <= maxPagesPerQuery; page++) {
      log.info(`Fetching "${query}" - Page ${page}...`);

      try {
        const searchResult = await searchFiverr(query, {
          page,
          sortBy,
          cookie
        });

        if (searchResult.results.length === 0) {
          log.warning(`No gigs found for query "${query}" on page ${page}.`);
          break;
        }

        const now = new Date().toISOString();
        const gigsToPush: FiverrGig[] = searchResult.results.map((gig) => ({
          ...gig,
          searchQuery: query,
          page,
          scrapedAt: now
        }));

        await Actor.pushData(gigsToPush);
        allGigs.push(...gigsToPush);
        totalGigsSaved += gigsToPush.length;

        log.info(
          `Saved ${gigsToPush.length} gigs from page ${page}. Total matching on Fiverr: ${searchResult.totalResults}`
        );

        if (!searchResult.hasMore || page >= searchResult.totalPages) {
          log.info(`Reached end of results for query "${query}".`);
          break;
        }

        // Polite delay between requests
        if (page < maxPagesPerQuery) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err: any) {
        log.error(`Failed to fetch page ${page} for "${query}": ${err.message}`);
        break;
      }
    }
  }

  // Save full results to default OUTPUT key-value store record
  if (allGigs.length > 0) {
    await Actor.setValue('OUTPUT', allGigs);
  }

  log.info(`Fiverr Scraper completed successfully. Total gigs collected: ${totalGigsSaved}`);
} catch (error: any) {
  log.exception(error, 'Actor failed with an error');
} finally {
  await Actor.exit();
}
