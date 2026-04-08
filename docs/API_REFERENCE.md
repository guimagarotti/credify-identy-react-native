# Referência de API - Credify Facial Recognition

## 📚 Visão Geral

Esta documentação descreve os endpoints e métodos disponíveis para integração com o SDK Credify.

---

## 🔌 Backend URLs

| Ambiente | URL Base | Endpoint Liveness |
|----------|----------|-------------------|
| Desenvolvimento | https://app-iden-dev.credify.com.br | https://dev-api.credify.com.br/livelinesscapture |
| Produção | https://app-iden.credify.com.br | https://api.credify.com.br/livelinesscapture |

---

## 🎯 Endpoints

### POST /livelinesscapture

Enviar frame facial para processamento e verificação de liveness.

**URL:** `https://dev-api.credify.com.br/livelinesscapture`

**Método:** `POST`

**Headers:**
```
Content-Type: application/json
Accept: application/json
LogAPITrigger: true
```

**Request Body:**
```json
{
  "imageData": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "format": "PNG",
  "timestamp": 1712425200000
}
```

**Response (Sucesso):**
```json
{
  "status": "success",
  "quality": 85,
  "feedback": "Captura bem-sucedida",
  "template": "PNG",
  "liveness": true,
  "confidence": 0.95
}
```

**Response (Erro):**
```json
{
  "status": "error",
  "error": "Descrição do erro",
  "feedback": "Mensagem de feedback"
}
```

**Status Codes:**
- `200 OK` - Captura processada com sucesso
- `400 Bad Request` - Dados inválidos
- `401 Unauthorized` - Não autenticado
- `500 Internal Server Error` - Erro no servidor

---

## 🔐 Autenticação

### Headers Obrigatórios

```
LogAPITrigger: true
```

### Headers Opcionais

```
Authorization: Bearer <token>
X-Request-ID: <request-id>
```

---

## 📊 Tipos de Dados

### ImageData

Imagem facial em formato Base64 (PNG ou JPEG).

```typescript
interface ImageData {
  data: string;  // Base64 encoded image
  format: "PNG" | "JPEG";
  width?: number;
  height?: number;
}
```

### CaptureResult

Resultado do processamento de captura.

```typescript
interface CaptureResult {
  status: "success" | "error";
  quality: number;  // 0-100
  feedback: string;
  template: string;
  liveness: boolean;
  confidence: number;  // 0-1
  imageData?: string;
}
```

### FeedbackMessage

Mensagem de feedback em tempo real.

```typescript
interface FeedbackMessage {
  message: string;
  quality: number;  // 0-100
  status: "waiting" | "capturing" | "processing" | "success" | "error";
}
```

---

## 🔧 Native Bridge API

### CredifyBridge.initialize(options)

Inicializar SDK Credify.

```typescript
const result = await CredifyBridge.initialize({
  modelUrl: "https://app-iden-dev.credify.com.br/models",
  pubKeyUrl: "https://app-iden-dev.credify.com.br/pub_key",
  headers: {
    "Authorization": "Bearer token"
  }
});

// result: { success: true, status: "initialized" }
```

### CredifyBridge.capture()

Capturar frame facial.

```typescript
const result = await CredifyBridge.capture();

// result: {
//   success: true,
//   imageData: "base64...",
//   quality: 85,
//   feedback: "Captura bem-sucedida",
//   template: "PNG",
//   liveness: true,
//   confidence: 0.95
// }
```

### CredifyBridge.getFeedback()

Obter feedback em tempo real.

```typescript
const feedback = await CredifyBridge.getFeedback();

// feedback: {
//   message: "Posicione seu rosto no guia",
//   quality: 75,
//   status: "capturing"
// }
```

### CredifyBridge.release()

Liberar recursos do SDK.

```typescript
const result = await CredifyBridge.release();

// result: { success: true, status: "released" }
```

### CredifyBridge.getDebugInfo()

Obter informações de debug.

```typescript
const info = CredifyBridge.getDebugInfo();

// info: {
//   platform: "ios",
//   implementation: "native",
//   nativeAvailable: true
// }
```

---

## 📱 Componente React

### FacialCaptureScreen

Tela de captura facial com interface completa.

```typescript
import FacialCaptureScreen from "@/app/facial-capture";

export default function MyScreen() {
  return <FacialCaptureScreen />;
}
```

**Props:**
- Nenhuma (componente autossuficiente)

**Comportamento:**
1. Exibe guia de captura
2. Captura frame facial
3. Envia para backend
4. Exibe resultado

---

## 🔄 Fluxo Completo

### 1. Inicializar

```typescript
await CredifyBridge.initialize({
  modelUrl: "https://app-iden-dev.credify.com.br/models",
  pubKeyUrl: "https://app-iden-dev.credify.com.br/pub_key"
});
```

### 2. Capturar

```typescript
const result = await CredifyBridge.capture();
if (result.success) {
  console.log("Captura bem-sucedida:", result);
} else {
  console.error("Erro na captura:", result.error);
}
```

### 3. Processar

```typescript
// Backend processa automaticamente
// Resultado retorna em result.feedback
```

### 4. Liberar

```typescript
await CredifyBridge.release();
```

---

## ⚠️ Tratamento de Erros

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "SDK não inicializado" | `initialize()` não foi chamado | Chamar `initialize()` primeiro |
| "Permissão de câmera negada" | Usuário negou permissão | Solicitar permissão novamente |
| "Erro ao conectar com backend" | Rede indisponível | Verificar conectividade |
| "Timeout" | Requisição demorou muito | Aumentar timeout ou tentar novamente |
| "Qualidade insuficiente" | Frame não atende critérios | Melhorar iluminação e posicionamento |

### Exemplo de Tratamento

```typescript
try {
  const result = await CredifyBridge.capture();
  
  if (!result.success) {
    console.error("Erro:", result.error);
    // Mostrar mensagem ao usuário
    return;
  }
  
  if (result.quality < 60) {
    console.warn("Qualidade baixa:", result.quality);
    // Sugerir melhor posicionamento
    return;
  }
  
  console.log("Captura bem-sucedida!");
} catch (error) {
  console.error("Exceção:", error);
  // Mostrar erro genérico
}
```

---

## 🧪 Exemplos de Uso

### Exemplo 1: Captura Simples

```typescript
import { CredifyBridge } from "@/lib/native-credify-bridge";

async function captureSimple() {
  try {
    await CredifyBridge.initialize({
      modelUrl: process.env.REACT_APP_URL_BASE + "/models",
      pubKeyUrl: process.env.REACT_APP_URL_BASE + "/pub_key"
    });
    
    const result = await CredifyBridge.capture();
    console.log("Resultado:", result);
    
    await CredifyBridge.release();
  } catch (error) {
    console.error("Erro:", error);
  }
}
```

### Exemplo 2: Captura com Feedback

```typescript
async function captureWithFeedback() {
  await CredifyBridge.initialize({...});
  
  // Monitorar feedback
  const feedbackInterval = setInterval(async () => {
    const feedback = await CredifyBridge.getFeedback();
    console.log(`Qualidade: ${feedback.quality}% - ${feedback.message}`);
  }, 500);
  
  const result = await CredifyBridge.capture();
  clearInterval(feedbackInterval);
  
  await CredifyBridge.release();
  return result;
}
```

### Exemplo 3: Captura com Retry

```typescript
async function captureWithRetry(maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const result = await CredifyBridge.capture();
      
      if (result.success && result.quality >= 70) {
        return result;
      }
      
      attempts++;
      console.log(`Tentativa ${attempts}/${maxRetries}`);
    } catch (error) {
      attempts++;
      console.error(`Erro na tentativa ${attempts}:`, error);
    }
  }
  
  throw new Error("Falha após múltiplas tentativas");
}
```

---

## 📈 Métricas e Monitoramento

### Qualidade de Captura

```typescript
// Distribuição de qualidade
const qualities = [];
for (let i = 0; i < 10; i++) {
  const result = await CredifyBridge.capture();
  qualities.push(result.quality);
}

const average = qualities.reduce((a, b) => a + b) / qualities.length;
console.log(`Qualidade média: ${average}%`);
```

### Taxa de Sucesso

```typescript
let successes = 0;
let failures = 0;

for (let i = 0; i < 100; i++) {
  const result = await CredifyBridge.capture();
  if (result.success) {
    successes++;
  } else {
    failures++;
  }
}

const successRate = (successes / 100) * 100;
console.log(`Taxa de sucesso: ${successRate}%`);
```

---

## 🔗 Recursos Adicionais

- [Setup Guide](./SETUP_GUIDE.md)
- [Build Guide](./BUILD_GUIDE.md)
- [Debugging Guide](../DEBUGGING_GUIDE.md)

