# Design Mobile: Credify Facial Recognition

## Visão Geral

O aplicativo de reconhecimento facial Credify para React Native é uma adaptação da versão web, otimizada para dispositivos móveis (Android e iOS). O design segue as diretrizes de interface humana da Apple (HIG) e padrões de design Android Material, garantindo uma experiência nativa e intuitiva em ambas as plataformas.

## Orientação e Contexto de Uso

O aplicativo é projetado para **orientação retrato (9:16)** e uso com **uma mão**. Todos os elementos interativos (botões, campos de entrada) são posicionados na metade inferior da tela para facilitar o alcance com o polegar. A captura facial é realizada em modo retrato, com o dispositivo mantido na altura dos olhos.

## Paleta de Cores

| Elemento | Cor (Light) | Cor (Dark) | Uso |
|----------|------------|-----------|-----|
| Primária | `#0a7ea4` | `#0a7ea4` | Botões principais, destaques |
| Fundo | `#ffffff` | `#151718` | Fundo de telas |
| Superfície | `#f5f5f5` | `#1e2022` | Cards, modais |
| Texto Principal | `#11181C` | `#ECEDEE` | Títulos, corpo de texto |
| Texto Secundário | `#687076` | `#9BA1A6` | Subtítulos, dicas |
| Borda | `#E5E7EB` | `#334155` | Divisores, bordas |
| Sucesso | `#22C55E` | `#4ADE80` | Confirmação, status positivo |
| Erro | `#EF4444` | `#F87171` | Erros, avisos |
| Aviso | `#F59E0B` | `#FBBF24` | Avisos, atenção |

## Tipografia

| Elemento | Tamanho | Peso | Uso |
|----------|--------|------|-----|
| Título Principal | 32px | Bold (700) | Títulos de tela |
| Título Secundário | 24px | Semibold (600) | Subtítulos |
| Corpo | 16px | Regular (400) | Texto principal |
| Pequeno | 14px | Regular (400) | Texto secundário, dicas |
| Muito Pequeno | 12px | Regular (400) | Labels, metadados |

## Estrutura de Telas

### 1. Tela de Home (Onboarding)

**Objetivo:** Apresentar o aplicativo e guiar o usuário para iniciar o processo de reconhecimento facial.

**Conteúdo Principal:**
- Título: "Reconhecimento Facial Credify"
- Ícone/Imagem: Ilustração de um rosto com overlay de reconhecimento
- Descrição: "Verifique sua identidade de forma segura e rápida"
- Instruções: "Este aplicativo capturará uma foto do seu rosto para verificação"
- Botão Principal: "Iniciar Captura"
- Botão Secundário: "Configurações"

**Layout:**
```
┌─────────────────────────────────┐
│  Status Bar (Sistema)           │
├─────────────────────────────────┤
│                                 │
│    Ícone/Ilustração (120x120)   │
│                                 │
│  Reconhecimento Facial Credify   │
│                                 │
│  Verifique sua identidade de    │
│  forma segura e rápida          │
│                                 │
│  Este aplicativo capturará uma  │
│  foto do seu rosto para         │
│  verificação                    │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Iniciar Captura          │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Configurações            │  │
│  └───────────────────────────┘  │
│                                 │
│  Tab Bar (Home, Settings)       │
└─────────────────────────────────┘
```

### 2. Tela de Captura Facial

**Objetivo:** Capturar a imagem do rosto do usuário com feedback em tempo real.

**Conteúdo Principal:**
- Câmera ao vivo (ocupando a maior parte da tela)
- Overlay com guia oval (indicando onde o rosto deve estar)
- Feedback de status em tempo real (ex: "Aproxime-se", "Afaste-se", "Olhe reto")
- Indicador de qualidade (barra de progresso)
- Botão de Captura (ou captura automática quando qualidade atinge limite)
- Botão de Cancelar

**Layout:**
```
┌─────────────────────────────────┐
│  Status Bar (Sistema)           │
├─────────────────────────────────┤
│                                 │
│    ┌─────────────────────────┐  │
│    │                         │  │
│    │   Câmera ao Vivo        │  │
│    │   (com overlay oval)    │  │
│    │                         │  │
│    │   Feedback: "Olhe reto" │  │
│    │                         │  │
│    └─────────────────────────┘  │
│                                 │
│  Qualidade: ████████░░░░░░░░░░  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Capturar                 │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Cancelar                 │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 3. Tela de Resultado

**Objetivo:** Exibir o resultado da verificação (sucesso ou falha) e próximos passos.

**Conteúdo Principal (Sucesso):**
- Ícone de Sucesso (✓ verde)
- Título: "Verificação Bem-Sucedida"
- Mensagem: "Sua identidade foi verificada com sucesso"
- Botão: "Continuar"

**Conteúdo Principal (Falha):**
- Ícone de Erro (✗ vermelho)
- Título: "Verificação Falhou"
- Mensagem: "Não foi possível verificar sua identidade. Tente novamente."
- Botão: "Tentar Novamente"
- Botão Secundário: "Cancelar"

**Layout (Sucesso):**
```
┌─────────────────────────────────┐
│  Status Bar (Sistema)           │
├─────────────────────────────────┤
│                                 │
│         ✓ (verde, 64x64)        │
│                                 │
│  Verificação Bem-Sucedida       │
│                                 │
│  Sua identidade foi verificada  │
│  com sucesso                    │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Continuar                │  │
│  └───────────────────────────┘  │
│                                 │
│  Tab Bar (Home, Settings)       │
└─────────────────────────────────┘
```

### 4. Tela de Configurações

**Objetivo:** Permitir que o usuário configure opções do aplicativo.

**Conteúdo Principal:**
- Título: "Configurações"
- Seção: Preferências
  - Toggle: "Modo Escuro"
  - Seletor: "Idioma"
- Seção: Sobre
  - Versão do Aplicativo
  - Termos de Serviço (link)
  - Política de Privacidade (link)

**Layout:**
```
┌─────────────────────────────────┐
│  Status Bar (Sistema)           │
├─────────────────────────────────┤
│  Configurações                  │
├─────────────────────────────────┤
│                                 │
│  Preferências                   │
│  ─────────────────────────────  │
│  Modo Escuro              [ON]   │
│                                 │
│  Idioma                   [PT▼]  │
│                                 │
│  Sobre                          │
│  ─────────────────────────────  │
│  Versão: 1.0.0                  │
│                                 │
│  Termos de Serviço              │
│  Política de Privacidade        │
│                                 │
│  Tab Bar (Home, Settings)       │
└─────────────────────────────────┘
```

## Fluxos de Usuário Principais

### Fluxo 1: Verificação Bem-Sucedida

1. Usuário abre o aplicativo → Tela de Home
2. Usuário toca em "Iniciar Captura" → Tela de Captura Facial
3. Câmera captura o rosto automaticamente quando qualidade atinge limite
4. Sistema processa a imagem → Tela de Resultado (Sucesso)
5. Usuário toca em "Continuar" → Redirecionamento (conforme backend)

### Fluxo 2: Verificação com Falha e Retry

1. Usuário abre o aplicativo → Tela de Home
2. Usuário toca em "Iniciar Captura" → Tela de Captura Facial
3. Câmera captura o rosto, mas qualidade é insuficiente
4. Sistema processa a imagem → Tela de Resultado (Falha)
5. Usuário toca em "Tentar Novamente" → Volta para Tela de Captura Facial
6. Processo se repete até sucesso ou cancelamento

### Fluxo 3: Acesso às Configurações

1. Usuário abre o aplicativo → Tela de Home
2. Usuário toca em "Configurações" ou na aba "Settings" → Tela de Configurações
3. Usuário ajusta preferências (modo escuro, idioma)
4. Usuário toca em "Home" ou volta → Tela de Home

## Componentes Reutilizáveis

| Componente | Descrição | Uso |
|-----------|-----------|-----|
| `ScreenContainer` | Wrapper de tela com SafeArea | Todas as telas |
| `PrimaryButton` | Botão principal com feedback | Ações principais |
| `SecondaryButton` | Botão secundário | Ações alternativas |
| `FeedbackText` | Texto de feedback em tempo real | Tela de Captura |
| `ResultCard` | Card de resultado (sucesso/falha) | Tela de Resultado |
| `SettingRow` | Linha de configuração | Tela de Configurações |

## Considerações de Performance e Acessibilidade

- **Performance:** A câmera ao vivo deve manter 30 FPS mínimo. O processamento WASM deve ser otimizado para não bloquear a thread de UI.
- **Acessibilidade:** Todos os elementos interativos devem ter labels acessíveis. Cores não devem ser o único indicador de status (usar também ícones e texto).
- **Orientação:** O aplicativo suporta apenas orientação retrato para simplificar a captura facial.
- **Notch/Home Indicator:** O `ScreenContainer` gerencia automaticamente as áreas seguras do dispositivo.

## Próximos Passos

1. Implementar componentes React Native baseados neste design.
2. Integrar câmera e feedback em tempo real.
3. Testar em dispositivos reais (Android e iOS).
4. Ajustar design com base em feedback de usuários.
