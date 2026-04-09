/**
 * useWebViewCapture - Utility hook (DEPRECATED)
 *
 * This hook is no longer used by the main facial-capture screen.
 * All WebView communication, authentication, and backend submission
 * logic has been moved directly into facial-capture.tsx to eliminate
 * the following issues:
 *
 * 1. `postMessage()` does not work on React Native WebView refs.
 *    You must use `injectJavaScript()` instead.
 * 2. `new Blob()` is not available in React Native's JS runtime.
 * 3. Dual message processing caused state machine desync.
 *
 * This file is kept for backwards compatibility but is NOT active.
 * The main facial capture flow is in:
 *   app/(tabs)/(screens)/facial-capture.tsx
 *
 * @deprecated Use the self-contained facial-capture component instead.
 */

import { useCallback, useRef, useState } from 'react';
import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

export interface WebViewCaptureOptions {
  modelUrl: string;
  pubKeyUrl: string;
  backendUrl: string;
  authUrl: string;
}

export interface WebViewCaptureResult {
  status: 'success' | 'error' | 'cancelled';
  message: string;
  imageData?: string;
  error?: Error;
}

export interface BackendResponse {
  success?: boolean;
  status?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  RESPOSTA?: {
    LIVELINESS?: {
      code?: number;
      message?: string;
      description?: string;
    };
    URL?: string;
  };
  [key: string]: unknown;
}

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/livelinesscapture$/i, '');
}

function resolveAuthUrl(authUrl: string, backendUrl: string): string {
  const authCandidate = authUrl.trim();
  if (authCandidate) {
    return /\/auth$/i.test(authCandidate)
      ? authCandidate.replace(/\/+$/, '')
      : `${normalizeApiBase(authCandidate)}/auth`;
  }
  return `${normalizeApiBase(backendUrl)}/auth`;
}

/**
 * @deprecated - Logic moved to facial-capture.tsx
 */
export function useWebViewCapture() {
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  const webViewRef = useRef<any>(null);
  const authTokenRef = useRef<string | null>(null);

  const resolveAuthToken = useCallback(async (authUrl: string, backendUrl: string) => {
    if (authTokenRef.current) return authTokenRef.current;

    const resolvedAuthUrl = resolveAuthUrl(authUrl, backendUrl);
    const response = await fetch(resolvedAuthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ClientID: CREDIFY_CONFIG.CLIENT_ID,
        ClientSecret: CREDIFY_CONFIG.CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha na autenticacao (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const token = data?.Dados || data?.token || data?.access_token;
    if (!token) throw new Error('Token nao encontrado');

    authTokenRef.current = token;
    return token;
  }, []);

  const initialize = useCallback(async (_options: WebViewCaptureOptions) => {
    console.warn('[useWebViewCapture] DEPRECATED - use facial-capture.tsx directly');
    setIsReady(true);
  }, []);

  const startCapture = useCallback(async (): Promise<WebViewCaptureResult> => {
    console.warn('[useWebViewCapture] DEPRECATED');
    setIsCapturing(true);
    return { status: 'error', message: 'Hook deprecated' };
  }, []);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  const submitToBackend = useCallback(
    async (_imageData: string, _backendUrl: string, _authUrl: string): Promise<BackendResponse> => {
      console.warn('[useWebViewCapture] DEPRECATED - use facial-capture.tsx directly');
      return { error: 'Hook deprecated' };
    },
    []
  );

  const validateResponse = useCallback((response: BackendResponse): boolean => {
    return Boolean(response?.RESPOSTA?.LIVELINESS?.code === 200 || response?.success);
  }, []);

  const getRedirectUrl = useCallback((response: BackendResponse): string | null => {
    return response?.RESPOSTA?.URL || response?.redirectUrl || null;
  }, []);

  const getErrorMessage = useCallback((response: BackendResponse): string => {
    return (
      response?.RESPOSTA?.LIVELINESS?.description ||
      response?.RESPOSTA?.LIVELINESS?.message ||
      response?.error ||
      response?.message ||
      'Erro desconhecido'
    );
  }, []);

  const handleWebViewMessage = useCallback((_input: unknown) => {
    // No-op - deprecated
  }, []);

  const sendMessageToWebView = useCallback((_message: unknown) => {
    // No-op - deprecated
  }, []);

  return {
    webViewRef,
    isReady,
    isCapturing,
    isWebViewReady,
    initialize,
    startCapture,
    stopCapture,
    submitToBackend,
    validateResponse,
    getRedirectUrl,
    getErrorMessage,
    handleWebViewMessage,
    sendMessageToWebView,
  };
}
