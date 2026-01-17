# Zest

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="screenshots/menu_bar_dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="screenshots/menu_bar.png" />
    <img alt="Zest Banner" src="screenshots/menu_bar.png" height="600" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg?style=flat" alt="Plataforma macOS" />
  <img src="https://img.shields.io/badge/language-Swift-orange.svg?style=flat" alt="Linguagem Swift" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" alt="Licença MIT" />
  <img src="https://img.shields.io/badge/version-0.1.0%20beta-green.svg?style=flat" alt="Versão" />
  <a href="README.en.md"><img src="https://img.shields.io/badge/lang-English-blue.svg?style=flat" alt="English" /></a>
  <a href="README.zh.md"><img src="https://img.shields.io/badge/lang-zh--CN-green.svg?style=flat" alt="Chinese" /></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/lang-Français-blue.svg?style=flat" alt="French" /></a>
</p>

<p align="center">
  <strong>O centro de comando definitivo para seus assistentes de codificação IA no macOS.</strong>
</p>

Zest é um aplicativo nativo para macOS para gerenciar o **CLIProxyAPI** - um servidor proxy local que alimenta seus agentes de codificação IA. Gerencie múltiplas contas de IA, acompanhe cotas e configure ferramentas CLI em um só lugar.

> Este projeto é um fork modificado do [Quotio](https://github.com/nguyenphutrong/quotio) original.

## Funcionalidades

- **Suporte Multi-Provedor**: Conecte contas do Gemini, Claude, OpenAI Codex, Qwen, Vertex AI, iFlow, Antigravity, Kiro, Trae e GitHub Copilot via OAuth ou chaves API.
- **Modo Cota Standalone**: Visualize cotas e contas sem executar o servidor proxy - perfeito para verificações rápidas.
- **Configuração de Agentes com Um Clique**: Detecte e configure automaticamente ferramentas de codificação IA como Claude Code, OpenCode, Gemini CLI e mais.
- **Dashboard em Tempo Real**: Monitore tráfego de requisições, uso de tokens e taxas de sucesso ao vivo.
- **Gerenciamento Inteligente de Cotas**: Acompanhamento visual de cotas por conta com estratégias de failover automático (Round Robin / Fill First).
- **Gerenciamento de Chaves API**: Gere e gerencie chaves API para seu proxy local.
- **Integração com Barra de Menu**: Acesso rápido ao status do servidor, visão geral de cotas e ícones de provedores personalizados na barra de menu.
- **Notificações**: Alertas para cotas baixas, períodos de resfriamento de contas ou problemas de serviço.
- **Atualização Automática**: Atualizador Sparkle integrado para atualizações contínuas.
- **Multilíngue**: Suporte para Inglês, Português-BR, Vietnamita, Francês e Chinês Simplificado.

## Ecossistema Suportado

### Provedores de IA
| Provedor | Método de Autenticação |
|----------|------------------------|
| Google Gemini | OAuth |
| Anthropic Claude | OAuth |
| OpenAI Codex | OAuth |
| Qwen Code | OAuth |
| Vertex AI | Service Account JSON |
| iFlow | OAuth |
| Antigravity | OAuth |
| Kiro | OAuth |
| GitHub Copilot | OAuth |

### Rastreamento de Cotas de IDE (Somente Monitoramento)
| IDE | Descrição |
|-----|-----------|
| Cursor | Detectado automaticamente quando instalado e logado |
| Trae | Detectado automaticamente quando instalado e logado |

> **Nota**: Essas IDEs são usadas apenas para monitoramento de uso de cotas. Elas não podem ser usadas como provedores para o proxy.

### Agentes CLI Compatíveis
Zest pode configurar automaticamente essas ferramentas para usar seu proxy centralizado:
- Claude Code
- Codex CLI
- Gemini CLI
- Amp CLI
- OpenCode
- Factory Droid

## Instalação

### Requisitos
- macOS 15.0 (Sequoia) ou posterior
- Conexão com a internet para autenticação OAuth

### Compilando a partir do Código Fonte

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/heliab125/zest.git
   cd zest
   ```

2. **Abra no Xcode:**
   ```bash
   open Quotio.xcodeproj
   ```

3. **Compile e Execute:**
   - Selecione o scheme "Quotio"
   - Pressione `Cmd + R` para compilar e executar

> O app baixará automaticamente o binário `CLIProxyAPI` na primeira execução.

## Como Usar

### 1. Inicie o Servidor
Abra o Zest e clique em **Iniciar** no dashboard para inicializar o servidor proxy local.

### 2. Conecte Contas
Vá para a aba **Provedores** → Clique em um provedor → Autentique via OAuth ou importe credenciais.

### 3. Configure Agentes
Vá para a aba **Agentes** → Selecione um agente instalado → Clique em **Configurar** → Escolha modo Automático ou Manual.

### 4. Monitore o Uso
- **Dashboard**: Saúde geral e tráfego
- **Cota**: Detalhamento de uso por conta
- **Logs**: Logs brutos de requisição/resposta para debugging

## Configurações

- **Porta**: Altere a porta de escuta do proxy
- **Estratégia de Roteamento**: Round Robin ou Fill First
- **Auto-iniciar**: Inicie o proxy automaticamente quando o Zest abrir
- **Notificações**: Ative/desative alertas para vários eventos

## Capturas de Tela

### Dashboard
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/dashboard_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/dashboard.png" />
  <img alt="Dashboard" src="screenshots/dashboard.png" />
</picture>

### Provedores
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/provider_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/provider.png" />
  <img alt="Provedores" src="screenshots/provider.png" />
</picture>

### Configuração de Agentes
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/agent_setup_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/agent_setup.png" />
  <img alt="Configuração de Agentes" src="screenshots/agent_setup.png" />
</picture>

### Monitoramento de Cotas
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/quota_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/quota.png" />
  <img alt="Monitoramento de Cotas" src="screenshots/quota.png" />
</picture>

## Contribuindo

1. Faça um Fork do Projeto
2. Crie sua Branch de Feature (`git checkout -b feature/amazing-feature`)
3. Commit suas Alterações (`git commit -m 'Add amazing feature'`)
4. Push para a Branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## Créditos

Este projeto é um fork modificado do [Quotio](https://github.com/nguyenphutrong/quotio) original, criado por [nguyenphutrong](https://github.com/nguyenphutrong).

**Modificado por:** [heliab125](https://github.com/heliab125)

## Licença

Licença MIT. Veja `LICENSE` para detalhes.
