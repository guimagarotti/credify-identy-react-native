import { useState, useCallback } from 'react';

/**
 * Configurações de Captura Facial
 * Alinhado com MenuFace.java do projeto modelo Identy
 * 
 * SEM SUPORTE A LICENÇAS (conforme solicitado)
 */

export enum ASLevel {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum UIOption {
  TICKING = 'TICKING',
  ANIMATED = 'ANIMATED',
  STATIC = 'STATIC',
}

export enum FaceTemplate {
  PNG = 'PNG',
  JPEG = 'JPEG',
  WEBP = 'WEBP',
}

export interface PrecaptureChecks {
  mask: boolean;
  glasses: boolean;
  sunglasses: boolean;
  hat: boolean;
  hand: boolean;
  eyeOpenness: boolean;
  mouthClosure: boolean;
}

export interface FacialCaptureConfig {
  // Configurações de Liveness (AS)
  asLevel: ASLevel;
  livenessServer: boolean;
  livenessWithinSdk: boolean;
  asServerConfig: string;
  asServerLiveness: string;

  // Configurações de Captura
  locale: string;
  hdCapture: boolean;
  backgroundColor: string | null;
  assistedMode: boolean;
  strictCaptureMode: boolean;
  displayResult: boolean;
  allowRetake: boolean;

  // Detecção de Objetos (Precapture Checks)
  precaptureChecks: PrecaptureChecks;

  // Templates
  requiredTemplates: FaceTemplate[];

  // UI
  uiOption: UIOption;
  showCaptureTraining: boolean;
  allowClose: boolean;

  // Modo de Identificação
  identificationMode: '1:1' | '1:N';
}

export interface FacialCaptureState extends FacialCaptureConfig {
  userEnrolled: boolean;
  testLaunched: boolean;
}

const DEFAULT_CONFIG: FacialCaptureConfig = {
  // Liveness
  asLevel: ASLevel.MEDIUM,
  livenessServer: true,
  livenessWithinSdk: false,
  asServerConfig: 'https://app-iden-dev.credify.com.br/api/v1/pub_key',
  asServerLiveness: 'https://app-iden-dev.credify.com.br/api/v1/secure/face/as',

  // Captura
  locale: 'pt-BR',
  hdCapture: false,
  backgroundColor: null,
  assistedMode: false,
  strictCaptureMode: false,
  displayResult: false,
  allowRetake: true,

  // Precapture Checks
  precaptureChecks: {
    mask: false,
    glasses: false,
    sunglasses: false,
    hat: false,
    hand: false,
    eyeOpenness: false,
    mouthClosure: false,
  },

  // Templates
  requiredTemplates: [FaceTemplate.PNG, FaceTemplate.JPEG],

  // UI
  uiOption: UIOption.TICKING,
  showCaptureTraining: false,
  allowClose: true,

  // Identificação
  identificationMode: '1:1',
};

/**
 * Hook para gerenciar configurações de captura facial
 * Equivalente a Utils.java do projeto modelo
 */
export function useFacialConfig() {
  const [config, setConfig] = useState<FacialCaptureState>({
    ...DEFAULT_CONFIG,
    userEnrolled: false,
    testLaunched: false,
  });

  // Setters para configurações individuais
  const setAsLevel = useCallback((level: ASLevel) => {
    setConfig((prev) => ({ ...prev, asLevel: level }));
  }, []);

  const setLocale = useCallback((locale: string) => {
    setConfig((prev) => ({ ...prev, locale }));
  }, []);

  const setLivenessServer = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, livenessServer: enabled }));
  }, []);

  const setLivenessWithinSdk = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, livenessWithinSdk: enabled }));
  }, []);

  const setHdCapture = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, hdCapture: enabled }));
  }, []);

  const setBackgroundColor = useCallback((color: string | null) => {
    setConfig((prev) => ({ ...prev, backgroundColor: color }));
  }, []);

  const setAssistedMode = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, assistedMode: enabled }));
  }, []);

  const setStrictCaptureMode = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, strictCaptureMode: enabled }));
  }, []);

  const setDisplayResult = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, displayResult: enabled }));
  }, []);

  const setAllowRetake = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, allowRetake: enabled }));
  }, []);

  const setPrecaptureCheck = useCallback(
    (check: keyof PrecaptureChecks, enabled: boolean) => {
      setConfig((prev) => ({
        ...prev,
        precaptureChecks: {
          ...prev.precaptureChecks,
          [check]: enabled,
        },
      }));
    },
    []
  );

  const setRequiredTemplates = useCallback((templates: FaceTemplate[]) => {
    setConfig((prev) => ({ ...prev, requiredTemplates: templates }));
  }, []);

  const setUiOption = useCallback((option: UIOption) => {
    setConfig((prev) => ({ ...prev, uiOption: option }));
  }, []);

  const setIdentificationMode = useCallback((mode: '1:1' | '1:N') => {
    setConfig((prev) => ({ ...prev, identificationMode: mode }));
  }, []);

  const setUserEnrolled = useCallback((enrolled: boolean) => {
    setConfig((prev) => ({ ...prev, userEnrolled: enrolled }));
  }, []);

  const setTestLaunched = useCallback((launched: boolean) => {
    setConfig((prev) => ({ ...prev, testLaunched: launched }));
  }, []);

  // Reset para valores padrão
  const resetConfig = useCallback(() => {
    setConfig({
      ...DEFAULT_CONFIG,
      userEnrolled: false,
      testLaunched: false,
    });
  }, []);

  // Getters
  const getConfig = useCallback(() => config, [config]);

  const getPrecaptureChecks = useCallback(() => {
    const checks = config.precaptureChecks;
    return {
      mask: checks.mask,
      glasses: checks.glasses,
      sunglasses: checks.sunglasses,
      hat: checks.hat,
      hand: checks.hand,
      eyeOpenness: checks.eyeOpenness,
      mouthClosure: checks.mouthClosure,
    };
  }, [config.precaptureChecks]);

  return {
    // Estado
    config,

    // Setters
    setAsLevel,
    setLocale,
    setLivenessServer,
    setLivenessWithinSdk,
    setHdCapture,
    setBackgroundColor,
    setAssistedMode,
    setStrictCaptureMode,
    setDisplayResult,
    setAllowRetake,
    setPrecaptureCheck,
    setRequiredTemplates,
    setUiOption,
    setIdentificationMode,
    setUserEnrolled,
    setTestLaunched,

    // Getters
    getConfig,
    getPrecaptureChecks,

    // Utils
    resetConfig,
  };
}

// Constantes para compatibilidade com modelo
export const CREDIFY_CONFIG = {
  AS_SERVER_CONFIG: 'https://app-iden-dev.credify.com.br/api/v1/pub_key',
  AS_SERVER_LIVENESS: 'https://app-iden-dev.credify.com.br/api/v1/secure/face/as',
  CLIENT_ID: '31919',
  CLIENT_SECRET: '42755029',
  APPLICATION: 'credify-facial-recognition',
  WERO: 'demo',
};
