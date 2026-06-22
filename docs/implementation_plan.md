# Plano de Implementação: Painel de Administração de Palavras

Este plano propõe a criação de um **Painel de Administração** para o gerenciamento de palavras e dicas. A estrutura de dados de palavras será expandida para suportar normalização automática de acentuação e múltiplas dicas por palavra.

---

## Modificações Propostas

### 1. Backend: Modelo de Dados e Normalização
#### [MODIFY] [dictionary.ts](file:///c:/Users/dsf/Documents/cruzadas-finais/backend/src/dictionary.ts)
* Modificar a interface `WordInfo` para incluir:
  * `displayWord: string`: Palavra correta com acentuação e capitalização original (ex: "Brasília").
  * `word: string`: Palavra normalizada (uppercase, sem acentos, apenas letras A-Z, ex: "BRASILIA").
  * `clues: string[]`: Array de strings para suportar múltiplas pistas para a mesma palavra (em vez de `clue: string`).
* Criar uma função utilitária `normalizeWord(str: string): string` para limpar caracteres acentuados usando normalização Unicode e expressões regulares.
* Atualizar a base de dados de semente (seeded words) para o novo formato, preenchendo o `displayWord` e convertendo a pista em um array de pistas `clues: [clue]`.
* Atualizar as funções utilitárias `initializeMissingElos` e `recordWordAttempt` para refletir as novas propriedades.

### 2. Backend: Ajuste no Gerador de Cruzadas
#### [MODIFY] [generator.ts](file:///c:/Users/dsf/Documents/cruzadas-finais/backend/src/generator.ts)
* Atualizar as funções de preenchimento (`generateBoardForElo` e `getFallbackBoard`) para selecionar aleatoriamente uma das pistas disponíveis na lista `clues` da palavra correspondente ao preencher o metadado `clueText` enviado ao frontend:
  ```typescript
  clueText: dictWord.clues[Math.floor(Math.random() * dictWord.clues.length)]
  ```

### 3. Backend: Rotas de API CRUD de Palavras
#### [MODIFY] [index.ts](file:///c:/Users/dsf/Documents/cruzadas-finais/backend/src/index.ts)
* Adicionar rotas REST na API Express para gerenciar as palavras:
  * **`GET /api/words`**: Retorna a lista completa de palavras.
  * **`POST /api/words`**: Cria uma nova palavra.
    * **Entrada**: `{ displayWord: string, clues: string[], elo?: number }`
    * **Lógica**: Normaliza o `displayWord` para gerar o `word`, valida tamanho e duplicatas, gera um `id` único (`w${Date.now()}`), calcula o Elo inicial se não informado, e insere no banco em memória.
  * **`PUT /api/words/:id`**: Atualiza uma palavra existente.
    * **Entrada**: `{ displayWord: string, clues: string[], elo?: number }`
    * **Lógica**: Atualiza o registro, re-normaliza se o `displayWord` mudou, e atualiza a lista de dicas.
  * **`DELETE /api/words/:id`**: Remove a palavra da base em memória.

### 4. Frontend: Compatibilidade e UI do Painel Admin
#### [MODIFY] [App.jsx](file:///c:/Users/dsf/Documents/cruzadas-finais/frontend/src/App.jsx)
* Criar um componente do **Painel de Admin** acessível através de uma aba no cabeçalho ("Painel Admin").
* **Funcionalidades do Painel Admin**:
  * **Métricas do Dicionário**: Cards mostrando total de palavras, palavras fáceis/médias/difíceis e média de dicas.
  * **Lista de Palavras**: Tabela estilizada contendo palavra acentuada, normalizada, ELO, número de dicas e ações de edição/exclusão. Inclui campo de busca e paginação.
  * **Formulário de Adicionar/Editar Palavra (Modal)**:
    * Campo para digitar a palavra acentuada (`displayWord`).
    * Preview da palavra normalizada (`word`) atualizada em tempo real conforme digitação.
    * Lista dinâmica de inputs de dicas, com botões para "Adicionar Dica" e "Remover Dica".
    * Validação para garantir que exista pelo menos 1 dica.
    * Campo de ELO (opcional, com cálculo de estimativa padrão).
  * **Exclusão com Confirmação**: Modal para confirmar a remoção da palavra.
* Atualizar o estado do jogo para usar a palavra acentuada (`displayWord`) na exibição após a palavra ser resolvida com sucesso no grid.

#### [MODIFY] [App.css](file:///c:/Users/dsf/Documents/cruzadas-finais/frontend/src/App.css)
* Adicionar estilizações premium para o painel de admin, incluindo tabelas estilizadas de acordo com o tema ativo, botões dinâmicos de ações, métricas em formato de grid, inputs flexíveis para múltiplas dicas e transições suaves de modais.

---

## Plano de Verificação

### Testes Manuais
1. **Normalização**: Cadastrar a palavra "Paralelogramo" com acentos ("Paralelógrafo") e garantir que o backend grave a versão normalizada como "PARALELOGRAFO" e a exibição como "Paralelógrafo".
2. **Múltiplas Dicas**: Cadastrar a palavra "SOL" com as dicas `["Estrela central", "Astro rei"]` e verificar que ambas as dicas estão salvas no painel admin.
3. **Validação do Grid**: Jogar uma partida e conferir que o grid seleciona uma das pistas da lista aleatoriamente, e que a validação do preenchimento continua funcionando com a palavra normalizada.
4. **CRUD Completo**: Adicionar, ler, editar e excluir uma palavra no painel de administração e verificar as mudanças refletidas em tempo real.
