import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useHomepageInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';
import { useState } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

export function useConvexChatHomepage(chatId: string) {
  useProjectInitializer(chatId);
  const [chatInitialized, setChatInitialized] = useState(false);
  const initializeChat = useHomepageInitializeChat(chatId, setChatInitialized);
  const storeMessageHistory = useStoreMessageHistory();
  useNewChatContainerSetup();
  const initialMessages = useInitialMessages(chatInitialized ? chatId : undefined);
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const subchats = useQuery(
    api.subchats.get,
    sessionId && chatInitialized
      ? {
          chatId,
          sessionId,
        }
      : 'skip',
  );

  return {
    initializeChat,
    storeMessageHistory,
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    subchats,
  };
}

export function useConvexChatExisting(chatId: string) {
  useProjectInitializer(chatId);
  const [chatInitialized, setChatInitialized] = useState(true); // For existing chats, already initialized
  const initializeChat = useHomepageInitializeChat(chatId, setChatInitialized);
  const storeMessageHistory = useStoreMessageHistory();
  // Don't set up a new container for existing chats
  const initialMessages = useInitialMessages(chatId); // Load messages immediately for existing chats
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const subchats = useQuery(
    api.subchats.get,
    sessionId
      ? {
          chatId,
          sessionId,
        }
      : 'skip',
  );

  return {
    initializeChat,
    storeMessageHistory,
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    subchats,
  };
}
