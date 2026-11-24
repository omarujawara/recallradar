import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SiteFooter from './SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/recalls', label: 'Recalls' },
  { to: '/admin/reports', label: 'Reports'},
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogOut() {
    navigate('/');
    await signOut();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b print:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-4">
          <Link to="/admin" className="text-lg font-semibold tracking-tight">
            RecallRadar Admin Page
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{profile?.display_name}</span>
            <Button variant="outline" size="sm" onClick={handleLogOut}>
              Log out
            </Button>
          </div>
        </div>

        <nav aria-label="Admin" className="mx-auto w-full max-w-5xl overflow-x-auto px-4 py-3">
          <ul className="flex gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium',
                      isActive
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link
                to="/"
                className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                View public site
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}