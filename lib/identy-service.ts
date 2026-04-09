/**
 * Serviço de SDK Identy
 *
 * IMPORTANTE: O pacote @identy/identy-face é um SDK **exclusivamente web**
 * (depende de jQuery, canvas, WASM, DOM APIs). Ele NÃO pode ser importado
 * diretamente no runtime do React Native.
 *
 * Em React Native (Expo Go / dispositivo), o SDK é executado dentro de uma
 * WebView — veja `app/(tabs)/(screens)/facial-capture.tsx` e o HTML que
 * carrega o SDK via <script> tag.
 *
 * Este serviço fornece apenas a lógica de backend (autenticação + envio)
 * que funciona em qualquer runtime JavaScript.
 */

import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface InitializeOptions {
  modelUrl: string;
  pubKeyUrl: string;
}

export interface CaptureOptions {
  asLevel?: string;
  enableAS?: boolean;
  requiredTemplates?: string[];
  showCaptureTraining?: boolean;
  baseUrl?: string;
  enableEyesStatusDetector?: boolean;
  skipSupportCheck?: boolean;
  backend?: string;
  appUI?: string;
  allowCameraSelect?: boolean;
  asThreshold?: string;
  assisted?: boolean;
  localization?: { language?: string };
  graphics?: { canvas?: { label?: string } };
}

export interface CaptureResult {
  status: 'success' | 'error' | 'cancelled';
  message: string;
  data?: {
    template?: Blob | ArrayBuffer;
    liveness?: { score: number; isLive: boolean };
    quality?: number;
    confidence?: number;
  };
  error?: Error;
}

export interface AuthResponse {
  Dados: string; // JWT Token
}

export interface CredifyResponse {
  RESPOSTA?: {
    LIVELINESS?: {
      code: number;
      message: string;
      description?: string;
    };
    URL?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Serviço (apenas lógica de backend, sem importação do SDK web)
// ─────────────────────────────────────────────────────────────

export class IdentyService {
  private static instance: IdentyService;
  private requestID = '';
  private authToken = '';

  private constructor() {
    this.generateRequestID();
  }

  static getInstance(): IdentyService {
    if (!IdentyService.instance) {
      IdentyService.instance = new IdentyService();
    }
    return IdentyService.instance;
  }

  private generateRequestID(): void {
    this.requestID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Autenticar no backend Credify
   */
  async authenticate(baseUrl: string): Promise<string> {
    console.log('[IdentyService] 🔐 Autenticando no backend');

    const response = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ClientID: CREDIFY_CONFIG.CLIENT_ID,
        ClientSecret: CREDIFY_CONFIG.CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro de autenticação: ${response.status}`);
    }

    const data: AuthResponse = await response.json();
    this.authToken = data.Dados;

    console.log('[IdentyService] ✅ Autenticado com sucesso');
    return this.authToken;
  }

  /**
   * Enviar captura para backend Credify
   */
  async submitCapture(
    captureData: Blob | ArrayBuffer,
    baseUrl: string,
    livenessUrl: string
  ): Promise<CredifyResponse> {
    console.log('[IdentyService] 📤 Enviando captura para backend');

    if (!this.authToken) {
      await this.authenticate(baseUrl);
    }

    const formData = new FormData();
    const blob = captureData instanceof Blob ? captureData : new Blob([captureData]);
    formData.append('file', blob, 'bdata');

    const timestamp = Date.now();
    const url = `${livenessUrl}?ts=${timestamp}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-DEBUG': CREDIFY_CONFIG.WERO,
        LogAPITrigger: 'true',
        requestID: this.requestID,
        application: CREDIFY_CONFIG.APPLICATION,
        wero: CREDIFY_CONFIG.WERO,
        keyUrl: CREDIFY_CONFIG.AS_SERVER_CONFIG,
        Authorization: `Bearer ${this.authToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    const result: CredifyResponse = await response.json();
    console.log('[IdentyService] ✅ Resposta do backend recebida');
    return result;
  }

  validateResponse(response: CredifyResponse): boolean {
    return response.RESPOSTA?.LIVELINESS?.code === 200;
  }

  getRedirectUrl(response: CredifyResponse): string | undefined {
    return response.RESPOSTA?.URL;
  }

  getErrorMessage(response: CredifyResponse): string {
    return (
      response.RESPOSTA?.LIVELINESS?.description ||
      response.RESPOSTA?.LIVELINESS?.message ||
      'Erro desconhecido'
    );
  }

  cleanup(): void {
    console.log('[IdentyService] 🧹 Limpando recursos');
    this.authToken = '';
  }

  getRequestID(): string {
    return this.requestID;
  }

  getAuthToken(): string {
    return this.authToken;
  }
}

export const identityService = IdentyService.getInstance();
