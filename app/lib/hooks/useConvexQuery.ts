import { useQuery as useConvexQueryOriginal } from 'convex/react';
import { useStore } from '@nanostores/react';
import { selectedTeamSlugStore } from '~/lib/stores/convexTeams';
import type { FunctionReference, FunctionReturnType } from 'convex/server';

/**
 * Wrapper around Convex's useQuery that returns undefined in local mode
 */
export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: any[]
): FunctionReturnType<Query> | undefined {
  const teamSlug = useStore(selectedTeamSlugStore);
  const isLocalMode = teamSlug === 'local-team';
  
  // In local mode, always return undefined without calling the actual hook
  if (isLocalMode) {
    return undefined;
  }
  
  return useConvexQueryOriginal(query, ...args);
}
