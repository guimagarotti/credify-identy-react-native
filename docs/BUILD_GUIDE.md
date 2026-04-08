# Guia de Build com EAS

## 📱 Visão Geral

Este guia explica como fazer build da aplicação Credify Facial Recognition para iOS e Android usando EAS (Expo Application Services).

---

## 🔧 Pré-requisitos

1. **EAS CLI instalado:**
   ```bash
   npm install -g eas-cli
   ```

2. **Conta Expo:**
   - Criar em https://expo.dev
   - Autenticar: `eas login`

3. **Variáveis de Ambiente Configuradas:**
   ```env
   REACT_APP_URL_BASE=https://app-iden-dev.credify.com.br
   REACT_APP_URL_BASE_CREDIFY=https://dev-api.credify.com.br/livelinesscapture
   ```

4. **Git Configurado:**
   ```bash
   git config --global user.name "Seu Nome"
   git config --global user.email "seu.email@example.com"
   ```

---

## 🚀 Build Preview (Teste)

### Para iOS

```bash
# Build preview para iOS
eas build --platform ios --profile preview

# Ou com mais verbosidade
eas build --platform ios --profile preview --verbose
```

**Tempo estimado:** 10-15 minutos

**Resultado:** Arquivo `.ipa` pronto para testes

### Para Android

```bash
# Build preview para Android
eas build --platform android --profile preview

# Ou com mais verbosidade
eas build --platform android --profile preview --verbose
```

**Tempo estimado:** 10-15 minutos

**Resultado:** Arquivo `.apk` pronto para testes

### Build Ambas Plataformas

```bash
eas build --platform all --profile preview
```

---

## 🏆 Build Produção

### Para iOS

```bash
# Build produção para iOS
eas build --platform ios --profile production
```

**Resultado:** Arquivo `.ipa` pronto para App Store

### Para Android

```bash
# Build produção para Android
eas build --platform android --profile production
```

**Resultado:** Arquivo `.aab` (Android App Bundle) pronto para Google Play

---

## 📊 Monitorar Build

### Ver Status do Build

```bash
# Listar builds recentes
eas build:list

# Ver detalhes de um build específico
eas build:view <build-id>

# Ver logs de um build
eas build:logs <build-id>
```

### Acompanhar em Tempo Real

O terminal mostrará progresso em tempo real:
```
✓ Build queued
✓ Build started
✓ Preparing credentials
✓ Building app
✓ Uploading artifacts
✓ Build complete
```

---

## 📥 Baixar Artefatos

### Baixar do Dashboard

1. Acessar https://expo.dev
2. Ir para projeto "credify-facial-recognition"
3. Clicar em "Builds"
4. Selecionar build desejado
5. Clicar em "Download"

### Baixar via CLI

```bash
# Listar builds
eas build:list

# Copiar ID do build desejado
# Baixar automaticamente
eas build:download <build-id>
```

---

## 🧪 Testar Build Localmente

### iOS (Simulator)

```bash
# Baixar .ipa
eas build:download <build-id> --path ./app.ipa

# Instalar em simulator
xcrun simctl install booted ./app.ipa

# Ou arrastar arquivo para simulator
open ./app.ipa
```

### Android (Emulator)

```bash
# Baixar .apk
eas build:download <build-id> --path ./app.apk

# Instalar em emulator
adb install ./app.apk
```

### Dispositivo Real

**iOS:**
```bash
# Usar TestFlight (recomendado)
# Ou instalar .ipa com Xcode
open ./app.ipa
```

**Android:**
```bash
# Instalar .apk em dispositivo conectado
adb install ./app.apk
```

---

## 🔐 Credenciais e Certificados

### iOS

EAS gerencia automaticamente certificados de assinatura:

```bash
# Ver credenciais
eas credentials

# Resetar credenciais (se necessário)
eas credentials:remove --platform ios
```

### Android

EAS gerencia automaticamente keystore:

```bash
# Ver credenciais
eas credentials

# Resetar keystore (se necessário)
eas credentials:remove --platform android
```

---

## 🔄 Perfis de Build

O projeto possui 3 perfis configurados em `eas.json`:

### development
- **Uso:** Desenvolvimento local
- **Distribuição:** Internal (apenas você)
- **Assinatura:** Debug

### preview
- **Uso:** Testes antes de produção
- **Distribuição:** Internal (time de testes)
- **Assinatura:** Release

### production
- **Uso:** App final para stores
- **Distribuição:** Store (App Store / Google Play)
- **Assinatura:** Release

---

## 📋 Checklist Pré-Build

- [ ] `.env` configurado com URLs corretas
- [ ] `git commit` realizado (EAS requer git)
- [ ] `pnpm check` passou (sem erros TypeScript)
- [ ] `pnpm lint` passou (sem erros de lint)
- [ ] Testado em Expo Go
- [ ] Testado em simulador/emulador
- [ ] Permissões configuradas (AndroidManifest.xml, Info.plist)
- [ ] Versão atualizada em `app.config.ts`
- [ ] Changelog atualizado

---

## ⚠️ Troubleshooting

### Build Falha com "Erro de Permissão"

```bash
# Solução: Resetar credenciais
eas credentials:remove --platform <ios|android>
eas build --platform <ios|android> --profile preview
```

### Build Falha com "Erro de Git"

```bash
# Solução: Fazer commit
git add .
git commit -m "Preparar para build"
eas build --platform <ios|android> --profile preview
```

### Build Falha com "Erro de Dependências"

```bash
# Solução: Limpar cache e reinstalar
pnpm install --force
cd ios && pod install && cd ..
eas build --platform <ios|android> --profile preview
```

### Build Falha com "Erro de TypeScript"

```bash
# Solução: Validar TypeScript
pnpm check

# Corrigir erros
# Fazer commit
git add .
git commit -m "Corrigir erros TypeScript"
eas build --platform <ios|android> --profile preview
```

### Build Demora Muito

- Tempo normal: 10-15 minutos
- Se demorar mais: verificar logs com `eas build:logs <build-id>`
- Pode estar aguardando fila de builds

---

## 🎯 Workflow Recomendado

### 1. Desenvolvimento

```bash
# Fazer mudanças
# Testar em Expo Go
pnpm dev:metro

# Testar em simulador
pnpm ios
# ou
pnpm android
```

### 2. Validação

```bash
# Validar TypeScript
pnpm check

# Validar lint
pnpm lint

# Fazer commit
git add .
git commit -m "Implementar feature X"
```

### 3. Build Preview

```bash
# Build para teste
eas build --platform all --profile preview

# Aguardar conclusão
eas build:list

# Testar em dispositivo
```

### 4. Build Produção

```bash
# Após validação completa
eas build --platform all --profile production

# Aguardar conclusão
# Publicar em stores
```

---

## 📱 Publicar em Stores

### App Store (iOS)

```bash
# Após build produção iOS
# 1. Acessar App Store Connect
# 2. Criar nova versão
# 3. Upload do .ipa via Xcode ou Transporter
# 4. Preencher informações
# 5. Submeter para revisão
```

### Google Play (Android)

```bash
# Após build produção Android
# 1. Acessar Google Play Console
# 2. Criar nova versão
# 3. Upload do .aab
# 4. Preencher informações
# 5. Submeter para revisão
```

---

## 🔗 Recursos Úteis

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS CLI Reference](https://docs.expo.dev/build/eas-cli/)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Google Play Console](https://play.google.com/console)

