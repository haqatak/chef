import { useEffect } from 'react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import { sessionIdStore, SESSION_ID_KEY } from '~/lib/stores/sessionId';
import { setSelectedTeamSlug, getStoredTeamSlug } from '~/lib/stores/convexTeams';

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const convex = useConvex();

  useEffect(() => {
    // Stores are already initialized with default values, just log for confirmation
    const sessionId = sessionIdStore.get();
    const teamSlug = getStoredTeamSlug() || 'local-team';
    const isLocalMode = teamSlug === 'local-team';
    
    console.log('[UserProvider] Using local mode session');
    console.log('[UserProvider] SessionId:', sessionId);
    console.log('[UserProvider] TeamSlug:', teamSlug);
    
    // In local mode, we don't need to do anything else
    // The stores are already initialized with the right values
  }, [convex]);

  return <>{children}</>;
};
