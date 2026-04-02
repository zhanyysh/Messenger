const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const enforceSecureWebSocketOnHttps = (wsBase: string): string => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsBase.startsWith('ws://')) {
    return `wss://${wsBase.slice('ws://'.length)}`;
  }
  return wsBase;
};

const deriveWsBaseFromApi = (apiBase: string): string => {
  if (apiBase.startsWith('https://')) {
    return `wss://${apiBase.slice('https://'.length)}`;
  }
  if (apiBase.startsWith('http://')) {
    return `ws://${apiBase.slice('http://'.length)}`;
  }
  return apiBase;
};

const apiBaseFromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
const wsBaseFromEnv = import.meta.env.VITE_WS_BASE_URL?.trim();

export const API_BASE_URL = normalizeBaseUrl(apiBaseFromEnv || DEFAULT_API_BASE_URL);
export const WS_BASE_URL = normalizeBaseUrl(
  enforceSecureWebSocketOnHttps(wsBaseFromEnv || deriveWsBaseFromApi(API_BASE_URL))
);

export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const wsUrl = (path: string): string =>
  `${WS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const resolveApiUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  return apiUrl(pathOrUrl);
};