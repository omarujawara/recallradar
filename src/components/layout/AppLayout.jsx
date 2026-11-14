import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SiteFooter from './SiteFooter';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { AlertsProvider, useAlerts } from '@/hooks/useAlerts';

const NAV_LINKS = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/search', label: 'Search' },
  { to: '/app/watchlist', label: 'Watchlist' },
  { to: '/app/alerts', label: 'Alerts' },
  { to: '/app/settings', label: 'Settings' },
];

function AppShell() {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useAlerts();
  const navigate = useNavigate();

  async function handleLogOut() {
    navigate('/'); // leave the protected area first, so we land on the home page instead of /login
    await signOut();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-4">
          <Link to="/app" className="text-lg font-semibold tracking-tight">
            RecallRadar
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.business_name ?? profile?.display_name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogOut}>
              Log out
            </Button>
          </div>
        </div>

        <nav aria-label="Main" className="mx-auto w-full max-w-5xl overflow-x-auto px-4 py-3">
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
                  {link.to === '/app/alerts' && unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

export default function AppLayout() {
  return (
    <AlertsProvider>
      <AppShell />
    </AlertsProvider>
  );
}