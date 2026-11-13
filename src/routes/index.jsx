import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

import PublicLayout from '@/components/layout/PublicLayout';
import AppLayout from '@/components/layout/AppLayout';
import AdminLayout from '@/components/layout/AdminLayout';

import Landing from '@/pages/public/Landing';
import Login from '@/pages/public/Login';
import Signup from '@/pages/public/Signup';

import Dashboard from '@/pages/app/Dashboard';
import Search from '@/pages/app/Search';
import RecallDetail from '@/pages/app/RecallDetail';
import Watchlist from '@/pages/app/Watchlist';
import Alerts from '@/pages/app/Alerts';
import Settings from '@/pages/app/Settings';

import AdminDashboard from '@pages/admin/AdminDashboard';
import RecallManager from '@pages/admin/RecallManager';
import RecallForm from '@pages/admin/RecallForm';

export const router = createBrowserRouter([
    // public: guests can search and read recall details
    {
        element: <PublicLayout />,
        children: [
        { path: '/', element: <Landing /> },
        { path: '/login', element: <Login /> },
        { path: '/signup', element: <Signup /> },
        { path: '/recalls/:id', element: <RecallDetail /> },
        ],
    },

    // Logged-in users (individual and business)
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: '/app',
                element: <AppLayout />,
                children: [
                    { index: true, element: <Dashboard /> },
                    { path: 'search', element: <Search /> },
                    { path: 'watchlist', element: <Watchlist /> },
                    { path: 'alerts', element: <Alerts /> },
                    { path: 'settings', element: <Settings /> },
                ],
            },
        ]
    },

    // Admin only
    {
        element: <ProtectedRoute requireAdmin/>,
        children: [
            {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                    { index: true, element: <AdminDashboard /> },
                    { path: 'recalls', element: <RecallManager /> },
                    { path: 'recalls/new', element: <RecallForm /> },
                    { path: 'recalls/:id/edit', element: <RecallForm /> },
                ],
            },
        ],
    },

    { path: '*', element: <Navigate to="/" replace /> },

]);