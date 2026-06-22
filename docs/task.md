# Checklist de Tarefas: Painel de Administração de Palavras

## Tarefas de Desenvolvimento

- [x] **Backend: Estrutura & Normalização**
  - [x] Implementar a função `normalizeWord` e atualizar a interface `WordInfo` em `dictionary.ts`
  - [x] Atualizar o banco de dados inicial (seeded words) para a nova estrutura (displayWord e clues array) em `dictionary.ts`
  - [x] Atualizar funções auxiliares de ELO em `dictionary.ts`

- [x] **Backend: Ajustes no Jogo**
  - [x] Modificar o gerador de tabuleiros (`generator.ts`) para sortear uma pista da lista de pistas (`clues`)

- [x] **Backend: Endpoints de API (CRUD)**
  - [x] Criar endpoint `GET /api/words`
  - [x] Criar endpoint `POST /api/words` (com auto-normalização)
  - [x] Criar endpoint `PUT /api/words/:id` (com atualização e re-normalização)
  - [x] Criar endpoint `DELETE /api/words/:id`

- [x] **Frontend: Interface e CSS**
  - [x] Criar aba "Painel Admin" e a interface de gerenciamento em `App.jsx`
  - [x] Criar o modal de Adicionar/Editar palavra com inputs dinâmicos de dicas e preview de normalização
  - [x] Adicionar os cards de estatísticas (total de palavras, média de dicas, contadores de Elo)
  - [x] Implementar estilos em `App.css` para a tabela, formulários, métricas e modais
  - [x] Garantir compatibilidade nos 3 temas (Claro, Escuro e Jornal)

- [x] **Verificação de Funcionamento**
  - [x] Validar cadastro de palavra acentuada ("Café" -> "CAFE") com múltiplas dicas
  - [x] Validar edição e remoção de palavras e pistas
  - [x] Garantir que o preenchimento do grid ranqueado consome dicas do banco aleatoriamente e funciona perfeitamente
