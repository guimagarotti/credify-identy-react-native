# Credify Facial Recognition - React Native

Aplicação React Native para captura facial e verificação de liveness usando SDK Credify.

## 🚀 Quick Start

### 1. Instalar Dependências

```bash
pnpm install
cd ios && pod install && cd ..
```

### 2. Configurar Variáveis de Ambiente

Criar arquivo `.env`:

```env
REACT_APP_URL_BASE=https://app-iden-dev.credify.com.br
REACT_APP_URL_BASE_CREDIFY=https://dev-api.credify.com.br/livelinesscapture
```

### 3. Rodar Localmente

```bash
# Terminal 1: Iniciar Metro
pnpm dev:metro

# Terminal 2: Abrir em Expo Go (iPhone/Android)
# Escanear QR code exibido no terminal
```

### 4. Build com EAS

```bash
# Preview (teste)
eas build --platform ios --profile preview

# Produção
eas build --platform ios --profile production
```

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) | Guia completo de setup e desenvolvimento |
| [BUILD_GUIDE.md](./docs/BUILD_GUIDE.md) | Guia de build com EAS |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | Referência de API e endpoints |

---

## 🏗️ Arquitetura

### Estrutura

```
app/                          # Telas React Native
├── (tabs)/                   # Tab bar layout
└── facial-capture.tsx        # Tela de captura

lib/
└── native-credify-bridge.ts  # Bridge para SDK nativo

android/                      # Código Android (Kotlin)
├── build.gradle
└── app/src/main/kotlin/com/credify/
    ├── CredifySdkModule.kt
    ├── CameraManager.kt
    └── WasmModule.kt

ios/                          # Código iOS (Swift)
├── Podfile
└── CredifySdk/
    ├── CredifySdkModule.swift
    ├── CameraManager.swift
    └── WasmModule.swift

docs/                         # Documentação
├── SETUP_GUIDE.md
├── BUILD_GUIDE.md
└── API_REFERENCE.md
```

### Fluxo de Captura

```
1. Usuário clica "Iniciar Captura"
   ↓
2. Solicita permissão de câmera
   ↓
3. Inicializa SDK Credify
   ↓
4. Abre câmera e captura frame facial
   ↓
5. Processa frame com WASM
   ↓
6. Envia para backend Credify
   ↓
7. Backend valida liveness
   ↓
8. Exibe resultado ao usuário
```

---

## 🔧 Tecnologias

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React Native | 0.81.5 | Framework mobile |
| Expo | 54.0.29 | Plataforma de desenvolvimento |
| TypeScript | 5.9 | Linguagem tipada |
| NativeWind | 4.2.1 | Tailwind CSS para React Native |
| @identy/identy-face | 5.0.1 | SDK Credify |
| Kotlin | 1.9.10 | Android |
| Swift | 5.9 | iOS |

---

## 📱 Plataformas Suportadas

- ✅ iOS 13+
- ✅ Android 8+
- ✅ Web (Expo Go)

---

## 🎯 Recursos

- ✅ Captura facial em tempo real
- ✅ Verificação de liveness
- ✅ Feedback de qualidade
- ✅ Suporte a múltiplos idiomas
- ✅ Tratamento robusto de erros
- ✅ Logs de debug detalhados

---

## 🔐 Segurança

- Permissões de câmera solicitadas no runtime
- Dados de captura processados localmente
- Comunicação HTTPS com backend
- Tokens JWT para autenticação

---

## 📊 Requisitos Mínimos

| Requisito | Mínimo |
|-----------|--------|
| Node.js | 18+ |
| npm/pnpm | 9+ |
| iOS | 13+ |
| Android | 8+ |
| RAM | 4GB |
| Espaço em disco | 2GB |

---

## 🚨 Troubleshooting

### Erro: "CredifySdkModule não encontrado"

**Solução:** Você está em Expo Go (simulador). O app usará backend real via HTTP.

### Erro: "Permissão de câmera negada"

**Solução:** Ir em Configurações > [App Name] > Câmera > Permitir

### Erro: "Erro ao conectar com backend"

**Solução:** Verificar URLs em `.env` e conectividade de rede

---

## 📝 Variáveis de Ambiente

```env
# Backend URLs (obrigatório)
REACT_APP_URL_BASE=https://app-iden-dev.credify.com.br
REACT_APP_URL_BASE_CREDIFY=https://dev-api.credify.com.br/livelinesscapture

# Credenciais JFrog (para @identy/identy-face)
# Atualizar .npmrc com suas credenciais
```

---

## 🔄 Workflow de Desenvolvimento

```bash
# 1. Fazer mudanças
# 2. Testar em Expo Go
pnpm dev:metro

# 3. Validar TypeScript
pnpm check

# 4. Fazer commit
git add .
git commit -m "Implementar feature"

# 5. Build preview
eas build --platform ios --profile preview

# 6. Testar em dispositivo
# 7. Build produção
eas build --platform ios --profile production
```

---

## 📦 Scripts Disponíveis

```bash
pnpm dev          # Rodar servidor de desenvolvimento
pnpm dev:metro    # Iniciar Metro Bundler
pnpm dev:server   # Iniciar servidor backend
pnpm check        # Validar TypeScript
pnpm lint         # Executar linter
pnpm format       # Formatar código
pnpm test         # Rodar testes
pnpm ios          # Rodar em iOS Simulator
pnpm android      # Rodar em Android Emulator
pnpm qr           # Gerar QR code para Expo Go
```

---

## 🤝 Contribuindo

1. Criar branch: `git checkout -b feature/sua-feature`
2. Fazer mudanças e testes
3. Commit: `git commit -am 'Adicionar feature'`
4. Push: `git push origin feature/sua-feature`
5. Criar Pull Request

---

## 📄 Licença

Propriedade de Credify. Todos os direitos reservados.

---

## 📞 Suporte

Para suporte, contatar: support@credify.com.br

---

## 🔗 Links Úteis

- [Documentação Expo](https://docs.expo.dev)
- [Documentação React Native](https://reactnative.dev)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Credify SDK](https://credify.com.br)

---

**Última atualização:** Abril 2026
