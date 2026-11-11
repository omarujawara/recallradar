
import { createContext, useCallback, useContext, useEffect, useState} from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider ({children}) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);

    // Get current session, then listen for login/logout
    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data }) => {
                setSession(data.session);
                setSessionLoading(false);
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            // Keep this callback syncronous. Supabase warns against awaiting
            // other Supabase calls inside it, so the profile loads in a seperate effect
            setSession(newSession);
        });

        return () => subscription.unsubscribe();

    }, []);

    const userId = session?.user?.id;

    // Load the profile (role, account_type, etc.) whenver the user changes
    const loadProfile = useCallback(async () => {
        if(!userId) {
            setProfile(null);
            return;
        }

        setProfileLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id',userId)
            .single();
        if(error) console.error('Failed to lead profile:',error.message);
        setProfile(data ?? null);
        setProfileLoading(false);
    }, [userId]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    // Auth actions
    const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password});

    const signUp = ({ email, password, displayName, accountType = 'individual', businessName, businessType}) =>
        supabase.auth.signUp({
            email,
            password,
            options: {
                // read by the handle_new_user trigger to fill public.profiles
                data: {
                    display_name: displayName,
                    account_type: accountType,
                    business_name: accountType === 'business' ? businessName : null,
                    business_type: accountType === 'business' ? businessType : null,
                },
            },
        });

    const signOut = () => supabase.auth.signOut();

    // Still loading if the profile for the current user hasn't arrived yet
    const loading =
        sessionLoading || profileLoading || (Boolean(userId) && profile?.id !== userId);

    const value = {
        session,
        user: session?.user ?? null,
        profile,
        isAdmin: profile?.role === 'admin',
        isBusiness: profile?.account_type === 'business',
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile: loadProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
    return context;
}

    
