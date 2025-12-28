import { PANTRY_ID, BASKET_NAME, DEFAULT_DATA } from '../constants';
import { AppData } from '../types';

const BASE_URL = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET_NAME}`;
const LOCAL_STORAGE_KEY = 'love_hsiung_glamping_data';

export const fetchAppData = async (): Promise<AppData> => {
  let cloudData: Partial<AppData> | null = null;

  // 1. Try Network
  try {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (response.ok) {
      cloudData = await response.json();
      // Sync to local storage
      if (cloudData) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData));
      }
    } else {
      console.warn('Pantry API returned non-OK status. Checking local backup.');
    }
  } catch (error) {
    console.warn('Network error fetching from Pantry. Checking local backup.');
  }

  // 2. Try Local Storage if Cloud failed or empty
  if (!cloudData) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        cloudData = JSON.parse(local);
      } catch (e) {
        console.error('Failed to parse local storage data');
      }
    }
  }

  // 3. Merge with default to ensure structure
  return { ...DEFAULT_DATA, ...cloudData };
};

export const saveAppData = async (data: AppData): Promise<boolean> => {
  // 1. Always save to Local Storage first (Reliability)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Local Storage failed', e);
  }

  // 2. Try Cloud
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.warn(`Cloud save failed (${response.status}). Data saved locally.`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Cloud save network error. Data saved locally.');
    return false;
  }
};