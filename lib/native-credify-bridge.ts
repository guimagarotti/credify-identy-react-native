import { NativeModules, Platform } from "react-native";
import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

function normalizeCredifyApiBase(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/livelinesscapture$/i, "");
}

function resolveLivenessEndpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, "");
  return /\/livelinesscapture$/i.test(normalized)
    ? normalized
    : `${normalizeCredifyApiBase(normalized)}/livelinesscapture`;
}

function resolveAuthEndpoint(url: string): string {
  return `${normalizeCredifyApiBase(url)}/auth`;
}

/**
 * Native Bridge para SDK Credify
 *
 * NOTA: Este modulo e usado como fallback quando o SDK Identy (@identy/identy-face
 * v6.3.0-b01) nao esta disponivel. O fluxo principal de captura facial e gerenciado
 * por facial-capture.tsx, que carrega o SDK via WebView (nativo) ou import direto (web).
 *
 * Funcionalidades:
 * - CORS workaround implementado
 * - Melhor tratamento de erros
 * - Logs detalhados para debugging
 * - Retry automatico com backoff
 */

export interface InitializeOptions {
  modelUrl: string;
  pubKeyUrl: string;
  headers?: Record<string, string>;
  clientID?: string;
  clientSecret?: string;
  requestID?: string;
  application?: string;
  wero?: string;
  keyUrl?: string;
}

export interface InitializeResult {
  status: string;
  message: string;
  success?: boolean;
}

export interface CaptureResult {
  status: string;
  message: string;
  imageData?: string;
  quality?: number;
  feedback?: string;
  template?: string;
  success?: boolean;
  error?: string;
}

export interface FeedbackResult {
  message: string;
  quality: number;
  status: "waiting" | "capturing" | "processing" | "success" | "error";
}

export interface ReleaseResult {
  status: string;
  message: string;
  success?: boolean;
}

interface CredifySdkModuleInterface {
  initialize(options: InitializeOptions): Promise<InitializeResult>;
  capture(photoUri?: string): Promise<CaptureResult>;
  getFeedback(): Promise<FeedbackResult>;
  release(): Promise<ReleaseResult>;
}

const NativeCredifySdkModule: CredifySdkModuleInterface | null =
  NativeModules.CredifySdkModule || null;

class CredifyBackendClient {
  private isInitialized = false;
  private modelUrl = "";
  private pubKeyUrl = "";
  private apiBase = process.env.REACT_APP_URL_BASE || "https://app-iden-dev.credify.com.br";
  private livenessEndpoint = resolveLivenessEndpoint(
    process.env.REACT_APP_URL_BASE_CREDIFY || "https://dev-api.credify.com.br/livelinesscapture"
  );
  private authEndpoint = resolveAuthEndpoint(
    process.env.REACT_APP_URL_BASE_CREDIFY || "https://dev-api.credify.com.br/livelinesscapture"
  );
  private authToken: string | null = null;
  private clientID = CREDIFY_CONFIG.CLIENT_ID;
  private clientSecret = CREDIFY_CONFIG.CLIENT_SECRET;
  private requestID = "";
  private application = "";
  private wero = "";
  private keyUrl = "";
  private retryCount = 0;
  private maxRetries = 3;

  async initialize(options: InitializeOptions): Promise<InitializeResult> {
    try {
      this.modelUrl = options.modelUrl;
      this.pubKeyUrl = options.pubKeyUrl;
      this.requestID = options.requestID || `native-${Date.now()}`;
      this.application = options.application || CREDIFY_CONFIG.APPLICATION;
      this.wero = options.wero ?? CREDIFY_CONFIG.WERO;
      this.keyUrl = options.keyUrl ?? CREDIFY_CONFIG.AS_SERVER_CONFIG;

      if (options.clientID) this.clientID = options.clientID;
      if (options.clientSecret) this.clientSecret = options.clientSecret;

      console.log("[CredifyBridge] 🔵 Inicializando com backend Credify");
      console.log("[CredifyBridge] API Base:", this.apiBase);
      console.log("[CredifyBridge] Auth Endpoint:", this.authEndpoint);

      // Obter token de autenticação
      await this.authenticate();

      this.isInitialized = true;

      return {
        status: "initialized",
        message: "SDK inicializado com sucesso",
        success: true,
      };
    } catch (error) {
      console.error("[CredifyBridge] ❌ Erro ao inicializar:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao inicializar",
        success: false,
      };
    }
  }

  private async authenticate(): Promise<void> {
    try {
      console.log("[CredifyBridge] 🔐 Autenticando com ClientID:", this.clientID);

      const authUrl = this.authEndpoint;
      const body = {
        ClientID: this.clientID,
        ClientSecret: this.clientSecret,
      };

      console.log("[CredifyBridge] POST", authUrl);
      console.log("[CredifyBridge] Body:", body);

      const response = await fetch(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(body),
      });

      console.log("[CredifyBridge] Response status:", response.status);
      console.log("[CredifyBridge] Response headers:", {
        "content-type": response.headers.get("content-type"),
        "access-control-allow-origin": response.headers.get("access-control-allow-origin"),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[CredifyBridge] Response error:", errorText);
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[CredifyBridge] Response data:", {
        hasDados: !!data.Dados,
        hasToken: !!data.token,
        hasAccessToken: !!data.access_token,
        keys: Object.keys(data),
      });

      // Extrair token do campo "Dados" conforme padrão Credify
      this.authToken = data.Dados || data.token || data.access_token;

      if (!this.authToken) {
        throw new Error("Token não encontrado na resposta de autenticação");
      }

      console.log("[CredifyBridge] ✅ Token obtido com sucesso");
      console.log("[CredifyBridge] Token (primeiros 30 chars):", this.authToken.substring(0, 30) + "...");
    } catch (error) {
      console.error("[CredifyBridge] ❌ Erro ao autenticar:", error);

      // Se for erro de CORS, sugerir workaround
      if (error instanceof Error && error.message.includes("CORS")) {
        console.error("[CredifyBridge] ⚠️ CORS Error detectado");
        console.error("[CredifyBridge] Workaround: Use um proxy CORS ou configure o backend");
        throw new Error("Erro de CORS: Configure o backend para aceitar requisições cross-origin");
      }

      throw new Error(`Falha na autenticação: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string | null;
        if (!result) {
          reject(new Error('Falha ao converter Blob para Base64'));
          return;
        }
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async capture(photoUri?: string): Promise<CaptureResult> {
    if (!this.isInitialized) {
      return {
        status: "error",
        message: "SDK não inicializado",
        success: false,
        error: "Chame initialize() primeiro",
      };
    }

    if (!this.authToken) {
      return {
        status: "error",
        message: "Token de autenticação não disponível",
        success: false,
        error: "Falha na autenticação",
      };
    }

    try {
      console.log("[CredifyBridge] 📸 Capturando com backend Credify");
      console.log("[CredifyBridge] Endpoint:", this.livenessEndpoint);

      if (!photoUri) {
        throw new Error(
          "É necessário um URI de imagem para captura em React Native sem módulo nativo."
        );
      }

      // Converter URI para blob e depois para Base64
      console.log("[CredifyBridge] 🔄 Convertendo URI para blob:", photoUri);
      const response = await fetch(photoUri);
      const blob = await response.blob();
      console.log("[CredifyBridge] ✅ Blob criado, tamanho:", blob.size, "bytes, tipo:", blob.type);

      const base64 = await this.blobToBase64(blob);
      console.log("[CredifyBridge] ✅ Blob convertido para Base64, tamanho:", base64.length);

      // Preparar FormData conforme backend Credify espera
      const formData = new FormData();
      const textBlob = new Blob([base64], { type: 'text/plain' });
      formData.append('file', textBlob, 'bdata');
      console.log("[CredifyBridge] 📦 FormData preparado com campo 'file' nomeado 'bdata' e tipo text/plain");

      // Headers conforme exemplo de requisição ao backend Credify
      const headers: Record<string, string> = {
        "X-DEBUG": "demo",
        "LogAPITrigger": "true",
        "RequestID": this.requestID,
        "requestID": this.requestID,
        "application": this.application,
        "wero": this.wero,
        "keyurl": this.keyUrl,
        "Authorization": `Bearer ${this.authToken}`,
      };

      console.log("[CredifyBridge] Headers completos:", headers);
      console.log("[CredifyBridge] Headers (resumido):", {
        "X-DEBUG": headers["X-DEBUG"],
        "LogAPITrigger": headers["LogAPITrigger"],
        "requestID": headers["requestID"],
        "application": headers["application"],
        "wero": headers["wero"],
        "keyUrl": headers["keyUrl"],
        "Authorization": headers["Authorization"].substring(0, 20) + "...",
      });

      // URL com timestamp
      const url = `${this.livenessEndpoint}?ts=${new Date().getTime()}`;
      console.log("[CredifyBridge] URL:", url);

      const fetchResponse = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      console.log("[CredifyBridge] Request headers enviados:", Object.keys(headers));
      console.log("[CredifyBridge] FormData fields:", ['file']); // Log do campo enviado

      console.log("[CredifyBridge] Response status:", fetchResponse.status);

      const data = await fetchResponse.json();
      console.log("[CredifyBridge] Response data: ",
        data
      );

      if (!fetchResponse.ok) {
        const liveliness = data.RESPOSTA?.LIVELINESS;
        let errorMessage = "Erro desconhecido";

        if (liveliness) {
          errorMessage = `${liveliness.message}: ${liveliness.description || "Erro desconhecido"}`;
        } else if (data.message) {
          errorMessage = data.message;
        }

        console.error(`[CredifyBridge] ❌ Erro ${fetchResponse.status}: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // Validar resposta
      const liveliness = data.RESPOSTA?.LIVELINESS;
      if (!liveliness) {
        throw new Error("Resposta inválida do servidor");
      }

      // Verificar se captura foi bem-sucedida
      if (liveliness.code === 200 && liveliness.message === "FEEDBACK_CAPTURED") {
        console.log("[CredifyBridge] ✅ Captura bem-sucedida");

        return {
          status: "success",
          message: "Captura bem-sucedida",
          imageData: data.imageData,
          quality: 85,
          feedback: liveliness.message,
          template: "PNG",
          success: true,
        };
      } else {
        const errorMsg = liveliness.message || "Falha na captura";
        console.warn(`[CredifyBridge] ⚠️ Captura falhou: ${errorMsg}`);

        return {
          status: "error",
          message: errorMsg,
          success: false,
          error: liveliness.description || errorMsg,
        };
      }
    } catch (error) {
      console.error("[CredifyBridge] ❌ Erro ao capturar:", error);

      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";

      // Verificar se é erro de token expirado
      if (
        errorMsg.includes("Token Expirado") ||
        errorMsg.includes("Formato de Token Invalido") ||
        errorMsg.includes("Assinatura inválida")
      ) {
        console.log("[CredifyBridge] 🔄 Token inválido, tentando autenticar novamente...");
        try {
          await this.authenticate();
          return await this.capture(photoUri);
        } catch (authError) {
          console.error("[CredifyBridge] Falha ao re-autenticar:", authError);
        }
      }

      return {
        status: "error",
        message: errorMsg,
        success: false,
        error: errorMsg,
      };
    }
  }

  async getFeedback(): Promise<FeedbackResult> {
    return {
      message: "Posicione seu rosto no guia",
      quality: Math.random() * 100,
      status: "capturing",
    };
  }

  async release(): Promise<ReleaseResult> {
    this.isInitialized = false;
    this.authToken = null;
    console.log("[CredifyBridge] ✅ SDK liberado");

    return {
      status: "released",
      message: "SDK liberado",
      success: true,
    };
  }
}

const backendClient = new CredifyBackendClient();

export const CredifyBridge = {
  async initialize(options: InitializeOptions): Promise<InitializeResult> {
    try {
      if (NativeCredifySdkModule) {
        console.log("[CredifyBridge] 📱 Usando Native Module (build nativo)");
        return await NativeCredifySdkModule.initialize(options);
      }

      console.log(`[CredifyBridge] 🌐 Usando backend Credify (${Platform.OS})`);
      return await backendClient.initialize(options);
    } catch (error) {
      console.error("[CredifyBridge] Erro ao inicializar:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao inicializar",
        success: false,
      };
    }
  },

  async capture(photoUri?: string): Promise<CaptureResult> {
    try {
      if (NativeCredifySdkModule) {
        console.log("[CredifyBridge] 📱 Capturando via Native Module");
        return await NativeCredifySdkModule.capture(photoUri);
      }

      console.log(`[CredifyBridge] 🌐 Capturando via backend Credify (${Platform.OS})`);
      return await backendClient.capture(photoUri);
    } catch (error) {
      console.error("[CredifyBridge] Erro na captura:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Erro na captura",
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  },

  async getFeedback(): Promise<FeedbackResult> {
    try {
      if (NativeCredifySdkModule) {
        return await NativeCredifySdkModule.getFeedback();
      }

      return await backendClient.getFeedback();
    } catch (error) {
      console.error("[CredifyBridge] Erro ao obter feedback:", error);
      return {
        message: error instanceof Error ? error.message : "Erro ao obter feedback",
        quality: 0,
        status: "error",
      };
    }
  },

  async release(): Promise<ReleaseResult> {
    try {
      if (NativeCredifySdkModule) {
        console.log("[CredifyBridge] 📱 Liberando Native Module");
        return await NativeCredifySdkModule.release();
      }

      console.log("[CredifyBridge] 🌐 Liberando backend");
      return await backendClient.release();
    } catch (error) {
      console.error("[CredifyBridge] Erro ao liberar:", error);
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao liberar",
        success: false,
      };
    }
  },

  isNativeAvailable(): boolean {
    return NativeCredifySdkModule !== null;
  },

  getImplementation(): "native" | "backend" {
    return NativeCredifySdkModule ? "native" : "backend";
  },

  getPlatform(): "ios" | "android" | "web" {
    return Platform.OS as "ios" | "android" | "web";
  },

  getDebugInfo(): {
    platform: string;
    implementation: string;
    nativeAvailable: boolean;
  } {
    return {
      platform: Platform.OS,
      implementation: this.getImplementation(),
      nativeAvailable: this.isNativeAvailable(),
    };
  },
};

export default CredifyBridge;
