import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { ScreenContainer } from '@/components/screen-container';
import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type CapturePhase =
  | 'idle'
  | 'initializing'
  | 'sdk_loading'
  | 'sdk_ready'
  | 'capturing'
  | 'processing'
  | 'submitting'
  | 'success'
  | 'error';

type CaptureMode = 'sdk' | 'native' | 'unknown';

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

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const SDK_SERVER_PORT = 9876;

// ─────────────────────────────────────────────────────────────
// Utilitarios
// ─────────────────────────────────────────────────────────────

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/livelinesscapture$/i, '');
}

function buildLivenessUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return /\/livelinesscapture$/i.test(normalized)
    ? normalized
    : `${normalizeApiBase(normalized)}/livelinesscapture`;
}

function buildAuthUrl(url: string): string {
  const base = normalizeApiBase(url);
  return /\/auth$/i.test(base) ? base : `${base}/auth`;
}

function buildRequestId(): string {
  return `rn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detectar o IP do servidor de desenvolvimento (Metro).
 * No Expo Go o `Constants.expoConfig?.hostUri` retorna algo como "192.168.1.x:8081".
 * Usamos o mesmo IP para acessar o SDK server local.
 */
function getDevServerHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as Record<string, unknown>).manifest?.debuggerHost ||
    (Constants as Record<string, unknown>).manifest?.hostUri ||
    '';

  if (typeof hostUri === 'string' && hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  return 'localhost';
}

function getSdkServerUrl(): string {
  const host = getDevServerHost();
  return `http://${host}:${SDK_SERVER_PORT}`;
}

// ─────────────────────────────────────────────────────────────
// SDK Web (Expo Web / Browser) - Importacao dinamica
//
// No Expo Web (Platform.OS === 'web'), o FaceSDK pode ser
// importado diretamente porque roda no browser (DOM, Canvas,
// WASM, jQuery).
//
// Para funcionar, o webpack/Metro Web precisa processar CSS:
// - Adicione style-loader + css-loader no webpack.config.js
// - Ou use craco/customize-cra se estiver com CRA
//
// Se a importacao direta falhar (falta de webpack config),
// o componente cai automaticamente no modo WebView.
// ─────────────────────────────────────────────────────────────

let webSdkModule: {
  FaceSDK: new (options: Record<string, unknown>) => {
    initialize(): Promise<void>;
    capture(): Promise<Blob>;
    abort(): Promise<void>;
    getLocalization(): unknown;
  };
  preInitialize: (
    modelUrl?: { URL: string | { url: string; headers?: Array<{ name: string; value: string }> } },
    pubKeyUrl?: { URL: string | { url: string; headers?: Array<{ name: string; value: string }> } },
    timeUrl?: { URL: string | { url: string; headers?: Array<{ name: string; value: string }> } }
  ) => Promise<unknown>;
  AsThreshold: Record<string, string>;
  Template: Record<string, string>;
  AppUI: Record<string, string>;
} | null = null;

let webSdkLoadAttempted = false;
let webSdkPreInitDone = false;

/**
 * Tenta carregar o SDK Identy diretamente no browser (Expo Web).
 * Retorna true se o SDK foi carregado com sucesso.
 */
async function tryLoadWebSdk(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (webSdkModule) return true;
  if (webSdkLoadAttempted) return false;

  webSdkLoadAttempted = true;

  try {
    // Dynamic import: only works when webpack can resolve @identy/identy-face
    // and process its CSS imports (requires css-loader + style-loader).
    const sdk = await import('@identy/identy-face');
    if (sdk && sdk.FaceSDK) {
      webSdkModule = {
        FaceSDK: sdk.FaceSDK,
        preInitialize: sdk.FaceSDK.preInitialize.bind(sdk.FaceSDK),
        AsThreshold: sdk.AsThreshold || {},
        Template: sdk.Template || {},
        AppUI: sdk.AppUI || {},
      };
      console.log('[FacialCapture] SDK Web carregado com sucesso via import direto');
      return true;
    }
  } catch (err) {
    console.warn('[FacialCapture] Import direto do SDK falhou (esperado em native):', err);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// HTML da WebView - Carrega SDK Identy v6.3.0 do servidor local
//
// O SDK @identy/identy-face e um pacote privado (JFrog) web-only.
// Ele e servido localmente por scripts/sdk-server.js na porta 9876.
// A WebView carrega o JS/CSS/WASM do servidor e usa FaceSDK.capture()
// para captura facial com liveness detection via WASM.
//
// Fluxo:
// 1. WebView carrega -> WEBVIEW_READY
// 2. RN envia INIT_SDK com a URL do SDK server e config
// 3. WebView carrega <script src="http://IP:9876/identy-face.js">
//    + CSS + chama FaceSDK.preInitialize + new FaceSDK + initialize
// 4. SDK pronto -> SDK_READY
// 5. RN envia START_CAPTURE
// 6. FaceSDK.capture() -> Blob -> base64 -> CAPTURE_RESULT
// 7. Se SDK falhar -> SDK_LOAD_FAILED -> fallback camera nativa
// ─────────────────────────────────────────────────────────────

function buildWebViewHTML(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>Credify Facial Capture</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1220; color: #f8fafc;
    }
    #sdk-container {
      width: 100%; height: 100%;
      display: none;
      position: relative;
    }
    #status-panel {
      width: 100%; padding: 16px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .card {
      background: #111827; border: 1px solid #1f2937; border-radius: 18px;
      padding: 20px; width: 100%; max-width: 400px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .title { font-size: 18px; font-weight: 700; text-align: center; }
    .badge-wrap { text-align: center; }
    .badge {
      display: inline-block; border-radius: 999px; padding: 5px 14px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    }
    .badge.loading  { background: #374151; color: #9ca3af; }
    .badge.sdk      { background: #1d4ed8; color: white; }
    .badge.error    { background: #dc2626; color: white; }
    .status-box {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
      padding: 14px; text-align: center;
    }
    .status-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .status-detail { font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .spinner-box {
      display: none; align-items: center; justify-content: center; gap: 8px;
      padding: 8px 0; color: #94a3b8; font-size: 12px;
    }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.12); border-top-color: #60a5fa;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .msg { display: none; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.4; }
    .msg.error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fecaca; }
  </style>
</head>
<body>

<!-- Status panel (visible when SDK is loading or errored) -->
<div id="status-panel">
  <div class="card">
    <div class="title">Captura Facial</div>
    <div class="badge-wrap"><span id="badge" class="badge loading">Aguardando</span></div>
    <div class="status-box">
      <div id="st-title" class="status-title">Preparando</div>
      <div id="st-detail" class="status-detail">Aguardando configuracao...</div>
    </div>
    <div id="err-box" class="msg error"></div>
    <div id="spin-box" class="spinner-box">
      <div class="spinner"></div>
      <span id="spin-text">Preparando...</span>
    </div>
  </div>
</div>

<!-- SDK container (the SDK renders its own UI here) -->
<div id="sdk-container"></div>

<script>
(function() {
  'use strict';

  var sdkInstance = null;
  var sdkGlobal = null;
  var sdkServerUrl = '';
  var config = {};

  var statusPanel = document.getElementById('status-panel');
  var sdkContainer = document.getElementById('sdk-container');
  var badge = document.getElementById('badge');
  var stTitle = document.getElementById('st-title');
  var stDetail = document.getElementById('st-detail');
  var errBox = document.getElementById('err-box');
  var spinBox = document.getElementById('spin-box');
  var spinText = document.getElementById('spin-text');

  function send(type, data) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data || {})));
      }
    } catch(e) {}
  }

  function log(msg, detail) {
    send('WEBVIEW_LOG', { message: msg, details: detail || null });
  }

  function showStatus(title, detail, spin, isError) {
    statusPanel.style.display = 'flex';
    sdkContainer.style.display = 'none';
    stTitle.textContent = title || '';
    stDetail.textContent = detail || '';
    spinBox.style.display = spin ? 'flex' : 'none';
    spinText.textContent = spin || 'Preparando...';
    errBox.style.display = isError ? 'block' : 'none';
    if (isError) errBox.textContent = detail || '';
    badge.textContent = isError ? 'Erro' : (spin ? 'Carregando' : 'SDK Identy');
    badge.className = 'badge ' + (isError ? 'error' : (spin ? 'loading' : 'sdk'));
  }

  function showSdkUI() {
    statusPanel.style.display = 'none';
    sdkContainer.style.display = 'block';
  }

  // --- Load SDK script + CSS from local server ---
  function loadCSS(url) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  function loadScript(url, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      var tid = setTimeout(function() {
        reject(new Error('Timeout carregando SDK de ' + url));
      }, timeoutMs || 20000);
      s.onload = function() { clearTimeout(tid); resolve(); };
      s.onerror = function(e) {
        clearTimeout(tid);
        reject(new Error('Falha ao carregar SDK de ' + url + '. Verifique se o servidor SDK esta rodando (pnpm dev:sdk)'));
      };
      document.head.appendChild(s);
    });
  }

  function findSdkExports() {
    // UMD module - when loaded via <script>, check multiple locations
    if (typeof module !== 'undefined' && module.exports && module.exports.FaceSDK) {
      return module.exports;
    }
    if (window.IdentyFace && window.IdentyFace.FaceSDK) return window.IdentyFace;
    if (window.Identy && window.Identy.FaceSDK) return window.Identy;
    if (window.FaceSDK) return { FaceSDK: window.FaceSDK };

    // The SDK uses webpack and may expose exports differently
    var keys = Object.keys(window);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      try {
        var val = window[k];
        if (val && typeof val === 'object' && val.FaceSDK && typeof val.FaceSDK === 'function') {
          log('SDK encontrado em window.' + k);
          return val;
        }
      } catch(e) {}
    }

    return null;
  }

  // --- Initialize SDK v6.3.0 ---
  async function initializeSdk(sdkUrl, conf) {
    showStatus('Carregando SDK Identy', 'Baixando SDK v6.3.0 do servidor local...', 'Carregando SDK...');
    send('SDK_LOADING', { stage: 'script' });

    // Set webpack public path for WASM/worker loading
    try {
      window.__webpack_public_path__ = sdkUrl + '/';
    } catch(e) {}

    // Load CSS
    loadCSS(sdkUrl + '/identy-face-style.css');

    // Load JS
    try {
      await loadScript(sdkUrl + '/identy-face.js', 25000);
    } catch(loadErr) {
      log('Falha ao carregar SDK JS: ' + loadErr.message);
      send('SDK_LOAD_FAILED', { error: loadErr.message });
      showStatus('SDK indisponivel', loadErr.message, null, true);
      return;
    }

    // Find exports
    sdkGlobal = findSdkExports();
    if (!sdkGlobal || !sdkGlobal.FaceSDK) {
      await new Promise(function(r) { setTimeout(r, 1000); });
      sdkGlobal = findSdkExports();
    }

    if (!sdkGlobal || !sdkGlobal.FaceSDK) {
      var errMsg = 'SDK carregado mas FaceSDK nao foi encontrado no escopo global. Versao: v6.3.0';
      log(errMsg);
      send('SDK_LOAD_FAILED', { error: errMsg });
      showStatus('SDK indisponivel', errMsg, null, true);
      return;
    }

    var sdkVersion = 'unknown';
    try { sdkVersion = sdkGlobal.FaceSDK.version ? sdkGlobal.FaceSDK.version() : 'unknown'; } catch(e) {}
    log('FaceSDK encontrado, versao: ' + sdkVersion);
    showStatus('Inicializando SDK', 'Executando preInitialize + initialize...', 'Inicializando...');
    send('SDK_LOADING', { stage: 'initialize', version: sdkVersion });

    try {
      // Step 1: preInitialize - downloads WASM models
      if (typeof sdkGlobal.FaceSDK.preInitialize === 'function') {
        var modelUrl = conf.modelUrl || (sdkUrl + '/assets');
        var pubKeyUrl = conf.pubKeyUrl || '';
        log('preInitialize com modelUrl: ' + modelUrl + ', pubKeyUrl: ' + pubKeyUrl);

        await sdkGlobal.FaceSDK.preInitialize(
          { URL: modelUrl },
          { URL: { url: pubKeyUrl, headers: [
            { name: 'LogAPITrigger', value: 'true' },
            { name: 'requestID', value: 'sdk-preinit-' + Date.now() }
          ]}},
          conf.timeUrl ? { URL: conf.timeUrl } : undefined
        );
        log('preInitialize OK');
      }

      // Step 2: Determine enums
      var Template = sdkGlobal.Template || { PNG: 'PNG' };
      var AsThreshold = sdkGlobal.AsThreshold || { MEDIUM: 'MEDIUM' };
      var AppUI = sdkGlobal.AppUI || { TICKING: 'TICKING' };

      // Step 3: Create SDK instance with v6.3.0 options
      sdkInstance = new sdkGlobal.FaceSDK({
        enableAS: true,
        asThreshold: AsThreshold.MEDIUM || 'MEDIUM',
        requiredTemplates: [Template.PNG || 'PNG'],
        showCaptureTraining: false,
        base64EncodingFlag: true,
        allowClose: true,
        enableEyesStatusDetector: true,
        skipSupportCheck: false,
        transaction: { type: 1 },
        appUI: AppUI.TICKING || 'TICKING',
        allowCameraSelect: false,
        assisted: false,
        localization: { language: 'pt-BR' },
        graphics: { canvas: { label: 'white' } },
        enableRetakeScreen: true,
        enableBackgroundRemoval: false,
      });

      log('FaceSDK instanciado, chamando initialize()...');

      // Step 4: Initialize with timeout
      await Promise.race([
        sdkInstance.initialize(),
        new Promise(function(_, rej) {
          setTimeout(function() { rej(new Error('Timeout no initialize() - 45s')); }, 45000);
        })
      ]);

      log('SDK inicializado com sucesso!');
      send('SDK_READY', { mode: 'sdk', version: sdkVersion });
      showStatus('SDK Identy pronto', 'Pronto para captura facial com liveness detection.', null);

    } catch(initErr) {
      var msg = initErr && initErr.message ? initErr.message : String(initErr);
      log('Falha no initialize: ' + msg);
      send('SDK_INIT_FAILED', { error: msg });
      showStatus('Falha na inicializacao', msg, null, true);
    }
  }

  // --- Capture ---
  async function startCapture() {
    if (!sdkInstance || typeof sdkInstance.capture !== 'function') {
      send('CAPTURE_ERROR', { error: 'SDK nao inicializado' });
      return;
    }

    try {
      showSdkUI();
      log('Iniciando FaceSDK.capture()...');
      send('CAPTURE_STARTED', {});

      var captureResult = await sdkInstance.capture();

      log('Captura concluida, tipo: ' + (typeof captureResult) +
          ', isBlob: ' + (captureResult instanceof Blob) +
          ', tamanho: ' + (captureResult ? captureResult.size || 0 : 0));

      // Convert Blob to base64
      if (captureResult instanceof Blob) {
        var reader = new FileReader();
        reader.onloadend = function() {
          var base64 = reader.result;
          log('Blob convertido para base64, tamanho: ' + (base64 ? base64.length : 0));
          send('CAPTURE_RESULT', {
            status: 'success',
            imageData: base64,
            mode: 'sdk'
          });
          showStatus('Captura concluida', 'Imagem capturada com sucesso pelo SDK Identy.', null);
        };
        reader.onerror = function() {
          send('CAPTURE_ERROR', { error: 'Falha ao converter Blob para base64' });
          showStatus('Erro na conversao', 'Falha ao converter imagem.', null, true);
        };
        reader.readAsDataURL(captureResult);
      } else if (typeof captureResult === 'string') {
        send('CAPTURE_RESULT', {
          status: 'success',
          imageData: captureResult,
          mode: 'sdk'
        });
        showStatus('Captura concluida', 'Imagem capturada com sucesso pelo SDK Identy.', null);
      } else {
        send('CAPTURE_ERROR', { error: 'Resultado inesperado do SDK: ' + typeof captureResult });
        showStatus('Erro', 'Resultado inesperado do SDK.', null, true);
      }

    } catch(captureErr) {
      var errMsg = captureErr && captureErr.message ? captureErr.message : String(captureErr);
      log('Erro na captura: ' + errMsg);
      send('CAPTURE_ERROR', { error: errMsg });
      showStatus('Erro na captura', errMsg, null, true);
    }
  }

  // --- Message handler (receives from RN via injectJavaScript) ---
  function onMessage(raw) {
    try {
      var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!m || !m.type) return;

      switch(m.type) {
        case 'INIT_SDK':
          sdkServerUrl = m.sdkServerUrl || '';
          config = m.config || {};
          log('INIT_SDK recebido, sdkServerUrl: ' + sdkServerUrl);
          if (sdkServerUrl) {
            initializeSdk(sdkServerUrl, config);
          } else {
            send('SDK_LOAD_FAILED', { error: 'sdkServerUrl nao fornecida' });
            showStatus('Erro', 'URL do servidor SDK nao fornecida.', null, true);
          }
          break;

        case 'START_CAPTURE':
          startCapture();
          break;

        case 'STOP_CAPTURE':
          if (sdkInstance && typeof sdkInstance.abort === 'function') {
            sdkInstance.abort().catch(function() {});
          }
          showStatus('Cancelado', 'Captura cancelada.', null);
          break;
      }
    } catch(e) {
      log('Erro ao processar mensagem: ' + (e && e.message ? e.message : e));
    }
  }

  // Listen for messages from RN (dispatched via injectJavaScript)
  document.addEventListener('message', function(e) { onMessage(e.data); });
  window.addEventListener('message', function(e) { onMessage(e.data); });

  showStatus('WebView pronta', 'Aguardando configuracao do SDK...', null);
  send('WEBVIEW_READY');
  log('WebView inicializada, aguardando INIT_SDK');
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

function FacialCaptureContent({ onSuccess, onError, onCancel }: FacialCaptureProps) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [feedback, setFeedback] = useState('Carregando...');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('unknown');
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isNativeCameraVisible, setIsNativeCameraVisible] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [isWebPlatform, setIsWebPlatform] = useState(Platform.OS === 'web');

  const webViewRef = useRef<WebView>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const webSdkInstanceRef = useRef<{
    capture(): Promise<Blob>;
    abort(): Promise<void>;
  } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // -- URLs --
  const credifyApiBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE_CREDIFY || CREDIFY_CONFIG.LIVENESS_URL
  );
  const urlBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE || 'https://app-iden-dev.credify.com.br'
  );
  const livenessUrl = buildLivenessUrl(credifyApiBase);
  const authUrl = buildAuthUrl(credifyApiBase);
  const sdkServerUrl = useMemo(() => getSdkServerUrl(), []);

  const webViewHTML = useMemo(() => buildWebViewHTML(), []);

  // -- Lifecycle --
  useEffect(() => {
    console.log('[FacialCapture] Componente montado, Platform:', Platform.OS);
    console.log('[FacialCapture] URLs:', { urlBase, credifyApiBase, livenessUrl, authUrl, sdkServerUrl });

    // On web, try to load SDK directly
    if (Platform.OS === 'web') {
      tryLoadWebSdk().then((loaded) => {
        if (loaded) {
          console.log('[FacialCapture] SDK Web disponivel via import direto');
          setIsWebPlatform(true);
          setIsWebViewReady(true); // No WebView needed on web
          setFeedback('SDK Web pronto. Toque em "Iniciar Captura".');
        } else {
          console.log('[FacialCapture] Import direto do SDK falhou; usando WebView na web tambem');
          setIsWebPlatform(false); // Fall back to WebView approach
          setFeedback('Carregando WebView...');
        }
      });
    } else {
      setIsWebPlatform(false);
      setFeedback('Carregando WebView...');
    }

    return () => console.log('[FacialCapture] Componente desmontado');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Send to WebView via injectJavaScript --
  const sendToWebView = useCallback((message: Record<string, unknown>) => {
    if (!webViewRef.current) return;
    const js = `
      (function(){
        try {
          var evt = new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(message))} });
          window.dispatchEvent(evt);
        } catch(e) {}
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, []);

  // -- Authentication --
  const authenticate = useCallback(async (): Promise<string> => {
    if (authTokenRef.current) return authTokenRef.current;

    console.log('[FacialCapture] Autenticando em:', authUrl);
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ClientID: CREDIFY_CONFIG.CLIENT_ID,
        ClientSecret: CREDIFY_CONFIG.CLIENT_SECRET,
      }),
    });

    const data = await response.json();
    if (!response.ok || data?.Sucess === false) {
      throw new Error(`Autenticacao falhou: ${data?.Message || response.status}`);
    }

    const token = data?.Dados || data?.token || data?.access_token;
    if (!token) throw new Error('Token nao encontrado na resposta');

    authTokenRef.current = token;
    console.log('[FacialCapture] Token obtido');
    return token;
  }, [authUrl]);

  // -- Submit to backend --
  const submitToBackend = useCallback(
    async (imageBase64: string, retryOnAuth = true): Promise<Record<string, unknown>> => {
      const requestID = buildRequestId();
      const rawBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

      console.log('[FacialCapture] Enviando para:', livenessUrl, 'base64 len:', rawBase64.length);

      let token: string | null = null;
      try {
        token = await authenticate();
      } catch (authErr) {
        console.warn('[FacialCapture] Auth falhou:', authErr);
      }

      const formData = new FormData();
      if (Platform.OS === 'web') {
        // Web: Blob is available
        const blob = new Blob([rawBase64], { type: 'text/plain' });
        formData.append('file', blob, 'bdata');
      } else {
        // React Native: use { uri, type, name } format
        formData.append('file', {
          uri: `data:text/plain;base64,${rawBase64}`,
          type: 'text/plain',
          name: 'bdata',
        } as unknown as Blob);
      }

      const headers: Record<string, string> = {
        'X-DEBUG': CREDIFY_CONFIG.WERO,
        LogAPITrigger: 'true',
        RequestID: requestID,
        requestID: requestID,
        application: CREDIFY_CONFIG.APPLICATION,
        wero: CREDIFY_CONFIG.WERO,
        keyurl: CREDIFY_CONFIG.AS_SERVER_CONFIG,
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${livenessUrl}?ts=${Date.now()}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let responseData: Record<string, unknown>;
      try {
        responseData = await response.json();
      } catch {
        responseData = { error: 'Resposta invalida do servidor', status: 'error' };
      }

      if (response.status === 401 && retryOnAuth) {
        authTokenRef.current = null;
        return submitToBackend(imageBase64, false);
      }

      if (!response.ok) {
        const errMsg =
          (responseData as Record<string, Record<string, Record<string, string>>>)?.RESPOSTA?.LIVELINESS?.description ||
          (responseData as Record<string, Record<string, Record<string, string>>>)?.RESPOSTA?.LIVELINESS?.message ||
          (responseData as Record<string, string>)?.error ||
          (responseData as Record<string, string>)?.message ||
          (responseData as Record<string, string>)?.Message ||
          `Erro HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      return responseData;
    },
    [authenticate, livenessUrl]
  );

  // -- Validate response --
  const validateResponse = useCallback((resp: Record<string, unknown>): boolean => {
    const resposta = resp?.RESPOSTA as Record<string, Record<string, number>> | undefined;
    const code = resposta?.LIVELINESS?.code;
    return code === 200 || resp?.success === true || resp?.status === 'success';
  }, []);

  const getRedirectUrl = useCallback((resp: Record<string, unknown>): string | null => {
    const resposta = resp?.RESPOSTA as Record<string, string> | undefined;
    return resposta?.URL || (resp?.redirectUrl as string) || null;
  }, []);

  const getErrorMessage = useCallback((resp: Record<string, unknown>): string => {
    const resposta = resp?.RESPOSTA as Record<string, Record<string, string>> | undefined;
    return (
      resposta?.LIVELINESS?.description ||
      resposta?.LIVELINESS?.message ||
      (resp?.error as string) ||
      (resp?.message as string) ||
      (resp?.Message as string) ||
      'Erro desconhecido'
    );
  }, []);

  // -- Cancel --
  const handleCancel = useCallback(() => {
    if (!isWebPlatform) {
      sendToWebView({ type: 'STOP_CAPTURE' });
    }
    if (webSdkInstanceRef.current) {
      webSdkInstanceRef.current.abort().catch(() => {});
      webSdkInstanceRef.current = null;
    }
    setIsNativeCameraVisible(false);
    setIsTakingPicture(false);
    setPhase('idle');
    setFeedback(
      isWebPlatform || isWebViewReady
        ? 'Toque em "Iniciar Captura" para comecar.'
        : 'Carregando WebView...'
    );
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    setCaptureMode('unknown');
    setIsSdkReady(false);
    onCancel?.();
  }, [isWebPlatform, isWebViewReady, onCancel, sendToWebView]);

  // -- Process captured image --
  const processCapturedImage = useCallback(
    async (imageData: string, mode: CaptureMode) => {
      setPhase('submitting');
      setFeedback('Enviando imagem para validacao Credify...');
      setErrorMessage('');

      try {
        const backendResponse = await submitToBackend(imageData);

        if (!validateResponse(backendResponse)) {
          const err = getErrorMessage(backendResponse);
          throw new Error(err || 'Falha na validacao');
        }

        console.log('[FacialCapture] Captura validada pelo backend');
        setPhase('success');
        setFeedback('Verificacao facial concluida com sucesso.');
        setSuccessMessage(
          mode === 'sdk'
            ? 'Captura validada com SDK Identy v6.3.0 (liveness detection).'
            : 'Captura validada com camera nativa.'
        );

        const redirect = getRedirectUrl(backendResponse);
        if (redirect) setRedirectUrl(redirect);

        onSuccess?.({
          status: 'success',
          message: 'Captura facial concluida',
          redirectUrl: redirect || undefined,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[FacialCapture] Erro submit:', error.message);
        setPhase('error');
        setErrorMessage(error.message);
        setFeedback('');
        onError?.(error);
      }
    },
    [getErrorMessage, getRedirectUrl, onError, onSuccess, submitToBackend, validateResponse]
  );

  // -- Native camera (fallback) --
  const startNativeCameraFlow = useCallback(async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission?.granted) {
      setPhase('error');
      setErrorMessage('Permissao de camera negada.');
      return;
    }
    setIsNativeCameraVisible(true);
    setPhase('capturing');
    setFeedback('Camera nativa aberta. Posicione o rosto e toque em "Capturar".');
  }, [cameraPermission, requestCameraPermission]);

  const captureWithNativeCamera = useCallback(async () => {
    try {
      if (!cameraRef.current) throw new Error('Camera nao esta pronta.');
      setIsTakingPicture(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.9 });
      if (!photo?.base64) throw new Error('Camera nao retornou imagem.');
      setIsNativeCameraVisible(false);
      await processCapturedImage(`data:image/jpeg;base64,${photo.base64}`, captureMode);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setPhase('error');
      setErrorMessage(error.message);
      onError?.(error);
    } finally {
      setIsTakingPicture(false);
    }
  }, [captureMode, onError, processCapturedImage]);

  // -- Web SDK capture (Expo Web only) --
  const startWebSdkCapture = useCallback(async () => {
    if (!webSdkModule) {
      setPhase('error');
      setErrorMessage('SDK Web nao carregado');
      return;
    }

    try {
      setPhase('sdk_loading');
      setFeedback('Inicializando SDK Identy no navegador...');

      // preInitialize (if not done)
      if (!webSdkPreInitDone) {
        console.log('[FacialCapture] Web: preInitialize...');
        const modelUrl = `${urlBase}/api/v1/models`;
        const pubKeyUrl = `${urlBase}/api/v1/pub_key`;

        await webSdkModule.preInitialize(
          { URL: modelUrl },
          {
            URL: {
              url: pubKeyUrl,
              headers: [
                { name: 'LogAPITrigger', value: 'true' },
                { name: 'requestID', value: `web-preinit-${Date.now()}` },
              ],
            },
          }
        );
        webSdkPreInitDone = true;
        console.log('[FacialCapture] Web: preInitialize OK');
      }

      // Create SDK instance
      const sdkInstance = new webSdkModule.FaceSDK({
        enableAS: true,
        asThreshold: webSdkModule.AsThreshold?.MEDIUM || 'MEDIUM',
        requiredTemplates: [webSdkModule.Template?.PNG || 'PNG'],
        showCaptureTraining: false,
        base64EncodingFlag: true,
        allowClose: true,
        enableEyesStatusDetector: true,
        skipSupportCheck: false,
        transaction: { type: 1 },
        appUI: webSdkModule.AppUI?.TICKING || 'TICKING',
        allowCameraSelect: false,
        assisted: false,
        localization: { language: 'pt-BR' },
        graphics: { canvas: { label: 'white' } },
        enableRetakeScreen: true,
      });

      webSdkInstanceRef.current = sdkInstance;

      setFeedback('Inicializando camera e modelos WASM...');
      await sdkInstance.initialize();

      setCaptureMode('sdk');
      setIsSdkReady(true);
      setPhase('capturing');
      setFeedback('SDK Identy capturando... Posicione o rosto no guia.');

      // Start capture
      const blob = await sdkInstance.capture();
      console.log('[FacialCapture] Web: capture retornou Blob, size:', blob.size);

      // Convert Blob to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao converter Blob'));
        reader.readAsDataURL(blob);
      });

      setPhase('processing');
      setFeedback('Imagem capturada. Enviando para validacao...');
      await processCapturedImage(base64, 'sdk');
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[FacialCapture] Web SDK error:', error.message);
      setPhase('error');
      setErrorMessage(error.message);
      onError?.(error);
    }
  }, [urlBase, processCapturedImage, onError]);

  // -- Handle WebView messages (native path) --
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        const type = message?.type;

        if (type !== 'WEBVIEW_LOG') {
          console.log('[FacialCapture] WebView:', type, message.mode || message.stage || message.error || '');
        }

        switch (type) {
          case 'WEBVIEW_READY':
            setIsWebViewReady(true);
            setFeedback('WebView pronta. Toque em "Iniciar Captura".');
            break;

          case 'SDK_LOADING':
            setPhase('sdk_loading');
            setFeedback(
              message.stage === 'initialize'
                ? 'Inicializando SDK Identy (WASM + modelos)...'
                : 'Carregando SDK Identy v6.3.0...'
            );
            break;

          case 'SDK_READY':
            setCaptureMode('sdk');
            setIsSdkReady(true);
            setPhase('sdk_ready');
            setFeedback('SDK Identy pronto. Toque em "Capturar com SDK" para iniciar.');
            break;

          case 'SDK_LOAD_FAILED':
          case 'SDK_INIT_FAILED':
            console.warn('[FacialCapture] SDK falhou:', message.error);
            setCaptureMode('native');
            setIsSdkReady(false);
            setPhase('sdk_ready'); // Allow native fallback
            setFeedback('SDK indisponivel. Use a camera nativa como alternativa.');
            setErrorMessage(message.error || 'SDK indisponivel');
            break;

          case 'CAPTURE_STARTED':
            setPhase('capturing');
            setFeedback('SDK capturando... Posicione o rosto no guia.');
            break;

          case 'CAPTURE_RESULT':
            if (message.status === 'success' && message.imageData) {
              console.log('[FacialCapture] Imagem capturada pelo SDK via WebView');
              setPhase('processing');
              setFeedback('Imagem capturada. Enviando para validacao...');
              processCapturedImage(message.imageData, 'sdk');
            } else {
              setPhase('error');
              setErrorMessage(message.error || 'Captura falhou');
            }
            break;

          case 'CAPTURE_ERROR':
            setPhase('error');
            setErrorMessage(message.error || 'Erro na captura');
            setFeedback('');
            break;

          case 'WEBVIEW_LOG':
            if (message.message) {
              console.log('[WebView]', message.message, message.details ?? '');
            }
            break;
        }
      } catch {
        // Non-JSON, ignore
      }
    },
    [processCapturedImage]
  );

  // -- Start capture flow --
  const handleStartCapture = useCallback(async () => {
    // Web path: use SDK directly
    if (isWebPlatform && webSdkModule) {
      console.log('[FacialCapture] Iniciando captura via SDK Web direto');
      await startWebSdkCapture();
      return;
    }

    // Native path: use WebView
    if (!isWebViewReady) {
      setErrorMessage('WebView ainda carregando. Aguarde.');
      return;
    }

    console.log('[FacialCapture] Iniciando - SDK server:', sdkServerUrl);
    setPhase('sdk_loading');
    setFeedback('Carregando SDK Identy...');
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    setIsSdkReady(false);

    sendToWebView({
      type: 'INIT_SDK',
      sdkServerUrl: sdkServerUrl,
      config: {
        modelUrl: `${urlBase}/api/v1/models`,
        pubKeyUrl: `${urlBase}/api/v1/pub_key`,
        backendUrl: livenessUrl,
        authUrl: authUrl,
      },
    });
  }, [authUrl, isWebPlatform, isWebViewReady, livenessUrl, sdkServerUrl, sendToWebView, startWebSdkCapture, urlBase]);

  // -- Trigger SDK capture (native path) --
  const handleSdkCapture = useCallback(() => {
    setPhase('capturing');
    setFeedback('Iniciando captura pelo SDK Identy...');
    sendToWebView({ type: 'START_CAPTURE' });
  }, [sendToWebView]);

  // -- Dynamic labels --
  const phaseTitle = useMemo(() => {
    switch (phase) {
      case 'idle': return 'Reconhecimento Facial';
      case 'sdk_loading': return 'Carregando SDK...';
      case 'sdk_ready': return 'Pronto';
      case 'initializing': return 'Preparando...';
      case 'capturing': return 'Capturando';
      case 'processing':
      case 'submitting': return 'Processando...';
      case 'success': return 'Sucesso';
      case 'error': return 'Erro';
      default: return '';
    }
  }, [phase]);

  const modeLabel = useMemo(() => {
    switch (captureMode) {
      case 'sdk': return 'SDK Identy v6.3.0 (WASM + Liveness)';
      case 'native': return 'Camera nativa (fallback)';
      default: return 'Aguardando';
    }
  }, [captureMode]);

  const showSpinner = phase === 'initializing' || phase === 'sdk_loading' || phase === 'processing' || phase === 'submitting';

  // Adjust WebView height based on phase
  const webViewHeight = useMemo(() => {
    if (phase === 'capturing' && captureMode === 'sdk') return 600;
    if (phase === 'sdk_loading') return 300;
    if (phase === 'sdk_ready') return 200;
    return 300;
  }, [phase, captureMode]);

  // -- Render --
  return (
    <ScreenContainer className="p-4 justify-center">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled>
        <View className="gap-4">
          {/* Header */}
          <View className="items-center gap-1 mt-2">
            <Text className="text-xl font-bold text-foreground">{phaseTitle}</Text>
            {feedback ? (
              <Text className="text-sm text-muted text-center leading-relaxed">{feedback}</Text>
            ) : null}
            <Text className="text-xs text-muted text-center mt-1">Modo: {modeLabel}</Text>
            <Text className="text-xs text-muted text-center opacity-60">
              {isWebPlatform ? 'Plataforma: Web' : `WebView: ${isWebViewReady ? 'OK' : '...'}`}
              {' | SDK: '}{isSdkReady ? 'OK' : '...'}
              {' | Fase: '}{phase}
            </Text>
          </View>

          {/* Spinner */}
          {showSpinner && (
            <View className="items-center py-2">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}

          {/* WebView -- only on native (not web), only when not idle */}
          {!isWebPlatform && phase !== 'idle' && (
            <View className="rounded-2xl overflow-hidden border border-border">
              <WebView
                ref={webViewRef}
                source={{ html: webViewHTML }}
                originWhitelist={['*']}
                style={{ width: '100%', height: webViewHeight, backgroundColor: '#0b1220' }}
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowFileAccess
                allowUniversalAccessFromFileURLs
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                onMessage={handleWebViewMessage}
                onLoadEnd={() => console.log('[WebView] onLoadEnd')}
                onError={(e: { nativeEvent: { description?: string } }) => {
                  console.error('[WebView] Erro:', e.nativeEvent.description);
                  setPhase('error');
                  setErrorMessage(`WebView error: ${e.nativeEvent.description || 'unknown'}`);
                }}
              />
            </View>
          )}

          {/* SDK Capture button (native path, SDK ready) */}
          {!isWebPlatform && phase === 'sdk_ready' && captureMode === 'sdk' && (
            <TouchableOpacity
              onPress={handleSdkCapture}
              className="bg-blue-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold text-base">
                Capturar com SDK Identy
              </Text>
            </TouchableOpacity>
          )}

          {/* Native camera fallback button */}
          {phase === 'sdk_ready' && captureMode === 'native' && !isNativeCameraVisible && (
            <TouchableOpacity
              onPress={() => startNativeCameraFlow().catch(console.error)}
              className="bg-green-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold text-base">
                Abrir Camera Nativa (Fallback)
              </Text>
            </TouchableOpacity>
          )}

          {/* Native Camera */}
          {isNativeCameraVisible && (
            <View className="gap-3 rounded-2xl overflow-hidden border border-border bg-black">
              <CameraView
                ref={cameraRef}
                style={{ width: '100%', height: 420 }}
                facing="front"
                mirror
              />
              <View className="gap-3 p-4 bg-background">
                <Text className="text-center text-foreground font-medium text-sm">
                  Posicione o rosto e capture.
                </Text>
                <TouchableOpacity
                  onPress={captureWithNativeCamera}
                  className={`rounded-xl p-4 ${isTakingPicture ? 'bg-green-300' : 'bg-green-600'}`}
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-white font-bold">
                    {isTakingPicture ? 'Capturando...' : 'Capturar Foto'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsNativeCameraVisible(false);
                    setPhase('sdk_ready');
                    setFeedback('Camera fechada.');
                  }}
                  className="bg-gray-200 rounded-xl p-3 border border-gray-300"
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-gray-800 font-semibold text-sm">Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Messages */}
          {successMessage ? (
            <View className="bg-green-600 rounded-xl p-4">
              <Text className="text-white text-sm font-semibold">{successMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View className="bg-red-500 rounded-xl p-4">
              <Text className="text-white text-sm">{errorMessage}</Text>
            </View>
          ) : null}

          {redirectUrl ? (
            <View className="bg-blue-500 rounded-xl p-4">
              <Text className="text-white text-sm font-semibold">Redirecionar: {redirectUrl}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          {phase === 'idle' && (
            <View className="gap-3">
              <TouchableOpacity
                onPress={handleStartCapture}
                className={`rounded-xl p-4 ${
                  isWebPlatform || isWebViewReady ? 'bg-blue-600' : 'bg-blue-300'
                }`}
                activeOpacity={0.7}
                disabled={!isWebPlatform && !isWebViewReady}
              >
                <Text className="text-center text-white font-bold text-base">
                  {isWebPlatform
                    ? 'Iniciar Captura (SDK Web)'
                    : isWebViewReady
                    ? 'Iniciar Captura'
                    : 'Aguardando WebView...'}
                </Text>
              </TouchableOpacity>

              {!isWebPlatform && (
                <View className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-3">
                  <Text className="text-amber-200 text-xs text-center leading-relaxed">
                    Certifique-se de que o servidor SDK esta rodando:{'\n'}
                    <Text className="font-mono font-bold">pnpm dev:sdk</Text>
                    {'\n'}URL: {sdkServerUrl}
                  </Text>
                </View>
              )}

              {/* Platform info */}
              <View className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-3">
                <Text className="text-gray-300 text-xs text-center leading-relaxed">
                  Plataforma: {Platform.OS}
                  {isWebPlatform ? ' (SDK direto)' : ' (WebView + servidor local)'}
                  {'\n'}SDK: @identy/identy-face v6.3.0-b01
                  {'\n'}Backend: {credifyApiBase}
                </Text>
              </View>
            </View>
          )}

          {(phase === 'success' || phase === 'error') && (
            <TouchableOpacity
              onPress={handleCancel}
              className="bg-blue-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold">Voltar ao inicio</Text>
            </TouchableOpacity>
          )}

          {phase !== 'idle' && phase !== 'success' && phase !== 'error' && (
            <TouchableOpacity
              onPress={handleCancel}
              className="bg-gray-200 rounded-xl p-3 border border-gray-300"
              activeOpacity={0.7}
            >
              <Text className="text-center text-gray-700 font-semibold text-sm">Cancelar</Text>
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
