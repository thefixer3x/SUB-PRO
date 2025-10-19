import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase, type Database } from '@/lib/supabase';

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

const isDevEnvironment =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';
const forceMockAuthFlag =
  (process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH ?? process.env.EXPO_PUBLIC_USE_MOCK_AUTH ?? process.env.NEXT_PUBLIC_USE_MOCK_AUTH ?? '')
    .toString()
    .toLowerCase() === 'true';

const mockDelay = (duration = 450) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration);
  });

const createMockUser = (email: string, fullName?: string): User => {
  const now = new Date().toISOString();
  return {
    id: `mock-user-${Math.random().toString(36).slice(2, 10)}`,
    app_metadata: { provider: 'email', providers: ['email'] },
    aud: 'authenticated',
    created_at: now,
    user_metadata: {
      full_name: fullName ?? email.split('@')[0] ?? 'Mock User',
    },
    email,
    phone: '',
    confirmation_sent_at: now,
    confirmed_at: now,
    email_confirmed_at: now,
    phone_confirmed_at: now,
    last_sign_in_at: now,
    factor_ids: [],
    identities: [],
    // Casting is necessary because the Supabase User type includes readonly internal fields
  } as unknown as User;
};

const createMockSession = (user: User): Session => {
  const expiresAt = Math.round(Date.now() / 1000) + 60 * 60;
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: expiresAt,
    refresh_token: 'mock-refresh-token',
    user,
    provider_token: null,
  } as unknown as Session;
};

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

  // Only use mock auth if explicitly enabled via EXPO_PUBLIC_ENABLE_MOCK_AUTH=true
  // Never use mock in production, even if Supabase is misconfigured
  const shouldUseMockAuth = forceMockAuthFlag && isDevEnvironment;

  useEffect(() => {
    let isMounted = true;

    if (shouldUseMockAuth) {
      setIsInitializing(false);
      return () => {
        isMounted = false;
      };
    }

    const initialiseSession = async () => {
      try {
        // Check if Supabase is properly configured
        if (!isSupabaseEnvConfigured) {
          console.warn('Supabase not configured, skipping session initialization');
          if (isMounted) {
            setIsInitializing(false);
          }
          return;
        }

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

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
            subscription_tier: 'free',
            updated_at: now,
          };

          // Use Supabase generics for type safety
          const { error: profileError } = await supabase
            .from<Database['public']['Tables']['profiles']['Insert']>('profiles')
            .upsert(
              profilePayload,
              { onConflict: 'id' },
            );

          if (profileError) {
            console.warn('Failed to create profile after sign up', profileError);
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
