import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import RecallSearch from '@/components/recall/RecallSearch';
import { useAuth } from '@/hooks/useAuth';

export default function Landing() {
  const { user } = useAuth();

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:pt-24">
        <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Has something you bought been recalled?
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Search U.S. FDA food recalls by product, brand, company, or ingredient. No account needed.
        </p>
        <RecallSearch className="mt-8" />
      </section>

      {!user && (
        <section className="border-t bg-muted/40">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight">Get told when a recall affects you</h2>
              <p className="mt-3 text-muted-foreground">
                Add the allergens, brands, and products you care about. RecallRadar shows every recall that
                matches, explains why it matched, and lets you know when one is resolved.
              </p>
              <p className="mt-2 text-muted-foreground">
                Running a restaurant or store? Track your suppliers and lot numbers too.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        </section>
      )}
    </>
  );
}