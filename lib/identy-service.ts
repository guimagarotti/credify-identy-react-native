/**
 * Serviço de SDK Identy
 * Alinhado com IdentyFaceSdk do projeto modelo
 * 
 * Responsável por:
 * - Inicialização do SDK (preInitialize + initialize)
 * - Configuração de opções
 * - Captura facial
 * - Processamento de resultados
 * - Integração com backend Credify
 */

import { CREDIFY_CONFIG } from '@/hooks/use-facial-config';

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
  localization?: {
    language?: string;
  };
  graphics?: {
    canvas?: {
      label?: string;
    };
  };
}

export interface CaptureResult {
  status: 'success' | 'error' | 'cancelled';
  message: string;
  data?: {
    template?: Blob | ArrayBuffer;
    liveness?: {
      score: number;
      isLive: boolean;
    };
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
    };
    URL?: string;
  };
}

/**
 * Classe para gerenciar SDK Identy
 * Equivalente a IdentyFaceSdk do projeto modelo
 */
export class IdentyService {
  private static instance: IdentyService;
  private sdkInitialized = false;
  private FaceSDK: any = null;
  private AppUI: any = null;
  private Base64: any = null;
  private Template: any = null;
  private TransactionMode: any = null;
  private AsThreshold: any = null;

  private options: InitializeOptions = {
    modelUrl: '',
    pubKeyUrl: '',
  };

  private requestID: string = '';
  private authToken: string = '';

  private constructor() {
    this.generateRequestID();
  }

  /**
   * Obter instância singleton
   */
  static getInstance(): IdentyService {
    if (!IdentyService.instance) {
      IdentyService.instance = new IdentyService();
    }
    return IdentyService.instance;
  }

  /**
   * Gerar ID único para requisição
   */
  private generateRequestID(): void {
    this.requestID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[IdentyService] Request ID:', this.requestID);
  }

  /**
   * Pré-inicializar SDK (equivalente a FaceSDK.preInitialize)
   * Define URLs de modelos e chaves públicas
   */
  async preInitialize(options: InitializeOptions): Promise<void> {
    console.log('[IdentyService] 🔧 Pré-inicializando SDK');

    this.options = options;

    try {
      // Definir publicPath antes de importar
      (globalThis as any).__webpack_public_path__ = './';

      console.log('[IdentyService] Tentando importar @identy/identy-face...');
      // Importar SDK Identy
      const idenyModule: any = await import('@identy/identy-face');
      console.log('[IdentyService] Chaves do módulo principal:', Object.keys(idenyModule));
      
      // Função recursiva para acessar exports aninhados
      const getNestedExports = (obj: any, depth = 0): any => {
        if (depth > 5) return obj; // Evitar loop infinito
        
        const keys = Object.keys(obj || {});
        console.log(`[IdentyService] Nível ${depth} - Chaves:`, keys);
        
        if (keys.includes('FaceSDK')) {
          console.log(`[IdentyService] ✅ FaceSDK encontrado no nível ${depth}`);
          return obj;
        }
        
        if (keys.length === 1 && keys[0] === 'default') {
          console.log(`[IdentyService] Apenas 'default' encontrada, acessando próximo nível...`);
          return getNestedExports(obj.default, depth + 1);
        }
        
        return obj;
      };
      
      let sdkExports = getNestedExports(idenyModule);
      
      const { FaceSDK, AppUI, Base64, Template, TransactionMode, AsThreshold } = sdkExports || {};
      
      console.log('[IdentyService] Valores extraídos:', {
        FaceSDK: !!FaceSDK,
        AppUI: !!AppUI,
        Base64: !!Base64,
        Template: !!Template,
        TransactionMode: !!TransactionMode,
        AsThreshold: !!AsThreshold,
      });

      if (!FaceSDK) {
        console.warn('[IdentyService] ⚠️ FaceSDK não encontrado, tentando acesso adicional...');
        console.log('[IdentyService] Content de sdkExports:', Object.keys(sdkExports || {}));
        // Tenta acessar como função/classe diretamente
      }

      this.FaceSDK = FaceSDK;
      this.AppUI = AppUI;
      this.Base64 = Base64;
      this.Template = Template;
      this.TransactionMode = TransactionMode;
      this.AsThreshold = AsThreshold;

      console.log('[IdentyService] ✅ Módulo carregado');
      
      if (typeof FaceSDK?.preInitialize === 'function') {
        console.log('[IdentyService] Chamando FaceSDK.preInitialize...');
        (FaceSDK as any).preInitialize(
          {
            URL: options.modelUrl,
          },
          {
            URL: {
              url: options.pubKeyUrl,
              headers: [
                {
                  name: 'LogAPITrigger',
                  value: 'true',
                },
                {
                  name: 'requestID',
                  value: this.requestID,
                },
              ],
            },
          }
        );
        console.log('[IdentyService] ✅ FaceSDK.preInitialize() chamado com sucesso');
      } else {
        console.warn('[IdentyService] ⚠️ FaceSDK.preInitialize não é uma função ou FaceSDK é undefined');
      }
    } catch (error) {
      console.error('[IdentyService] ❌ Erro ao pré-inicializar:', error);
      throw error;
    }
  }

  /**
   * Inicializar SDK com configurações
   * Equivalente a IdentyFaceSdk.newInstance().capture()
   */
  async initialize(captureOptions: CaptureOptions): Promise<any> {
    console.log('[IdentyService] 🔵 Inicializando SDK com configurações');
    console.log('[IdentyService] Valores carregados:', {
      FaceSDK: !!this.FaceSDK,
      Base64: !!this.Base64,
      Template: !!this.Template,
      AppUI: !!this.AppUI,
      AsThreshold: !!this.AsThreshold,
    });

    if (!this.FaceSDK) {
      throw new Error('SDK não pré-inicializado. Chame preInitialize() primeiro.');
    }

    try {
      // Criar instância do SDK conforme modelo
      console.log('[IdentyService] Criando instância do SDK...');
      const sdkInstance = new (this.FaceSDK as any)({
        enableAS: captureOptions.enableAS ?? true,
        requiredTemplates: captureOptions.requiredTemplates ?? [this.Template?.PNG || 'PNG'],
        showCaptureTraining: captureOptions.showCaptureTraining ?? false,
        base64EncodingFlag: this.Base64?.NO_WRAP ?? 0,
        allowClose: captureOptions.allowCameraSelect ?? true,
        enableEyesStatusDetector: captureOptions.enableEyesStatusDetector ?? true,
        skipSupportCheck: captureOptions.skipSupportCheck ?? false,
        backend: captureOptions.backend ?? 'wasm',
        transaction: { type: 1 },
        appUI: captureOptions.appUI ?? this.AppUI?.TICKING ?? 1,
        allowCameraSelect: captureOptions.allowCameraSelect ?? false,
        asThreshold: captureOptions.asThreshold ?? this.AsThreshold?.MEDIUM ?? 50,
        assisted: captureOptions.assisted ?? false,
        graphics: captureOptions.graphics ?? {
          canvas: {
            label: 'white',
          },
        },
        localization: captureOptions.localization ?? {
          language: 'pt-BR',
        },
      });

      console.log('[IdentyService] ✅ Instância do SDK criada');

      // Inicializar
      await sdkInstance.initialize();
      console.log('[IdentyService] ✅ SDK inicializado com sucesso');

      return sdkInstance;
    } catch (error) {
      console.error('[IdentyService] ❌ Erro ao inicializar:', error);
      throw error;
    }
  }

  /**
   * Capturar imagem facial
   */
  async capture(sdkInstance: any): Promise<Blob> {
    console.log('[IdentyService] 🎥 Iniciando captura');

    try {
      const result = await sdkInstance.capture();
      console.log('[IdentyService] ✅ Captura bem-sucedida');
      console.log('[IdentyService] Tipo:', typeof result);
      console.log('[IdentyService] Tamanho:', result?.length || result?.size || 'desconhecido');

      return result;
    } catch (error: any) {
      console.error('[IdentyService] ❌ Erro na captura:', error);
      throw error;
    }
  }

  /**
   * Autenticar no backend Credify
   */
  async authenticate(baseUrl: string): Promise<string> {
    console.log('[IdentyService] 🔐 Autenticando no backend');

    try {
      const response = await fetch(`${baseUrl}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    } catch (error) {
      console.error('[IdentyService] ❌ Erro ao autenticar:', error);
      throw error;
    }
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

    try {
      // Autenticar se necessário
      if (!this.authToken) {
        await this.authenticate(baseUrl);
      }

      // Preparar FormData
      const formData = new FormData();
      const blob = captureData instanceof Blob ? captureData : new Blob([captureData]);
      formData.append('file', blob, 'bdata');

      // Preparar URL com timestamp
      const timestamp = new Date().getTime();
      const url = `${livenessUrl}?ts=${timestamp}`;

      console.log('[IdentyService] POST', url);

      // Enviar requisição
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-DEBUG': CREDIFY_CONFIG.WERO,
          'LogAPITrigger': 'true',
          'requestID': this.requestID,
          'application': CREDIFY_CONFIG.APPLICATION,
          'wero': CREDIFY_CONFIG.WERO,
          'keyUrl': CREDIFY_CONFIG.AS_SERVER_CONFIG,
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: formData,
      });

      console.log('[IdentyService] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[IdentyService] Erro do servidor:', errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      const result: CredifyResponse = await response.json();
      console.log('[IdentyService] ✅ Resposta do backend:', result);

      return result;
    } catch (error) {
      console.error('[IdentyService] ❌ Erro ao enviar captura:', error);
      throw error;
    }
  }

  /**
   * Validar resposta do backend
   */
  validateResponse(response: CredifyResponse): boolean {
    return response.RESPOSTA?.LIVELINESS?.code === 200;
  }

  /**
   * Obter URL de redirecionamento
   */
  getRedirectUrl(response: CredifyResponse): string | undefined {
    return response.RESPOSTA?.URL;
  }

  /**
   * Obter mensagem de erro
   */
  getErrorMessage(response: CredifyResponse): string {
    return response.RESPOSTA?.LIVELINESS?.message || 'Erro desconhecido';
  }

  /**
   * Limpar recursos
   */
  cleanup(): void {
    console.log('[IdentyService] 🧹 Limpando recursos');
    this.sdkInitialized = false;
    this.authToken = '';
  }

  /**
   * Obter Request ID
   */
  getRequestID(): string {
    return this.requestID;
  }

  /**
   * Obter Auth Token
   */
  getAuthToken(): string {
    return this.authToken;
  }
}

// Exportar instância singleton
export const identityService = IdentyService.getInstance();
