import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { BUSINESS_TYPES } from '@/constants';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();

  const [form, setForm] = useState({
    displayName: profile?.display_name ?? '',
    accountType: profile?.account_type ?? 'individual',
    businessName: profile?.business_name ?? '',
    businessType: profile?.business_type ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'success' | 'error', text }

  const isBusiness = form.accountType === 'business';
  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setValue = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    // The database requires a business name for business accounts
    if (isBusiness && !form.businessName.trim()) {
      setMessage({ kind: 'error', text: 'Enter your business name.' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.displayName.trim(),
        account_type: form.accountType,
        business_name: form.businessName.trim() || null,
        business_type: form.businessType || null,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to save settings:', error.message);
      setMessage({ kind: 'error', text: 'Your settings couldn’t be saved. Try again.' });
    } else {
      await refreshProfile(); // so the header and watchlist types update right away
      setMessage({ kind: 'success', text: 'Settings saved.' });
    }
    setSaving(false);
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={user?.email ?? ''} disabled />
          <p className="text-xs text-muted-foreground">Your email is your login and can’t be changed here.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Your name</Label>
          <Input
            id="display-name"
            autoComplete="name"
            required
            value={form.displayName}
            onChange={setField('displayName')}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Account type</legend>
          <RadioGroup value={form.accountType} onValueChange={setValue('accountType')} className="grid grid-cols-2 gap-2">
            <Label
              htmlFor="type-individual"
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="individual" id="type-individual" />
              Personal
            </Label>
            <Label
              htmlFor="type-business"
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="business" id="type-business" />
              Business
            </Label>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            Business accounts can also watch suppliers and lot or UPC numbers.
          </p>
        </fieldset>

        {isBusiness && (
          <>
            <div className="space-y-2">
              <Label htmlFor="business-name">Business name</Label>
              <Input
                id="business-name"
                autoComplete="organization"
                required
                value={form.businessName}
                onChange={setField('businessName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">Business type</Label>
              <Select value={form.businessType} onValueChange={setValue('businessType')}>
                <SelectTrigger id="business-type" className="w-full">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <p
          role="status"
          aria-live="polite"
          className={`min-h-5 text-sm ${message?.kind === 'error' ? 'text-destructive' : ''}`}
        >
          {message?.text}
        </p>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </div>
  );
}