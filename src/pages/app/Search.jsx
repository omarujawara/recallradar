import RecallSearch from '@/components/recall/RecallSearch';

export default function Search() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Search recalls</h1>
      <p className="mt-2 text-muted-foreground">
        Search every FDA food recall by product, brand, company, or ingredient.
      </p>
      <RecallSearch className="mt-6" />
    </div>
  );
}