
import { Alert } from '../types.ts';

// Cloudflare Worker URL
const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

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

export const createAlert = async (alert: Omit<Alert, 'status'>, customUserId?: string): Promise<boolean> => {
  const userId = customUserId || getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
      },
      body: JSON.stringify({
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

export const fetchUserAlerts = async (customUserId?: string): Promise<Alert[]> => {
  const userId = customUserId || getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'X-User-ID': userId }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

export const deleteAlert = async (id: number, customUserId?: string): Promise<boolean> => {
  const userId = customUserId || getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/${id}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': userId },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const saveSubscription = async (subscription: PushSubscription, customUserId?: string): Promise<boolean> => {
  const userId = customUserId || getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/subscribe?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
      body: JSON.stringify(subscription.toJSON()),
    });
    return response.ok;
  } catch (error) {
    console.error('Save subscription error:', error);
    return false;
  }
};

export const removeSubscription = async (endpoint: string, customUserId?: string): Promise<boolean> => {
  const userId = customUserId || getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/unsubscribe?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
      body: JSON.stringify({ endpoint }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};
