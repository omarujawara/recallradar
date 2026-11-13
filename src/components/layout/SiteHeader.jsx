import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function SiteHeader() {
  const { user, isAdmin } = useAuth();

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          RecallRadar
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to={isAdmin ? '/admin' : '/app'}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Create account</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}