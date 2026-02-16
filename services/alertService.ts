import { Alert } from '../types.ts';

// Cloudflare Worker URL - Updated to the current production endpoint
const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

const generateFallbackUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const syncIdToIDB = (id: string) => {
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
  syncIdToIDB(id);
  return id;
};

export const createAlert = async (alert: Omit<Alert, 'status'>): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(anonId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
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

export const fetchUserAlerts = async (): Promise<Alert[]> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(anonId)}`, {
      method: 'GET',
      headers: { 'X-User-ID': anonId }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

export const deleteAlert = async (id: number): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/${id}?userId=${encodeURIComponent(anonId)}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': anonId },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const saveSubscription = async (subscription: PushSubscription): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/subscribe?userId=${encodeURIComponent(anonId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': anonId },
      body: JSON.stringify(subscription.toJSON()),
    });
    return response.ok;
  } catch (error) {
    console.error('Save subscription error:', error);
    return false;
  }
};

export const removeSubscription = async (endpoint: string): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/unsubscribe?userId=${encodeURIComponent(anonId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': anonId },
      body: JSON.stringify({ endpoint }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};