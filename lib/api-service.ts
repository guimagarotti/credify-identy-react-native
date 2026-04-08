import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Serviço de API para comunicação com o backend Credify
 *
 * Responsabilidades:
 * - Gerenciar autenticação (JWT tokens)
 * - Fazer requisições HTTP
 * - Tratar erros
 * - Gerenciar timeouts
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CaptureSubmissionPayload {
  file: Blob;
  requestID: string;
  metadata?: {
    timestamp: number;
    deviceInfo?: string;
  };
}

class ApiService {
  private baseURL: string;
  private jwtToken: string | null = null;
  private timeout: number = 30000; // 30 segundos

  constructor() {
    this.baseURL = process.env.REACT_APP_URL_BASE_CREDIFY || "";
  }

  /**
   * Obter JWT token do armazenamento local
   */
  private async getJWTToken(): Promise<string | null> {
    if (this.jwtToken) {
      return this.jwtToken;
    }

    try {
      const token = await AsyncStorage.getItem("jwt_token");
      if (token) {
        this.jwtToken = token;
      }
      return token;
    } catch (error) {
      console.error("Erro ao obter JWT token:", error);
      return null;
    }
  }

  /**
   * Definir JWT token
   */
  async setJWTToken(token: string): Promise<void> {
    this.jwtToken = token;
    try {
      await AsyncStorage.setItem("jwt_token", token);
    } catch (error) {
      console.error("Erro ao salvar JWT token:", error);
    }
  }

  /**
   * Limpar JWT token
   */
  async clearJWTToken(): Promise<void> {
    this.jwtToken = null;
    try {
      await AsyncStorage.removeItem("jwt_token");
    } catch (error) {
      console.error("Erro ao limpar JWT token:", error);
    }
  }

  /**
   * Enviar captura facial para o backend
   */
  async submitFacialCapture(
    payload: CaptureSubmissionPayload
  ): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append("file", payload.file, "facial_capture.png");
      formData.append("requestID", payload.requestID);

      if (payload.metadata) {
        formData.append("metadata", JSON.stringify(payload.metadata));
      }

      const token = await this.getJWTToken();
      const headers: HeadersInit = {
        "Content-Type": "multipart/form-data",
        LogAPITrigger: "true",
        requestID: payload.requestID,
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${this.baseURL}/api/v1/capture?ts=${new Date().getTime()}`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
        message: "Captura enviada com sucesso",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Obter status de verificação
   */
  async getVerificationStatus(requestID: string): Promise<ApiResponse> {
    try {
      const token = await this.getJWTToken();
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${this.baseURL}/api/v1/verification/${requestID}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Fazer login
   */
  async login(email: string, password: string): Promise<ApiResponse> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/v1/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.token) {
        await this.setJWTToken(data.token);
      }

      return {
        success: true,
        data,
        message: "Login realizado com sucesso",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao fazer login",
      };
    }
  }

  /**
   * Fazer logout
   */
  async logout(): Promise<void> {
    await this.clearJWTToken();
  }

  /**
   * Fazer requisição genérica GET
   */
  async get<T = any>(url: string): Promise<ApiResponse<T>> {
    try {
      const token = await this.getJWTToken();
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${url}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Fazer requisição genérica POST
   */
  async post<T = any>(url: string, data: any): Promise<ApiResponse<T>> {
    try {
      const token = await this.getJWTToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${url}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const responseData = await response.json();

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }
}

// Exportar instância singleton
export const apiService = new ApiService();
