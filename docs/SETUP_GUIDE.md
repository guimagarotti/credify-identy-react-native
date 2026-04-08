# Guia de Setup e Desenvolvimento

## 📋 Pré-requisitos

### Sistema Operacional
- macOS 12+ (para iOS)
- Windows 10+ ou Linux (para Android)
- Node.js 18+ e npm/pnpm

### Ferramentas Necessárias

**macOS/Linux:**
```bash
# Instalar Xcode Command Line Tools (macOS)
xcode-select --install

# Instalar Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Java Development Kit
brew install openjdk@11
export JAVA_HOME=/usr/local/opt/openjdk@11

# Instalar Android SDK
brew install android-sdk
```

**Windows:**
- Visual Studio Build Tools
- Java Development Kit 11+
- Android SDK

---

## 🚀 Desenvolvimento Local

### 1. Clonar e Instalar Dependências

```bash
# Clonar repositório
git clone <seu-repositorio>
cd identy-react-native

# Instalar dependências
pnpm install

# Instalar pods (iOS)
cd ios && pod install && cd ..
```

### 2. Configurar Variáveis de Ambiente

Criar arquivo `.env` na raiz do projeto:

```env
# Backend URLs (Credify)
REACT_APP_URL_BASE=https://app-iden-dev.credify.com.br
REACT_APP_URL_BASE_CREDIFY=https://dev-api.credify.com.br/livelinesscapture

# Credenciais JFrog (para @identy/identy-face)
# Atualizar .npmrc com suas credenciais
```

### 3. Rodar em Expo Go (Desenvolvimento)

```bash
# Terminal 1: Iniciar Metro Bundler
pnpm dev:metro

# Terminal 2: Gerar QR code (opcional)
pnpm qr
```

**No iPhone/Android:**
1. Abrir app Expo Go
2. Escanear QR code exibido no terminal
3. App abrirá automaticamente

### 4. Rodar em Simulador/Emulador

**iOS Simulator:**
```bash
pnpm ios
```

**Android Emulator:**
```bash
pnpm android
```

### 5. Validar TypeScript

```bash
pnpm check
```

---

## 🏗️ Build com EAS

### 1. Instalar EAS CLI

```bash
npm install -g eas-cli
```

### 2. Autenticar com Expo

```bash
eas login
```

### 3. Configurar Projeto EAS

O projeto já possui `eas.json` configurado com 3 perfis:

| Perfil | Uso | Distribuição |
|--------|-----|--------------|
| `development` | Desenvolvimento local | Internal |
| `preview` | Testes antes de produção | Internal |
| `production` | App final para stores | Store |

### 4. Build para Preview (Teste)

```bash
# iOS Preview
eas build --platform ios --profile preview

# Android Preview
eas build --platform android --profile preview

# Ambas plataformas
eas build --platform all --profile preview
```

**Tempo estimado:** 10-15 minutos por plataforma

### 5. Build para Produção

```bash
# iOS Produção
eas build --platform ios --profile production

# Android Produção
eas build --platform android --profile production
```

### 6. Testar Build Localmente

**iOS:**
```bash
# Baixar .ipa do build anterior
eas build:list

# Instalar em simulador
xcrun simctl install booted /caminho/para/arquivo.ipa
```

**Android:**
```bash
# Baixar .apk do build anterior
# Instalar em emulador
adb install /caminho/para/arquivo.apk
```

---

## 🔍 Debugging

### Logs em Tempo Real

**Terminal (Metro):**
```bash
# Logs aparecem automaticamente
pnpm dev:metro
```

**Expo Go App:**
1. Shake device (ou Cmd+D no iOS, Ctrl+M no Android)
2. Selecionar "View logs"

**Chrome DevTools (Web):**
```bash
# Abrir em http://localhost:8081
# Pressionar Cmd+Option+I (macOS) ou F12 (Windows/Linux)
```

### Verificar Permissões

**iOS:**
```
Settings > [App Name] > Camera
```

**Android:**
```
Settings > Apps > [App Name] > Permissions > Camera
```

### Verificar Conectividade Backend

```bash
# Testar endpoint Credify
curl -X POST https://dev-api.credify.com.br/livelinesscapture \
  -H "Content-Type: application/json" \
  -H "LogAPITrigger: true" \
  -d '{"format":"PNG","timestamp":'$(date +%s000)'}'
```

---

## 📱 Testar Fluxo Completo

### 1. Inicializar App

```bash
pnpm dev:metro
```

### 2. Abrir em Expo Go

- iPhone: Escanear QR code
- Android: Escanear QR code

### 3. Testar Captura Facial

1. Clicar em "Iniciar Captura"
2. Permitir acesso à câmera
3. Posicionar rosto no guia
4. Aguardar captura
5. Verificar resultado

### 4. Verificar Logs

```
[FacialCapture] ===== INICIANDO FLUXO DE CAPTURA =====
[FacialCapture] 1️⃣ Botão clicado - Iniciando SDK
[FacialCapture] 2️⃣ Chamando CredifyBridge.initialize()...
[FacialCapture] 3️⃣ Resultado da inicialização: { status: 'initialized', ... }
...
[FacialCapture] ✅ FLUXO COMPLETO COM SUCESSO!
```

---

## 🐛 Troubleshooting

### "CredifySdkModule não encontrado"

**Solução:** Você está em Expo Go (simulador). O app usará backend real via HTTP.

```
[CredifyBridge] Native Module não disponível. Usando backend real (ios)
```

### "Erro ao conectar com backend"

**Verificar:**
1. URLs de backend estão corretas em `.env`
2. Rede está conectada
3. Backend está online

```bash
# Testar conectividade
curl https://dev-api.credify.com.br/livelinesscapture
```

### "Permissão de câmera negada"

**iOS:**
1. Settings > [App Name] > Camera > Allow
2. Reiniciar app

**Android:**
1. Settings > Apps > [App Name] > Permissions > Camera > Allow
2. Reiniciar app

### "Metro Bundler não inicia"

```bash
# Limpar cache
pnpm dev:metro --reset-cache

# Ou
rm -rf node_modules/.cache
pnpm dev:metro
```

### "Build EAS falha"

```bash
# Verificar status
eas build:list

# Ver logs do build
eas build:view <build-id>

# Limpar cache EAS
eas build:cache:remove
```

---

## 📊 Estrutura do Projeto

```
identy-react-native/
├── app/                          # Telas React Native
│   ├── (tabs)/                   # Tab bar layout
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── facial-capture.tsx        # Tela de captura
├── lib/
│   └── native-credify-bridge.ts  # Bridge para SDK nativo
├── android/                      # Código Android (Kotlin)
│   ├── build.gradle
│   ├── app/build.gradle
│   └── app/src/main/kotlin/com/credify/
│       ├── CredifySdkModule.kt
│       ├── CameraManager.kt
│       └── WasmModule.kt
├── ios/                          # Código iOS (Swift)
│   ├── Podfile
│   └── CredifySdk/
│       ├── CredifySdkModule.swift
│       ├── CameraManager.swift
│       └── WasmModule.swift
├── docs/                         # Documentação
│   ├── SETUP_GUIDE.md           # Este arquivo
│   ├── BUILD_GUIDE.md           # Guia de build
│   └── API_REFERENCE.md         # Referência de API
├── app.config.ts                # Configuração Expo
├── eas.json                     # Configuração EAS Build
├── .env                         # Variáveis de ambiente
└── package.json                 # Dependências
```

---

## 🔗 Recursos Úteis

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Credify SDK Documentation](https://credify.com.br)

---

## ✅ Checklist de Setup

- [ ] Node.js 18+ instalado
- [ ] pnpm instalado
- [ ] Xcode instalado (macOS)
- [ ] Android SDK instalado
- [ ] Repositório clonado
- [ ] Dependências instaladas (`pnpm install`)
- [ ] `.env` configurado
- [ ] Pods instalados (`cd ios && pod install`)
- [ ] Metro rodando (`pnpm dev:metro`)
- [ ] App abrindo em Expo Go
- [ ] Câmera funcionando
- [ ] Backend respondendo

