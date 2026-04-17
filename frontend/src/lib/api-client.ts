import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let manualToken: string | null = null;

export const setApiToken = (token: string | null) => {
  manualToken = token;
};

const getAccessToken = async (forceRefresh = false): Promise<string | null> => {
  if (manualToken) return manualToken;
  if (typeof window === 'undefined') return null;
  const session = await getSession();
  if (session?.accessToken) return session.accessToken as string;
  if (!forceRefresh) return null;
  // Force a fresh session fetch from the server
  const freshSession = await fetch('/api/auth/session')
    .then((r) => r.json())
    .catch(() => null);
  return (freshSession?.accessToken as string) ?? null;
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
    });

    // Request interceptor — attach Bearer token from session or manual override
    this.client.interceptors.request.use(
      async (config) => {
        const token = await getAccessToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor — on 401, try refreshing the session once before redirecting
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

        if (error.response?.status === 401 && !originalRequest._retried) {
          originalRequest._retried = true;

          // Attempt to get a fresh token
          const freshToken = await getAccessToken(true);
          if (freshToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${freshToken}`;
            return this.client(originalRequest);
          }

          // No valid session — redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      },
    );
  }

  getInstance(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getInstance();
