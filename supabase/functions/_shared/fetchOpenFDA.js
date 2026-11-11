const ENDPOINTS = {
  food: 'https://api.fda.gov/food/enforcement.json',
  drug: 'https://api.fda.gov/drug/enforcement.json',
  device: 'https://api.fda.gov/device/enforcement.json',
};

export const MAX_PAGE_SIZE = 1000; // openFDA max per request
export const MAX_SKIP = 25000;     // openFDA max skip

/**
 * Build an openFDA search string.
 * Dates are YYYYMMDD strings. Omit status to get every status.
 */
export function buildSearch({ status, from, to } = {}) {
  const parts = [];
  if (status) parts.push(`status:"${status}"`);
  if (from || to) parts.push(`report_date:[${from ?? '20040101'} TO ${to ?? '20991231'}]`);
  return parts.join(' AND ');
}

/**
 * Fetch one page. Always returns { meta, results } with raw (not normalized) records.
 */
export async function fetchOpenFDAPage({
  productType = 'food',
  search,
  limit = 100,
  skip = 0,
  apiKey,
} = {}) {
  const baseUrl = ENDPOINTS[productType];
  if (!baseUrl) throw new Error(`Unknown product type: ${productType}`);

  const params = new URLSearchParams({
    sort: 'report_date:desc',
    limit: String(Math.min(limit, MAX_PAGE_SIZE)),
    skip: String(skip),
  });
  if (search) params.set('search', search);
  if (apiKey) params.set('api_key', apiKey);

  const response = await fetch(`${baseUrl}?${params}`);

  // openFDA returns 404 (not an empty list) when nothing matches
  if (response.status === 404) return { meta: null, results: [] };

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`openFDA request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  return { meta: data.meta, results: data.results ?? [] };
}

/**
 * Yield pages until there are no more results or maxRecords is reached.
 */
export async function* fetchAllOpenFDA({
  productType = 'food',
  search,
  maxRecords = 5000,
  pageSize = MAX_PAGE_SIZE,
  apiKey,
} = {}) {
  let skip = 0;
  while (skip < maxRecords && skip <= MAX_SKIP) {
    const limit = Math.min(pageSize, maxRecords - skip);
    const page = await fetchOpenFDAPage({ productType, search, limit, skip, apiKey });
    if (page.results.length === 0) return;
    yield page;
    skip += page.results.length;
    if (page.results.length < limit) return; // last page
  }
}

// Self-Invoking Async Function to test outputs
// (async () => {
//   console.log("Starting script...");
//   const result = await fetchAllOpenFDA();
//   console.log(result.results);
// })();