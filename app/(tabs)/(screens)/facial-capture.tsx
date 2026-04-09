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
import { ScreenContainer } from '@/components/screen-container';
import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type CapturePhase =
  | 'idle'
  | 'initializing'
  | 'ready'
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
// Utilitários de URL
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

// ─────────────────────────────────────────────────────────────
// HTML da WebView
//
// A WebView serve como container para o SDK Identy (web-only).
// O SDK @identy/identy-face é um pacote privado, indisponivel
// em CDNs publicos (jsdelivr/unpkg retornam 404).
//
// Estrategia:
//   1. WebView inicia → envia WEBVIEW_READY
//   2. RN envia INIT_CONFIG com URLs do SDK
//   3. WebView tenta carregar SDK via JFrog (privado, requer auth)
//      - Sucesso: SDK_INITIALIZED
//      - Falha (esperado no Expo Go): SDK_FALLBACK
//   4. Modo fallback: camera nativa do React Native captura a foto
//   5. Foto enviada ao backend Credify via fetch do RN
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1220; color: #f8fafc; padding: 16px;
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
    }
    .card {
      background: #111827; border: 1px solid #1f2937; border-radius: 18px;
      padding: 20px; width: 100%; max-width: 400px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .title { font-size: 18px; font-weight: 700; text-align: center; }
    .badge-wrap { text-align: center; }
    .badge {
      display: inline-block; border-radius: 999px; padding: 5px 14px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    }
    .badge.loading  { background: #374151; color: #9ca3af; }
    .badge.sdk      { background: #1d4ed8; color: white; }
    .badge.native   { background: #0d9488; color: white; }
    .status-box {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 12px;
      padding: 14px; text-align: center;
    }
    .status-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .status-detail { font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .msg { display: none; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.4; }
    .msg.error   { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fecaca; }
    .msg.success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: #bbf7d0; }
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
    .hint { font-size: 11px; color: #64748b; text-align: center; line-height: 1.4; margin-top: 4px; }
  </style>
</head>
<body>
<div class="card">
  <div class="title">Captura Facial</div>
  <div class="badge-wrap"><span id="badge" class="badge loading">Aguardando</span></div>

  <div class="status-box">
    <div id="st-title" class="status-title">Preparando</div>
    <div id="st-detail" class="status-detail">Aguardando configuracao do aplicativo...</div>
  </div>

  <div id="err-box" class="msg error"></div>
  <div id="ok-box" class="msg success"></div>
  <div id="spin-box" class="spinner-box">
    <div class="spinner"></div>
    <span id="spin-text">Preparando...</span>
  </div>

  <div class="hint">
    O SDK web Identy e carregado nesta WebView quando disponivel.
    Caso contrario, a camera nativa do dispositivo sera utilizada.
  </div>
</div>

<script>
(function() {
  'use strict';

  var config = null;
  var sdkMode = 'unknown';

  var badge    = document.getElementById('badge');
  var stTitle  = document.getElementById('st-title');
  var stDetail = document.getElementById('st-detail');
  var errBox   = document.getElementById('err-box');
  var okBox    = document.getElementById('ok-box');
  var spinBox  = document.getElementById('spin-box');
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

  function setBadge(mode, label) {
    sdkMode = mode;
    badge.textContent = label;
    badge.className = 'badge ' + (mode === 'sdk' ? 'sdk' : mode === 'native' ? 'native' : 'loading');
  }

  function ui(opts) {
    stTitle.textContent  = opts.title  || '';
    stDetail.textContent = opts.detail || '';
    errBox.textContent   = opts.error  || '';
    errBox.style.display = opts.error  ? 'block' : 'none';
    okBox.textContent    = opts.success || '';
    okBox.style.display  = opts.success ? 'block' : 'none';
    spinBox.style.display = opts.spin  ? 'flex' : 'none';
    spinText.textContent  = opts.spinText || 'Preparando...';
  }

  // --- SDK Loading ---
  function loadScript(url, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      var tid = setTimeout(function() {
        reject(new Error('Timeout: ' + url));
      }, timeoutMs || 8000);
      s.onload = function() { clearTimeout(tid); resolve(); };
      s.onerror = function() { clearTimeout(tid); reject(new Error('Network error: ' + url)); };
      document.head.appendChild(s);
    });
  }

  function findSdkGlobal() {
    if (window.IdentyFace && window.IdentyFace.FaceSDK) return window.IdentyFace;
    if (window.Identy    && window.Identy.FaceSDK)      return window.Identy;
    if (window.FaceSDK)                                  return { FaceSDK: window.FaceSDK };
    return null;
  }

  function activateFallback(reason) {
    setBadge('native', 'Camera Nativa');
    ui({
      title: 'Modo camera nativa',
      detail: 'SDK web indisponivel. Use a camera nativa do dispositivo para capturar.',
      spin: false,
    });
    log('Fallback ativado: ' + (reason || 'SDK indisponivel'));
    send('SDK_FALLBACK', { reason: reason || 'SDK web indisponivel', mode: 'native' });
  }

  async function prepareSdk() {
    send('SDK_LOADING', { stage: 'prepare' });
    ui({
      title: 'Preparando captura',
      detail: 'Verificando disponibilidade do SDK Identy...',
      spin: true, spinText: 'Carregando SDK...',
    });

    // 1. Check if already in global scope
    var g = findSdkGlobal();
    if (g) {
      log('SDK encontrado no escopo global');
      await trySdkInit(g, 'global');
      return;
    }

    // 2. The SDK is a private package. Public CDNs (jsdelivr, unpkg) will 404.
    //    We skip CDN attempts entirely to avoid unnecessary delays.
    //    In a production build (EAS), the SDK can be bundled or served locally.
    log('SDK privado - CDN publica indisponivel. Ativando modo nativo.');
    activateFallback('Pacote @identy/identy-face e privado - CDN publica indisponivel');
  }

  async function trySdkInit(sdkGlobal, source) {
    try {
      if (!sdkGlobal || !sdkGlobal.FaceSDK) {
        throw new Error('FaceSDK nao encontrado');
      }
      setBadge('sdk', 'SDK Identy');
      ui({
        title: 'Inicializando SDK Identy',
        detail: 'Carregando modelos e configuracoes...',
        spin: true, spinText: 'Inicializando...',
      });

      if (typeof sdkGlobal.FaceSDK.preInitialize === 'function' && config) {
        sdkGlobal.FaceSDK.preInitialize(
          { URL: config.modelUrl },
          { URL: { url: config.pubKeyUrl, headers: [
            { name: 'LogAPITrigger', value: 'true' },
            { name: 'requestID', value: String(Date.now()) }
          ]}}
        );
        log('preInitialize OK');
      }

      var instance = new sdkGlobal.FaceSDK({
        enableAS: true, requiredTemplates: ['PNG'],
        showCaptureTraining: false, allowCameraSelect: false,
        enableEyesStatusDetector: true, skipSupportCheck: false,
        backend: 'wasm', appUI: 'TICKING', asThreshold: 'MEDIUM',
        localization: { language: 'pt-BR' },
        graphics: { canvas: { label: 'white' } },
      });

      if (instance && typeof instance.initialize === 'function') {
        await Promise.race([
          Promise.resolve(instance.initialize()),
          new Promise(function(_, rej) {
            setTimeout(function(){ rej(new Error('Timeout initialize()')); }, 10000);
          })
        ]);
      }

      ui({
        title: 'SDK Identy pronto',
        detail: 'SDK inicializado com sucesso.',
        spin: false,
      });
      send('SDK_INITIALIZED', { mode: 'sdk', source: source });
      log('SDK inicializado com sucesso de: ' + source);
    } catch(e) {
      log('Falha ao inicializar SDK: ' + (e && e.message ? e.message : e));
      activateFallback('SDK carregado mas initialize() falhou');
    }
  }

  // --- Update UI from RN messages ---
  function updateStatus(title, detail, isOk) {
    ui({
      title: title, detail: detail,
      spin: false,
      success: isOk ? detail : null,
      error: isOk === false ? detail : null,
    });
  }

  // --- Message handler (from React Native) ---
  function onMessage(raw) {
    try {
      var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!m || !m.type) return;

      switch (m.type) {
        case 'INIT_CONFIG':
          config = m.config || {};
          log('Config recebida', {
            hasModelUrl: !!config.modelUrl,
            hasPubKeyUrl: !!config.pubKeyUrl,
            hasBackendUrl: !!config.backendUrl,
          });
          prepareSdk();
          break;

        case 'UPDATE_STATUS':
          updateStatus(m.title || '', m.detail || '', m.isOk);
          if (m.badgeMode) setBadge(m.badgeMode, m.badgeLabel || '');
          break;

        case 'STOP_CAPTURE':
          ui({ title: 'Cancelado', detail: 'Voce pode iniciar novamente.', spin: false });
          break;
      }
    } catch(e) {
      log('Erro ao processar mensagem: ' + (e && e.message ? e.message : e));
    }
  }

  // Listen for messages from React Native
  document.addEventListener('message', function(e) { onMessage(e.data); });
  window.addEventListener('message',   function(e) { onMessage(e.data); });

  // Initial state
  setBadge('loading', 'Aguardando');
  ui({
    title: 'WebView pronta',
    detail: 'Aguardando configuracao do aplicativo.',
    spin: false,
  });

  // Notify React Native
  send('WEBVIEW_READY');
  log('WebView inicializada com sucesso');
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
  const [feedback, setFeedback] = useState('Carregando WebView...');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('unknown');
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [isNativeCameraVisible, setIsNativeCameraVisible] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ── URLs from environment ───────────────────────────────────
  const credifyApiBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE_CREDIFY || 'https://dev-api.credify.com.br/livelinesscapture'
  );
  const urlBase = normalizeApiBase(
    process.env.REACT_APP_URL_BASE || 'https://app-iden-dev.credify.com.br'
  );
  const livenessUrl = buildLivenessUrl(credifyApiBase);
  const authUrl = buildAuthUrl(credifyApiBase);

  const webViewHTML = useMemo(() => buildWebViewHTML(), []);

  // ── Lifecycle logs ─────────────────────────────────────────
  useEffect(() => {
    console.log('[FacialCapture] Componente montado');
    console.log('[FacialCapture] URLs:', { urlBase, credifyApiBase, livenessUrl, authUrl });
    return () => console.log('[FacialCapture] Componente desmontado');
  }, [urlBase, credifyApiBase, livenessUrl, authUrl]);

  // ── Send message TO the WebView ────────────────────────────
  // IMPORTANT: In React Native WebView, you must use injectJavaScript
  // to send data to the WebView. webViewRef.postMessage() does NOT work.
  const sendToWebView = useCallback((message: Record<string, unknown>) => {
    if (!webViewRef.current) {
      console.warn('[FacialCapture] WebView ref not available');
      return;
    }
    const js = `
      (function() {
        try {
          var evt = new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(message))} });
          window.dispatchEvent(evt);
        } catch(e) {
          console.error('injectJS error:', e);
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, []);

  // ── Update WebView status display ─────────────────────────
  const updateWebViewStatus = useCallback(
    (title: string, detail: string, isOk?: boolean, badgeMode?: string, badgeLabel?: string) => {
      sendToWebView({
        type: 'UPDATE_STATUS',
        title,
        detail,
        isOk,
        badgeMode,
        badgeLabel,
      });
    },
    [sendToWebView]
  );

  // ── Authentication ─────────────────────────────────────────
  const authenticate = useCallback(async (): Promise<string> => {
    if (authTokenRef.current) {
      return authTokenRef.current;
    }

    console.log('[FacialCapture] Autenticando em:', authUrl);

    const response = await fetch(authUrl, {
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

    const data = await response.json();

    if (!response.ok || data?.Sucess === false) {
      const msg = data?.Message || `HTTP ${response.status}`;
      console.error('[FacialCapture] Auth falhou:', msg);
      throw new Error(`Autenticacao falhou: ${msg}`);
    }

    const token = data?.Dados || data?.token || data?.access_token;
    if (!token) {
      throw new Error('Token nao encontrado na resposta');
    }

    authTokenRef.current = token;
    console.log('[FacialCapture] Token obtido com sucesso');
    return token;
  }, [authUrl]);

  // ── Submit image to Credify backend ────────────────────────
  const submitToBackend = useCallback(
    async (imageBase64: string, retryOnAuth = true): Promise<Record<string, unknown>> => {
      const requestID = buildRequestId();

      // Strip data URI prefix if present
      const rawBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

      console.log('[FacialCapture] Enviando para backend:', livenessUrl);
      console.log('[FacialCapture] Image base64 length:', rawBase64.length);

      let token: string | null = null;
      try {
        token = await authenticate();
      } catch (authErr) {
        console.warn('[FacialCapture] Auth falhou, tentando sem token:', authErr);
      }

      // React Native does NOT have Blob. Use FormData with a file-like object.
      // React Native's FormData accepts { uri, type, name } objects.
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Web environment - use Blob
        const blob = new Blob([rawBase64], { type: 'text/plain' });
        formData.append('file', blob, 'bdata');
      } else {
        // React Native - FormData accepts file-like objects
        // We need to create a temporary file or use a different approach.
        // Since RN FormData supports string values, we append the base64 as a string field.
        // However, the Credify backend expects a file upload named 'file' with filename 'bdata'.
        //
        // RN FormData trick: append an object with uri/type/name
        // We'll create a data URI and let RN handle it
        formData.append('file', {
          uri: `data:text/plain;base64,${btoa(rawBase64)}`,
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

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${livenessUrl}?ts=${Date.now()}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      let responseData: Record<string, unknown>;
      try {
        responseData = await response.json();
      } catch {
        const text = await response.text();
        responseData = { error: text || 'Resposta invalida', status: 'error' };
      }

      // Retry on 401
      if (response.status === 401 && retryOnAuth) {
        console.log('[FacialCapture] 401 - limpando token e retentando...');
        authTokenRef.current = null;
        return submitToBackend(imageBase64, false);
      }

      if (!response.ok) {
        const errMsg =
          (responseData as any)?.RESPOSTA?.LIVELINESS?.description ||
          (responseData as any)?.RESPOSTA?.LIVELINESS?.message ||
          (responseData as any)?.error ||
          (responseData as any)?.message ||
          `Erro HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      return responseData;
    },
    [authenticate, livenessUrl]
  );

  // ── Validate backend response ─────────────────────────────
  const validateResponse = useCallback((resp: Record<string, unknown>): boolean => {
    const liveliness = (resp as any)?.RESPOSTA?.LIVELINESS;
    return (
      liveliness?.code === 200 ||
      resp?.success === true ||
      resp?.status === 'success'
    );
  }, []);

  const getRedirectUrl = useCallback((resp: Record<string, unknown>): string | null => {
    return (resp as any)?.RESPOSTA?.URL || (resp as any)?.redirectUrl || null;
  }, []);

  const getErrorMessage = useCallback((resp: Record<string, unknown>): string => {
    return (
      (resp as any)?.RESPOSTA?.LIVELINESS?.description ||
      (resp as any)?.RESPOSTA?.LIVELINESS?.message ||
      (resp as any)?.error ||
      (resp as any)?.message ||
      'Erro desconhecido no backend'
    );
  }, []);

  // ── Cancel ─────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    console.log('[FacialCapture] Cancelando...');
    setIsNativeCameraVisible(false);
    setIsTakingPicture(false);
    setPhase('idle');
    setFeedback(
      isWebViewReady
        ? 'Cancelado. Toque em "Iniciar Captura" para tentar novamente.'
        : 'Carregando WebView...'
    );
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    setCaptureMode('unknown');
    sendToWebView({ type: 'STOP_CAPTURE' });
    onCancel?.();
  }, [isWebViewReady, onCancel, sendToWebView]);

  // ── Process captured image ────────────────────────────────
  const processCapturedImage = useCallback(
    async (imageData: string, mode: CaptureMode) => {
      setPhase('submitting');
      setFeedback('Enviando imagem para validacao Credify...');
      setErrorMessage('');

      updateWebViewStatus(
        'Processando',
        'Enviando imagem para validacao...',
        undefined,
        'native',
        'Processando'
      );

      try {
        const backendResponse = await submitToBackend(imageData);

        if (!validateResponse(backendResponse)) {
          const backendError = getErrorMessage(backendResponse);
          throw new Error(backendError || 'Falha na validacao do backend Credify');
        }

        console.log('[FacialCapture] Captura validada pelo backend');
        setPhase('success');
        setFeedback('Verificacao facial concluida com sucesso.');
        setSuccessMessage(
          mode === 'sdk'
            ? 'Captura validada com SDK Identy via WebView.'
            : 'Captura validada com camera nativa.'
        );

        const redirect = getRedirectUrl(backendResponse);
        if (redirect) {
          setRedirectUrl(redirect);
        }

        updateWebViewStatus(
          'Sucesso',
          'Verificacao facial concluida.',
          true,
          'native',
          'Concluido'
        );

        onSuccess?.({
          status: 'success',
          message: 'Captura facial concluida com sucesso',
          redirectUrl: redirect || undefined,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[FacialCapture] Erro no processamento:', error.message);
        setPhase('error');
        setErrorMessage(error.message);
        setFeedback('');

        updateWebViewStatus('Erro', error.message, false);

        onError?.(error);
      }
    },
    [
      getErrorMessage,
      getRedirectUrl,
      onError,
      onSuccess,
      submitToBackend,
      updateWebViewStatus,
      validateResponse,
    ]
  );

  // ── Native camera flow ────────────────────────────────────
  const startNativeCameraFlow = useCallback(async () => {
    console.log('[FacialCapture] Abrindo camera nativa...');

    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      const msg = 'Permissao de camera negada. Habilite nas Configuracoes do iPhone.';
      setPhase('error');
      setErrorMessage(msg);
      setFeedback('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');
    setIsNativeCameraVisible(true);
    setPhase('capturing');
    setFeedback('Camera nativa aberta. Posicione o rosto e toque em "Capturar".');

    updateWebViewStatus(
      'Camera ativa',
      'Posicione o rosto no guia e capture a foto.',
      undefined,
      'native',
      'Camera Nativa'
    );
  }, [cameraPermission, requestCameraPermission, updateWebViewStatus]);

  const captureWithNativeCamera = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error('Camera nativa nao esta pronta.');
      }

      setIsTakingPicture(true);
      setFeedback('Capturando...');

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        throw new Error('Camera nao retornou imagem em Base64.');
      }

      console.log('[FacialCapture] Foto capturada, base64 length:', photo.base64.length);
      setIsNativeCameraVisible(false);
      await processCapturedImage(`data:image/jpeg;base64,${photo.base64}`, captureMode);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[FacialCapture] Erro na captura nativa:', error.message);
      setPhase('error');
      setErrorMessage(error.message);
      setFeedback('');
      onError?.(error);
    } finally {
      setIsTakingPicture(false);
    }
  }, [captureMode, onError, processCapturedImage]);

  // ── Handle WebView messages ───────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        const type = message?.type;

        if (type !== 'WEBVIEW_LOG') {
          console.log('[FacialCapture] WebView:', type, message.mode || message.stage || '');
        }

        switch (type) {
          case 'WEBVIEW_READY':
            setIsWebViewReady(true);
            setFeedback('WebView pronta. Toque em "Iniciar Captura".');
            console.log('[FacialCapture] WebView READY');
            break;

          case 'SDK_LOADING':
            setPhase('initializing');
            setFeedback('Verificando SDK Identy...');
            break;

          case 'SDK_INITIALIZED':
            setCaptureMode('sdk');
            setPhase('ready');
            setFeedback('SDK Identy pronto. Toque para capturar.');
            console.log('[FacialCapture] SDK inicializado');
            break;

          case 'SDK_FALLBACK':
            setCaptureMode('native');
            setPhase('ready');
            setFeedback('Modo camera nativa. Toque em "Abrir Camera" para capturar.');
            console.log('[FacialCapture] Modo fallback (camera nativa)');
            break;

          case 'CAPTURE_SUCCESS':
            // Image captured from WebView SDK camera
            if (message.imageData) {
              console.log('[FacialCapture] Imagem recebida da WebView');
              processCapturedImage(message.imageData, 'sdk');
            }
            break;

          case 'SDK_ERROR':
          case 'ERROR':
            setPhase('error');
            setErrorMessage(message.error || 'Erro na WebView');
            setFeedback('');
            break;

          case 'WEBVIEW_LOG':
            if (message.message) {
              console.log('[WebView]', message.message, message.details ?? '');
            }
            break;
        }
      } catch {
        // Non-JSON message, ignore
      }
    },
    [processCapturedImage]
  );

  // ── "Start Capture" button handler ─────────────────────────
  const handleStartCapture = useCallback(async () => {
    if (!isWebViewReady) {
      setErrorMessage('WebView ainda esta carregando. Aguarde.');
      return;
    }

    console.log('[FacialCapture] Iniciando fluxo de captura...');
    setPhase('initializing');
    setFeedback('Enviando configuracao para WebView...');
    setErrorMessage('');
    setSuccessMessage('');
    setRedirectUrl('');

    // Send config to WebView to attempt SDK initialization
    sendToWebView({
      type: 'INIT_CONFIG',
      config: {
        modelUrl: `${urlBase}/api/v1/models`,
        pubKeyUrl: `${urlBase}/api/v1/pub_key`,
        backendUrl: livenessUrl,
        authUrl: authUrl,
      },
    });

    // The WebView will respond with SDK_INITIALIZED or SDK_FALLBACK
    // Those messages are handled in handleWebViewMessage above
    // Set a safety timeout to ensure we don't stay stuck
    setTimeout(() => {
      setPhase((currentPhase: CapturePhase) => {
        if (currentPhase === 'initializing') {
          console.log('[FacialCapture] Timeout no init - ativando fallback');
          setCaptureMode('native');
          setFeedback('Modo camera nativa. Toque em "Abrir Camera".');
          return 'ready';
        }
        return currentPhase;
      });
    }, 15000);
  }, [authUrl, isWebViewReady, livenessUrl, sendToWebView, urlBase]);

  // ── Dynamic labels ─────────────────────────────────────────
  const phaseTitle = useMemo(() => {
    switch (phase) {
      case 'idle':
        return 'Reconhecimento Facial';
      case 'initializing':
        return 'Preparando...';
      case 'ready':
        return 'Pronto';
      case 'capturing':
        return 'Capturando';
      case 'processing':
      case 'submitting':
        return 'Processando...';
      case 'success':
        return 'Sucesso';
      case 'error':
        return 'Erro';
      default:
        return '';
    }
  }, [phase]);

  const modeLabel = useMemo(() => {
    switch (captureMode) {
      case 'sdk':
        return 'SDK Identy via WebView';
      case 'native':
        return 'Camera nativa (Expo Go)';
      default:
        return 'Aguardando configuracao';
    }
  }, [captureMode]);

  const showSpinner = phase === 'initializing' || phase === 'processing' || phase === 'submitting';

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <ScreenContainer className="p-4 justify-center">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled>
        <View className="gap-5">
          {/* Header */}
          <View className="items-center gap-1 mt-2">
            <Text className="text-xl font-bold text-foreground">{phaseTitle}</Text>
            {feedback ? (
              <Text className="text-sm text-muted text-center leading-relaxed">
                {feedback}
              </Text>
            ) : null}
            <Text className="text-xs text-muted text-center mt-1">Modo: {modeLabel}</Text>
            <Text className="text-xs text-muted text-center opacity-60">
              WebView: {isWebViewReady ? 'OK' : '...'} | Modo: {captureMode} | Fase: {phase}
            </Text>
          </View>

          {/* Spinner */}
          {showSpinner && (
            <View className="items-center py-2">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}

          {/* WebView - always mounted for SDK communication */}
          <View className="rounded-2xl overflow-hidden border border-border bg-black/5">
            <WebView
              ref={webViewRef}
              source={{ html: webViewHTML }}
              originWhitelist={['*']}
              style={{
                width: '100%',
                height: isNativeCameraVisible ? 200 : 360,
                backgroundColor: 'transparent',
              }}
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
              onError={(syntheticEvent: { nativeEvent: { description?: string } }) => {
                const desc = syntheticEvent.nativeEvent.description || 'Erro desconhecido';
                console.error('[WebView] Erro:', desc);
                setPhase('error');
                setErrorMessage(`Falha na WebView: ${desc}`);
              }}
            />
          </View>

          {/* Native Camera (fallback mode) */}
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
                  Posicione seu rosto dentro do guia e capture a foto.
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
                    setPhase('ready');
                    setFeedback('Camera fechada. Toque para abrir novamente.');
                  }}
                  className="bg-gray-200 rounded-xl p-3 border border-gray-300"
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-gray-800 font-semibold text-sm">
                    Fechar camera
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* "Open Native Camera" button (ready + native mode) */}
          {phase === 'ready' && captureMode === 'native' && !isNativeCameraVisible && (
            <TouchableOpacity
              onPress={() => {
                startNativeCameraFlow().catch((err: unknown) => {
                  console.error('[FacialCapture] Erro ao abrir camera:', err);
                });
              }}
              className="bg-green-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold text-base">
                Abrir Camera
              </Text>
            </TouchableOpacity>
          )}

          {/* Success message */}
          {successMessage ? (
            <View className="bg-green-600 rounded-xl p-4">
              <Text className="text-white text-sm font-semibold">{successMessage}</Text>
            </View>
          ) : null}

          {/* Error message */}
          {errorMessage ? (
            <View className="bg-red-500 rounded-xl p-4">
              <Text className="text-white text-sm">{errorMessage}</Text>
            </View>
          ) : null}

          {/* Redirect URL */}
          {redirectUrl ? (
            <View className="bg-blue-500 rounded-xl p-4">
              <Text className="text-white text-sm font-semibold">
                Redirecionar: {redirectUrl}
              </Text>
            </View>
          ) : null}

          {/* Action buttons */}
          {phase === 'idle' && (
            <TouchableOpacity
              onPress={handleStartCapture}
              className={`rounded-xl p-4 ${isWebViewReady ? 'bg-blue-600' : 'bg-blue-300'}`}
              activeOpacity={0.7}
              disabled={!isWebViewReady}
            >
              <Text className="text-center text-white font-bold text-base">
                {isWebViewReady ? 'Iniciar Captura' : 'Aguardando WebView...'}
              </Text>
            </TouchableOpacity>
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
