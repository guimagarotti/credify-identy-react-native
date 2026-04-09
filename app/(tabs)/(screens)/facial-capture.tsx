import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ScreenContainer } from '@/components/screen-container';
import { useWebViewCapture } from '@/hooks/use-webview-capture';

type CapturePhase =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'success'
  | 'error';

type CaptureMode = 'sdk' | 'fallback' | 'unknown';

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

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/livelinesscapture$/i, '');
}

function buildLivenessUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return /\/livelinesscapture$/i.test(normalized)
    ? normalized
    : `${normalizeApiBase(normalized)}/livelinesscapture`;
}

function buildWebViewHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Credify + Identy</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1220;
      color: #f8fafc;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 18px;
      padding: 18px;
      width: 100%;
      min-height: 460px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      justify-content: flex-start;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      text-align: center;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.4;
    }
    .status {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 14px;
      text-align: center;
    }
    .status-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .status-feedback {
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.4;
    }
    .badge {
      align-self: center;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: #1d4ed8;
      color: white;
    }
    .badge.fallback {
      background: #92400e;
    }
    .message {
      display: none;
      padding: 12px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
    }
    .message.error {
      background: rgba(239, 68, 68, 0.16);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #fecaca;
    }
    .message.success {
      background: rgba(34, 197, 94, 0.16);
      border: 1px solid rgba(34, 197, 94, 0.45);
      color: #bbf7d0;
    }
    .loading {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 8px 0;
      color: #cbd5e1;
      font-size: 13px;
    }
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top-color: #60a5fa;
      border-radius: 999px;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .camera-shell {
      display: none;
      border-radius: 16px;
      overflow: hidden;
      background: #000;
      aspect-ratio: 3 / 4;
      width: 100%;
      position: relative;
      border: 1px solid #1f2937;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
    }
    canvas {
      display: none;
    }
    .camera-guide {
      position: absolute;
      inset: 14% 10%;
      border: 3px solid rgba(96, 165, 250, 0.8);
      border-radius: 999px;
      pointer-events: none;
      box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.18);
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: auto;
    }
    button {
      width: 100%;
      border: none;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }
    button.primary {
      background: #2563eb;
      color: white;
    }
    button.success {
      background: #16a34a;
      color: white;
      display: none;
    }
    button.secondary {
      background: #e5e7eb;
      color: #111827;
    }
    .hint {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Captura Facial</div>
    <div class="subtitle">Fluxo compatível com React Native + Expo Go usando WebView, com tentativa de ativação do SDK web da Identy quando disponível.</div>

    <div id="mode-badge" class="badge">Aguardando configuração</div>

    <div class="status">
      <div id="status-title" class="status-title">WebView pronta</div>
      <div id="status-feedback" class="status-feedback">Aguardando o aplicativo enviar as configurações da captura.</div>
    </div>

    <div id="error-box" class="message error"></div>
    <div id="success-box" class="message success"></div>

    <div id="loading" class="loading">
      <div class="spinner"></div>
      <span id="loading-text">Preparando captura...</span>
    </div>

    <div id="camera-shell" class="camera-shell">
      <video id="camera" autoplay playsinline muted></video>
      <canvas id="canvas"></canvas>
      <div class="camera-guide"></div>
    </div>

    <div class="actions">
      <button id="start-btn" class="primary" type="button">Iniciar captura</button>
      <button id="capture-btn" class="success" type="button">Capturar imagem</button>
      <button id="cancel-btn" class="secondary" type="button">Cancelar</button>
      <div class="hint">Se o SDK web da Identy não responder dentro do WebView, o app ativa automaticamente um modo compatível para não travar a experiência no iPhone/Expo Go.</div>
    </div>
  </div>

  <script>
    (function () {
      var config = null;
      var sdkInstance = null;
      var sdkMode = 'unknown';
      var sdkReady = false;
      var prepareStarted = false;
      var cameraStream = null;
      var scriptUrls = [
        'https://cdn.jsdelivr.net/npm/@identy/identy-face@5.0.1/dist/identy-face.js',
        'https://unpkg.com/@identy/identy-face@5.0.1/dist/identy-face.js'
      ];

      var statusTitle = document.getElementById('status-title');
      var statusFeedback = document.getElementById('status-feedback');
      var modeBadge = document.getElementById('mode-badge');
      var errorBox = document.getElementById('error-box');
      var successBox = document.getElementById('success-box');
      var loadingBox = document.getElementById('loading');
      var loadingText = document.getElementById('loading-text');
      var cameraShell = document.getElementById('camera-shell');
      var camera = document.getElementById('camera');
      var canvas = document.getElementById('canvas');
      var startBtn = document.getElementById('start-btn');
      var captureBtn = document.getElementById('capture-btn');
      var cancelBtn = document.getElementById('cancel-btn');

      function sendToReactNative(type, data) {
        if (!window.ReactNativeWebView) {
          return;
        }
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data || {})));
      }

      function log(message, details) {
        console.log('[IdentyWebView] ' + message, details || '');
        sendToReactNative('WEBVIEW_LOG', {
          message: message,
          details: details || null,
        });
      }

      function updateStartButtonLabel() {
        startBtn.textContent = sdkMode === 'fallback' ? 'Usar câmera nativa' : 'Iniciar captura';
      }

      function setMode(mode, label) {
        sdkMode = mode;
        modeBadge.textContent = label;
        modeBadge.className = 'badge' + (mode === 'fallback' ? ' fallback' : '');
        updateStartButtonLabel();
      }

      function withTimeout(promise, timeoutMs, errorMessage) {
        return Promise.race([
          promise,
          new Promise(function (_, reject) {
            setTimeout(function () {
              reject(new Error(errorMessage));
            }, timeoutMs);
          })
        ]);
      }

      function updateUI(options) {
        statusTitle.textContent = options.status || 'Captura Facial';
        statusFeedback.textContent = options.feedback || '';

        errorBox.textContent = options.error || '';
        errorBox.style.display = options.error ? 'block' : 'none';

        successBox.textContent = options.success || '';
        successBox.style.display = options.success ? 'block' : 'none';

        loadingBox.style.display = options.showLoading ? 'flex' : 'none';
        loadingText.textContent = options.loadingText || 'Preparando captura...';

        cameraShell.style.display = options.showCamera ? 'block' : 'none';
        startBtn.style.display = options.showStart ? 'block' : 'none';
        captureBtn.style.display = options.showCapture ? 'block' : 'none';
      }

      function stopCamera() {
        if (!cameraStream) {
          return;
        }

        var tracks = cameraStream.getTracks ? cameraStream.getTracks() : [];
        tracks.forEach(function (track) {
          try {
            track.stop();
          } catch (error) {
            console.warn('Falha ao parar track da câmera', error);
          }
        });

        cameraStream = null;
        camera.srcObject = null;
      }

      function getSdkGlobal() {
        if (window.IdentyFace && window.IdentyFace.FaceSDK) {
          return window.IdentyFace;
        }
        if (window.Identy && window.Identy.FaceSDK) {
          return window.Identy;
        }
        return null;
      }

      function loadScript(url) {
        return new Promise(function (resolve, reject) {
          var existing = document.querySelector('script[data-identy-url="' + url + '"]');
          if (existing) {
            resolve();
            return;
          }

          var script = document.createElement('script');
          script.src = url;
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.setAttribute('data-identy-url', url);

          var timeoutId = setTimeout(function () {
            reject(new Error('Timeout ao carregar script do SDK'));
          }, 7000);

          script.onload = function () {
            clearTimeout(timeoutId);
            resolve();
          };

          script.onerror = function () {
            clearTimeout(timeoutId);
            reject(new Error('Falha ao carregar script do SDK'));
          };

          document.head.appendChild(script);
        });
      }

      function activateFallback(reason) {
        sdkReady = true;
        setMode('fallback', 'Modo compatível Expo Go');
        updateUI({
          status: 'Modo compatível ativo',
          feedback: 'O SDK web não respondeu no WebView. A captura continuará em modo compatível para evitar travamentos.',
          success: reason ? 'Detalhe: ' + reason : '',
          showLoading: false,
          showStart: true,
          showCapture: false,
          showCamera: false,
        });
        sendToReactNative('SDK_FALLBACK', { reason: reason || 'SDK web indisponível no WebView' });
      }

      async function initializeSdkFromGlobal(sdkGlobal, source) {
        try {
          if (!sdkGlobal || !sdkGlobal.FaceSDK) {
            throw new Error('FaceSDK não encontrado no objeto global');
          }

          setMode('sdk', 'SDK Identy ativo');
          updateUI({
            status: 'Inicializando SDK Identy',
            feedback: 'Carregando configurações e dependências do SDK',
            showLoading: true,
            loadingText: 'Inicializando SDK Identy...',
          });

          if (typeof sdkGlobal.FaceSDK.preInitialize === 'function' && config && config.modelUrl && config.pubKeyUrl) {
            try {
              sdkGlobal.FaceSDK.preInitialize(
                { URL: config.modelUrl },
                {
                  URL: {
                    url: config.pubKeyUrl,
                    headers: [
                      { name: 'LogAPITrigger', value: 'true' },
                      { name: 'requestID', value: String(Date.now()) }
                    ]
                  }
                }
              );
            } catch (preInitError) {
              log('preInitialize falhou, seguindo com modo compatível', preInitError && preInitError.message ? preInitError.message : String(preInitError));
              activateFallback('preInitialize falhou no WebView');
              return;
            }
          }

          try {
            sdkInstance = new sdkGlobal.FaceSDK({
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

            if (sdkInstance && typeof sdkInstance.initialize === 'function') {
              await withTimeout(
                Promise.resolve(sdkInstance.initialize()),
                8000,
                'Timeout ao inicializar SDK Identy no WebView'
              );
            }

            sdkReady = true;
            updateUI({
              status: 'SDK Identy pronto',
              feedback: 'O SDK foi preparado. Toque em "Iniciar captura" para abrir a câmera.',
              showLoading: false,
              showStart: true,
            });
            sendToReactNative('SDK_INITIALIZED', { mode: 'sdk', source: source });
          } catch (sdkInitError) {
            log('Inicialização do SDK falhou no WebView', sdkInitError && sdkInitError.message ? sdkInitError.message : String(sdkInitError));
            activateFallback('SDK carregado, mas não inicializou no WebView');
          }
        } catch (error) {
          activateFallback(error && error.message ? error.message : 'Erro ao inicializar SDK');
        }
      }

      async function prepareSdk() {
        if (prepareStarted) {
          return;
        }

        prepareStarted = true;
        sendToReactNative('SDK_LOADING', { stage: 'prepare' });

        updateUI({
          status: 'Preparando captura',
          feedback: 'Tentando ativar o SDK Identy dentro do WebView',
          showLoading: true,
          loadingText: 'Verificando SDK Identy...',
        });

        var globalSdk = getSdkGlobal();
        if (globalSdk) {
          await initializeSdkFromGlobal(globalSdk, 'global-existente');
          return;
        }

        var lastError = '';
        for (var i = 0; i < scriptUrls.length; i += 1) {
          var url = scriptUrls[i];
          try {
            await loadScript(url);
            globalSdk = getSdkGlobal();
            if (globalSdk) {
              await initializeSdkFromGlobal(globalSdk, url);
              return;
            }
            lastError = 'Script carregado sem expor FaceSDK em objeto global';
          } catch (error) {
            lastError = error && error.message ? error.message : String(error);
            log('Tentativa de carregar SDK falhou', { url: url, error: lastError });
          }
        }

        activateFallback(lastError || 'Não foi possível ativar o SDK Identy no WebView');
      }

      async function startCapture() {
        try {
          if (!config) {
            throw new Error('Configuração ainda não recebida do aplicativo');
          }

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('getUserMedia não está disponível neste WebView');
          }

          updateUI({
            status: 'Solicitando câmera',
            feedback: 'Permita o acesso à câmera para continuar',
            showLoading: true,
            loadingText: 'Abrindo câmera...',
            showStart: false,
          });

          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 720 },
              height: { ideal: 960 }
            },
            audio: false,
          });

          camera.srcObject = cameraStream;
          camera.setAttribute('playsinline', 'true');
          if (camera.play) {
            await camera.play();
          }

          updateUI({
            status: sdkMode === 'sdk' ? 'SDK pronto para captura' : 'Captura pronta',
            feedback: 'Posicione seu rosto dentro do guia e toque em "Capturar imagem".',
            showLoading: false,
            showCamera: true,
            showCapture: true,
          });

          sendToReactNative('READY', { mode: sdkMode });
        } catch (error) {
          var message = error && error.message ? error.message : 'Falha ao abrir a câmera';
          updateUI({
            status: 'Erro ao abrir câmera',
            feedback: 'Verifique as permissões do dispositivo e tente novamente.',
            error: message,
            showLoading: false,
            showStart: true,
            showCamera: false,
            showCapture: false,
          });
          sendToReactNative('ERROR', { error: message });
        }
      }

      function captureImage() {
        try {
          if (!camera.videoWidth || !camera.videoHeight) {
            throw new Error('A câmera ainda não entregou um frame válido');
          }

          updateUI({
            status: 'Processando imagem',
            feedback: sdkMode === 'sdk'
              ? 'Captura concluída. Enviando imagem para validação no app.'
              : 'Modo compatível ativo. Enviando imagem para validação no app.',
            showLoading: true,
            loadingText: 'Gerando imagem...',
            showCamera: false,
            showCapture: false,
          });

          canvas.width = camera.videoWidth;
          canvas.height = camera.videoHeight;
          var context = canvas.getContext('2d');
          context.drawImage(camera, 0, 0, canvas.width, canvas.height);
          var imageData = canvas.toDataURL('image/png', 1.0);

          stopCamera();
          sendToReactNative('CAPTURE_SUCCESS', {
            imageData: imageData,
            mode: sdkMode,
          });
        } catch (error) {
          var message = error && error.message ? error.message : 'Falha ao capturar imagem';
          updateUI({
            status: 'Erro na captura',
            feedback: 'A câmera será mantida disponível para uma nova tentativa.',
            error: message,
            showLoading: false,
            showCamera: true,
            showCapture: true,
          });
          sendToReactNative('ERROR', { error: message });
        }
      }

      function cancelCapture() {
        stopCamera();
        updateUI({
          status: 'Captura cancelada',
          feedback: 'Você pode iniciar novamente quando quiser.',
          showLoading: false,
          showStart: true,
          showCamera: false,
          showCapture: false,
        });
        sendToReactNative('CANCELLED');
      }

      function applyConfig(nextConfig) {
        config = nextConfig || {};
        log('Configuração recebida do app', {
          hasModelUrl: !!config.modelUrl,
          hasPubKeyUrl: !!config.pubKeyUrl,
          hasBackendUrl: !!config.backendUrl,
          hasAuthUrl: !!config.authUrl,
        });

        updateUI({
          status: 'Configuração recebida',
          feedback: 'Preparando a melhor estratégia de captura para este dispositivo.',
          showLoading: false,
          showStart: false,
        });

        prepareSdk();
      }

      function handleIncomingMessage(rawData) {
        try {
          var message = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          if (!message || !message.type) {
            return;
          }

          switch (message.type) {
            case 'INIT_CONFIG':
              applyConfig(message.config);
              break;
            case 'START_CAPTURE':
              startCapture();
              break;
            case 'STOP_CAPTURE':
              cancelCapture();
              break;
          }
        } catch (error) {
          console.error('Erro ao processar mensagem do app:', error);
        }
      }

      document.addEventListener('message', function (event) {
        handleIncomingMessage(event.data);
      });

      window.addEventListener('message', function (event) {
        handleIncomingMessage(event.data);
      });

      startBtn.addEventListener('click', function () {
        sendToReactNative('START_REQUESTED', { mode: sdkMode });
      });

      captureBtn.addEventListener('click', captureImage);
      cancelBtn.addEventListener('click', function () {
        sendToReactNative('CANCEL_REQUESTED');
      });

      window.addEventListener('beforeunload', stopCamera);

      setMode('unknown', 'WebView pronta');
      updateUI({
        status: 'WebView pronta',
        feedback: 'Aguardando o aplicativo enviar as configurações da captura.',
        showLoading: false,
        showStart: false,
        showCapture: false,
        showCamera: false,
      });

      sendToReactNative('WEBVIEW_READY');
    })();
  </script>
</body>
</html>`;
}

function FacialCaptureContent({ onSuccess, onError, onCancel }: FacialCaptureProps) {
  const {
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
  } = useWebViewCapture();

  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [feedback, setFeedback] = useState('Aguardando a WebView ficar pronta.');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('unknown');
  const [isNativeCameraVisible, setIsNativeCameraVisible] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const urlBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE || 'https://app-iden.credify.com.br'
  );
  const credifyApiBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE_CREDIFY || 'https://api.credify.com.br/livelinesscapture'
  );
  const livenessUrl = buildLivenessUrl(credifyApiBase);
  const authBaseUrl = credifyApiBase;
  const webViewHTML = useMemo(() => buildWebViewHTML(), []);

  useEffect(() => {
    console.log('[FacialCapture] ✅ Componente WebView + SDK Identy montado');
    return () => console.log('[FacialCapture] ❌ Componente WebView + SDK Identy desmontado');
  }, []);

  useEffect(() => {
    if (isWebViewReady && phase === 'idle') {
      setFeedback('WebView pronta. Clique em "Iniciar Captura" para preparar o fluxo.');
    }
  }, [isWebViewReady, phase]);

  const handleCancel = useCallback(() => {
    console.log('[FacialCapture] ❌ Cancelado');
    stopCapture();
    setIsNativeCameraVisible(false);
    setIsTakingPicture(false);
    setPhase('idle');
    setFeedback(
      isWebViewReady
        ? 'Fluxo cancelado. Você pode iniciar novamente quando quiser.'
        : 'Aguardando a WebView ficar pronta.'
    );
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    if (onCancel) onCancel();
  }, [isWebViewReady, onCancel, stopCapture]);

  const processCapturedImage = useCallback(
    async (imageData: string, mode: CaptureMode) => {
      setPhase('processing');
      setFeedback('Enviando dados para validação Credify...');
      setErrorMessage('');

      const backendResponse = await submitToBackend(imageData, livenessUrl, authBaseUrl);

      if (!validateResponse(backendResponse)) {
        const backendError = getErrorMessage(backendResponse);
        throw new Error(backendError || 'Falha na validação do backend Credify');
      }

      console.log('[FacialCapture] ✅ Captura validada pelo backend Credify');
      setPhase('success');
      setFeedback('Verificação facial concluída com sucesso.');
      setSuccessMessage(
        mode === 'sdk'
          ? 'Captura validada com o fluxo WebView + Identy.'
          : 'Captura validada com a câmera nativa em modo compatível com Expo Go.'
      );

      const redirect = getRedirectUrl(backendResponse);
      if (redirect) {
        setRedirectUrl(redirect);
      }

      if (onSuccess) {
        onSuccess({
          status: 'success',
          message: 'Captura facial concluída com sucesso',
          redirectUrl: redirect || undefined,
        });
      }
    },
    [authBaseUrl, getErrorMessage, getRedirectUrl, livenessUrl, onSuccess, submitToBackend, validateResponse]
  );

  const startNativeCameraFlow = useCallback(async () => {
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      const error = new Error('Permissão de câmera negada no iPhone. Habilite a câmera para continuar.');
      setPhase('error');
      setErrorMessage(error.message);
      setFeedback('');
      throw error;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    setIsNativeCameraVisible(true);
    setPhase('capturing');
    setFeedback('Câmera nativa aberta. Posicione o rosto dentro do guia e toque em capturar.');
  }, [cameraPermission, requestCameraPermission]);

  const captureWithNativeCamera = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error('A câmera nativa ainda não está pronta.');
      }

      setIsTakingPicture(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        throw new Error('A câmera nativa não retornou a imagem em Base64.');
      }

      setIsNativeCameraVisible(false);
      await processCapturedImage(`data:image/jpeg;base64,${photo.base64}`, 'fallback');
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na captura nativa:', error);
      setPhase('error');
      setErrorMessage(error?.message || 'Erro no processamento da captura nativa');
      setFeedback('');
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      setIsTakingPicture(false);
    }
  }, [onError, processCapturedImage]);

  const performCapture = useCallback(async () => {
    if (captureMode === 'fallback') {
      await startNativeCameraFlow();
      return;
    }

    console.log('[FacialCapture] ===== CAPTURANDO VIA WEBVIEW =====');

    setPhase('capturing');
    setFeedback('SDK Identy pronto. Abra a câmera dentro da WebView.');
    setErrorMessage('');

    try {
      const result = await startCapture();

      if (result.status === 'success' && result.imageData) {
        console.log('[FacialCapture] ✅ Imagem capturada pela WebView');
        await processCapturedImage(result.imageData, 'sdk');
      } else if (result.status === 'cancelled') {
        setPhase('idle');
        setFeedback('Captura cancelada. Você pode tentar novamente.');
        if (onCancel) onCancel();
      } else {
        throw new Error(result.message || 'Erro na captura facial');
      }
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na captura:', error);
      setPhase('error');
      setErrorMessage(error?.message || 'Erro no processamento da captura');
      setFeedback('');
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [captureMode, onCancel, onError, processCapturedImage, startCapture, startNativeCameraFlow]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { data } = event.nativeEvent;
      console.log('[FacialCapture] Mensagem bruta da WebView:', data);

      try {
        const message = JSON.parse(data);
        console.log('[FacialCapture] Mensagem da WebView:', message);

        switch (message.type) {
          case 'WEBVIEW_READY':
            setPhase('idle');
            setFeedback('WebView pronta. Clique em "Iniciar Captura" para continuar.');
            break;

          case 'SDK_LOADING':
            setPhase('initializing');
            setFeedback('Tentando ativar o SDK Identy dentro da WebView...');
            break;

          case 'SDK_INITIALIZED':
            setCaptureMode('sdk');
            setPhase('ready');
            setFeedback('SDK Identy pronto para captura.');
            break;

          case 'SDK_FALLBACK':
            setCaptureMode('fallback');
            setPhase('ready');
            setFeedback(
              'Modo compatível Expo Go ativo. O fluxo seguirá sem travar a WebView.'
            );
            break;

          case 'START_REQUESTED':
            if (captureMode === 'fallback') {
              startNativeCameraFlow().catch((error) => {
                console.error('[FacialCapture] ❌ Erro ao abrir câmera nativa:', error);
              });
            } else {
              performCapture();
            }
            break;

          case 'CANCEL_REQUESTED':
            handleCancel();
            break;

          case 'READY':
            setPhase('capturing');
            setFeedback('Câmera aberta. Posicione o rosto e capture a imagem.');
            if (message.mode === 'sdk' || message.mode === 'fallback') {
              setCaptureMode(message.mode);
            }
            break;

          case 'WEBVIEW_LOG':
            if (message?.message) {
              console.log('[FacialCapture][WebViewLog]', message.message, message.details || '');
            }
            break;

          case 'SDK_ERROR':
            setPhase('error');
            setErrorMessage(message.error || 'Erro ao preparar SDK Identy');
            setFeedback('');
            break;

          case 'ERROR':
            setPhase('error');
            setErrorMessage(message.error || 'Erro na WebView');
            setFeedback('');
            break;
        }
      } catch (error) {
        console.error('[FacialCapture] Erro ao processar mensagem da WebView:', error);
      }

      handleWebViewMessage(data);
    },
    [captureMode, handleCancel, handleWebViewMessage, performCapture, startNativeCameraFlow]
  );

  const initializeCapture = useCallback(async () => {
    if (!isWebViewReady) {
      const error = new Error('A WebView ainda não terminou a inicialização. Aguarde alguns instantes.');
      setPhase('error');
      setErrorMessage(error.message);
      setFeedback('');
      throw error;
    }

    console.log('[FacialCapture] ===== PREPARANDO FLUXO DE CAPTURA =====');

    setPhase('initializing');
    setFeedback('Enviando configuração para a WebView...');
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');

    await initialize({
      modelUrl: `${urlBase}/api/v1/models`,
      pubKeyUrl: `${urlBase}/api/v1/pub_key`,
      backendUrl: livenessUrl,
      authUrl: authBaseUrl,
    });

    setPhase('ready');
    setFeedback(
      'Preparação concluída. Use o botão dentro da WebView para abrir a câmera.'
    );
  }, [authBaseUrl, initialize, isWebViewReady, livenessUrl, urlBase]);

  const handleStartCapture = useCallback(async () => {
    try {
      console.log('[FacialCapture] 🔵 BOTÃO CLICADO - Iniciando captura');
      await initializeCapture();
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro ao preparar captura:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }, [initializeCapture, onError]);

  return (
    <ScreenContainer className="p-6 justify-center">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled>
        <View className="gap-6">
          <View className="items-center gap-2">
            <Text className="text-2xl font-bold text-foreground">
              {phase === 'idle' && 'Reconhecimento Facial'}
              {phase === 'initializing' && 'Preparando captura'}
              {phase === 'ready' && 'Fluxo pronto'}
              {phase === 'capturing' && 'Capturando'}
              {phase === 'processing' && 'Processando'}
              {phase === 'success' && '✅ Sucesso'}
              {phase === 'error' && '❌ Erro'}
            </Text>
            <Text className="text-base text-muted text-center">{feedback}</Text>
            <Text className="text-sm text-muted text-center">
              Modo atual:{' '}
              {captureMode === 'sdk'
                ? 'SDK Identy via WebView'
                : captureMode === 'fallback'
                  ? 'Compatível com Expo Go'
                  : 'Aguardando configuração'}
            </Text>
            <Text className="text-xs text-muted text-center">
              WebView: {isWebViewReady ? 'pronta' : 'carregando'} • SDK: {isReady ? 'preparado' : 'pendente'} • Captura: {isCapturing ? 'em andamento' : 'ociosa'}
            </Text>
          </View>

          {phase !== 'idle' && phase !== 'success' && phase !== 'error' && (
            <View className="items-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}

          <View className="rounded-2xl overflow-hidden border border-border bg-black/5">
            <WebView
              ref={webViewRef}
              source={{ html: webViewHTML, baseUrl: urlBase }}
              originWhitelist={['*']}
              style={{ width: '100%', height: 620, backgroundColor: 'transparent' }}
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowFileAccess
              allowUniversalAccessFromFileURLs
              mixedContentMode="always"
              setSupportMultipleWindows={false}
              onMessage={handleMessage}
              onLoadStart={() => console.log('[WebView] Iniciando carregamento do fluxo Identy')}
              onLoadEnd={() => console.log('[WebView] HTML da WebView carregado')}
              onError={(error) => {
                console.error('[WebView] Erro ao carregar WebView:', error);
                setPhase('error');
                setErrorMessage('Erro ao carregar a WebView de captura');
              }}
            />
          </View>

          {isNativeCameraVisible ? (
            <View className="gap-3 rounded-2xl overflow-hidden border border-border bg-black">
              <CameraView
                ref={cameraRef}
                style={{ width: '100%', height: 460 }}
                facing="front"
                mirror
              />
              <View className="gap-3 p-4 bg-background">
                <Text className="text-center text-foreground font-medium">
                  Câmera nativa ativa para garantir compatibilidade no Expo Go / iPhone.
                </Text>
                <TouchableOpacity
                  onPress={captureWithNativeCamera}
                  className={`rounded-lg p-4 ${isTakingPicture ? 'bg-green-300' : 'bg-green-500'}`}
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-white font-semibold">
                    {isTakingPicture ? 'Capturando...' : 'Capturar com câmera nativa'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsNativeCameraVisible(false);
                    setPhase('ready');
                    setFeedback('Câmera nativa fechada. Você pode abrir novamente quando quiser.');
                  }}
                  className="bg-gray-200 rounded-lg p-4 border border-gray-300"
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-gray-800 font-semibold">Fechar câmera</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {phase === 'ready' && captureMode === 'fallback' ? (
            <TouchableOpacity
              onPress={() => {
                startNativeCameraFlow().catch((error) => {
                  console.error('[FacialCapture] ❌ Erro ao abrir câmera nativa:', error);
                });
              }}
              className="bg-green-500 rounded-lg p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-semibold">Abrir câmera nativa</Text>
            </TouchableOpacity>
          ) : null}

          {successMessage ? (
            <View className="bg-green-500 rounded-lg p-4">
              <Text className="text-white text-sm font-semibold">{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View className="bg-red-500 rounded-lg p-4">
              <Text className="text-white text-sm">{errorMessage}</Text>
            </View>
          ) : null}

          {redirectUrl ? (
            <View className="bg-blue-500 rounded-lg p-4">
              <Text className="text-white text-sm font-semibold">Redirecionar para: {redirectUrl}</Text>
            </View>
          ) : null}

          {phase === 'idle' && (
            <>
              <Text className="text-center text-foreground font-bold">🚀 Credify + Identy adaptado para React Native</Text>
              <TouchableOpacity
                onPress={handleStartCapture}
                className={`rounded-lg p-4 ${isWebViewReady ? 'bg-blue-500' : 'bg-blue-300'}`}
                activeOpacity={0.7}
                disabled={!isWebViewReady}
              >
                <Text className="text-center text-white font-semibold">
                  {isWebViewReady ? 'Preparar Captura' : 'Aguardando WebView'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancel}
                className="bg-gray-200 rounded-lg p-4 border border-gray-300"
                activeOpacity={0.7}
              >
                <Text className="text-center text-gray-800 font-semibold">Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {(phase === 'success' || phase === 'error') && (
            <TouchableOpacity
              onPress={handleCancel}
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
