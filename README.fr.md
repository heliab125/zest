# Zest

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="screenshots/menu_bar_dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="screenshots/menu_bar.png" />
    <img alt="Bannière Zest" src="screenshots/menu_bar.png" height="600" />
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg?style=flat" alt="Plateforme macOS" />
  <img src="https://img.shields.io/badge/language-Swift-orange.svg?style=flat" alt="Langage Swift" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" alt="Licence MIT" />
  <img src="https://img.shields.io/badge/version-0.1.0%20beta-green.svg?style=flat" alt="Version" />
  <a href="README.md"><img src="https://img.shields.io/badge/lang-Português-green.svg?style=flat" alt="Portuguese" /></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/lang-English-blue.svg?style=flat" alt="English" /></a>
  <a href="README.zh.md"><img src="https://img.shields.io/badge/lang-zh--CN-green.svg?style=flat" alt="Chinois" /></a>
</p>

<p align="center">
  <strong>Le centre de commande ultime pour vos assistants de codage IA sur macOS.</strong>
</p>

Zest est une application macOS native pour gérer **CLIProxyAPI** - un serveur proxy local qui alimente vos agents de codage IA. Il vous aide à gérer plusieurs comptes IA, suivre les quotas et configurer les outils CLI en un seul endroit.

> Ce projet est un fork modifié de [Quotio](https://github.com/nguyenphutrong/quotio) original.

## Fonctionnalités

- **Support Multi-Fournisseurs** : Connectez des comptes de Gemini, Claude, OpenAI Codex, Qwen, Vertex AI, iFlow, Antigravity, Kiro, Trae et GitHub Copilot via OAuth ou clés API.
- **Mode Quota Autonome** : Visualisez les quotas et les comptes sans exécuter le serveur proxy - idéal pour des vérifications rapides.
- **Configuration Agent en Un Clic** : Détection automatique et configuration des outils de codage IA comme Claude Code, OpenCode, Gemini CLI, et plus.
- **Tableau de Bord en Temps Réel** : Surveillez le trafic des requêtes, l'utilisation des tokens et les taux de réussite en direct.
- **Gestion Intelligente des Quotas** : Suivi visuel des quotas par compte avec stratégies de basculement automatique (Round Robin / Remplir d'abord).
- **Gestion des Clés API** : Générez et gérez les clés API pour votre proxy local.
- **Intégration Barre de Menu** : Accès rapide à l'état du serveur, aperçu des quotas et icônes de fournisseurs personnalisés depuis votre barre de menu.
- **Notifications** : Alertes pour quotas faibles, périodes de refroidissement des comptes ou problèmes de service.
- **Mise à Jour Automatique** : Mise à jour Sparkle intégrée pour des mises à jour transparentes.
- **Multilingue** : Support anglais, portugais-BR, vietnamien, chinois simplifié et français.

## Écosystème Supporté

### Fournisseurs IA
| Fournisseur | Méthode d'Authentification |
|-------------|---------------------------|
| Google Gemini | OAuth |
| Anthropic Claude | OAuth |
| OpenAI Codex | OAuth |
| Qwen Code | OAuth |
| Vertex AI | JSON de compte de service |
| iFlow | OAuth |
| Antigravity | OAuth |
| Kiro | OAuth |
| GitHub Copilot | OAuth |

### Suivi de Quota IDE (Surveillance uniquement)
| IDE | Description |
|-----|-------------|
| Cursor | Détecté automatiquement lorsqu'installé et connecté |
| Trae | Détecté automatiquement lorsqu'installé et connecté |

> **Note** : Ces IDE sont uniquement utilisés pour la surveillance de l'utilisation des quotas. Ils ne peuvent pas être utilisés comme fournisseurs pour le proxy.

### Agents CLI Compatibles
Zest peut configurer automatiquement ces outils pour utiliser votre proxy centralisé :
- Claude Code
- Codex CLI
- Gemini CLI
- Amp CLI
- OpenCode
- Factory Droid

## Installation

### Prérequis
- macOS 15.0 (Sequoia) ou ultérieur
- Connexion Internet pour l'authentification OAuth

### Compilation depuis les Sources

1. **Clonez le dépôt :**
   ```bash
   git clone https://github.com/heliab125/zest.git
   cd zest
   ```

2. **Ouvrez dans Xcode :**
   ```bash
   open Quotio.xcodeproj
   ```

3. **Compilez et Exécutez :**
   - Sélectionnez le schéma "Quotio"
   - Appuyez sur `Cmd + R` pour compiler et exécuter

> L'application téléchargera automatiquement le binaire `CLIProxyAPI` au premier lancement.

## Utilisation

### 1. Démarrer le Serveur
Lancez Zest et cliquez sur **Démarrer** dans le tableau de bord pour initialiser le serveur proxy local.

### 2. Connecter des Comptes
Allez dans l'onglet **Fournisseurs** → Cliquez sur un fournisseur → Authentifiez-vous via OAuth ou importez des identifiants.

### 3. Configurer les Agents
Allez dans l'onglet **Agents** → Sélectionnez un agent installé → Cliquez sur **Configurer** → Choisissez le mode Automatique ou Manuel.

### 4. Surveiller l'Utilisation
- **Tableau de bord** : Santé générale et trafic
- **Quota** : Détail de l'utilisation par compte
- **Logs** : Logs bruts requête/réponse pour le débogage

## Paramètres

- **Port** : Modifier le port d'écoute du proxy
- **Stratégie de Routage** : Round Robin ou Remplir d'abord
- **Démarrage Automatique** : Lancer le proxy automatiquement à l'ouverture de Zest
- **Notifications** : Activer/désactiver les alertes pour divers événements

## Captures d'Écran

### Tableau de Bord
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/dashboard_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/dashboard.png" />
  <img alt="Tableau de Bord" src="screenshots/dashboard.png" />
</picture>

### Fournisseurs
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/provider_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/provider.png" />
  <img alt="Fournisseurs" src="screenshots/provider.png" />
</picture>

### Configuration des Agents
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/agent_setup_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/agent_setup.png" />
  <img alt="Configuration des Agents" src="screenshots/agent_setup.png" />
</picture>

### Surveillance des Quotas
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/quota_dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="screenshots/quota.png" />
  <img alt="Surveillance des Quotas" src="screenshots/quota.png" />
</picture>

## Contribuer

1. Forkez le Projet
2. Créez votre Branche de Fonctionnalité (`git checkout -b feature/fonctionnalite-geniale`)
3. Commitez vos Modifications (`git commit -m 'Ajout d'une fonctionnalité géniale'`)
4. Poussez vers la Branche (`git push origin feature/fonctionnalite-geniale`)
5. Ouvrez une Pull Request

## Crédits

Ce projet est un fork modifié de [Quotio](https://github.com/nguyenphutrong/quotio) original, créé par [nguyenphutrong](https://github.com/nguyenphutrong).

**Modifié par :** [heliab125](https://github.com/heliab125)

## Licence

Licence MIT. Voir `LICENSE` pour plus de détails.
