import axios from 'axios';
import { supabase } from './supabase';

const baseURL = import.meta.env.VITE_API_URL
  || (import.meta.env.MODE === 'production' ? import.meta.env.VITE_API_PRO_URL : import.meta.env.VITE_API_DEV_URL)
  || 'http://localhost:4000';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default api;
