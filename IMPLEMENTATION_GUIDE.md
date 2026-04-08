# Guia de Implementação: Credify React Native

## Visão Geral

Este documento fornece um guia completo para implementar o reconhecimento facial Credify em um aplicativo React Native para Android e iOS. O projeto foi estruturado seguindo as melhores práticas de desenvolvimento mobile e design de interface humana.

## Estrutura do Projeto

```
credify-react-native/
├── app/                          # Telas e rotas (Expo Router)
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Configuração de abas
│   │   └── index.tsx            # Tela inicial (Home)
│   ├── facial-capture.tsx       # Tela de captura facial
│   └── _layout.tsx              # Layout raiz
├── components/
│   ├── screen-container.tsx     # Wrapper de tela com SafeArea
│   ├── themed-view.tsx          # View com tema automático
│   └── ui/
│       ├── buttons.tsx          # Componentes de botão
│       └── icon-symbol.tsx      # Mapeamento de ícones
├── hooks/
│   ├── use-facial-capture.ts    # Hook para gerenciar captura
│   ├── use-colors.ts            # Hook de cores do tema
│   └── use-color-scheme.ts      # Hook de modo claro/escuro
├── lib/
│   ├── api-service.ts           # Serviço de API
│   └── utils.ts                 # Funções utilitárias
├── constants/
│   └── theme.ts                 # Configuração de tema
├── assets/
│   └── images/                  # Ícones e imagens
├── design.md                    # Especificação de design
├── CREDIFY_INTEGRATION.md        # Documentação técnica do SDK
├── IMPLEMENTATION_GUIDE.md      # Este arquivo
├── app.config.ts                # Configuração do Expo
├── package.json                 # Dependências
├── tailwind.config.js           # Configuração Tailwind CSS
└── theme.config.js              # Paleta de cores
```

## Instalação e Configuração

### 1. Instalar Dependências

Após resolver as credenciais do JFrog, execute:

```bash
pnpm install
```

Isso instalará todas as dependências, incluindo:
- `@identy/identy-common` - Utilitários comuns do SDK
- `@identy/identy-face` - SDK principal de reconhecimento facial
- `expo-camera` - Acesso à câmera do dispositivo
- Outras dependências React Native e Expo

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# URLs do Backend
REACT_APP_URL_BASE=https://api.identy.example.com
REACT_APP_URL_BASE_CREDIFY=https://api.credify.example.com

# Configuração do SDK Credify
CREDIFY_API_KEY=sua_chave_api_aqui
CREDIFY_TRANSACTION_MODE=ENROLL  # ou VERIFY
```

### 3. Configurar JFrog para Dependências Credify

O arquivo `.npmrc` já contém as configurações necessárias. Certifique-se de que as credenciais estão atualizadas:

```
@identy:registry=https://identy.jfrog.io/identy/api/npm/identy-npm/
//identy.jfrog.io/identy/api/npm/identy-npm/:username=seu_usuario
//identy.jfrog.io/identy/api/npm/identy-npm/:_password=sua_senha
```

## Desenvolvimento

### Iniciar o Servidor de Desenvolvimento

```bash
pnpm dev
```

Isso iniciará:
- Metro Bundler (para React Native)
- Servidor de desenvolvimento (Expo)
- Servidor backend (Node.js)

### Testar no Simulador/Emulador

**iOS:**
```bash
pnpm ios
```

**Android:**
```bash
pnpm android
```

**Web:**
```bash
pnpm dev:metro
```

### Testar em Dispositivo Real

1. Instale o Expo Go no seu dispositivo (iOS App Store ou Google Play)
2. Execute `pnpm qr` para gerar um QR code
3. Escaneie o QR code com o Expo Go
4. O aplicativo carregará no seu dispositivo

## Fluxo de Captura Facial

### 1. Inicialização do SDK

O SDK Credify é inicializado quando o usuário acessa a tela de captura:

```typescript
const { initialize } = useFacialCapture();
await initialize();
```

Neste ponto:
- O WASM do SDK é carregado
- Modelos de IA são baixados do backend
- Permissões de câmera são solicitadas

### 2. Captura de Frame

Uma vez inicializado, o SDK captura frames continuamente:

```typescript
const { capture } = useFacialCapture();
const result = await capture();
```

O SDK fornece feedback em tempo real:
- "Olhe reto"
- "Aproxime-se"
- "Afaste-se"
- "Qualidade insuficiente"

### 3. Processamento com WASM

O frame capturado é processado pelo WebAssembly:
- Detecção facial
- Análise de liveness (detecção de rosto vivo)
- Extração de features
- Verificação de qualidade

### 4. Envio para Backend

Após captura bem-sucedida, a imagem é enviada para o backend:

```typescript
const response = await apiService.submitFacialCapture({
  file: blob,
  requestID: generateRequestID(),
  metadata: {
    timestamp: Date.now(),
  },
});
```

### 5. Resultado

O backend retorna o resultado da verificação:

```json
{
  "status": "success",
  "verificationId": "ver_123456",
  "confidence": 0.98,
  "message": "Verificação bem-sucedida"
}
```

## Componentes Principais

### ScreenContainer

Wrapper de tela que gerencia SafeArea e background:

```tsx
import { ScreenContainer } from "@/components/screen-container";

export function MyScreen() {
  return (
    <ScreenContainer className="p-4">
      {/* Conteúdo da tela */}
    </ScreenContainer>
  );
}
```

### Botões

Componentes de botão reutilizáveis:

```tsx
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";

<PrimaryButton onPress={handleSubmit}>
  Enviar
</PrimaryButton>

<SecondaryButton onPress={handleCancel}>
  Cancelar
</SecondaryButton>
```

### Hook useFacialCapture

Hook para gerenciar o estado da captura:

```tsx
const {
  status,
  feedback,
  quality,
  error,
  initialize,
  capture,
  reset,
  retry,
} = useFacialCapture({
  onSuccess: (result) => console.log("Sucesso:", result),
  onError: (error) => console.error("Erro:", error),
});
```

### API Service

Serviço centralizado para comunicação com backend:

```tsx
import { apiService } from "@/lib/api-service";

// Fazer login
await apiService.login(email, password);

// Enviar captura
await apiService.submitFacialCapture({
  file: blob,
  requestID: "req_123456",
});

// Obter status
await apiService.getVerificationStatus("req_123456");

// Fazer logout
await apiService.logout();
```

## Permissões Necessárias

### Android

Adicione ao `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Solicite em tempo de execução usando `expo-permissions`.

### iOS

Adicione ao `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Este aplicativo precisa acessar sua câmera para verificação facial.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Este aplicativo precisa acessar sua biblioteca de fotos.</string>
```

## Tratamento de Erros

O SDK Credify retorna códigos de erro específicos:

| Código | Mensagem | Ação |
|--------|----------|------|
| 401 | Licença inválida | Verificar configuração do SDK |
| 501 | Timeout | Tentar novamente |
| 600 | Erro de câmera | Verificar permissões |
| 700 | Qualidade insuficiente | Pedir ao usuário para tentar novamente |
| 800 | Rosto não detectado | Instruir usuário a posicionar o rosto |

Implementar retry logic:

```tsx
if (error?.code === 700) {
  // Qualidade insuficiente - permitir retry
  await retry();
} else if (error?.code === 501) {
  // Timeout - retry com backoff
  await new Promise(r => setTimeout(r, 2000));
  await retry();
}
```

## Otimização de Performance

### 1. Lazy Loading do SDK

O SDK é carregado dinamicamente apenas quando necessário:

```typescript
const { FaceSDK } = await import("@identy/identy-face");
```

### 2. Compressão de Imagens

Comprimir frames antes de enviar para o backend:

```typescript
const compressedBlob = await compressImage(blob, {
  quality: 0.8,
  maxWidth: 1024,
  maxHeight: 1024,
});
```

### 3. Cache de Modelos

Os modelos WASM são cacheados no dispositivo após o primeiro download.

### 4. Otimização de Bundle

O Expo otimiza automaticamente o bundle para cada plataforma.

## Testes

### Testes Unitários

Execute testes com Vitest:

```bash
pnpm test
```

Exemplo de teste para o hook `useFacialCapture`:

```typescript
import { renderHook, act } from "@testing-library/react-native";
import { useFacialCapture } from "@/hooks/use-facial-capture";

describe("useFacialCapture", () => {
  it("deve inicializar o SDK", async () => {
    const { result } = renderHook(() => useFacialCapture());

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.status).toBe("capturing");
  });
});
```

### Testes de Integração

Testar fluxo completo em dispositivo:

1. Abrir aplicativo
2. Navegar para captura facial
3. Capturar imagem
4. Verificar resultado

## Publicação

### Build para Android

```bash
eas build --platform android
```

Gera um APK ou AAB para publicação na Google Play Store.

### Build para iOS

```bash
eas build --platform ios
```

Gera um IPA para publicação na Apple App Store.

### Configuração EAS

Edite `eas.json` para configurar builds:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "buildType": "ipa"
      }
    }
  }
}
```

## Troubleshooting

### Erro: "Cannot find module '@identy/identy-face'"

**Solução:** Instale as dependências com credenciais JFrog corretas:

```bash
pnpm install
```

### Erro: "Camera permission denied"

**Solução:** Verifique se as permissões estão configuradas no `app.config.ts`:

```typescript
plugins: [
  [
    "expo-camera",
    {
      cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
    },
  ],
]
```

### Erro: "WASM initialization failed"

**Solução:** Verifique se as URLs do backend estão corretas no `.env`:

```env
REACT_APP_URL_BASE=https://api.identy.example.com
```

### Performance lenta em captura

**Solução:** Reduza a resolução da câmera ou aumente o intervalo de processamento:

```typescript
const options = {
  cameraResolution: { width: 720, height: 1280 },
  processingInterval: 100, // ms
};
```

## Próximos Passos

1. **Implementar Autenticação:** Adicionar login/logout com OAuth ou JWT
2. **Histórico de Verificações:** Armazenar histórico local com AsyncStorage
3. **Notificações Push:** Integrar expo-notifications para alertas
4. **Análise:** Adicionar rastreamento de eventos com analytics
5. **Internacionalização:** Suportar múltiplos idiomas
6. **Testes:** Aumentar cobertura de testes
7. **CI/CD:** Configurar pipeline de build automático

## Recursos Adicionais

- [Documentação Expo](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Credify SDK Documentation](https://www.identy.io/)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Expo Router Documentation](https://expo.github.io/router/)

## Suporte

Para dúvidas ou problemas:

1. Consulte a documentação oficial
2. Verifique o arquivo `CREDIFY_INTEGRATION.md`
3. Abra uma issue no repositório do projeto
4. Entre em contato com o time de suporte Credify

---

**Versão:** 1.0.0  
**Última atualização:** Abril de 2026  
**Mantido por:** Manus AI & Credify Team
