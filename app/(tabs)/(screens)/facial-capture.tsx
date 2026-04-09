import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ScreenContainer } from '@/components/screen-container';
import { useWebViewCapture } from '@/hooks/use-webview-capture';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// HTML da WebView — com SDK Identy ou modo compatível
//
// Fluxo:
// 1. WebView inicia → envia WEBVIEW_READY
// 2. RN envia INIT_CONFIG com URLs
// 3. WebView tenta carregar SDK Identy via <script>
//    - Se conseguir: envia SDK_INITIALIZED
//    - Se falhar (CDN privado ou timeout): envia SDK_FALLBACK
// 4. Ambos os modos permitem captura pela câmera da WebView
//    ou a câmera nativa do React Native (modo fallback)
// ─────────────────────────────────────────────────────────────

function buildWebViewHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Credify Facial Capture</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1220;
      color: #f8fafc;
      padding: 12px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      text-align: center;
    }
    .status-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .status-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .status-detail {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .badge {
      align-self: center;
      display: inline-block;
      border-radius: 999px;
      padding: 5px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .badge.sdk      { background: #1d4ed8; color: white; }
    .badge.fallback { background: #92400e; color: white; }
    .badge.loading  { background: #374151; color: #9ca3af; }
    .msg { display: none; padding: 10px 12px; border-radius: 10px; font-size: 12px; line-height: 1.4; }
    .msg.error   { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fecaca; }
    .msg.success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.4); color: #bbf7d0; }
    .spinner-box { display: none; align-items: center; justify-content: center; gap: 8px; padding: 6px 0; color: #94a3b8; font-size: 12px; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.12);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .cam-shell {
      display: none;
      border-radius: 14px;
      overflow: hidden;
      background: #000;
      aspect-ratio: 3/4;
      width: 100%;
      position: relative;
      border: 1px solid #1f2937;
    }
    video { width: 100%; height: 100%; object-fit: cover; }
    canvas { display: none; }
    .cam-guide {
      position: absolute; inset: 14% 10%;
      border: 3px solid rgba(96,165,250,0.75);
      border-radius: 50%;
      pointer-events: none;
      box-shadow: 0 0 0 999px rgba(0,0,0,0.15);
    }
    .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    button {
      width: 100%; border: none; border-radius: 12px;
      padding: 13px 14px; font-size: 15px; font-weight: 700; cursor: pointer;
    }
    button.primary   { background: #2563eb; color: white; }
    button.green     { background: #16a34a; color: white; display: none; }
    button.secondary { background: #e5e7eb; color: #111827; }
    button:disabled  { opacity: 0.5; cursor: default; }
    .hint { font-size: 11px; color: #64748b; text-align: center; line-height: 1.4; }
  </style>
</head>
<body>
<div class="card">
  <div class="title">Captura Facial</div>

  <div style="text-align:center">
    <span id="badge" class="badge loading">Aguardando</span>
  </div>

  <div class="status-box">
    <div id="st-title" class="status-title">Preparando WebView</div>
    <div id="st-detail" class="status-detail">Aguardando configuração do aplicativo.</div>
  </div>

  <div id="err-box" class="msg error"></div>
  <div id="ok-box"  class="msg success"></div>

  <div id="spin-box" class="spinner-box">
    <div class="spinner"></div>
    <span id="spin-text">Preparando...</span>
  </div>

  <div id="cam-shell" class="cam-shell">
    <video id="video" autoplay playsinline muted></video>
    <canvas id="canvas"></canvas>
    <div class="cam-guide"></div>
  </div>

  <div class="actions">
    <button id="btn-start"   class="primary"   type="button" style="display:none">Iniciar captura</button>
    <button id="btn-capture" class="green"      type="button">Capturar imagem</button>
    <button id="btn-cancel"  class="secondary"  type="button">Cancelar</button>
  </div>

  <div class="hint">
    O SDK web da Identy é carregado dentro desta WebView.
    Se não estiver disponível, o app ativa o modo compatível automaticamente.
  </div>
</div>

<script>
(function () {
  'use strict';

  // ── Estado ──────────────────────────────────────────────
  var config = null;
  var sdkMode = 'unknown';   // 'sdk' | 'fallback' | 'unknown'
  var sdkReady = false;
  var cameraStream = null;

  // ── Elementos ───────────────────────────────────────────
  var badge     = document.getElementById('badge');
  var stTitle   = document.getElementById('st-title');
  var stDetail  = document.getElementById('st-detail');
  var errBox    = document.getElementById('err-box');
  var okBox     = document.getElementById('ok-box');
  var spinBox   = document.getElementById('spin-box');
  var spinText  = document.getElementById('spin-text');
  var camShell  = document.getElementById('cam-shell');
  var video     = document.getElementById('video');
  var canvas    = document.getElementById('canvas');
  var btnStart  = document.getElementById('btn-start');
  var btnCap    = document.getElementById('btn-capture');
  var btnCancel = document.getElementById('btn-cancel');

  // ── Comunicação com React Native ────────────────────────
  function send(type, data) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data || {})));
    }
  }

  function log(msg, detail) {
    send('WEBVIEW_LOG', { message: msg, details: detail || null });
  }

  // ── UI helpers ──────────────────────────────────────────
  function setBadge(mode, label) {
    sdkMode = mode;
    badge.textContent = label;
    badge.className = 'badge ' + (mode === 'sdk' ? 'sdk' : mode === 'fallback' ? 'fallback' : 'loading');
  }

  function ui(opts) {
    stTitle.textContent  = opts.title  || '';
    stDetail.textContent = opts.detail || '';

    errBox.textContent    = opts.error || '';
    errBox.style.display  = opts.error ? 'block' : 'none';

    okBox.textContent     = opts.success || '';
    okBox.style.display   = opts.success ? 'block' : 'none';

    spinBox.style.display = opts.spin ? 'flex' : 'none';
    spinText.textContent  = opts.spinText || 'Preparando...';

    camShell.style.display  = opts.cam     ? 'block' : 'none';
    btnStart.style.display  = opts.btnStart ? 'block' : 'none';
    btnCap.style.display    = opts.btnCap   ? 'block' : 'none';

    btnStart.textContent = sdkMode === 'fallback' ? 'Abrir câmera (modo compatível)' : 'Iniciar captura';
  }

  // ── Câmera ──────────────────────────────────────────────
  function stopCamera() {
    if (cameraStream) {
      try { cameraStream.getTracks().forEach(function(t){ t.stop(); }); } catch(_){}
      cameraStream = null;
      video.srcObject = null;
    }
  }

  // ── SDK Identy — carregamento via script tag ────────────
  function loadScript(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.crossOrigin = 'anonymous';

      var tid = setTimeout(function () {
        reject(new Error('Timeout ao carregar SDK de ' + url));
      }, timeoutMs || 8000);

      s.onload = function () { clearTimeout(tid); resolve(); };
      s.onerror = function () { clearTimeout(tid); reject(new Error('Erro de rede ao carregar SDK')); };
      document.head.appendChild(s);
    });
  }

  function findSdkGlobal() {
    // O bundle webpack do @identy/identy-face expõe no escopo global
    if (window.IdentyFace && window.IdentyFace.FaceSDK) return window.IdentyFace;
    if (window.Identy    && window.Identy.FaceSDK)      return window.Identy;
    if (window.FaceSDK)                                  return { FaceSDK: window.FaceSDK };
    return null;
  }

  function activateFallback(reason) {
    sdkReady = true;
    setBadge('fallback', 'Modo compatível');
    ui({
      title: 'Modo compatível ativo',
      detail: 'O SDK web não conseguiu inicializar. A captura funcionará pela câmera nativa do React Native.',
      spin: false,
      btnStart: true,
      btnCap: false,
      cam: false,
    });
    log('Fallback ativado: ' + (reason || ''));
    send('SDK_FALLBACK', { reason: reason || 'SDK web indisponível' });
  }

  // ── Preparação do SDK ───────────────────────────────────
  async function prepareSdk() {
    send('SDK_LOADING', { stage: 'prepare' });

    ui({
      title: 'Preparando captura',
      detail: 'Verificando disponibilidade do SDK Identy...',
      spin: true,
      spinText: 'Carregando SDK...',
      btnStart: false,
    });

    // 1) Verificar se já existe no escopo global
    var g = findSdkGlobal();
    if (g) {
      log('SDK encontrado no escopo global');
      await trySdkInit(g, 'global');
      return;
    }

    // 2) Tentar carregar de CDNs (o pacote é privado, então pode falhar)
    var urls = [
      'https://cdn.jsdelivr.net/npm/@identy/identy-face@5.0.1/dist/identy-face.js',
      'https://unpkg.com/@identy/identy-face@5.0.1/dist/identy-face.js'
    ];

    var lastErr = '';
    for (var i = 0; i < urls.length; i++) {
      try {
        log('Tentando carregar: ' + urls[i]);
        await loadScript(urls[i], 6000);
        g = findSdkGlobal();
        if (g) {
          log('SDK carregado com sucesso de: ' + urls[i]);
          await trySdkInit(g, urls[i]);
          return;
        }
        lastErr = 'Script carregado mas FaceSDK não foi exposto globalmente';
      } catch (e) {
        lastErr = e && e.message ? e.message : String(e);
        log('Falha ao carregar de ' + urls[i] + ': ' + lastErr);
      }
    }

    // 3) Não conseguiu — ativar fallback
    activateFallback(lastErr || 'SDK privado não disponível em CDN público');
  }

  async function trySdkInit(sdkGlobal, source) {
    try {
      if (!sdkGlobal || !sdkGlobal.FaceSDK) {
        throw new Error('FaceSDK não encontrado no módulo');
      }

      setBadge('sdk', 'SDK Identy');

      ui({
        title: 'Inicializando SDK Identy',
        detail: 'Carregando modelos e configurações...',
        spin: true,
        spinText: 'Inicializando...',
      });

      // preInitialize
      if (typeof sdkGlobal.FaceSDK.preInitialize === 'function' && config) {
        try {
          sdkGlobal.FaceSDK.preInitialize(
            { URL: config.modelUrl },
            { URL: { url: config.pubKeyUrl, headers: [
              { name: 'LogAPITrigger', value: 'true' },
              { name: 'requestID', value: String(Date.now()) }
            ]}}
          );
          log('preInitialize OK');
        } catch (e) {
          log('preInitialize falhou: ' + (e && e.message ? e.message : e));
          activateFallback('preInitialize falhou');
          return;
        }
      }

      // Criar instância
      var instance = new sdkGlobal.FaceSDK({
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

      if (instance && typeof instance.initialize === 'function') {
        await Promise.race([
          Promise.resolve(instance.initialize()),
          new Promise(function(_, rej) {
            setTimeout(function(){ rej(new Error('Timeout initialize()')); }, 10000);
          })
        ]);
      }

      sdkReady = true;

      ui({
        title: 'SDK Identy pronto',
        detail: 'Toque em "Iniciar captura" para abrir a câmera.',
        spin: false,
        btnStart: true,
      });

      send('SDK_INITIALIZED', { mode: 'sdk', source: source });
      log('SDK inicializado com sucesso de: ' + source);

    } catch (e) {
      log('Falha ao inicializar SDK: ' + (e && e.message ? e.message : e));
      activateFallback('SDK carregado mas initialize() falhou');
    }
  }

  // ── Captura pela câmera do WebView ──────────────────────
  async function openCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia indisponível neste WebView');
      }

      ui({
        title: 'Abrindo câmera',
        detail: 'Permita o acesso à câmera para continuar.',
        spin: true,
        spinText: 'Abrindo câmera...',
        btnStart: false,
      });

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });

      video.srcObject = cameraStream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      ui({
        title: sdkMode === 'sdk' ? 'SDK capturando' : 'Câmera pronta',
        detail: 'Posicione o rosto dentro do guia e toque em "Capturar imagem".',
        spin: false,
        cam: true,
        btnCap: true,
      });

      send('READY', { mode: sdkMode });

    } catch (e) {
      var msg = e && e.message ? e.message : 'Falha ao abrir câmera';
      ui({
        title: 'Erro na câmera',
        detail: 'Verifique permissões e tente novamente.',
        error: msg,
        spin: false,
        btnStart: true,
        cam: false,
        btnCap: false,
      });
      send('ERROR', { error: msg });
    }
  }

  function captureFrame() {
    try {
      if (!video.videoWidth || !video.videoHeight) {
        throw new Error('Câmera sem frame válido');
      }

      ui({
        title: 'Processando imagem',
        detail: 'Enviando para validação...',
        spin: true,
        spinText: 'Gerando imagem...',
        cam: false,
        btnCap: false,
      });

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      var dataUrl = canvas.toDataURL('image/png', 1.0);

      stopCamera();

      send('CAPTURE_SUCCESS', { imageData: dataUrl, mode: sdkMode });

      ui({
        title: 'Imagem capturada',
        detail: 'Aguardando processamento pelo aplicativo...',
        success: 'Imagem enviada com sucesso.',
        spin: true,
        spinText: 'Processando...',
      });

    } catch (e) {
      var msg = e && e.message ? e.message : 'Falha ao capturar';
      ui({ title: 'Erro', error: msg, cam: true, btnCap: true });
      send('ERROR', { error: msg });
    }
  }

  function cancelCapture() {
    stopCamera();
    ui({
      title: 'Cancelado',
      detail: 'Você pode iniciar novamente.',
      spin: false,
      btnStart: sdkReady,
      cam: false,
      btnCap: false,
    });
    send('CANCELLED');
  }

  // ── Mensagens vindas do React Native ────────────────────
  function onMessage(raw) {
    try {
      var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!m || !m.type) return;

      switch (m.type) {
        case 'INIT_CONFIG':
          config = m.config || {};
          log('Config recebida', {
            hasModelUrl:   !!config.modelUrl,
            hasPubKeyUrl:  !!config.pubKeyUrl,
            hasBackendUrl: !!config.backendUrl,
          });
          prepareSdk();
          break;

        case 'START_CAPTURE':
          if (sdkMode === 'fallback') {
            // No modo fallback a câmera nativa do RN será usada
            send('START_REQUESTED', { mode: 'fallback' });
          } else {
            openCamera();
          }
          break;

        case 'STOP_CAPTURE':
          cancelCapture();
          break;
      }
    } catch (e) {
      log('Erro ao processar mensagem: ' + (e && e.message ? e.message : e));
    }
  }

  // Ambos os event listeners (iOS usa 'message', Android usa 'document message')
  document.addEventListener('message', function(e) { onMessage(e.data); });
  window.addEventListener('message', function(e) { onMessage(e.data); });

  // Botões internos da WebView
  btnStart.addEventListener('click', function () {
    if (sdkMode === 'fallback') {
      send('START_REQUESTED', { mode: 'fallback' });
    } else {
      openCamera();
    }
  });

  btnCap.addEventListener('click', captureFrame);
  btnCancel.addEventListener('click', function () { send('CANCEL_REQUESTED'); });
  window.addEventListener('beforeunload', stopCamera);

  // ── Estado inicial ──────────────────────────────────────
  setBadge('loading', 'Aguardando');
  ui({
    title: 'WebView pronta',
    detail: 'Aguardando configuração do aplicativo.',
    spin: false,
    btnStart: false,
    btnCap: false,
    cam: false,
  });

  // Notificar RN que a WebView está pronta
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
  const [feedback, setFeedback] = useState('Carregando WebView...');
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

  // ── Logs de ciclo de vida ─────────────────────────────────
  useEffect(() => {
    console.log('[FacialCapture] ✅ Componente montado');
    return () => console.log('[FacialCapture] ❌ Componente desmontado');
  }, []);

  // ── Reagir quando a WebView ficar pronta ──────────────────
  useEffect(() => {
    if (isWebViewReady && phase === 'idle') {
      console.log('[FacialCapture] WebView reportou READY');
      setFeedback('WebView pronta. Toque em "Iniciar Captura" para começar.');
    }
  }, [isWebViewReady, phase]);

  // ── Cancelar ──────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    console.log('[FacialCapture] Cancelando...');
    stopCapture();
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
    onCancel?.();
  }, [isWebViewReady, onCancel, stopCapture]);

  // ── Processar imagem capturada ────────────────────────────
  const processCapturedImage = useCallback(
    async (imageData: string, mode: CaptureMode) => {
      setPhase('processing');
      setFeedback('Enviando imagem para validação Credify...');
      setErrorMessage('');

      try {
        const backendResponse = await submitToBackend(imageData, livenessUrl, authBaseUrl);

        if (!validateResponse(backendResponse)) {
          const backendError = getErrorMessage(backendResponse);
          throw new Error(backendError || 'Falha na validação do backend Credify');
        }

        console.log('[FacialCapture] ✅ Captura validada pelo backend');
        setPhase('success');
        setFeedback('Verificação facial concluída com sucesso.');
        setSuccessMessage(
          mode === 'sdk'
            ? 'Captura validada com SDK Identy via WebView.'
            : 'Captura validada com câmera nativa (modo compatível).'
        );

        const redirect = getRedirectUrl(backendResponse);
        if (redirect) {
          setRedirectUrl(redirect);
        }

        onSuccess?.({
          status: 'success',
          message: 'Captura facial concluída com sucesso',
          redirectUrl: redirect || undefined,
        });
      } catch (err: any) {
        console.error('[FacialCapture] ❌ Erro no processamento:', err);
        setPhase('error');
        setErrorMessage(err?.message || 'Erro no processamento');
        setFeedback('');
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [authBaseUrl, getErrorMessage, getRedirectUrl, livenessUrl, onError, onSuccess, submitToBackend, validateResponse]
  );

  // ── Câmera nativa (fallback) ──────────────────────────────
  const startNativeCameraFlow = useCallback(async () => {
    const permission = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();

    if (!permission?.granted) {
      const error = new Error('Permissão de câmera negada. Habilite nas Configurações do iPhone.');
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
    setFeedback('Câmera nativa aberta. Posicione o rosto e toque em "Capturar".');
  }, [cameraPermission, requestCameraPermission]);

  const captureWithNativeCamera = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error('Câmera nativa não está pronta.');
      }

      setIsTakingPicture(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.base64) {
        throw new Error('Câmera não retornou imagem em Base64.');
      }

      setIsNativeCameraVisible(false);
      await processCapturedImage(`data:image/jpeg;base64,${photo.base64}`, 'fallback');
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na captura nativa:', error);
      setPhase('error');
      setErrorMessage(error?.message || 'Erro na captura nativa');
      setFeedback('');
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsTakingPicture(false);
    }
  }, [onError, processCapturedImage]);

  // ── Captura pela WebView (modo SDK) ───────────────────────
  const performWebViewCapture = useCallback(async () => {
    console.log('[FacialCapture] Iniciando captura via WebView');
    setPhase('capturing');
    setFeedback('Abrindo câmera na WebView...');
    setErrorMessage('');

    try {
      const result = await startCapture();

      if (result.status === 'success' && result.imageData) {
        console.log('[FacialCapture] ✅ Imagem capturada pela WebView');
        await processCapturedImage(result.imageData, 'sdk');
      } else if (result.status === 'cancelled') {
        setPhase('ready');
        setFeedback('Captura cancelada. Toque para tentar novamente.');
        onCancel?.();
      } else {
        throw new Error(result.message || 'Erro na captura facial');
      }
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro na captura WebView:', error);
      setPhase('error');
      setErrorMessage(error?.message || 'Erro na captura');
      setFeedback('');
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [onCancel, onError, processCapturedImage, startCapture]);

  // ── Mensagens vindas da WebView ───────────────────────────
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { data } = event.nativeEvent;

      try {
        const message = JSON.parse(data);
        const type = message?.type;

        // Logs não-ruidosos
        if (type !== 'WEBVIEW_LOG') {
          console.log('[FacialCapture] ← WebView:', type);
        }

        switch (type) {
          case 'WEBVIEW_READY':
            setFeedback('WebView pronta. Toque em "Iniciar Captura".');
            break;

          case 'SDK_LOADING':
            setPhase('initializing');
            setFeedback('Carregando SDK Identy...');
            break;

          case 'SDK_INITIALIZED':
            setCaptureMode('sdk');
            setPhase('ready');
            setFeedback('SDK Identy pronto. Use o botão na WebView para iniciar.');
            break;

          case 'SDK_FALLBACK':
            setCaptureMode('fallback');
            setPhase('ready');
            setFeedback('Modo compatível ativo. Toque para abrir a câmera nativa.');
            break;

          case 'START_REQUESTED':
            if (message.mode === 'fallback' || captureMode === 'fallback') {
              startNativeCameraFlow().catch((cameraErr: unknown) => {
                console.error('[FacialCapture] Erro ao abrir câmera nativa:', cameraErr);
              });
            } else {
              performWebViewCapture();
            }
            break;

          case 'CANCEL_REQUESTED':
            handleCancel();
            break;

          case 'READY':
            setPhase('capturing');
            setFeedback('Câmera aberta. Posicione o rosto e capture.');
            if (message.mode) {
              setCaptureMode(message.mode);
            }
            break;

          case 'SDK_ERROR':
          case 'ERROR':
            setPhase('error');
            setErrorMessage(message.error || 'Erro na WebView');
            setFeedback('');
            break;
        }
      } catch (parseError) {
        console.warn('[FacialCapture] Mensagem não-JSON da WebView:', data);
      }

      // Repassar para o hook (resolve promessas pendentes)
      handleWebViewMessage(data);
    },
    [captureMode, handleCancel, handleWebViewMessage, performWebViewCapture, startNativeCameraFlow]
  );

  // ── Botão "Iniciar Captura" ───────────────────────────────
  const handleStartCapture = useCallback(async () => {
    try {
      if (!isWebViewReady) {
        setErrorMessage('WebView ainda está carregando. Aguarde.');
        return;
      }

      console.log('[FacialCapture] 🔵 Iniciando fluxo de captura');
      setPhase('initializing');
      setFeedback('Enviando configuração para WebView...');
      setErrorMessage('');
      setSuccessMessage('');
      setRedirectUrl('');

      await initialize({
        modelUrl: `${urlBase}/api/v1/models`,
        pubKeyUrl: `${urlBase}/api/v1/pub_key`,
        backendUrl: livenessUrl,
        authUrl: authBaseUrl,
      });

      // Após inicializar, o estado já foi atualizado pelas mensagens
      // da WebView (SDK_INITIALIZED ou SDK_FALLBACK)
      console.log('[FacialCapture] ✅ Inicialização concluída');

      if (phase !== 'ready') {
        setPhase('ready');
        setFeedback('Pronto. Use os botões na WebView ou abra a câmera nativa.');
      }
    } catch (error: any) {
      console.error('[FacialCapture] ❌ Erro ao iniciar:', error);
      setPhase('error');
      setErrorMessage(error?.message || 'Erro ao preparar captura');
      setFeedback('');
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [authBaseUrl, initialize, isWebViewReady, livenessUrl, onError, phase, urlBase]);

  // ── Rótulos dinâmicos ─────────────────────────────────────
  const phaseTitle = useMemo(() => {
    switch (phase) {
      case 'idle': return 'Reconhecimento Facial';
      case 'initializing': return 'Preparando...';
      case 'ready': return 'Pronto';
      case 'capturing': return 'Capturando';
      case 'processing': return 'Processando...';
      case 'success': return '✅ Sucesso';
      case 'error': return '❌ Erro';
      default: return '';
    }
  }, [phase]);

  const modeLabel = useMemo(() => {
    switch (captureMode) {
      case 'sdk': return 'SDK Identy via WebView';
      case 'fallback': return 'Câmera nativa (compatível)';
      default: return 'Aguardando configuração';
    }
  }, [captureMode]);

  const showSpinner = phase === 'initializing' || phase === 'processing';

  // ─────────────────────────────────────────────────────────
  // Renderização
  // ─────────────────────────────────────────────────────────

  return (
    <ScreenContainer className="p-4 justify-center">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled>
        <View className="gap-5">

          {/* ── Cabeçalho ──────────────────────────────────── */}
          <View className="items-center gap-1 mt-2">
            <Text className="text-xl font-bold text-foreground">{phaseTitle}</Text>
            {feedback ? (
              <Text className="text-sm text-muted text-center leading-relaxed">{feedback}</Text>
            ) : null}
            <Text className="text-xs text-muted text-center mt-1">
              Modo: {modeLabel}
            </Text>
            <Text className="text-xs text-muted text-center opacity-60">
              WebView: {isWebViewReady ? '✅' : '⏳'} | SDK: {isReady ? '✅' : '⏳'} | Captura: {isCapturing ? '🔴' : '⚪'}
            </Text>
          </View>

          {/* ── Spinner ────────────────────────────────────── */}
          {showSpinner && (
            <View className="items-center py-2">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}

          {/* ── WebView (sempre visível para manter comunicação) */}
          <View className="rounded-2xl overflow-hidden border border-border bg-black/5">
            <WebView
              ref={webViewRef}
              source={{ html: webViewHTML, baseUrl: urlBase }}
              originWhitelist={['*']}
              style={{ width: '100%', height: 540, backgroundColor: 'transparent' }}
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
              onLoadStart={() => console.log('[WebView] onLoadStart')}
              onLoadEnd={() => console.log('[WebView] onLoadEnd')}
              onError={(syntheticEvent: any) => {
                const { nativeEvent } = syntheticEvent;
                console.error('[WebView] Erro:', nativeEvent);
                setPhase('error');
                setErrorMessage('Falha ao carregar WebView: ' + (nativeEvent.description || ''));
              }}
            />
          </View>

          {/* ── Câmera nativa (modo fallback) ──────────────── */}
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
                  Câmera nativa para compatibilidade com Expo Go.
                </Text>
                <TouchableOpacity
                  onPress={captureWithNativeCamera}
                  className={`rounded-xl p-4 ${isTakingPicture ? 'bg-green-300' : 'bg-green-600'}`}
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-white font-bold">
                    {isTakingPicture ? 'Capturando...' : '📸 Capturar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setIsNativeCameraVisible(false);
                    setPhase('ready');
                    setFeedback('Câmera fechada. Toque para abrir novamente.');
                  }}
                  className="bg-gray-200 rounded-xl p-3 border border-gray-300"
                  activeOpacity={0.7}
                  disabled={isTakingPicture}
                >
                  <Text className="text-center text-gray-800 font-semibold text-sm">Fechar câmera</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Botão "Abrir câmera nativa" (modo fallback) ── */}
          {phase === 'ready' && captureMode === 'fallback' && !isNativeCameraVisible && (
            <TouchableOpacity
              onPress={() => {
                startNativeCameraFlow().catch((nativeCamErr: unknown) => {
                  console.error('[FacialCapture] Erro:', nativeCamErr);
                });
              }}
              className="bg-green-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold">📸 Abrir Câmera Nativa</Text>
            </TouchableOpacity>
          )}

          {/* ── Mensagens ──────────────────────────────────── */}
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

          {/* ── Botões de ação ─────────────────────────────── */}
          {phase === 'idle' && (
            <View className="gap-3">
              <TouchableOpacity
                onPress={handleStartCapture}
                className={`rounded-xl p-4 ${isWebViewReady ? 'bg-blue-600' : 'bg-blue-300'}`}
                activeOpacity={0.7}
                disabled={!isWebViewReady}
              >
                <Text className="text-center text-white font-bold text-base">
                  {isWebViewReady ? '🚀 Iniciar Captura' : '⏳ Aguardando WebView...'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {(phase === 'success' || phase === 'error') && (
            <TouchableOpacity
              onPress={handleCancel}
              className="bg-blue-600 rounded-xl p-4"
              activeOpacity={0.7}
            >
              <Text className="text-center text-white font-bold">↩ Voltar ao início</Text>
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
