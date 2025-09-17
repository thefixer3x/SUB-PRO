import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase, type Database } from '@/lib/supabase';
import { DEFAULT_SUBSCRIPTION_TIER } from '@/lib/constants/subscription';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isInitializing: boolean;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    params: { email: string; password: string; fullName?: string }
  ) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initialiseSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Failed to fetch session', error);
          return;
        }

        if (!isMounted) {
          return;
        }

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Unexpected error while fetching session', error);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    void initialiseSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsInitializing(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session) {
        return {
          success: false,
          error: 'Unable to create a session. Please try again.',
        };
      }

      setSession(data.session);
      setUser(data.session.user);
      return { success: true };
    } catch (error) {
      console.error('Error during sign in', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign in. Please try again.',
      };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signUp = useCallback(
    async ({ email, password, fullName }: { email: string; password: string; fullName?: string }) => {
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName ?? null,
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        const userId = data.user?.id;
        if (userId) {
          const now = new Date().toISOString();
          const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
            id: userId,
            email,
            full_name: fullName ?? null,
            subscription_tier: DEFAULT_SUBSCRIPTION_TIER,
            updated_at: now,
          };

          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profilePayload as any, { onConflict: 'id' });

          if (profileError) {
            console.warn('Failed to create profile after sign up', profileError);
            return { success: false, error: 'Failed to create user profile. Please try again.' };
          }
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }

        return {
          success: true,
          requiresEmailConfirmation: !data.session,
        };
      } catch (error) {
        console.error('Error during sign up', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to sign up. Please try again.',
        };
      } finally {
        setAuthLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: error.message };
      }

      setSession(null);
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error('Error during sign out', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign out. Please try again.',
      };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Failed to refresh session', error);
        return;
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    } catch (error) {
      console.error('Unexpected error refreshing session', error);
    }
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void refreshSession();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshSession]);
  const value = useMemo(
    () => ({
      session,
      user,
      isInitializing,
      authLoading,
      signIn,
      signUp,
      signOut,
      refreshSession,
    }),
    [authLoading, isInitializing, session, signIn, signOut, signUp, refreshSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
