
import { Alert } from '../types.ts';

// Local API URL
const ALERT_API_URL = '/api';

const generateFallbackUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Optimized Sync: Saves the ID to both IDB (for persistence) 
 * and CacheStorage (for high-speed SW access).
 */
const syncIdToFastStorage = async (id: string) => {
  // 1. Sync to IndexedDB
  const request = indexedDB.open('StockerDB', 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings');
    }
  };
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put(id, 'stkr_anon_id');
  };

  // 2. Sync to CacheStorage (MUCH faster for SW to read)
  if ('caches' in window) {
    try {
      const cache = await caches.open('stocker-fast-id');
      await cache.put('/user-id', new Response(id));
    } catch (e) {
      console.warn("Fast-cache sync failed", e);
    }
  }
};

export const getAnonymousId = (): string => {
  let id = localStorage.getItem('stkr_anon_id');
  if (!id) {
    try {
      id = (window.crypto && window.crypto.randomUUID) 
        ? window.crypto.randomUUID() 
        : generateFallbackUUID();
    } catch (e) {
      id = generateFallbackUUID();
    }
    localStorage.setItem('stkr_anon_id', id);
  }
  syncIdToFastStorage(id);
  return id;
};

export const createAlert = async (alert: Omit<Alert, 'status'>): Promise<boolean> => {
  const currentUser = localStorage.getItem('stkr_current_user');
  if (!currentUser) return false;

  try {
    const response = await fetch(`${ALERT_API_URL}/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: currentUser,
        ticker: alert.ticker,
        target_price: Number(alert.target_price),
        condition: alert.condition
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Alert creation failed:', error);
    return false;
  }
};

export const fetchUserAlerts = async (): Promise<Alert[]> => {
  const currentUser = localStorage.getItem('stkr_current_user');
  if (!currentUser) return [];

  try {
    const response = await fetch(`${ALERT_API_URL}/alerts?username=${encodeURIComponent(currentUser)}`, {
      method: 'GET',
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

export const deleteAlert = async (id: number): Promise<boolean> => {
  const currentUser = localStorage.getItem('stkr_current_user');
  if (!currentUser) return false;

  try {
    const response = await fetch(`${ALERT_API_URL}/alerts/${id}?username=${encodeURIComponent(currentUser)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const saveSubscription = async (subscription: PushSubscription): Promise<boolean> => {
  const currentUser = localStorage.getItem('stkr_current_user');
  if (!currentUser) return false;

  try {
    const response = await fetch(`${ALERT_API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser,
        subscription: subscription.toJSON()
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Save subscription error:', error);
    return false;
  }
};

export const removeSubscription = async (endpoint: string): Promise<boolean> => {
  try {
    const response = await fetch(`${ALERT_API_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};
