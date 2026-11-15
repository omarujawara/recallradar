import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { CLASSIFICATION_OPTIONS, CLOSED_STATUSES, RECALL_STATUS_OPTIONS } from '@/constants';

const FORM_COLUMNS =
  'id, source, recall_number, product_description, recalling_firm, reason_for_recall, status, classification, code_info, distribution_pattern, is_nationwide, report_date, termination_date';

// Today as YYYY-MM-DD in the admin's own time zone
const today = () => new Date().toLocaleDateString('en-CA');

function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function RecallForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(() => ({
    product_description: '',
    recalling_firm: '',
    reason_for_recall: '',
    status: 'Ongoing',
    classification: 'Not Yet Classified',
    code_info: '',
    distribution_pattern: '',
    is_nationwide: false,
    report_date: today(),
  }));
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Editing: load the recall into the form
  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;

    supabase
      .from('recalls')
      .select(FORM_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (ignore) return;
        if (loadError || !data) {
          setNotFound(true);
        } else {
          setExisting(data);
          setForm({
            product_description: data.product_description ?? '',
            recalling_firm: data.recalling_firm ?? '',
            reason_for_recall: data.reason_for_recall ?? '',
            status: data.status,
            classification: data.classification ?? 'Not Yet Classified',
            code_info: data.code_info ?? '',
            distribution_pattern: data.distribution_pattern ?? '',
            is_nationwide: data.is_nationwide,
            report_date: data.report_date ?? '',
          });
        }
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [id, isEdit]);

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setValue = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const isClosed = CLOSED_STATUSES.includes(form.status);
    const payload = {
      product_description: form.product_description.trim(),
      recalling_firm: form.recalling_firm.trim() || null,
      reason_for_recall: form.reason_for_recall.trim() || null,
      status: form.status,
      classification: form.classification,
      code_info: form.code_info.trim() || null,
      distribution_pattern: form.distribution_pattern.trim() || null,
      is_nationwide: form.is_nationwide,
      report_date: form.report_date || null,
      // Closing a recall stamps today's date; reopening clears it
      termination_date: isClosed ? (existing?.termination_date ?? today()) : null,
    };

    const request = isEdit
      ? supabase.from('recalls').update(payload).eq('id', id)
      : supabase.from('recalls').insert({
          ...payload,
          source: 'manual',
          recall_initiation_date: form.report_date || today(),
        });

    const { error: saveError } = await request;
    if (saveError) {
      console.error('Failed to save recall:', saveError.message);
      setError('The recall couldn’t be saved. Check the fields and try again.');
      setSaving(false);
      return;
    }

    navigate('/admin/recalls', { state: { message: isEdit ? 'Recall saved.' : 'Recall added.' } });
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">This recall couldn’t be found</h1>
        <Button asChild className="mt-6">
          <Link to="/admin/recalls">Back to recalls</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit recall' : 'Add recall'}</h1>
      {existing && (
        <p className="mt-2 text-sm text-muted-foreground">
          {existing.source === 'manual'
            ? 'Added by an admin.'
            : `Imported from the FDA as ${existing.recall_number}.`}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          id="product-description"
          label="Product"
          hint="Name the product, brand, and package size the way they appear on the label."
        >
          <Textarea
            id="product-description"
            required
            rows={3}
            value={form.product_description}
            onChange={setField('product_description')}
          />
        </Field>

        <Field id="recalling-firm" label="Company">
          <Input id="recalling-firm" value={form.recalling_firm} onChange={setField('recalling_firm')} />
        </Field>

        <Field
          id="reason"
          label="Reason for recall"
          hint="Name any allergen or contaminant plainly, for example “undeclared peanut”. Watchlists match on these words."
        >
          <Textarea id="reason" rows={3} value={form.reason_for_recall} onChange={setField('reason_for_recall')} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="status"
            label="Status"
            hint="Closing a recall alerts everyone following it."
          >
            <Select value={form.status} onValueChange={setValue('status')}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECALL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="classification" label="FDA classification">
            <Select value={form.classification} onValueChange={setValue('classification')}>
              <SelectTrigger id="classification" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field id="code-info" label="Lot numbers, UPCs, and dates" hint="The codes people should check on their package.">
          <Textarea id="code-info" rows={2} value={form.code_info} onChange={setField('code_info')} />
        </Field>

        <Field id="distribution" label="Where it was sold" hint="For example: CA, OR, and WA.">
          <Input id="distribution" value={form.distribution_pattern} onChange={setField('distribution_pattern')} />
        </Field>

        <div className="flex items-center gap-2">
          <Checkbox
            id="nationwide"
            checked={form.is_nationwide}
            onCheckedChange={(checked) => setValue('is_nationwide')(checked === true)}
          />
          <Label htmlFor="nationwide">Sold nationwide</Label>
        </div>

        <Field id="report-date" label="Date reported">
          <Input
            id="report-date"
            type="date"
            className="w-48"
            value={form.report_date}
            onChange={setField('report_date')}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save recall' : 'Add recall'}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/admin/recalls">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}