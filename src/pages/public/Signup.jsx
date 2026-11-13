import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { BUSINESS_TYPES } from '@/constants';

function signupErrorMessage(error) {
  if (/already registered/i.test(error.message)) return 'An account with this email already exists. Log in instead.';
  if (/password/i.test(error.message)) return 'Use a password with at least 6 characters.';
  if (/database error/i.test(error.message)) return 'Your account couldn’t be created. Check your details and try again.';
  return error.message;
}

export default function Signup() {
  const { user, isAdmin, loading, signUp } = useAuth();

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    accountType: 'consumer',
    businessName: '',
    businessType: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const isBusiness = form.accountType === 'business';
  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  if (!loading && user) {
    return <Navigate to={isAdmin ? '/admin' : '/app'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    // The database requires a business name for business accounts
    if (isBusiness && !form.businessName.trim()) {
      setError('Enter your business name.');
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await signUp({
      email: form.email.trim(),
      password: form.password,
      displayName: form.displayName.trim(),
      accountType: form.accountType,
      businessName: form.businessName.trim(),
      businessType: form.businessType || null,
    });

    if (signUpError) {
      setError(signupErrorMessage(signUpError));
      setSubmitting(false);
      return;
    }

    // No session means email confirmation is turned on
    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
    }
    // Otherwise the user is logged in and the redirect above takes over
  }

  if (needsConfirmation) {
    return (
      <div className="mx-auto w-full max-w-sm px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a confirmation link to {form.email}. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Already have one?{' '}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Account type</legend>
          <RadioGroup
            value={form.accountType}
            onValueChange={(value) => setForm((prev) => ({ ...prev, accountType: value }))}
            className="grid grid-cols-2 gap-2"
          >
            <Label
              htmlFor="type-consumer"
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value="consumer" id="type-consumer" />
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
        </fieldset>

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
              <Select
                value={form.businessType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, businessType: value }))}
              >
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

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={setField('email')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={form.password}
            onChange={setField('password')}
          />
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}