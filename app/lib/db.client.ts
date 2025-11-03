import { openDB, type IDBPDatabase } from 'idb';
import type { SerializedMessage } from '@convex/messages';

const DB_NAME = 'chef-local-db';
const DB_VERSION = 1;

interface ChefDB {
  messages: {
    key: string;
    value: {
      chatId: string;
      serialized: SerializedMessage[];
      timestamp: number;
    };
  };
  snapshots: {
    key: string;
    value: {
      chatId: string;
      snapshot: Uint8Array;
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ChefDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ChefDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChefDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'chatId' });
          messagesStore.createIndex('timestamp', 'timestamp');
        }

        // Create snapshots store
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'chatId' });
          snapshotsStore.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveMessages(chatId: string, serialized: SerializedMessage[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('messages', {
      chatId,
      serialized,
      timestamp: Date.now(),
    });
    console.log('[IndexedDB] Saved', serialized.length, 'messages for chat', chatId);
  } catch (error) {
    console.error('[IndexedDB] Error saving messages:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(`chat-messages-${chatId}`, JSON.stringify({ serialized }));
      console.log('[IndexedDB] Fell back to localStorage');
    } catch (e) {
      console.error('[IndexedDB] localStorage fallback also failed:', e);
    }
  }
}

export async function loadMessages(chatId: string): Promise<SerializedMessage[] | null> {
  try {
    const db = await getDB();
    const record = await db.get('messages', chatId);
    if (record) {
      console.log('[IndexedDB] Loaded', record.serialized.length, 'messages for chat', chatId);
      return record.serialized;
    }
    
    // Try localStorage fallback for migration
    const stored = localStorage.getItem(`chat-messages-${chatId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[IndexedDB] Migrated from localStorage');
      // Save to IndexedDB for future use
      await saveMessages(chatId, parsed.serialized);
      // Clean up localStorage
      localStorage.removeItem(`chat-messages-${chatId}`);
      return parsed.serialized;
    }
    
    return null;
  } catch (error) {
    console.error('[IndexedDB] Error loading messages:', error);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`chat-messages-${chatId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[IndexedDB] Fell back to localStorage');
        return parsed.serialized;
      }
    } catch (e) {
      console.error('[IndexedDB] localStorage fallback also failed:', e);
    }
    return null;
  }
}

export async function saveSnapshot(chatId: string, snapshot: Uint8Array): Promise<void> {
  try {
    const db = await getDB();
    await db.put('snapshots', {
      chatId,
      snapshot,
      timestamp: Date.now(),
    });
    console.log('[IndexedDB] Saved snapshot for chat', chatId);
  } catch (error) {
    console.error('[IndexedDB] Error saving snapshot:', error);
  }
}

export async function loadSnapshot(chatId: string): Promise<Uint8Array | null> {
  try {
    const db = await getDB();
    const record = await db.get('snapshots', chatId);
    if (record) {
      console.log('[IndexedDB] Loaded snapshot for chat', chatId);
      return record.snapshot;
    }
    return null;
  } catch (error) {
    console.error('[IndexedDB] Error loading snapshot:', error);
    return null;
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  try {
    const db = await getDB();
    await Promise.all([
      db.delete('messages', chatId),
      db.delete('snapshots', chatId),
    ]);
    console.log('[IndexedDB] Deleted chat', chatId);
  } catch (error) {
    console.error('[IndexedDB] Error deleting chat:', error);
  }
}

export async function listChats(): Promise<Array<{ chatId: string; timestamp: number }>> {
  try {
    const db = await getDB();
    const messages = await db.getAllFromIndex('messages', 'timestamp');
    return messages.map(m => ({ chatId: m.chatId, timestamp: m.timestamp }));
  } catch (error) {
    console.error('[IndexedDB] Error listing chats:', error);
    return [];
  }
}
