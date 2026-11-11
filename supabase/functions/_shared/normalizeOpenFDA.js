const SOURCE_BY_PRODUCT_TYPE = {
  Food: 'openfda_food',
  Drugs: 'openfda_drug',
  Devices: 'openfda_device',
};

const STATUSES = new Set(['Ongoing', 'Completed', 'Terminated', 'Pending']);
const CLASSIFICATIONS = new Set(['Class I', 'Class II', 'Class III', 'Not Yet Classified']);

const STATE_NAMES = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC', 'Puerto Rico': 'PR',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));
// Longest names first so "West Virginia" is consumed before "Virginia"
const NAMES_LONGEST_FIRST = Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length);

/** Turn "", "N/A", whitespace into null. */
function clean(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === '' || /^n\/?a$/i.test(s)) return null;
  return s;
}

/** "20261102" -> "2026-11-02", or null if missing/invalid. */
function toDate(value) {
  const s = clean(value);
  if (!s || !/^\d{8}$/.test(s)) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}

/** "FL, GA. NC, and TN" -> { isNationwide: false, states: ['FL','GA','NC','TN'] } */
export function parseDistribution(text) {
  const t = clean(text);
  if (!t) return { isNationwide: false, states: [] };

  const isNationwide =
    /nation\s*-?\s*wide|all\s+(50\s+)?states|throughout\s+the\s+(u\.?s\.?a?\.?|united\s+states)/i.test(t);

  const states = new Set();
  let rest = t;

  for (const name of NAMES_LONGEST_FIRST) {
    const re = new RegExp(`\\b${name}\\b`, 'gi');
    if (re.test(rest)) {
      states.add(STATE_NAMES[name]);
      rest = rest.replace(re, ' ');
    }
  }

  for (const match of rest.matchAll(/\b[A-Z]{2}\b/g)) {
    if (STATE_CODES.has(match[0])) states.add(match[0]);
  }

  return { isNationwide, states: [...states] };
}

/**
 * Convert one raw openFDA record into a public.recalls row plus its states.
 * Returns { error } instead if the record can't be stored.
 */
export function normalizeRecall(raw, { syncRunId, syncedAt }) {
  const recallNumber = clean(raw.recall_number);
  const status = clean(raw.status);
  const classification = clean(raw.classification);
  const productType = clean(raw.product_type);
  const description = clean(raw.product_description);

  if (!recallNumber) return { error: 'missing recall_number' };
  if (!STATUSES.has(status)) return { error: `${recallNumber}: unknown status "${raw.status}"` };
  if (!description) return { error: `${recallNumber}: missing product_description` };

  const { isNationwide, states } = parseDistribution(raw.distribution_pattern);

  return {
    recall: {
      source: SOURCE_BY_PRODUCT_TYPE[productType] ?? 'openfda_food',
      recall_number: recallNumber,
      event_id: clean(raw.event_id),
      status,
      classification: CLASSIFICATIONS.has(classification) ? classification : null,
      product_type: productType,
      product_description: description,
      product_quantity: clean(raw.product_quantity),
      code_info: clean(raw.code_info),
      reason_for_recall: clean(raw.reason_for_recall),
      recalling_firm: clean(raw.recalling_firm),
      address_1: clean(raw.address_1),
      city: clean(raw.city),
      state: clean(raw.state),
      postal_code: clean(raw.postal_code),
      country: clean(raw.country),
      voluntary_mandated: clean(raw.voluntary_mandated),
      initial_firm_notification: clean(raw.initial_firm_notification),
      distribution_pattern: clean(raw.distribution_pattern),
      is_nationwide: isNationwide,
      recall_initiation_date: toDate(raw.recall_initiation_date),
      center_classification_date: toDate(raw.center_classification_date),
      report_date: toDate(raw.report_date),
      termination_date: toDate(raw.termination_date),
      openfda: raw.openfda ?? {},
      raw,
      last_sync_run_id: syncRunId,
      last_synced_at: syncedAt,
      // Not sent on purpose: id, search_vector (generated), first_seen_at (default on insert only), updated_at (trigger)
    },
    states,
  };
}