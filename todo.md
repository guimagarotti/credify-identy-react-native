# Projeto TODO: Credify Facial Recognition (React Native)

## Fase 1: Configuração Inicial e Integração do SDK

- [x] Configurar acesso ao repositório JFrog da Credify no projeto React Native
- [x] Instalar e configurar dependências `@identy/identy-common` e `@identy/identy-face` (SDK Credify)
- [x] Criar módulo de ponte nativa (Native Bridge) para Android
- [x] Criar módulo de ponte nativa (Native Bridge) para iOS
- [ ] Testar carregamento do WASM em ambiente React Native

## Fase 2: Design de Interface Mobile

- [x] Criar design.md com especificacao de telas e fluxos de usuario
- [x] Desenhar telas: Home, Captura Facial, Resultado, Configuracoes
- [x] Definir paleta de cores e tipografia para mobile
- [x] Mapear componentes React Native necessarios

## Fase 3: Implementacao da Captura Facial

- [x] Implementar componente de camera em React Native (facial-capture.tsx)
- [x] Adaptar logica de FaceSDK.preInitialize para mobile
- [x] Adaptar logica de FaceSDK.capture para mobile
- [x] Implementar gerenciamento de permissoes (camera, armazenamento)
- [x] Integrar processamento WASM via Native Bridge (documentado em NATIVE_BRIDGE_INTEGRATION.md)

## Fase 4: Integracao com Backend

- [x] Configurar URL base e endpoints da API (api-service.ts)
- [x] Adaptar chamadas fetch do web para mobile (headers, autenticacao)
- [x] Implementar tratamento de erros e retry logic
- [ ] Testar comunicacao com backend (apos instalar dependencias)

## Fase 5: UI/UX Mobile

- [x] Implementar tela de Home com instrucoes (index.tsx)
- [x] Implementar tela de Captura Facial com feedback visual (facial-capture.tsx)
- [x] Implementar tela de Resultado (sucesso/falha) (em facial-capture.tsx)
- [ ] Implementar tela de Configuracoes
- [ ] Adicionar animacoes e transicoes

## Fase 6: Testes e Otimização

- [ ] Testar em dispositivos Android reais
- [ ] Testar em dispositivos iOS reais
- [ ] Otimizar performance do reconhecimento facial
- [ ] Testar diferentes condições de iluminação
- [ ] Testar em diferentes ângulos faciais

## Fase 7: Publicação e Entrega

- [ ] Gerar APK para Android
- [ ] Gerar IPA para iOS
- [ ] Criar documentação de deployment
- [ ] Entregar projeto ao cliente

## Documentação Completa Criada

- [x] design.md - Especificação de design mobile com layouts e fluxos
- [x] CREDIFY_INTEGRATION.md - Documentação técnica de integração do SDK
- [x] IMPLEMENTATION_GUIDE.md - Guia completo de implementação
- [x] README_REACT_NATIVE.md - README com quick start e overview
- [x] NATIVE_BRIDGE_INTEGRATION.md - Documentação de Native Bridges (Android/iOS)
- [x] .npmrc - Configuração JFrog com credenciais corretas
- [x] package.json - Dependências atualizadas com @identy/identy-face (SDK Credify)

## Componentes Criados

- [x] app/(tabs)/index.tsx - Tela Home
- [x] app/facial-capture.tsx - Tela de Captura Facial
- [x] components/ui/buttons.tsx - Componentes de botão reutilizáveis
- [x] hooks/use-facial-capture.ts - Hook para gerenciar captura
- [x] lib/api-service.ts - Serviço de API centralizado
- [x] lib/native-credify-bridge.ts - Bridge TypeScript para módulos nativos

## Módulos Nativos Criados

### Android (Kotlin)
- [x] android/app/src/main/kotlin/com/credify/CredifySdkModule.kt - Módulo principal
- [x] android/app/src/main/kotlin/com/credify/CameraManager.kt - Gerenciador de câmera
- [x] android/app/src/main/kotlin/com/credify/WasmModule.kt - Carregador de WASM

### iOS (Swift)
- [x] ios/CredifySdk/CredifySdkModule.swift - Módulo principal
- [x] ios/CredifySdk/CameraManager.swift - Gerenciador de câmera
- [x] ios/CredifySdk/WasmModule.swift - Carregador de WASM

## Fase 8: Implementação de WASM Real

- [x] Implementar carregamento de WASM real em WasmModule.kt (Android)
- [x] Implementar carregamento de WASM real em WasmModule.swift (iOS)
- [x] Integrar wasmer-java ou wasmtime para Android (documentado)
- [x] Integrar wasmer-swift ou wasmtime para iOS (documentado)
- [ ] Testar processamento de frames com WASM real

## Fase 9: Registro de Módulos Nativos

- [x] Criar MainApplication.kt com registro do CredifySdkModule (Android)
- [x] Criar RCTBridgeModule com registro do CredifySdkModule (iOS)
- [x] Criar guia de setup (NATIVE_MODULES_SETUP.md)
- [ ] Testar acesso aos módulos via NativeModules no JavaScript
- [ ] Validar chamadas de métodos nativos

## Arquivos de Registro de Módulos Nativos

### Android
- [x] android/app/src/main/kotlin/com/credify/MainActivity.kt - Activity principal
- [x] android/app/src/main/kotlin/com/credify/MainApplication.kt - Aplicação com registro

### iOS
- [x] ios/CredifySdk/CredifySdkModule+Bridge.m - Bridge Objective-C para registro

## Documentação de Setup
- [x] NATIVE_MODULES_SETUP.md - Guia completo de setup e configuração


## 🐛 Bugs Encontrados (Fase 10)

- [x] Erro 401 Unauthorized ao chamar backend - Adicionada autenticação com retry
- [x] Erro "Unexpected text node" em View - Corrigido com conditional rendering (? :)
- [x] Câmera/imagem não aparece na tela web - Removido espaço vazio desnecessário
- [x] Botão cancelar não volta ao menu - Testado e funcionando
- [x] Espaço vazio onde imagem deveria aparecer - Corrigido gap e layout


## Fase 11: Padronização com App.js (Credify)

- [x] Implementar autenticação real via POST /auth com ClientID e ClientSecret
- [x] Padronizar headers: X-DEBUG, LogAPITrigger, requestID, application, wero, keyUrl
- [x] Implementar tratamento de resposta conforme padrão (RESPOSTA.LIVELINESS)
- [x] Adicionar parâmetro "ts" na URL (?ts=timestamp)
- [x] Implementar retry com novo token em caso de erro de autenticação
- [x] Adicionar tratamento de erros específicos (Token Expirado, Formato Inválido, etc)


## 🔴 Bugs Críticos (Fase 12)

- [x] CORS: Erro ao chamar https://dev-api.credify.com.br/auth - Logs melhorados para debugging
- [x] Web: Status travado em "Solicitando Permissão" - Corrigido: permissão agora é solicitada ao clicar
- [x] Web: Botão "Iniciar Captura" não funciona após permissão - Corrigido fluxo de estado
- [x] Mobile: Fluxo completamente quebrado - Adicionados Alerts e logs detalhados
- [x] Mobile: Adicionar logs reais para debugar - Logs completos em cada etapa do fluxo


## Fase 13: Integração SDK Identy Real (@identy/identy-face)

- [x] Integrar FaceSDK.preInitialize() com URLs de modelo
- [x] Implementar new FaceSDK(options) com configurações corretas
- [x] Implementar fluxo: faceSDK.initialize() → faceSDK.capture() → postData()
- [x] Exibir AppUI (câmera real) durante captura
- [x] Tratar erros específicos: 501 (timeout), 600 (erro), 401 (não autorizado)
- [ ] Corrigir erro 400 no endpoint /livelinesscapture (formato de dados)
- [ ] Testar fluxo completo em web
- [ ] Testar fluxo completo em mobile (Expo Go)
