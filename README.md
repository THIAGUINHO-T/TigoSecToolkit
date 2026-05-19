# 🛡️ TigoSecToolkit

![Version](https://img.shields.io/badge/version-1.5.0-00f2ff?style=for-the-badge&labelColor=111111)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge&labelColor=111111)
![Platform](https://img.shields.io/badge/platform-Windows-0078d7?style=for-the-badge&logo=windows&labelColor=111111)

**TigoSecToolkit** e uma suite desktop de auditoria de seguranca que integra as principais ferramentas open-source de SAST, DAST, secrets-scanning e analise de dependencias numa unica interface grafica. Voce seleciona um projeto ou uma URL, marca quais ferramentas quer rodar e recebe relatorios consolidados — sem precisar instalar e configurar cada ferramenta manualmente.

---

## 📑 Sumario

- [Funcionalidades](#-funcionalidades)
- [Como instalar (usuario final)](#-como-instalar-usuario-final)
- [Como usar](#-como-usar)
- [Pre-requisitos opcionais](#-pre-requisitos-opcionais)
- [Onde ficam os relatorios](#-onde-ficam-os-relatorios)
- [Solucao de problemas](#-solucao-de-problemas)
- [Desenvolvimento](#-desenvolvimento)
- [Gerar uma nova release](#-gerar-uma-nova-release)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Tecnologias](#-tecnologias)
- [Contribuicoes](#-contribuicoes)
- [Autor & Licenca](#-autor)

---

## 🔥 Funcionalidades

Cada modulo abaixo gera um relatorio independente, e os resultados ficam disponiveis tanto na interface quanto em `reports/` (JSON + HTML).

| Categoria | Ferramentas | O que detecta |
|---|---|---|
| 🔑 **Secrets & Credenciais** | Gitleaks, TruffleHog | Tokens, chaves de API e senhas expostos em codigo e historico do Git |
| 💻 **Codigo-fonte (SAST)** | Semgrep | Padroes inseguros, OWASP Top 10, regras customizaveis |
| 📦 **Dependencias & CVEs** | Snyk, Depcheck | Vulnerabilidades conhecidas em libs e pacotes nao utilizados |
| 🌐 **Web Scanners (DAST)** | Nuclei | Vulnerabilidades em aplicacoes web (~10k templates) |
| 📱 **Frontend & HTTP** | Lighthouse, Mozilla Observatory | Performance, SEO, acessibilidade, headers HTTP de seguranca |
| 🚀 **Carga & Estabilidade** | k6 | Testes de stress, latencia e taxa de erro sob carga |
| 🧩 **Estrutura de codigo** | Madge | Dependencias circulares e arvore de imports |

---

## 🚀 Como instalar (usuario final)

1. Acesse **[a pagina de Releases](https://github.com/THIAGUINHO-T/TigoSecToolkit/releases/latest)**.
2. Baixe um dos arquivos:
   - **`TigoSecToolkit Setup X.Y.Z.exe`** — instalador NSIS (cria atalho no menu Iniciar e na area de trabalho). **Recomendado.**
   - **`TigoSecToolkit X.Y.Z.exe`** — versao portatil (executa direto, sem instalar).
3. Execute o arquivo baixado.

> ⚠️ **Aviso do Windows SmartScreen**
>
> Como o instalador nao tem assinatura digital comercial (custaria centenas de dolares por ano), o Windows pode mostrar a tela azul **"O Windows protegeu o seu PC"** na primeira execucao.
>
> Clique em **"Mais informacoes"** → **"Executar assim mesmo"**.
>
> Isso so acontece **uma vez** por usuario. O codigo-fonte deste repositorio e o que gerou o binario, voce pode auditar tudo antes de executar.

### Primeira execucao

Na primeira vez que abrir o app, ele baixa automaticamente as ferramentas externas necessarias (Gitleaks, Trufflehog, Nuclei, k6, Snyk, Semgrep). Esse download leva alguns minutos e exige conexao com a internet. Das proximas vezes em diante, o app abre instantaneamente.

---

## 🧭 Como usar

1. Abra o **TigoSecToolkit**.
2. Clique em **"Selecionar projeto"** e escolha a pasta que voce quer auditar (ou informe uma URL para os scanners web).
3. Selecione na lista quais ferramentas executar (voce pode marcar todas ou apenas as relevantes).
4. Clique em **"Iniciar Scan"**.
5. Acompanhe a execucao em tempo real no painel de logs.
6. Ao fim, os relatorios aparecem na aba **"Relatorios"**, com resumos visuais e a opcao de exportar tudo em Markdown (util pra colar em IA para analise).

---

## ⚙️ Pre-requisitos opcionais

O app **nao precisa** de nada pre-instalado para a maioria das ferramentas (Node ja vem embutido no Electron). Mas algumas funcionalidades especificas dependem de programas externos:

| Programa | Necessario para | Link |
|---|---|---|
| [Python 3](https://python.org) | Semgrep (SAST) | python.org |
| [Git](https://git-scm.com) | Escanear historico de commits com Gitleaks/Trufflehog | git-scm.com |

Se voce nao instalar esses extras, o app continua funcionando — apenas as ferramentas correspondentes ficam indisponiveis.

### Autenticacao do Snyk

O Snyk e gratuito mas exige um cadastro. Na primeira vez que voce rodar o scan do Snyk pela interface, o app abrira o navegador para voce autenticar. Isso e necessario uma unica vez.

---

## 📂 Onde ficam os relatorios

Os relatorios sao salvos na pasta `reports/` ao lado do executavel (ou em `%LOCALAPPDATA%\TigoSecToolkit\reports\` na versao instalada). Cada execucao gera arquivos com nome no formato:

```
<ferramenta>-<timestamp>.json
<ferramenta>-<timestamp>.html
```

A interface permite:
- Filtrar relatorios por ferramenta ou categoria
- Excluir relatorios antigos (>24h) ou todos de uma vez
- Exportar um resumo consolidado em Markdown
- Abrir o JSON/HTML bruto no navegador

---

## 🔧 Solucao de problemas

**❓ O app abre mas as ferramentas dao erro de "executavel nao encontrado"**

Significa que o download automatico falhou. Verifique sua conexao e clique em **"Reinstalar ferramentas"** no menu de configuracoes do app.

**❓ Semgrep nao funciona**

Voce precisa do Python 3 instalado. Baixe em [python.org](https://python.org), marque **"Add Python to PATH"** durante a instalacao, reinicie o computador e tente novamente.

**❓ Gitleaks/Trufflehog so escaneam arquivos atuais, nao o historico**

Significa que o Git nao esta instalado ou o projeto nao tem `.git/`. Instale o [Git](https://git-scm.com) e/ou rode `git init` no projeto.

**❓ Como atualizo para uma nova versao?**

Basta baixar o instalador da nova release. Os relatorios e configuracoes sao preservados.

**❓ Antivirus reclama do executavel**

Falso positivo comum em apps Electron sem assinatura digital. Adicione o app a lista de excecoes do seu antivirus ou compile voce mesmo a partir do codigo-fonte (instrucoes em [Desenvolvimento](#-desenvolvimento)).

---

## 🛠️ Desenvolvimento

Quer contribuir ou rodar a versao em desenvolvimento?

### Pre-requisitos
- [Node.js 20+](https://nodejs.org)
- Git
- Windows 10/11 (o app e Windows-only por enquanto)

### Setup

```bash
git clone https://github.com/THIAGUINHO-T/TigoSecToolkit.git
cd TigoSecToolkit/core/gui
npm install
```

### Comandos uteis

```bash
# Modo desenvolvimento (Vite + Electron com hot-reload)
npm run dev

# Compilar GUI estatica (gera dist/)
npm run build

# Empacotar versao "win-unpacked" para testes rapidos (sem instalador)
npm run package

# Gerar instaladores finais (.exe NSIS + portable)
# IMPORTANTE: a variavel abaixo desativa code signing e evita erro de symlink
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
```

---

## 📦 Gerar uma nova release

1. Atualize a versao em `core/gui/package.json` (campo `version`) e o badge no topo deste README.
2. Gere os instaladores:
   ```bash
   cd core/gui
   CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist
   ```
3. Os arquivos finais ficam em `core/gui/release/`:
   - `TigoSecToolkit Setup X.Y.Z.exe`
   - `TigoSecToolkit X.Y.Z.exe`
4. Crie uma nova [Release no GitHub](https://github.com/THIAGUINHO-T/TigoSecToolkit/releases/new):
   - Tag: `vX.Y.Z`
   - Titulo: `TigoSecToolkit X.Y.Z`
   - Anexe os dois `.exe` da pasta `release/`.
5. **Publish release**.

> 💡 No Windows, se o build falhar com erro de symlink no `winCodeSign`, a flag `CSC_IDENTITY_AUTO_DISCOVERY=false` resolve. Ela desativa a tentativa de code signing (que tambem nao usariamos sem certificado).

---

## 📁 Estrutura do projeto

```
TigoSecToolkit/
├── assets/                  # Icones do app
├── core/
│   ├── package.json         # Deps Node usadas pelos scripts de analise
│   ├── scripts/             # Scripts de analise (Node.js puro)
│   │   ├── setup.js         # Baixa Gitleaks/Trufflehog/Nuclei/k6/etc na 1a execucao
│   │   ├── analyze.js       # Orquestrador CLI
│   │   ├── detect-project.js
│   │   └── run-*.js         # 1 arquivo por ferramenta
│   ├── gui/
│   │   ├── package.json     # Deps Electron + React + electron-builder
│   │   ├── electron/
│   │   │   ├── main.js      # Processo principal do Electron (IPC, spawn de tools)
│   │   │   ├── preload.js   # Bridge segura para o renderer
│   │   │   └── tool-runner.js
│   │   ├── src/             # Codigo React (Vite + TS + Tailwind)
│   │   ├── icon.png
│   │   └── release/         # ⚠️ Gerado pelo electron-builder (ignorado pelo git)
│   └── tools/               # ⚠️ Ferramentas portateis baixadas em runtime (ignorado)
├── reports/                 # ⚠️ Saidas das analises (ignorado pelo git)
├── LICENSE
└── README.md
```

Pastas marcadas com ⚠️ sao geradas dinamicamente e estao no `.gitignore`.

---

## 🛠️ Tecnologias

- **Interface**: React 19 + Vite 6 + TailwindCSS 3 + Framer Motion
- **Desktop**: Electron 33 (empacotado com electron-builder 25)
- **Scripts de analise**: Node.js (embutido no Electron, sem necessidade de instalar separadamente)
- **Linguagens**: TypeScript (renderer) + JavaScript (main process)

---

## 🤝 Contribuicoes

Issues e Pull Requests sao bem-vindos. Sugestoes uteis:

- Suporte a Linux/macOS (atualmente so Windows)
- Novas ferramentas (ZAP, Trivy, etc.)
- Traducao da interface para outros idiomas
- Templates customizados para Nuclei
- Melhorias na visualizacao de relatorios

Abra uma issue antes de comecar mudancas grandes, para alinharmos a direcao.

---

## 👤 Autor

**Thiago Santana**
- 📧 [thiagosantana888@gmail.com](mailto:thiagosantana888@gmail.com)
- 🌐 [github.com/THIAGUINHO-T](https://github.com/THIAGUINHO-T)

---

## ⚖️ Aviso Legal

Esta ferramenta foi desenvolvida para fins **educacionais** e **auditoria autorizada**. O uso em sistemas sem autorizacao previa e ilegal e e crime na maioria das jurisdicoes. O autor nao se responsabiliza por qualquer uso indevido deste software.

---

© 2026 Thiago Santana. Licenca [MIT](LICENSE).
