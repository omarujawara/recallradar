import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlist } from '@/hooks/useWatchlist';
import { COMMON_ALLERGENS, WATCH_ITEM_TYPES } from '@/constants';

function matchCountText(count) {
  if (count === 0) return 'No matching recalls';
  return `${count} matching ${count === 1 ? 'recall' : 'recalls'}`;
}

export default function Watchlist() {
  const { isBusiness } = useAuth();
  const { items, loading, error, addItem, removeItem } = useWatchlist();

  const [itemType, setItemType] = useState('allergen');
  const [term, setTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'success' | 'error', text }

  const types = WATCH_ITEM_TYPES.filter((type) => isBusiness || !type.businessOnly);
  const currentType = types.find((type) => type.value === itemType) ?? types[0];
  const typeLabel = (value) => WATCH_ITEM_TYPES.find((type) => type.value === value)?.label ?? value;

  const watchedAllergens = new Set(
    items.filter((item) => item.item_type === 'allergen').map((item) => item.term.toLowerCase()),
  );
  const allergenSuggestions = COMMON_ALLERGENS.filter((allergen) => !watchedAllergens.has(allergen));

  async function add(type, rawTerm) {
    const value = rawTerm.trim();
    if (!value) return;

    setSubmitting(true);
    setMessage(null);
    const { item, error: addError } = await addItem({ itemType: type, term: value });
    setSubmitting(false);

    if (addError) {
      setMessage({ kind: 'error', text: addError });
      return;
    }

    const count = item?.matchCount ?? 0;
    setMessage({
      kind: 'success',
      text:
        count === 0
          ? `“${value}” added. No recalls match right now.`
          : `“${value}” added. ${count} ${count === 1 ? 'recall matches' : 'recalls match'}.`,
    });
    setTerm('');
  }

  async function remove(item) {
    setMessage(null);
    const { error: removeError } = await removeItem(item.id);
    setMessage(
      removeError
        ? { kind: 'error', text: removeError }
        : { kind: 'success', text: `“${item.term}” removed.` },
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    add(currentType.value, term);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
      <p className="mt-2 text-muted-foreground">
        Add what you want to watch for. RecallRadar finds every recall that mentions it.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="item-type">Type</Label>
            <Select value={currentType.value} onValueChange={setItemType}>
              <SelectTrigger id="item-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-term">{currentType.label}</Label>
            <Input
              id="item-term"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={currentType.placeholder}
              required
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add to watchlist'}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{currentType.hint}</p>

        {currentType.value === 'allergen' && allergenSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Common allergens:</span>
            {allergenSuggestions.map((allergen) => (
              <Button
                key={allergen}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full"
                disabled={submitting}
                onClick={() => add('allergen', allergen)}
              >
                {allergen}
              </Button>
            ))}
          </div>
        )}
      </form>

      <p
        role="status"
        aria-live="polite"
        className={`mt-4 min-h-5 text-sm ${message?.kind === 'error' ? 'text-destructive' : ''}`}
      >
        {message?.text}
      </p>

      <section aria-labelledby="watching-heading" className="mt-6">
        <h2 id="watching-heading" className="border-b pb-3 text-base font-medium">
          Watching {items.length > 0 && `(${items.length})`}
        </h2>

        {loading && (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {error && <p className="mt-4 text-destructive">Your watchlist couldn’t be loaded. Refresh the page to try again.</p>}

        {!loading && !error && items.length === 0 && (
          <p className="mt-4 max-w-prose text-muted-foreground">
            Your watchlist is empty. Add an allergen, brand, or product above to see the recalls that match.
          </p>
        )}

        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.term}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabel(item.item_type)}, {matchCountText(item.matchCount).toLowerCase()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(item)}
                aria-label={`Remove ${item.term} from watchlist`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}