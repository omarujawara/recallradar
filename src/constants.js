export const ACTIVE_STATUSES = ['Ongoing', 'Pending'];
export const CLOSED_STATUSES = ['Completed', 'Terminated'];

export const STATUS_FILTERS = [
    { value: 'active', label: 'Active' },
    { value: 'all', label: 'All' },
    { value: 'closed', label: 'Closed' },
];

// Plain-language labels for FDA classifications
export const CLASSIFICATION_INFO = {
    'Class I': {
        label: 'Serious risk',
        description: 'FDA Class I: Could cause serious health problems or death.',
    },
    'Class II': {
        label: 'Moderate risk',
        description: 'FDA Class II: Could cause temporary or treatable health problems.',
    },
    'Class III': {
        label: 'Low risk',
        description: 'FDA Class III: unlikely to cause health problems.',
    },
    'Not Yet Classified': {
        label: 'Not yet rated',
        description: 'The FDA has not classified this recall yet.',
    },
};

export const EXAMPLE_SEARCHES = ['peanut', 'Listeria', 'Salmonella', 'milk'];

export const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'grocery', label: 'Grocery store' },
  { value: 'cafe', label: 'Café or bakery' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'other', label: 'Other' },
];

export const WATCH_ITEM_TYPES = [
  { value: 'allergen', label: 'Allergen', hint: 'An ingredient you need to avoid, like peanut or milk.', placeholder: 'peanut' },
  { value: 'brand', label: 'Brand', hint: 'A brand name printed on the package.', placeholder: 'Brand name' },
  { value: 'product', label: 'Product', hint: 'A kind of food, like ice cream or spinach.', placeholder: 'ice cream' },
  { value: 'keyword', label: 'Keyword', hint: 'Any word or phrase, like Listeria.', placeholder: 'Listeria' },
  { value: 'vendor', label: 'Supplier', hint: 'A company you buy from.', placeholder: 'Supplier name', businessOnly: true },
  { value: 'lot_upc', label: 'Lot or UPC', hint: 'A lot number or UPC exactly as printed on the package.', placeholder: '632687615989', businessOnly: true },
];

// The nine major U.S. food allergens, as search terms
export const COMMON_ALLERGENS = ['milk', 'egg', 'fish', 'shellfish', 'tree nut', 'peanut', 'wheat', 'soy', 'sesame'];

// Where in the recall a watchlist term was found
export const MATCHED_FIELD_LABELS = {
  reason_for_recall: 'the reason for recall',
  product_description: 'the product description',
  recalling_firm: 'the company name',
  code_info: 'the package codes',
  distribution_pattern: 'the distribution area',
};