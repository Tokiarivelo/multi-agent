import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let manualToken: string | null = null;

export const setApiToken = (token: string | null) => {
  manualToken = token;
};

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        // ⭐ PRIORITY 1 — manual token (tests / provider / override)
        if (manualToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${manualToken}`;
          return config;
        }

        // ⭐ PRIORITY 2 — session token (browser only)
        if (typeof window !== 'undefined') {
          const session = await getSession();
          if (session?.accessToken) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${session.accessToken}`;
          }
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
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