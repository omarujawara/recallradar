import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ClassBadge from '@/components/recall/ClassBadge';
import StatusBadge from '@/components/recall/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { useRecall } from '@/hooks/useRecalls';
import { useRecallMatches } from '@/hooks/useMatches';
import { ACTIVE_STATUSES, CLASSIFICATION_INFO } from '@/constants';
import { formatDate, truncate } from '@/utils/format';

function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();

  // If they came from inside the app, go back to their search results
  if (location.key !== 'default') {
    return (
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => navigate(-1)}>
        <ArrowLeft aria-hidden="true" /> Back
      </Button>
    );
  }
  // Opened directly (shared link, new tab)
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3">
      <Link to="/">
        <ArrowLeft aria-hidden="true" /> Search recalls
      </Link>
    </Button>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t py-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 max-w-prose space-y-2">{children}</div>
    </section>
  );
}

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export default function RecallDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { recall, loading, notFound } = useRecall(id);
  const matches = useRecallMatches(recall?.id);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">This recall couldn’t be found</h1>
        <p className="mt-3 text-muted-foreground">The link may be out of date or mistyped.</p>
        <Button asChild className="mt-6">
          <Link to="/">Search recalls</Link>
        </Button>
      </div>
    );
  }

  const isActive = ACTIVE_STATUSES.includes(recall.status);
  const classInfo = CLASSIFICATION_INFO[recall.classification] ?? CLASSIFICATION_INFO['Not Yet Classified'];
  const states = recall.recall_distribution_states.map((row) => row.state_code).sort();
  const companyLocation = [recall.city, recall.state].filter(Boolean).join(', ');

  let soldIn = 'The FDA report doesn’t list specific states.';
  if (recall.is_nationwide) soldIn = 'Sold nationwide.';
  else if (states.length > 0) soldIn = `Sold in ${states.join(', ')}.`;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <BackLink />

      <header className="mt-4 pb-6">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={recall.status} />
          <ClassBadge classification={recall.classification} />
        </div>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight">
          {truncate(recall.product_description, 120)}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {recall.recalling_firm ?? 'Company not listed'}, reported {formatDate(recall.report_date)}
        </p>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4">
          <p className="font-medium">
            {isActive ? 'This recall is active.' : 'This recall is closed.'}
          </p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {isActive
              ? 'If you have this product, don’t eat or serve it. Compare the codes below with your package, then throw it away or return it to the store.'
              : `The FDA closed this recall${recall.termination_date ? ` on ${formatDate(recall.termination_date)}` : ''}. If you still have an older package, compare it with the codes below.`}
          </p>
        </div>

        {matches.length > 0 && (
          <div className="mt-3 rounded-lg border border-primary/40 p-4">
            <p className="font-medium">This recall matches your watchlist</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {matches.map((match) => (
                <li key={match.id}>{match.match_reason}</li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <Section title="Why it was recalled">
        <p>{recall.reason_for_recall ?? 'The FDA report doesn’t give a reason.'}</p>
        <p className="text-sm text-muted-foreground">{classInfo.description}</p>
      </Section>

      <Section title="Which product">
        <p>{recall.product_description}</p>
        {recall.product_quantity && (
          <p className="text-sm text-muted-foreground">Amount recalled: {recall.product_quantity}</p>
        )}
      </Section>

      <Section title="Codes to check on your package">
        {recall.code_info ? (
          <p className="whitespace-pre-wrap break-words">{recall.code_info}</p>
        ) : (
          <p>The FDA report doesn’t list lot numbers or UPCs for this recall.</p>
        )}
      </Section>

      <Section title="Where it was sold">
        <p>{soldIn}</p>
        {recall.distribution_pattern && (
          <p className="text-sm text-muted-foreground">FDA report: “{recall.distribution_pattern}”</p>
        )}
      </Section>

      <Section title="Recall details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Company">
            {recall.recalling_firm}
            {companyLocation && `, ${companyLocation}`}
          </Detail>
          <Detail label="FDA recall number">{recall.recall_number}</Detail>
          <Detail label="Recall started">
            {recall.recall_initiation_date && formatDate(recall.recall_initiation_date)}
          </Detail>
          <Detail label="Reported by FDA">{recall.report_date && formatDate(recall.report_date)}</Detail>
          <Detail label="FDA status">{recall.status}</Detail>
          <Detail label="FDA classification">{recall.classification}</Detail>
          <Detail label="Closed">{recall.termination_date && formatDate(recall.termination_date)}</Detail>
          <Detail label="Recall type">{recall.voluntary_mandated}</Detail>
        </dl>
      </Section>

      {!user && (
        <section className="border-t py-6">
          <p className="max-w-prose text-muted-foreground">
            Create an account to see recalls that match your allergens, brands, and suppliers.
          </p>
          <Button asChild className="mt-3">
            <Link to="/signup">Create account</Link>
          </Button>
        </section>
      )}
    </article>
  );
}