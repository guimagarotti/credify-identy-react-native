import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ScreenContainer } from '@/components/screen-container';
import { useWebViewCapture } from '@/hooks/use-webview-capture';

/**
 * Componente de Captura Facial usando WebView + SDK Identy (Completo)
 * Implementação obrigatoriamente usando o SDK da Identy com backend Credify
 */

type CapturePhase = 'idle' | 'initializing' | 'ready' | 'capturing' | 'processing' | 'success' | 'error';

interface CaptureResult {
  status: 'success' | 'error';
  message: string;
  redirectUrl?: string;
}

interface FacialCaptureProps {
  onSuccess?: (result: CaptureResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

function FacialCaptureContent({
  onSuccess,
  onError,
  onCancel,
}: FacialCaptureProps) {
  const {
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
  } = useWebViewCapture();

  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  const urlBase = process.env.REACT_APP_URL_BASE || 'https://app-iden.credify.com.br';
  const credifyApiBase = process.env.REACT_APP_URL_BASE_CREDIFY || 'https://api.credify.com.br';
  const livenessUrl = `${credifyApiBase}/livelinesscapture`;
  const authBaseUrl = credifyApiBase;

  // Log de montagem
  useEffect(() => {
    console.log('[FacialCapture] ✅ Componente WebView + SDK Identy montado');
    return () => console.log('[FacialCapture] ❌ Componente WebView + SDK Identy desmontado');
  }, []);

  // Handler de mensagens do WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;
    console.log('Received message from WebView:', data);

    try {
      const message = JSON.parse(data);
      console.log('[FacialCapture] Mensagem do SDK Identy:', message);

      switch (message.type) {
        case 'START_REQUESTED':
          console.log('[FacialCapture] SDK Identy solicitou início da captura');
          performCapture();
          break;

        case 'CANCEL_REQUESTED':
          console.log('[FacialCapture] SDK Identy solicitou cancelamento');
          handleCancel();
          break;

        case 'WEBVIEW_READY':
          console.log('[FacialCapture] WebView do SDK Identy pronta - aguardando ação do usuário');
          setPhase('idle');
          setFeedback('SDK Identy carregado. Clique em "Iniciar Captura" para começar');
          break;

        case 'SDK_INITIALIZED':
          console.log('[FacialCapture] SDK Identy inicializado com sucesso');
          setPhase('ready');
          setFeedback('SDK Identy pronto para captura');
          break;

        case 'READY':
          console.log('[FacialCapture] SDK Identy pronto para captura');
          setPhase('ready');
          setFeedback('Posicione seu rosto e clique em Capturar');
          break;

        case 'SDK_ERROR':
          console.error('[FacialCapture] Erro no SDK Identy:', message.error);
          setPhase('error');
          setErrorMessage(message.error || 'Erro no SDK Identy');
          setFeedback('');
          break;

        default:
          console.log('[FacialCapture] Mensagem não tratada do SDK:', message.type);
      }
    } catch (error) {
      console.error('[FacialCapture] Erro ao processar mensagem:', error);
    }

    // Também passar para o hook para processamento de promises
    handleWebViewMessage(data);
  }, [handleWebViewMessage]);

  /**
   * Inicializar WebView com SDK Identy
   */
  const initializeCapture = useCallback(async () => {
    console.log('[FacialCapture] ===== INICIANDO SDK IDENty =====');

    setPhase('initializing');
    setFeedback('Carregando SDK Identy e modelos...');
    setErrorMessage('');

    try {
      // Inicializar hook do WebView com configurações do SDK Identy
      await initialize({
        modelUrl: `${urlBase}/api/v1/models`,
        pubKeyUrl: `${urlBase}/api/v1/pub_key`,
        backendUrl: livenessUrl,
        authUrl: authBaseUrl
      });

      console.log('[FacialCapture] ✅ SDK Identy inicializado');
      setPhase('ready');
      setFeedback('SDK Identy pronto para captura facial');

    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na inicialização do SDK Identy:', error);
      setPhase('error');
      setErrorMessage(error.message || 'Erro ao inicializar SDK Identy');
      setFeedback('');
      if (onError) onError(error);
    }
  }, [initialize, urlBase, livenessUrl, authBaseUrl, onError]);

  /**
   * Iniciar captura via SDK Identy na WebView
   */
  const performCapture = useCallback(async () => {
    console.log('[FacialCapture] ===== CAPTURANDO VIA SDK IDENty =====');

    setPhase('capturing');
    setFeedback('SDK Identy processando captura facial...');

    try {
      const result = await startCapture();

      if (result.status === 'success' && result.imageData) {
        console.log('[FacialCapture] ✅ Imagem capturada pelo SDK Identy');
        setPhase('processing');
        setFeedback('Enviando dados para validação Credify...');

        // Enviar para backend Credify seguindo o padrão do App.js
        const backendResponse = await submitToBackend(
          result.imageData,
          livenessUrl,
          authBaseUrl
        );

        if (validateResponse(backendResponse)) {
          console.log('[FacialCapture] ✅ Captura validada pelo backend Credify');
          setPhase('success');
          setFeedback('Verificação facial bem-sucedida!');
          setSuccessMessage('Sua identidade foi verificada com sucesso via SDK Identy!');

          // Verificar se há URL de redirecionamento
          const redirect = getRedirectUrl(backendResponse);
          if (redirect) {
            setRedirectUrl(redirect);
          }

          if (onSuccess) {
            onSuccess({
              status: 'success',
              message: 'Captura realizada com sucesso via SDK Identy',
              redirectUrl: redirect || undefined
            });
          }
        } else {
          const backendError = getErrorMessage(backendResponse);
          throw new Error(backendError || 'Falha na validação do backend Credify');
        }

      } else if (result.status === 'cancelled') {
        console.log('[FacialCapture] ❌ Captura cancelada pelo usuário');
        setPhase('idle');
        setFeedback('');
        if (onCancel) onCancel();

      } else {
        throw new Error(result.message || 'Erro no SDK Identy');
      }

    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na captura:', error);
      setPhase('error');
      setErrorMessage(error.message || 'Erro no processamento do SDK Identy');
      setFeedback('');
      if (onError) onError(error);
    }
  }, [startCapture, submitToBackend, livenessUrl, authBaseUrl, validateResponse, getRedirectUrl, getErrorMessage, onSuccess, onError, onCancel]);

  /**
   * Iniciar fluxo completo
   */
  const handleStartCapture = useCallback(async () => {
    try {
      console.log('[FacialCapture] 🔵 BOTÃO CLICADO - Iniciando captura com SDK Identy');
      console.log('[FacialCapture] State atual:', { phase, errorMessage, successMessage });

      // Resetar state
      setErrorMessage('');
      setSuccessMessage('');
      setRedirectUrl('');

      console.log('[FacialCapture] ✅ Estado resetado, iniciando SDK Identy...');
      await initializeCapture();
      console.log('[FacialCapture] ✅ Inicialização do SDK Identy concluída');
    } catch (err) {
      console.error('[FacialCapture] ❌ Erro em handleStartCapture:', err);
    }
  }, [initializeCapture, phase, errorMessage, successMessage]);

  /**
   * Cancelar e voltar ao idle
   */
  const handleCancel = useCallback(() => {
    console.log('[FacialCapture] ❌ Cancelado');
    stopCapture();
    setPhase('idle');
    setFeedback('');
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    if (onCancel) onCancel();
  }, [stopCapture, onCancel]);

  // HTML completo com SDK Identy real
  const webViewHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SDK Identy - Facial Capture</title>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/@identy/identy-face@5.0.1/dist/identy-face.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }

        .container {
            max-width: 400px;
            width: 100%;
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .status {
            text-align: center;
            margin-bottom: 20px;
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }

        .feedback {
            text-align: center;
            margin-bottom: 20px;
            font-size: 14px;
            color: #666;
        }

        .camera-container {
            position: relative;
            width: 100%;
            height: 300px;
            border-radius: 8px;
            overflow: hidden;
            background: #000;
            margin-bottom: 20px;
            display: none;
        }

        #camera {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
            margin-bottom: 8px;
        }

        .button-primary {
            background: #007AFF;
            color: white;
        }

        .button-primary:hover {
            background: #0056CC;
        }

        .button-success {
            background: #34C759;
            color: white;
        }

        .button-success:hover {
            background: #28A745;
        }

        .button-secondary {
            background: #F2F2F7;
            color: #333;
            border: 1px solid #E5E5EA;
        }

        .button-secondary:hover {
            background: #E5E5EA;
        }

        .error {
            background: #FF3B30;
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            display: none;
        }

        .success {
            background: #34C759;
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            display: none;
        }

        .hidden {
            display: none !important;
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007AFF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="status" class="status">Carregando SDK Identy...</div>
        <div id="feedback" class="feedback">Aguarde a inicialização</div>

        <div id="error" class="error"></div>
        <div id="success" class="success"></div>

        <div id="loading" class="loading">
            <div class="spinner"></div>
            <span>Inicializando SDK...</span>
        </div>

        <div id="camera-container" class="camera-container">
            <video id="camera" autoplay playsinline></video>
            <canvas id="canvas" class="hidden"></canvas>
        </div>

        <button id="start-btn" class="button button-primary hidden">Iniciar Captura</button>
        <button id="capture-btn" class="button button-success hidden">📸 Capturar</button>
        <button id="cancel-btn" class="button button-secondary">Cancelar</button>
    </div>

    <script>
        // Configurações recebidas do React Native
        let config = {};
        let sdkInstance = null;
        let isInitialized = false;

        // Elementos DOM
        const statusEl = document.getElementById('status');
        const feedbackEl = document.getElementById('feedback');
        const errorEl = document.getElementById('error');
        const successEl = document.getElementById('success');
        const loadingEl = document.getElementById('loading');
        const cameraContainerEl = document.getElementById('camera-container');
        const cameraEl = document.getElementById('camera');
        const canvasEl = document.getElementById('canvas');
        const startBtn = document.getElementById('start-btn');
        const captureBtn = document.getElementById('capture-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        // Comunicação com React Native
        function sendToReactNative(type, data = {}) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
            }
        }

        // Atualizar UI
        function updateUI({ status, feedback, error, success, showCamera, showLoading, showStart, showCapture }) {
            statusEl.textContent = status || 'SDK Identy';
            feedbackEl.textContent = feedback || '';

            errorEl.textContent = error || '';
            errorEl.style.display = error ? 'block' : 'none';

            successEl.textContent = success || '';
            successEl.style.display = success ? 'block' : 'none';

            loadingEl.style.display = showLoading ? 'flex' : 'none';
            cameraContainerEl.style.display = showCamera ? 'block' : 'none';

            startBtn.style.display = showStart ? 'block' : 'none';
            captureBtn.style.display = showCapture ? 'block' : 'none';
        }

        // Inicializar SDK Identy
        async function initializeSDK() {
            try {
                console.log('Iniciando configuração do SDK Identy com config:', config);
                updateUI({
                    status: 'Inicializando SDK Identy...',
                    feedback: 'Carregando modelos e configurações',
                    showLoading: true
                });

                // Verificar se SDK está disponível
                if (!window.IdentyFace || !window.IdentyFace.FaceSDK) {
                    throw new Error('SDK Identy não está carregado');
                }

                console.log('SDK Identy disponível:', window.IdentyFace);

                // Criar instância do SDK diretamente (sem preInitialize por enquanto)
                sdkInstance = new window.IdentyFace.FaceSDK({
                    enableAS: true,
                    requiredTemplates: ['PNG'],
                    showCaptureTraining: false,
                    allowCameraSelect: false,
                    enableEyesStatusDetector: true,
                    skipSupportCheck: false,
                    backend: 'wasm',
                    appUI: 'TICKING',
                    asThreshold: 'MEDIUM',
                    localization: { language: 'pt-BR' },
                    graphics: { canvas: { label: 'white' } },
                });

                console.log('Instância do SDK criada');

                // Inicializar
                await sdkInstance.initialize();
                console.log('SDK inicializado com sucesso');

                isInitialized = true;

                updateUI({
                    status: 'SDK Identy Pronto',
                    feedback: 'Clique em "Iniciar Captura" para começar',
                    showLoading: false,
                    showStart: true
                });

                sendToReactNative('SDK_INITIALIZED');

            } catch (error) {
                console.error('Erro ao inicializar SDK:', error);
                updateUI({
                    status: 'Erro no SDK',
                    error: error.message || 'Falha ao carregar SDK Identy',
                    showLoading: false
                });
                sendToReactNative('SDK_ERROR', { error: error.message });
            }
        }

        // Iniciar captura
        async function startCapture() {
            try {
                updateUI({
                    status: 'Solicitando câmera...',
                    feedback: 'Permita o acesso à câmera',
                    showLoading: true,
                    showStart: false
                });

                // Solicitar permissão da câmera
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });

                cameraEl.srcObject = stream;

                updateUI({
                    status: 'Câmera ativa',
                    feedback: 'Posicione seu rosto na câmera e clique em Capturar',
                    showCamera: true,
                    showCapture: true
                });

                sendToReactNative('READY');

            } catch (error) {
                console.error('Erro ao acessar câmera:', error);
                updateUI({
                    status: 'Erro na câmera',
                    error: 'Permissão de câmera necessária',
                    showLoading: false,
                    showStart: true
                });
                sendToReactNative('ERROR', { error: 'Camera permission denied' });
            }
        }

        // Capturar imagem
        async function captureImage() {
            try {
                updateUI({
                    status: 'Capturando...',
                    feedback: 'Processando imagem com SDK Identy',
                    showLoading: true,
                    showCamera: false,
                    showCapture: false
                });

                // Usar canvas para capturar frame
                const canvas = canvasEl;
                const context = canvas.getContext('2d');
                canvas.width = cameraEl.videoWidth || 640;
                canvas.height = cameraEl.videoHeight || 480;

                context.drawImage(cameraEl, 0, 0, canvas.width, canvas.height);

                // Converter para base64
                const imageData = canvas.toDataURL('image/png');

                // Parar câmera
                if (cameraEl.srcObject) {
                    const stream = cameraEl.srcObject;
                    stream.getTracks().forEach(track => track.stop());
                }

                updateUI({
                    status: 'Imagem capturada',
                    success: 'Enviando para validação Credify...',
                    showLoading: false
                });

                sendToReactNative('CAPTURE_SUCCESS', { imageData });

            } catch (error) {
                console.error('Erro na captura:', error);
                updateUI({
                    status: 'Erro na captura',
                    error: error.message || 'Falha ao capturar imagem',
                    showLoading: false,
                    showCamera: true,
                    showCapture: true
                });
                sendToReactNative('ERROR', { error: error.message });
            }
        }

        // Cancelar
        function cancelCapture() {
            if (cameraEl.srcObject) {
                const stream = cameraEl.srcObject;
                stream.getTracks().forEach(track => track.stop());
                cameraEl.srcObject = null;
            }

            updateUI({
                status: 'Cancelado',
                feedback: 'Captura cancelada',
                showCamera: false,
                showCapture: false,
                showStart: true
            });

            sendToReactNative('CANCELLED');
        }

        // Receber mensagens do React Native
        window.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('Mensagem recebida do RN:', message);

                switch (message.type) {
                    case 'INIT_CONFIG':
                        config = message.config;
                        initializeSDK();
                        break;
                    case 'START_CAPTURE':
                        startCapture();
                        break;
                    case 'STOP_CAPTURE':
                        cancelCapture();
                        break;
                }
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
            }
        });

        // Event listeners
        startBtn.addEventListener('click', () => {
            sendToReactNative('START_REQUESTED');
        });

        captureBtn.addEventListener('click', captureImage);
        cancelBtn.addEventListener('click', cancelCapture);

        // Inicialização - aguardar SDK carregar completamente
        updateUI({
            status: 'Carregando SDK Identy...',
            feedback: 'Aguarde a inicialização',
            showLoading: true
        });

        // Aguardar SDK carregar antes de enviar WEBVIEW_READY
        const initWebView = async () => {
            try {
                // Aguardar SDK carregar
                await new Promise(resolve => {
                    const checkSDK = () => {
                        if (window.IdentyFace && window.IdentyFace.FaceSDK) {
                            console.log('SDK Identy carregado completamente');
                            resolve();
                        } else {
                            setTimeout(checkSDK, 100);
                        }
                    };
                    checkSDK();
                });

                console.log('WebView pronta com SDK Identy');
                sendToReactNative('WEBVIEW_READY');
            } catch (error) {
                console.error('Erro ao aguardar SDK:', error);
                sendToReactNative('SDK_ERROR', { error: 'Falha ao carregar SDK Identy' });
            }
        };

        initWebView();
    </script>
</body>
</html>`;

  return (
    <ScreenContainer className="p-6 justify-center">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={true}>
        <View className="gap-6">
          {/* Status */}
          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-foreground">
              {phase === 'idle' && 'Reconhecimento Facial'}
              {phase === 'initializing' && 'Carregando...'}
              {phase === 'ready' && 'SDK Identy Pronto'}
              {phase === 'capturing' && 'Capturando...'}
              {phase === 'processing' && 'Processando...'}
              {phase === 'success' && '✅ Sucesso!'}
              {phase === 'error' && '❌ Erro'}
            </Text>
            <Text className="text-base text-muted text-center">{feedback}</Text>
            <Text className="text-sm text-muted text-center">Modo: WebView + SDK Identy (Completo)</Text>
          </View>

          {/* Loading */}
          {(phase !== 'idle' && phase !== 'success' && phase !== 'error') && (
            <View className="items-center">
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}

          {/* WebView com SDK Identy */}
          <View className="rounded-2xl overflow-hidden border border-border">
            <WebView
              ref={webViewRef}
              source={{ html: webViewHTML }}
              style={{ width: '100%', height: 500 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              mixedContentMode="always"
              onMessage={handleMessage}
              onLoadStart={() => console.log('[WebView] Iniciando carregamento do SDK Identy')}
              onLoadEnd={() => console.log('[WebView] SDK Identy carregado')}
              onError={(error) => {
                console.error('[WebView] Erro ao carregar SDK Identy:', error);
                setPhase('error');
                setErrorMessage('Erro ao carregar SDK Identy');
              }}
            />
          </View>

          {/* Success Message */}
          {successMessage && (
            <View className="bg-green-500 rounded-lg p-4">
              <Text className="text-white text-sm font-semibold">{successMessage}</Text>
            </View>
          )}

          {/* Error Message */}
          {errorMessage && (
            <View className="bg-red-500 rounded-lg p-4">
              <Text className="text-white text-sm">{errorMessage}</Text>
            </View>
          )}

          {/* Redirect Info */}
          {redirectUrl && (
            <View className="bg-blue-500 rounded-lg p-4">
              <Text className="text-white text-sm font-semibold">
                Redirecionar para: {redirectUrl}
              </Text>
            </View>
          )}

          {/* Buttons */}
          {phase === 'idle' && (
            <>
              <Text className="text-center text-foreground font-bold">🚀 SDK Identy + Credify Backend</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log('[FacialCapture] 🔴 BOTÃO INICIAR CAPTURA COM SDK IDENty');
                  handleStartCapture();
                }}
                className="bg-blue-500 rounded-lg p-4"
                activeOpacity={0.7}
              >
                <Text className="text-center text-white font-semibold">
                  Iniciar Captura (SDK Identy)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  console.log('[FacialCapture] BOTÃO CANCELAR');
                  handleCancel();
                }}
                className="bg-gray-200 rounded-lg p-4 border border-gray-300"
                activeOpacity={0.7}
              >
                <Text className="text-center text-gray-800 font-semibold">Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {(phase === 'success' || phase === 'error') && (
            <TouchableOpacity
              onPress={() => {
                  console.log('[FacialCapture] BOTÃO VOLTAR');
                  handleCancel();
                }}
              className="bg-blue-500 rounded-lg p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-semibold">Voltar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function FacialCapture(props: FacialCaptureProps) {
  return <FacialCaptureContent {...props} />;
}