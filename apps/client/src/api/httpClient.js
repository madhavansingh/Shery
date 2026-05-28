import axios from 'axios';
import { API_BASE_URL, API_DIRECT_URL } from '../config/env';

function getRole() {
  return localStorage.getItem('demo_role') || 'student';
}

function createClient(baseURL) {
  const client = axios.create({
    baseURL,
    headers: {
      Accept: 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers['x-demo-role'] = getRole();

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      const data = error.response?.data;
      const message = data?.error || data?.message || error.message || 'Request failed';
      const normalized = new Error(message);
      normalized.status = error.response?.status;
      normalized.data = data;
      throw normalized;
    }
  );

  return client;
}

export const apiClient = createClient(API_BASE_URL);
export const directApiClient = createClient(API_DIRECT_URL);
