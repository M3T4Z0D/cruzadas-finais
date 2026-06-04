# 🧩 Cruzadas Diretas Ranqueadas

Uma plataforma moderna e dinâmica de **Cruzadas Diretas** cooperativas em tempo real, com sistema inteligente de calibração de dificuldade por ELO para palavras e jogadores, suporte a bots cooperativos e três temas visuais premium (Claro, Escuro e Jornal).

---

## 🚀 Funcionalidades Principais

* **Sistema de ELO Dinâmico**: O backend avalia as palavras cadastradas e calibra a dificuldade delas (ELO) com base na taxa de acerto dos jogadores. Da mesma forma, o ELO dos jogadores sobe ou desce dinamicamente após a conclusão das partidas ranqueadas.
* **Cooperação em Tempo Real**: Suporte para salas multiplayer via Socket.io com visualização de cursores em tempo real (estilo Figma) e preenchimento compartilhado das células.
* **Validação Segura (Anti-Cheat)**: A validação das respostas é processada inteiramente no servidor. O cliente nunca recebe as palavras e respostas completas no código-fonte, prevenindo trapaças por inspeção de código (DevTools).
* **Três Temas Visuais Exclusivos**:
  * ☀️ **Modo Claro (Pastel)**: Cores suaves e balanceadas em HSL (Frosted Blue, Celadon, Lavender Veil, Granite e Dusty Grape).
  * 🌙 **Modo Escuro (Neon)**: Estética premium com brilhos neon de alta visibilidade e excelente legibilidade.
  * 📰 **Modo Jornal (Retro/Paper)**: Visual clássico com bordas marcadas à tinta, fonte Serifada (*Georgia/Playfair*) e fundo texturizado imitando papel de jornal antigo.
* **Dicas Diretas Integradas**: As dicas ficam alocadas exatamente no início de cada palavra (à esquerda para horizontais e acima para verticais), com exibição de popups inteligentes (*tooltips*) ao passar o mouse.
* **Bot Simulador de Cooperação**: Permite testar a mecânica cooperativa mesmo jogando offline ou sozinho.

---

## 🛠️ Tecnologias Utilizadas

### Frontend
* **React** (com Vite e Javascript)
* **CSS Vanilla** (Variáveis nativas para temas dinâmicos)
* **Socket.io-Client** (Comunicação em tempo real)
* **Lucide React** (Ícones modernos)

### Backend
* **Node.js** com **Express**
* **Socket.io** (Gerenciamento de conexões e sincronização de salas)
* **TypeScript** (Segurança e tipagem estática)

---

## 📂 Estrutura do Projeto

```text
cruzadas-finais/
├── backend/                  # Servidor Express, WebSockets e lógica de ELO
│   ├── src/
│   │   ├── elo.ts            # Cálculo matemático de ELO de palavras/jogadores
│   │   ├── generator.ts      # Gerador algorítmico do grid de cruzadas
│   │   ├── session.ts        # Gerenciamento das salas cooperativas
│   │   └── index.ts          # Inicialização do servidor
│   └── package.json
│
├── frontend/                 # Interface React + Vite
│   ├── src/
│   │   ├── assets/           # Imagens e vetores
│   │   ├── engine/           # Cópia local do gerador/ELO para modo offline
│   │   ├── App.jsx           # Componente principal do Dashboard e Grid
│   │   ├── App.css           # Estilizações globais dos componentes
│   │   └── index.css         # Configuração dos três temas e variáveis CSS
│   └── package.json
│
└── docs/                     # Documentações do projeto (salvos para portabilidade)
    ├── system_architecture.md # Detalhes da arquitetura de dados e backend
    ├── implementation_plan.md # Nosso plano de implementação
    ├── task.md                # Checklists de desenvolvimento e pendências
    └── walkthrough.md         # Histórico de alterações e testes realizados
```

---

## 💻 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
Certifique-se de ter o [Node.js](https://nodejs.org/) instalado na sua máquina.

### 2. Rodando o Servidor (Backend)
1. Navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   *O backend rodará por padrão na porta `http://localhost:5000`.*

### 3. Rodando o Aplicativo (Frontend)
1. Abra um novo terminal e navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor do Vite:
   ```bash
   npm run dev
   ```
   *O frontend rodará por padrão na porta `http://localhost:5173`.*

---

## 📚 Documentação Adicional
Para mais detalhes sobre as regras de negócio, o funcionamento matemático do ELO ou para entender o roadmap do projeto, consulte a pasta [docs/](file:///c:/Users/dsf/Documents/cruzadas-finais/docs):
* **[Arquitetura do Sistema](file:///c:/Users/dsf/Documents/cruzadas-finais/docs/system_architecture.md)**
* **[Plano de Implementação](file:///c:/Users/dsf/Documents/cruzadas-finais/docs/implementation_plan.md)**
* **[Histórico de Alterações](file:///c:/Users/dsf/Documents/cruzadas-finais/docs/walkthrough.md)**
