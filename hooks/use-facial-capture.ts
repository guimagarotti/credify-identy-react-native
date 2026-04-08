import { useState, useCallback } from "react";
import { CredifyBridge, type CaptureResult, type InitializeOptions } from "@/lib/native-credify-bridge";

/**
 * Hook para gerenciar captura facial via Native Bridge
 * 
 * O SDK Credify roda nativamente (Android/iOS), não em JavaScript
 * Este hook fornece interface TypeScript para controlar a captura
 * 
 * Exemplo de uso:
 * ```typescript
 * const {
 *   status,
 *   feedback,
 *   quality,
 *   error,
 *   initialize,
 *   capture,
 *   release
 * } = useFacialCapture();
 * 
 * // Inicializar
 * await initialize({
 *   modelUrl: "http://localhost:3000/api/v1/models",
 *   pubKeyUrl: "http://localhost:3000/api/v1/pub_key",
 *   headers: { LogAPITrigger: "true" }
 * });
 * 
 * // Capturar
 * const result = await capture();
 * if (result.success) {
 *   console.log("Captura bem-sucedida:", result.imageData);
 * }
 * ```
 */

type CaptureStatus = "idle" | "initializing" | "capturing" | "processing" | "success" | "error";

interface UseFacialCaptureState {
  status: CaptureStatus;
  feedback: string;
  quality: number;
  error: string | null;
  isInitialized: boolean;
}

interface UseFacialCaptureActions {
  initialize: (options: InitializeOptions) => Promise<void>;
  capture: () => Promise<CaptureResult | null>;
  getFeedback: () => Promise<void>;
  release: () => Promise<void>;
  reset: () => void;
}

export function useFacialCapture(): UseFacialCaptureState & UseFacialCaptureActions {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [feedback, setFeedback] = useState("");
  const [quality, setQuality] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Inicializar SDK Credify via Native Bridge
   */
  const initialize = useCallback(async (options: InitializeOptions) => {
    setStatus("initializing");
    setError(null);
    setFeedback("Inicializando SDK...");

    try {
      // Validar opções
      if (!options.modelUrl || !options.pubKeyUrl) {
        throw new Error("modelUrl e pubKeyUrl são obrigatórios");
      }

      // Chamar Native Bridge para inicializar
      const result = await CredifyBridge.initialize(options);

      // Verificar resultado com type guard
      if (!result.success && result.status !== "initialized") {
        throw new Error(result.message || "Falha ao inicializar SDK");
      }

      setIsInitialized(true);
      setStatus("idle");
      setFeedback("SDK inicializado com sucesso");

      // Limpar feedback após 2 segundos
      setTimeout(() => setFeedback(""), 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao inicializar SDK";
      setError(errorMessage);
      setStatus("error");
      setFeedback(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Capturar frame facial via Native Bridge
   */
  const capture = useCallback(async (): Promise<CaptureResult | null> => {
    if (!isInitialized) {
      const errorMessage = "SDK não inicializado. Chame initialize() primeiro.";
      setError(errorMessage);
      setStatus("error");
      setFeedback(errorMessage);
      return null;
    }

    setStatus("capturing");
    setError(null);
    setFeedback("Capturando...");

    try {
      // Chamar Native Bridge para capturar
      const result = await CredifyBridge.capture();

      // Verificar resultado com type guard
      if (!result.success && result.status !== "success") {
        throw new Error(result.error || result.message || "Falha na captura");
      }

      // Atualizar qualidade se disponível
      if (typeof result.quality === "number") {
        setQuality(result.quality);
      }

      setStatus("success");
      setFeedback(result.feedback || "Captura bem-sucedida!");

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro na captura";
      setError(errorMessage);
      setStatus("error");
      setFeedback(errorMessage);
      return null;
    }
  }, [isInitialized]);

  /**
   * Obter feedback em tempo real da captura
   */
  const getFeedback = useCallback(async () => {
    if (!isInitialized) {
      return;
    }

    try {
      const feedbackResult = await CredifyBridge.getFeedback();
      setFeedback(feedbackResult.message);
      setQuality(feedbackResult.quality);
    } catch (err) {
      console.warn("Erro ao obter feedback:", err);
    }
  }, [isInitialized]);

  /**
   * Liberar recursos do SDK
   */
  const release = useCallback(async () => {
    setStatus("idle");
    setFeedback("Liberando recursos...");

    try {
      const result = await CredifyBridge.release();

      if (!result.success && result.status !== "released") {
        throw new Error(result.message || "Falha ao liberar SDK");
      }

      setIsInitialized(false);
      setStatus("idle");
      setFeedback("");
      setQuality(0);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao liberar SDK";
      setError(errorMessage);
      setStatus("error");
      setFeedback(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Resetar estado do hook
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setFeedback("");
    setQuality(0);
    setError(null);
    setIsInitialized(false);
  }, []);

  return {
    // Estado
    status,
    feedback,
    quality,
    error,
    isInitialized,

    // Ações
    initialize,
    capture,
    getFeedback,
    release,
    reset,
  };
}

export default useFacialCapture;
