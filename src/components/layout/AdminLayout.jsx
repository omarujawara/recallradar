import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SiteFooter from './SiteFooter';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogOut() {
    navigate('/'); // leave the protected area first, so we land on the home page instead of /login
    await signOut();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/admin" className="text-lg font-semibold tracking-tight">
            RecallRadar
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile?.business_name ?? profile?.display_name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogOut}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}