import { useCallback, useEffect, useRef, useState } from 'react';
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

type PendingTimeout = ReturnType<typeof setTimeout>;

type PendingInitialize = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: PendingTimeout;
};

type PendingCapture = {
  resolve: (result: WebViewCaptureResult) => void;
  reject: (error: Error) => void;
  timeout: PendingTimeout;
};

type PendingPromisesRef = {
  initialize?: PendingInitialize;
  capture?: PendingCapture;
};

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/livelinesscapture$/i, '');
}

function resolveLivenessUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return /\/livelinesscapture$/i.test(normalized)
    ? normalized
    : `${normalizeApiBase(normalized)}/livelinesscapture`;
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

function buildRequestId(): string {
  return `webview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripImagePrefix(imageData: string): string {
  return imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
}

function parseResponsePayload(payload: string): BackendResponse {
  try {
    return JSON.parse(payload) as BackendResponse;
  } catch {
    return {
      status: 'error',
      error: payload || 'Resposta inválida do servidor',
      message: payload || 'Resposta inválida do servidor',
    };
  }
}

export function useWebViewCapture() {
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isWebViewReady, setIsWebViewReady] = useState(false);

  const mountedRef = useRef(true);
  const webViewRef = useRef<any>(null);
  const queuedMessagesRef = useRef<any[]>([]);
  const webViewReadyRef = useRef(false);
  const authTokenRef = useRef<string | null>(null);
  const pendingPromisesRef = useRef<PendingPromisesRef>({});

  const clearInitializePending = useCallback(() => {
    const pending = pendingPromisesRef.current.initialize;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingPromisesRef.current.initialize = undefined;
  }, []);

  const clearCapturePending = useCallback(() => {
    const pending = pendingPromisesRef.current.capture;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingPromisesRef.current.capture = undefined;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearInitializePending();
      clearCapturePending();
    };
  }, [clearCapturePending, clearInitializePending]);

  const flushQueuedMessages = useCallback(() => {
    if (!webViewRef.current || !webViewReadyRef.current || queuedMessagesRef.current.length === 0) {
      return;
    }

    const queuedMessages = [...queuedMessagesRef.current];
    queuedMessagesRef.current = [];

    queuedMessages.forEach((message) => {
      webViewRef.current?.postMessage(JSON.stringify(message));
    });
  }, []);

  const sendMessageToWebView = useCallback(
    (message: any) => {
      if (!webViewRef.current || !webViewReadyRef.current) {
        queuedMessagesRef.current.push(message);
        return false;
      }

      webViewRef.current.postMessage(JSON.stringify(message));
      return true;
    },
    []
  );

  const resolveAuthToken = useCallback(async (authUrl: string, backendUrl: string) => {
    if (authTokenRef.current) {
      return authTokenRef.current;
    }

    const resolvedAuthUrl = resolveAuthUrl(authUrl, backendUrl);
    const response = await fetch(resolvedAuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ClientID: CREDIFY_CONFIG.CLIENT_ID,
        ClientSecret: CREDIFY_CONFIG.CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha na autenticação (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const token = data?.Dados || data?.token || data?.access_token;

    if (!token) {
      throw new Error('Token de autenticação não encontrado na resposta do backend');
    }

    authTokenRef.current = token;
    return token;
  }, []);

  const resolveInitialize = useCallback(() => {
    const pending = pendingPromisesRef.current.initialize;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingPromisesRef.current.initialize = undefined;
    pending.resolve();
  }, []);

  const rejectInitialize = useCallback((error: Error) => {
    const pending = pendingPromisesRef.current.initialize;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingPromisesRef.current.initialize = undefined;
    pending.reject(error);
  }, []);

  const resolveCapture = useCallback((result: WebViewCaptureResult) => {
    const pending = pendingPromisesRef.current.capture;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingPromisesRef.current.capture = undefined;
    pending.resolve(result);
  }, []);

  const handleWebViewMessage = useCallback(
    (input: any) => {
      try {
        const rawData = typeof input === 'string' ? input : input?.nativeEvent?.data;
        if (!rawData) {
          console.error('[WebViewCapture] Dados da mensagem não encontrados:', input);
          return;
        }

        const data = JSON.parse(rawData);
        console.log('[WebViewCapture] Mensagem recebida:', data);

        switch (data.type) {
          case 'WEBVIEW_READY':
            webViewReadyRef.current = true;
            if (mountedRef.current) {
              setIsWebViewReady(true);
            }
            flushQueuedMessages();
            break;

          case 'SDK_INITIALIZED':
          case 'SDK_FALLBACK':
            if (mountedRef.current) {
              setIsReady(true);
            }
            resolveInitialize();
            break;

          case 'SDK_ERROR':
            rejectInitialize(new Error(data.error || 'Erro na inicialização do SDK'));
            break;

          case 'CAPTURE_SUCCESS':
            if (mountedRef.current) {
              setIsCapturing(false);
            }
            resolveCapture({
              status: 'success',
              message: 'Imagem capturada com sucesso',
              imageData: data.imageData,
            });
            break;

          case 'ERROR':
            if (mountedRef.current) {
              setIsCapturing(false);
            }
            resolveCapture({
              status: 'error',
              message: data.error || 'Erro desconhecido',
              error: new Error(data.error || 'Erro desconhecido'),
            });
            break;

          case 'CANCELLED':
            if (mountedRef.current) {
              setIsCapturing(false);
            }
            resolveCapture({
              status: 'cancelled',
              message: 'Captura cancelada pelo usuário',
            });
            break;
        }
      } catch (error) {
        console.error('[WebViewCapture] Erro ao processar mensagem:', error);
      }
    },
    [flushQueuedMessages, rejectInitialize, resolveCapture, resolveInitialize]
  );

  const initialize = useCallback(
    async (options: WebViewCaptureOptions) => {
      console.log('[WebViewCapture] Inicializando com opções:', options);
      setIsReady(false);

      return new Promise<void>((resolve, reject) => {
        clearInitializePending();

        const timeout = setTimeout(() => {
          pendingPromisesRef.current.initialize = undefined;
          reject(new Error('Timeout ao inicializar WebView/SDK'));
        }, 20000);

        pendingPromisesRef.current.initialize = { resolve, reject, timeout };

        sendMessageToWebView({
          type: 'INIT_CONFIG',
          config: options,
        });
      });
    },
    [clearInitializePending, sendMessageToWebView]
  );

  const startCapture = useCallback(async (): Promise<WebViewCaptureResult> => {
    return new Promise((resolve, reject) => {
      setIsCapturing(true);
      clearCapturePending();

      const timeout = setTimeout(() => {
        pendingPromisesRef.current.capture = undefined;
        if (mountedRef.current) {
          setIsCapturing(false);
        }
        resolve({
          status: 'error',
          message: 'Timeout na captura',
          error: new Error('Timeout na captura'),
        });
      }, 30000);

      pendingPromisesRef.current.capture = { resolve, reject, timeout };
      sendMessageToWebView({ type: 'START_CAPTURE' });
    });
  }, [clearCapturePending, sendMessageToWebView]);

  const stopCapture = useCallback(() => {
    console.log('[WebViewCapture] Parando captura');
    if (mountedRef.current) {
      setIsCapturing(false);
    }
    clearCapturePending();
    sendMessageToWebView({ type: 'STOP_CAPTURE' });
  }, [clearCapturePending, sendMessageToWebView]);

  const submitToBackend = useCallback(
    async (
      imageData: string,
      backendUrl: string,
      authUrl: string,
      retryOnAuthFailure = true
    ): Promise<BackendResponse> => {
      const livenessUrl = resolveLivenessUrl(backendUrl);
      const requestID = buildRequestId();
      const imageBase64 = stripImagePrefix(imageData);

      console.log('[WebViewCapture] Enviando imagem para backend Credify');
      console.log('[WebViewCapture] Liveness URL:', livenessUrl);

      let token: string | null = null;

      try {
        token = await resolveAuthToken(authUrl, backendUrl);
      } catch (authError) {
        console.warn('[WebViewCapture] Falha ao autenticar antes do envio:', authError);
      }

      const formData = new FormData();
      const payloadBlob = new Blob([imageBase64], { type: 'text/plain' });
      formData.append('file', payloadBlob, 'bdata');

      const headers: Record<string, string> = {
        'X-DEBUG': CREDIFY_CONFIG.WERO,
        LogAPITrigger: 'true',
        RequestID: requestID,
        requestID,
        application: CREDIFY_CONFIG.APPLICATION,
        wero: CREDIFY_CONFIG.WERO,
        keyurl: CREDIFY_CONFIG.AS_SERVER_CONFIG,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${livenessUrl}?ts=${Date.now()}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const responseText = await response.text();
      const payload = parseResponsePayload(responseText);

      if (response.status === 401 && retryOnAuthFailure) {
        authTokenRef.current = null;
        return submitToBackend(imageData, backendUrl, authUrl, false);
      }

      if (!response.ok) {
        const message =
          payload?.RESPOSTA?.LIVELINESS?.description ||
          payload?.RESPOSTA?.LIVELINESS?.message ||
          payload?.error ||
          payload?.message ||
          `Erro HTTP ${response.status}`;
        throw new Error(message);
      }

      return payload;
    },
    [resolveAuthToken]
  );

  const validateResponse = useCallback((response: BackendResponse): boolean => {
    return Boolean(
      response?.RESPOSTA?.LIVELINESS?.code === 200 ||
        response?.success === true ||
        response?.status === 'success'
    );
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
      'Erro desconhecido no backend'
    );
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
