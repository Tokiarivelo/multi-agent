import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '../api/github.api';
import { GitHubConnection, GitHubRepo } from '@/types';

const STORAGE_KEY = 'github_oauth_token';
const STORAGE_LOGIN_KEY = 'github_oauth_login';
const STORAGE_AVATAR_KEY = 'github_oauth_avatar';

let listeners: (() => void)[] = [];

function subscribe(onStoreChange: () => void) {
  listeners.push(onStoreChange);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStoreChange);
  }
  return () => {
    listeners = listeners.filter((l) => l !== onStoreChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStoreChange);
    }
  };
}

function notify() {
  listeners.forEach((l) => l());
}

function loadConnection(): GitHubConnection {
  if (typeof window === 'undefined') return { connected: false };
  const accessToken = localStorage.getItem(STORAGE_KEY) ?? undefined;
  const login = localStorage.getItem(STORAGE_LOGIN_KEY) ?? undefined;
  const avatarUrl = localStorage.getItem(STORAGE_AVATAR_KEY) ?? undefined;
  return { connected: !!accessToken, accessToken, login, avatarUrl };
}

function saveConnection(payload: { accessToken: string; login: string; avatarUrl: string }) {
  localStorage.setItem(STORAGE_KEY, payload.accessToken);
  localStorage.setItem(STORAGE_LOGIN_KEY, payload.login);
  localStorage.setItem(STORAGE_AVATAR_KEY, payload.avatarUrl);
  notify();
}

function clearConnection() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_LOGIN_KEY);
  localStorage.removeItem(STORAGE_AVATAR_KEY);
  notify();
}

const connectionSnapshot = () => JSON.stringify(loadConnection());
const serverSnapshot = () => JSON.stringify({ connected: false });

export function useGitHub() {
  const connectionStr = useSyncExternalStore(subscribe, connectionSnapshot, serverSnapshot);
  const connection = useMemo(() => JSON.parse(connectionStr) as GitHubConnection, [connectionStr]);

  const popupRef = useRef<Window | null>(null);

  // Listen for the token message posted by the OAuth callback page
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'github_oauth_success') return;
      const payload = event.data as { type: string; accessToken: string; login: string; avatarUrl: string };
      saveConnection(payload);
      popupRef.current?.close();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const connect = useCallback(async () => {
    const { url } = await githubApi.getAuthorizationUrl();
    const popup = window.open(url, 'github_oauth', 'width=600,height=700,scrollbars=yes');
    popupRef.current = popup;
  }, []);

  const disconnect = useCallback(() => {
    clearConnection();
  }, []);

  // Fetch repositories when connected
  const reposQuery = useQuery<GitHubRepo[]>({
    queryKey: ['github-repos', connection.accessToken],
    queryFn: () => githubApi.listRepositories(connection.accessToken!),
    enabled: connection.connected && !!connection.accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    connection,
    connect,
    disconnect,
    repos: reposQuery.data ?? [],
    isLoadingRepos: reposQuery.isLoading,
    reposError: reposQuery.error,
  };
}
