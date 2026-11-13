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