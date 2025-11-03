import type { Id } from '@convex/_generated/dataModel';
import { useStore } from '@nanostores/react';
import type { ConvexReactClient } from 'convex/react';
import { atom } from 'nanostores';

export const SESSION_ID_KEY = 'sessionIdForConvex';

// Initialize with stored value to prevent hook ordering issues
function getInitialSessionId(): Id<'sessions'> | null {
  if (typeof window === 'undefined') return 'local-session-id' as any;
  try {
    const stored = localStorage.getItem(SESSION_ID_KEY);
    return stored ? (stored as any) : ('local-session-id' as any);
  } catch {
    return 'local-session-id' as any;
  }
}

export function useConvexSessionIdOrNullOrLoading(): Id<'sessions'> | null | undefined {
  const sessionId = useStore(sessionIdStore);
  return sessionId;
}

export function useConvexSessionId(): Id<'sessions'> {
  const sessionId = useStore(sessionIdStore);
  if (sessionId === undefined || sessionId === null) {
    throw new Error('Session ID is not set');
  }
  return sessionId;
}

export async function waitForConvexSessionId(caller?: string): Promise<Id<'sessions'>> {
  return new Promise((resolve) => {
    const sessionId = sessionIdStore.get();
    if (sessionId !== null && sessionId !== undefined) {
      resolve(sessionId);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for session ID...`);
    }
    const unsubscribe = sessionIdStore.subscribe((sessionId) => {
      if (sessionId !== null && sessionId !== undefined) {
        unsubscribe();
        resolve(sessionId);
      }
    });
  });
}

export const sessionIdStore = atom<Id<'sessions'> | null | undefined>(getInitialSessionId());

export const convexAuthTokenStore = atom<string | null>(null);

/**
 * We send the auth token in big brain requests. The Convex client already makes
 * sure it has an up-to-date auth token, so we just need to extract it.
 *
 * This is especially convenient in functions that are not async.
 *
 * Since there's not a public API for this, we internally type cast.
 */
export function getConvexAuthToken(convex: ConvexReactClient): string | null {
  try {
    // In local mode or if sync is not available, return mock token
    if (!(convex as any)?.sync) {
      return 'local-mock-token';
    }
    
    const token = (convex as any)?.sync?.state?.auth?.value;
    if (!token) {
      return 'local-mock-token';
    }
    // TODO make this automatically harvested on refresh
    convexAuthTokenStore.set(token);
    return token;
  } catch (error) {
    // If anything fails, return mock token for local mode
    console.warn('[getConvexAuthToken] Error accessing auth token:', error);
    return 'local-mock-token';
  }
}
