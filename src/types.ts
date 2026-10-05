export interface ActorInput {
  queries: string[];
  maxPagesPerQuery?: number;
  sortBy?: 'relevance' | 'rating' | 'best_selling' | 'newest';
  cookie?: string;
  proxyConfiguration?: Record<string, unknown>;
}

export interface SellerInfo {
  id: string | number | null;
  username: string;
  displayName?: string;
  country?: string;
  avatar?: string;
  level?: string;
  isOnline: boolean;
}

export interface GigPrice {
  amount: number | null;
  currency: string;
  currencySymbol: string;
}

export interface GigRating {
  score: number | null;
  count: number;
}

export interface GigBadges {
  isPro: boolean;
  isChoice: boolean;
}

export interface FiverrGig {
  id: number | string;
  title: string;
  url: string | null;
  searchQuery: string;
  page: number;
  price: GigPrice;
  seller: SellerInfo;
  rating: GigRating;
  badges: GigBadges;
  images: string[];
  scrapedAt: string;
}

export interface ParsedSearchResult {
  totalResults: number;
  resultsCount: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
  results: Omit<FiverrGig, 'searchQuery' | 'page' | 'scrapedAt'>[];
}
