import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useCallback } from 'react';
import { api } from '@convex/_generated/api';
import { ContainerBootState, waitForBootStepCompleted } from '~/lib/stores/containerBootState';
import { toast } from 'sonner';
import { waitForConvexProjectConnection } from '~/lib/stores/convexProject';
import { selectedTeamSlugStore } from '~/lib/stores/convexTeams';

const CREATE_PROJECT_TIMEOUT = 15000;

export function useHomepageInitializeChat(chatId: string, setChatInitialized: (chatInitialized: boolean) => void) {
  const convex = useConvex();

  return useCallback(async () => {
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const teamSlug = selectedTeamSlugStore.get();
    const isLocalMode = teamSlug === 'local-team';

    // In local mode, skip Convex mutations entirely
    if (!isLocalMode) {
      // Initialize the chat and start project creation
      await convex.mutation(api.messages.initializeChat, {
        id: chatId,
        sessionId,
        projectInitParams: undefined,
      });
    } else {
      console.log('[Local Mode] Skipping chat initialization mutation');
    }
    
    if (!isLocalMode) {
      try {
        // Wait for the Convex project to be successfully created before allowing chat to start
        await Promise.race([
          waitForConvexProjectConnection(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Connection timeout'));
            }, CREATE_PROJECT_TIMEOUT);
          }),
        ]);
      } catch (error) {
        console.error('Failed to create Convex project:', error);
        if (error instanceof Error && error.message === 'Connection timeout') {
          toast.error('Connection timed out. Please try again.');
        } else {
          toast.error('Failed to create Convex project. Please try again.');
        }
        return false;
      }
    } else {
      console.log('[Local Mode] Skipping Convex project connection wait');
    }
    
    setChatInitialized(true);

    // Wait for the WebContainer to have its snapshot loaded before sending a message.
    await waitForBootStepCompleted(ContainerBootState.LOADING_SNAPSHOT);
    return true;
  }, [convex, chatId, setChatInitialized]);
}
