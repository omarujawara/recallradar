import { Navigate, Outlet, useLocation} from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ProtectedRoute({ requireAdmin = false }) {
    const { user, isAdmin, loading } = useAuth();
    const location = useLocation();

    if(loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-muted-foreground">
                Loading...
            </div>
        );
    }

    // Not logged in: go to login, and remember where they were headed
    if (!user)
        return <Navigate to="/login" replace state={{from: location}} />;

    // Logged in but not admin
    if (requireAdmin && !isAdmin)
            return <Navigate to="/app" replace />

    return <Outlet />



}