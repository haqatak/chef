import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';

export type ConvexTeam = {
  id: string;
  name: string;
  slug: string;
  referralCode: string;
};

export const convexTeamsStore = atom<ConvexTeam[] | null>(null);

const SELECTED_TEAM_SLUG_KEY = 'selectedConvexTeamSlug';

// Initialize with stored value or default to 'local-team' to prevent hook ordering issues
function getInitialTeamSlug(): string {
  if (typeof window === 'undefined') return 'local-team';
  try {
    return getLocalStorage(SELECTED_TEAM_SLUG_KEY) || 'local-team';
  } catch {
    return 'local-team';
  }
}

export const selectedTeamSlugStore = atom<string>(getInitialTeamSlug());

export function getStoredTeamSlug(): string | null {
  return getLocalStorage(SELECTED_TEAM_SLUG_KEY);
}

export function setSelectedTeamSlug(teamSlug: string) {
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlug);
  selectedTeamSlugStore.set(teamSlug);
}

export function useSelectedTeamSlug(): string {
  const selectedTeamSlug = useStore(selectedTeamSlugStore);
  return selectedTeamSlug;
}

export function useSelectedTeam(): ConvexTeam | null {
  const teams = useStore(convexTeamsStore);
  const slug = useSelectedTeamSlug();
  if (teams === null) {
    return null;
  }
  return teams.find((t) => t.slug === slug) || null;
}

export async function waitForSelectedTeamSlug(caller?: string): Promise<string> {
  return new Promise((resolve) => {
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug) {
      resolve(selectedTeamSlug);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for selected team slug...`);
    }
    const unsubscribe = selectedTeamSlugStore.subscribe((selectedTeamSlug) => {
      if (selectedTeamSlug) {
        unsubscribe();
        resolve(selectedTeamSlug);
      }
    });
  });
}
