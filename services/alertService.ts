
import { Alert } from '../types.ts';

// Cloudflare Worker URL
const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

/**
 * Fallback UUID generator for environments where crypto.randomUUID might be missing
 */
const generateFallbackUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  return id;
};

export const createAlert = async (alert: Omit<Alert, 'status'>): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
      },
      body: JSON.stringify(alert),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Alert creation failed:', response.status, errorData);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Network error creating alert:', error);
    return false;
  }
};

export const fetchUserAlerts = async (): Promise<Alert[]> => {
  const anonId = getAnonymousId();
  if (!anonId) return [];

  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(anonId)}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return [];
  }
};

export const deleteAlert = async (id: number): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'X-User-ID': anonId,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to delete alert:', error);
    return false;
  }
};

export const saveSubscription = async (subscription: PushSubscription): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    // CRITICAL: PushSubscription objects must be converted to JSON explicitly
    // otherwise JSON.stringify(subscription) returns "{}"
    const subscriptionData = subscription.toJSON();
    
    const response = await fetch(`${ALERT_WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Subscription save failed:', response.status, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    return false;
  }
};

export const removeSubscription = async (endpoint: string): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
      },
      body: JSON.stringify({ endpoint }),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to remove push subscription:', error);
    return false;
  }
};
