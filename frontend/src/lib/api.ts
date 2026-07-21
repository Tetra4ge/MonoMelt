import axios from 'axios';
import { supabase } from './supabase';

const baseURL = import.meta.env.VITE_API_URL 
  || import.meta.env.VITE_API_DEV_URL 
  || (import.meta.env.VITE_MODE === 'production' ? import.meta.env.VITE_API_PRO_URL : 'http://localhost:4000');

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (e) {
    console.warn('Supabase getSession notice:', e);
  }
  return config;
});

export default api;
