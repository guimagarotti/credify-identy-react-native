import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';

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
}

export function useWebViewCapture() {
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const webViewRef = useRef<any>(null);

  // Estado para promises pendentes
  const [pendingPromises, setPendingPromises] = useState<{
    initialize?: { resolve: () => void; reject: (error: Error) => void; timeout: number };
    capture?: { resolve: (result: WebViewCaptureResult) => void; reject: (error: Error) => void; timeout: number };
  }>({});

  const sendMessageToWebView = useCallback((message: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(message));
    }
  }, []);

  // Processar mensagens da WebView
  const handleWebViewMessage = useCallback((input: any) => {
    try {
      // Aceitar tanto o formato antigo (event.nativeEvent.data) quanto string direta
      const rawData = typeof input === 'string' ? input : input?.nativeEvent?.data;
      if (!rawData) {
        console.error('[WebViewCapture] Dados da mensagem não encontrados:', input);
        return;
      }

      const data = JSON.parse(rawData);
      console.log('[WebViewCapture] Mensagem recebida:', data);

      // Processar mensagens específicas do hook
      switch (data.type) {
        case 'WEBVIEW_READY':
          console.log('[WebViewCapture] WebView pronta');
          break;

        case 'SDK_INITIALIZED':
          console.log('[WebViewCapture] SDK inicializado com sucesso');
          setIsReady(true);
          // Resolver promise de inicialização se existir
          if (pendingPromises.initialize) {
            clearTimeout(pendingPromises.initialize.timeout);
            pendingPromises.initialize.resolve();
            setPendingPromises(prev => ({ ...prev, initialize: undefined }));
          }
          break;

        case 'SDK_ERROR':
          console.error('[WebViewCapture] Erro no SDK:', data.error);
          // Rejeitar promise de inicialização se existir
          if (pendingPromises.initialize) {
            clearTimeout(pendingPromises.initialize.timeout);
            pendingPromises.initialize.reject(new Error(data.error || 'Erro na inicialização do SDK'));
            setPendingPromises(prev => ({ ...prev, initialize: undefined }));
          }
          break;

        case 'CAPTURE_SUCCESS':
          setIsCapturing(false);
          if (pendingPromises.capture) {
            clearTimeout(pendingPromises.capture.timeout);
            pendingPromises.capture.resolve({
              status: 'success',
              message: 'Imagem capturada com sucesso',
              imageData: data.imageData
            });
            setPendingPromises(prev => ({ ...prev, capture: undefined }));
          }
          break;

        case 'ERROR':
          setIsCapturing(false);
          if (pendingPromises.capture) {
            clearTimeout(pendingPromises.capture.timeout);
            pendingPromises.capture.resolve({
              status: 'error',
              message: data.error || 'Erro desconhecido',
              error: new Error(data.error)
            });
            setPendingPromises(prev => ({ ...prev, capture: undefined }));
          }
          break;

        case 'CANCELLED':
          setIsCapturing(false);
          if (pendingPromises.capture) {
            clearTimeout(pendingPromises.capture.timeout);
            pendingPromises.capture.resolve({
              status: 'cancelled',
              message: 'Captura cancelada pelo usuário'
            });
            setPendingPromises(prev => ({ ...prev, capture: undefined }));
          }
          break;
      }

    } catch (error) {
      console.error('[WebViewCapture] Erro ao processar mensagem:', error);
    }
  }, [pendingPromises]);

  const initialize = useCallback(async (options: WebViewCaptureOptions) => {
    console.log('[WebViewCapture] Inicializando com opções:', options);

    // Enviar configuração para a WebView
    sendMessageToWebView({
      type: 'INIT_CONFIG',
      config: options
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao inicializar WebView'));
        setPendingPromises(prev => ({ ...prev, initialize: undefined }));
      }, 15000);

      setPendingPromises(prev => ({
        ...prev,
        initialize: { resolve, reject, timeout }
      }));
    });
  }, [sendMessageToWebView]);

  const startCapture = useCallback(async (): Promise<WebViewCaptureResult> => {
    return new Promise((resolve, reject) => {
      setIsCapturing(true);

      const timeout = setTimeout(() => {
        setIsCapturing(false);
        setPendingPromises(prev => ({ ...prev, capture: undefined }));
        resolve({
          status: 'error',
          message: 'Timeout na captura',
          error: new Error('Timeout na captura')
        });
      }, 30000);

      setPendingPromises(prev => ({
        ...prev,
        capture: { resolve, reject, timeout }
      }));

      // Iniciar captura
      sendMessageToWebView({ type: 'START_CAPTURE' });
    });
  }, [sendMessageToWebView]);

  const stopCapture = useCallback(() => {
    console.log('[WebViewCapture] Parando captura');
    setIsCapturing(false);
    sendMessageToWebView({ type: 'STOP_CAPTURE' });
  }, [sendMessageToWebView]);

  const submitToBackend = useCallback(async (
    imageData: string,
    backendUrl: string,
    authUrl: string
  ): Promise<BackendResponse> => {
    try {
      console.log('[WebViewCapture] Enviando imagem para backend Credify');

      // Converter base64 para blob
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Criar FormData seguindo o padrão do App.js
      const formData = new FormData();
      formData.append('image', new Blob([bytes], { type: 'image/png' }), 'capture.png');

      // Headers seguindo o padrão do App.js
      const headers: Record<string, string> = {
        'LogAPITrigger': 'true',
        'requestID': `webview-${Date.now()}`,
      };

      // Obter token de autenticação se necessário
      try {
        // Aqui você pode implementar a lógica para obter o token
        // Por enquanto, assumimos que o backend aceita sem auth ou usa headers padrão
        console.log('[WebViewCapture] Headers de autenticação:', headers);
      } catch (authError) {
        console.warn('[WebViewCapture] Erro ao obter token de auth:', authError);
      }

      // Enviar para backend
      const response = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
      }

      const result: BackendResponse = await response.json();
      console.log('[WebViewCapture] Resposta do backend Credify:', result);

      return result;

    } catch (error) {
      console.error('[WebViewCapture] Erro ao enviar para backend:', error);
      throw error;
    }
  }, []);

  const validateResponse = useCallback((response: BackendResponse): boolean => {
    // Validação baseada no padrão esperado do backend Credify
    return Boolean(response.success === true ||
           response.status === 'success' ||
           (response.message && !response.error));
  }, []);

  const getRedirectUrl = useCallback((response: BackendResponse): string | null => {
    return response.redirectUrl || null;
  }, []);

  const getErrorMessage = useCallback((response: BackendResponse): string => {
    return response.error || response.message || 'Erro desconhecido no backend';
  }, []);

  return {
    webViewRef,
    isReady,
    isCapturing,
    initialize,
    startCapture,
    stopCapture,
    submitToBackend,
    validateResponse,
    getRedirectUrl,
    getErrorMessage,
    handleWebViewMessage,
    sendMessageToWebView
  };
}