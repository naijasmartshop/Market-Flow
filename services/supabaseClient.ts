import { createClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'mf_sb_url';
const STORAGE_KEY_KEY = 'mf_sb_key';

// Default / Fallback credentials
const DEFAULT_URL = 'https://qcbcqekaeztqvsdqckeb.supabase.co';
const DEFAULT_KEY = 'sb_publishable_7uhZkj9bjpve-tTmd7TGvw_YbKux7qS';

const getStoredConfig = () => {
  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL,
    key: localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY
  };
};

const config = getStoredConfig();

export const supabase = createClient(config.url, config.key);

export const updateSupabaseConfig = (url: string, key: string) => {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url);
  if (key) localStorage.setItem(STORAGE_KEY_KEY, key);
  window.location.reload();
};

export const resetSupabaseConfig = () => {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  window.location.reload();
};

export const getCurrentConfig = getStoredConfig;