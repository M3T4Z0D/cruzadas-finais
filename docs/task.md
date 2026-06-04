# Lista de Tarefas - Desenvolvimento de Cruzadas Diretas Ranqueadas

Abaixo está o cronograma de implementação física do projeto, dividido de forma incremental e lógica para garantir alta qualidade.

## Fase 1: Inicialização do Workspace e Infraestrutura
- [x] Criar estrutura de diretórios (`backend/` e `frontend/`)
- [x] Inicializar e configurar o Backend (Node.js, TypeScript, Express, Socket.io, Prisma)
- [x] Inicializar e configurar o Frontend (Vite, React, CSS Premium)

## Fase 2: Regras de Negócio no Backend (Engine de Jogo e Elo)
- [x] Implementar a fórmula matemática de ajuste de Elo dinâmico para Jogadores e Palavras
- [x] Cadastrar dicionário padrão de palavras com pesos linguísticos e Elo base inicial
- [x] Cadastrar templates de matrizes geométricas vazias (matrizes de 0s e 1s com direções)
- [x] Criar a API do Gerador Dinâmico de Grids (busca palavras de Elo compatível e preenche as slots com backtracking)
- [x] Criar a API de Validação Segura de Respostas (valida letras no backend e retorna acerto/erro)

## Fase 3: Frontend Interativo & Design Premium (React & CSS)
- [x] Configurar o sistema global de estilização CSS (Tema dark de alto contraste, Glassmorphism e paleta neon)
- [x] Desenvolver a tela de Dashboard do Jogador (visualização do Elo, liga atual e estatísticas)
- [x] Criar o componente do Grid Interativo de Cruzadas Diretas (células de letras, caixas de dica de 0, setas indicadoras)
- [x] Implementar a navegação de digitação fluida pelo teclado (avanço automático, retrocesso)

## Fase 4: Multiplayer Cooperativo em Tempo Real (WebSockets)
- [x] Estabelecer conexão WebSocket persistente entre Frontend e Backend usando Socket.io
- [x] Implementar mecânica de Criação e Entrada de Salas de grupo
- [x] Sincronizar em tempo real a digitação de letras na sala cooperativa
- [x] Desenvolver cursores compartilhados em tempo real (estilo Figma) com cores e nomes flutuantes dos amigos

## Fase 5: Integração, Polimento e Testes
- [x] Integrar fluxo de simulação de login/registro (Google OAuth mock/Supabase Auth)
- [x] Realizar polimento visual fino (animações de acerto, efeitos de confete ao concluir tabuleiros)
- [x] Executar bateria de verificação local de ponta a ponta
