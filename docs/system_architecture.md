# Documentação de Arquitetura do Sistema - Cruzadas Diretas Ranqueadas

Esta documentação detalha a engenharia, modelagem de dados e arquitetura de fluxos para o **Sistema de Cruzadas Diretas Ranqueadas**. Ela foi estruturada como uma referência técnica antes do início do desenvolvimento.

---

## 1. Atores do Sistema

Identificamos os seguintes atores que interagem com o sistema:

| Ator | Tipo | Descrição |
| :--- | :--- | :--- |
| **Jogador (Player)** | Humano / Externo | Usuário final que realiza login, joga nos modos casual e ranqueado, e cria ou participa de salas cooperativas. |
| **Administrador (Admin)** | Humano / Externo | Usuário com privilégios para cadastrar novas palavras, gerenciar templates de grids e moderar o banco de dados. |
| **Engine de Matchmaking/Elo** | Sistema / Interno | Subsistema automatizado responsável por parear jogadores em salas e calcular os reajustes de Elo após os jogos. |
| **Serviço de Autenticação (Google/Supabase)** | Sistema / Externo | Provedor externo responsável por validar as credenciais de login e fornecer o token seguro (JWT). |

---

## 2. Diagrama de Casos de Uso (UML Use Case)

Este diagrama demonstra os principais casos de uso do sistema divididos por atores.

```mermaid
graph TD
    %% Atores
    Player["Jogador (Player)"]
    Admin["Administrador"]
    System["Engine de Elo"]
    
    %% Casos de Uso do Jogador
    UC_Login["UC01: Fazer Login (Google/Email)"]
    UC_PlayCasual["UC02: Jogar Modo Casual"]
    UC_PlayRanked["UC03: Jogar Modo Ranqueado"]
    UC_CreateGroup["UC04: Criar Sala de Grupo (Co-op)"]
    UC_JoinGroup["UC05: Entrar em Sala de Grupo"]
    UC_ViewLeaderboard["UC06: Visualizar Leaderboard"]
    UC_RequestHint["UC07: Solicitar Dica"]
    
    %% Casos de Uso do Admin
    UC_ManageWords["UC08: Gerenciar Banco de Palavras"]
    UC_ManageTemplates["UC09: Cadastrar Templates de Grid"]
    
    %% Casos de Uso do Sistema
    UC_CalcElo["UC10: Recalcular Elo (Jogador/Palavra)"]

    %% Relações do Jogador
    Player --> UC_Login
    Player --> UC_PlayCasual
    Player --> UC_PlayRanked
    Player --> UC_CreateGroup
    Player --> UC_JoinGroup
    Player --> UC_ViewLeaderboard
    Player --> UC_RequestHint

    %% Relações do Admin
    Admin --> UC_ManageWords
    Admin --> UC_ManageTemplates

    %% Relações do Sistema
    UC_PlayRanked --> UC_CalcElo
    UC_CalcElo --> System
```

---

## 3. Diagrama de Classes UML (Modelagem de Domínio)

Este diagrama representa a estrutura de classes do sistema e seus relacionamentos no backend.

```mermaid
classDiagram
    class User {
        +int id
        +string email
        +string username
        +float elo
        +string rankTier
        +DateTime createdAt
        +login()
        +updateElo(float newElo)
    }

    class Word {
        +int id
        +string word
        +string clue
        +float elo
        +int attempts
        +int solves
        +calculateInitialElo()
        +adjustElo(float score, float expected)
    }

    class GridTemplate {
        +int id
        +int rows
        +int cols
        +string matrixLayout
        +int slotsCount
    }

    class GameSession {
        +string id
        +string mode
        +string status
        +float averageElo
        +DateTime startTime
        +validateAnswer(int clueId, string attempt)
    }

    class MultiplayerSession {
        +string roomCode
        +List~User~ connectedPlayers
        +broadcastState()
    }

    class SolveHistory {
        +int id
        +int userId
        +int wordId
        +float score
        +int durationSeconds
        +DateTime solvedAt
    }

    User "1" --* "many" SolveHistory : "possui"
    Word "1" --* "many" SolveHistory : "participa de"
    GameSession "1" --* "1" GridTemplate : "usa"
    GameSession "1" --* "many" Word : "contém"
    GameSession <|-- MultiplayerSession : "estende"
```

---

## 4. Diagrama de Sequência (UML Sequence)

Este diagrama de sequência demonstra a interação em tempo real de uma **sessão cooperativa em grupo**, onde o Jogador A digita uma letra em uma célula e ela é replicada para o Jogador B.

```mermaid
sequenceDiagram
    autonumber
    participant PlayerA as Jogador A (Frontend)
    participant Server as Servidor Node.js (Socket.io)
    participant PlayerB as Jogador B (Frontend)
    participant DB as Banco de Dados

    PlayerA->>Server: Envia evento: "cell_type" (Célula x:y, Letra 'A')
    Server->>Server: Valida se a sessão em grupo está ativa
    Server->>PlayerB: Emite transmissão: "cell_updated" (Jogador A, Letra 'A')
    PlayerB->>PlayerB: Atualiza o grid na tela e renderiza o cursor colorido de A

    Note over PlayerA, PlayerB: Jogador A digita a última letra e completa a palavra
    PlayerA->>Server: Envia evento: "submit_word" (PalavraId, Tentativa 'BRASILIA')
    Server->>DB: Consulta a resposta correta no Banco de Dados
    DB-->>Server: Retorna resposta gabaritada
    Server->>Server: Valida e marca como CORRETA
    Server->>PlayerA: Emite: "word_status" (Sucesso, Revela cor verde)
    Server->>PlayerB: Emite: "word_status" (Sucesso, Revela cor verde)
```

---

## 5. Diagrama de Entidade-Relacionamento (DER)

Abaixo está o modelo relacional de banco de dados (PostgreSQL) otimizado para lidar com autenticação, histórico de jogos e o dicionário de palavras calibradas por Elo.

```mermaid
erDiagram
    USERS {
        serial id PK
        varchar email UK
        varchar username
        float elo
        varchar rank_tier
        timestamp created_at
    }

    WORDS {
        serial id PK
        varchar word
        text clue
        float elo
        int total_attempts
        int total_solves
        timestamp last_updated
    }

    GRID_TEMPLATES {
        serial id PK
        int rows
        int cols
        text matrix_json
        timestamp created_at
    }

    CASUAL_BOARDS {
        serial id PK
        varchar title
        int grid_template_id FK
        text predefined_answers_json
        varchar difficulty
    }

    SOLVE_HISTORY {
        serial id PK
        int user_id FK
        int word_id FK
        float score
        int duration_seconds
        timestamp solved_at
    }

    ROOMS {
        varchar code PK
        varchar status
        int host_id FK
        timestamp created_at
    }

    ROOM_PLAYERS {
        int room_id FK
        int user_id FK
        timestamp joined_at
    }

    USERS ||--o{ SOLVE_HISTORY : "registra"
    WORDS ||--o{ SOLVE_HISTORY : "participa de"
    GRID_TEMPLATES ||--o{ CASUAL_BOARDS : "estrutura"
    USERS ||--o{ ROOMS : "hospeda"
    ROOMS ||--o{ ROOM_PLAYERS : "contém"
    USERS ||--o{ ROOM_PLAYERS : "participa"
```

---

## 6. Validação de Regras de Negócio e Casos de Borda

### A. Validação de Elo (Prevenção de Inflação)
* **K-Factor Variável:** Jogadores novos iniciam com $K = 40$ para rápida calibração. Jogadores estáveis (com mais de 50 partidas) reduzem para $K = 20$. Palavras mantêm $K = 16$ fixo para evitar flutuações agressivas causadas por um único usuário fora da média.
* **Glicko-2 (Alternativa Futura):** Se houver muita inatividade de certos jogadores, o sistema pode adotar o fator de incerteza do Glicko-2 para evitar perdas/ganhos injustos.

### B. Tratamento de Desconexões no Multiplayer
* Se um jogador cair da sala no meio da resolução cooperativa, o progresso do grid não é perdido (permanece em cache no servidor Node.js/Redis ou banco de dados temporário).
* Ao reconectar usando o mesmo token de autenticação, o servidor envia o estado consolidado da sala atualizado.
