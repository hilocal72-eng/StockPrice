
import { Alert } from '../types.ts';

// Cloudflare Worker URL
const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

export const getAnonymousId = (): string => {
  let id = localStorage.getItem('stkr_anon_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('stkr_anon_id', id);
  }
  return id;
};

export const createAlert = async (alert: Omit<Alert, 'status'>): Promise<boolean> => {
  const anonId = getAnonymousId();
  try {
    console.log('Attempting to create alert for:', alert.ticker);
    const response = await fetch(`${ALERT_WORKER_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
      },
      body: JSON.stringify(alert),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server responded with ${response.status}: ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Network or CORS error creating alert:', error);
    return false;
  }
};

export const fetchUserAlerts = async (): Promise<Alert[]> => {
  const anonId = getAnonymousId();
  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${anonId}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch alerts: ${response.status}`);
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
    const response = await fetch(`${ALERT_WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': anonId,
      },
      body: JSON.stringify(subscription),
    });
    return response.ok;
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
