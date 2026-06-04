import { calculateInitialWordElo } from "./elo";

export interface WordInfo {
  id: string;
  word: string;
  clue: string;
  elo: number;
  attempts: number;
  solves: number;
}

// In-memory words database (pre-seeded with calculated starting ELOs)
export let wordsDatabase: WordInfo[] = [
  // EASY WORDS (approx. 900 - 1100 Elo)
  { id: "w1", word: "AMOR", clue: "Sentimento de grande afeto", elo: 950, attempts: 0, solves: 0 },
  { id: "w2", word: "CASA", clue: "Local de moradia humana", elo: 960, attempts: 0, solves: 0 },
  { id: "w3", word: "GATO", clue: "Felino doméstico que mia", elo: 980, attempts: 0, solves: 0 },
  { id: "w4", word: "SOL", clue: "Estrela central do nosso sistema", elo: 920, attempts: 0, solves: 0 },
  { id: "w5", word: "BOLA", clue: "Objeto esférico usado em jogos", elo: 940, attempts: 0, solves: 0 },
  { id: "w6", word: "MESA", clue: "Móvel plano apoiado sobre pés", elo: 970, attempts: 0, solves: 0 },
  { id: "w7", word: "AGUA", clue: "Líquido essencial para a vida", elo: 990, attempts: 0, solves: 0 },
  { id: "w8", word: "BRASIL", clue: "O maior país da América do Sul", elo: 1020, attempts: 0, solves: 0 },
  { id: "w9", word: "LIVRO", clue: "Conjunto de folhas escritas e encadernadas", elo: 1050, attempts: 0, solves: 0 },
  { id: "w10", word: "JANELA", clue: "Abertura na parede para entrada de luz", elo: 1080, attempts: 0, solves: 0 },

  // MEDIUM WORDS (approx. 1100 - 1350 Elo)
  { id: "w11", word: "BANANA", clue: "Fruta amarela e alongada", elo: 1120, attempts: 0, solves: 0 },
  { id: "w12", word: "FUTEBOL", clue: "Esporte mais popular do Brasil", elo: 1140, attempts: 0, solves: 0 },
  { id: "w13", word: "OXIGENIO", clue: "Gás essencial para a nossa respiração", elo: 1220, attempts: 0, solves: 0 },
  { id: "w14", word: "CURIOSO", clue: "Aquele que tem desejo de saber", elo: 1180, attempts: 0, solves: 0 },
  { id: "w15", word: "ESPINHA", clue: "Estrutura óssea dorsal ou pequena lesão na pele", elo: 1250, attempts: 0, solves: 0 },
  { id: "w16", word: "GUITARRA", clue: "Instrumento musical de cordas com braço", elo: 1280, attempts: 0, solves: 0 },
  { id: "w17", word: "CEREBRO", clue: "Órgão do pensamento e sistema nervoso", elo: 1300, attempts: 0, solves: 0 },
  { id: "w18", word: "QUIMICA", clue: "Ciência que estuda a matéria e suas reações", elo: 1320, attempts: 0, solves: 0 },
  { id: "w19", word: "FLORESTA", clue: "Grande área coberta por árvores", elo: 1160, attempts: 0, solves: 0 },
  { id: "w20", word: "VIAGEM", clue: "Ato de deslocar-se de um lugar para outro", elo: 1190, attempts: 0, solves: 0 },

  // HARD WORDS (approx. 1350 - 1650 Elo)
  { id: "w21", word: "XILOFONE", clue: "Instrumento musical de percussão com lâminas", elo: 1450, attempts: 0, solves: 0 },
  { id: "w22", word: "QUIMERA", clue: "Ilusão, utopia ou monstro mitológico", elo: 1480, attempts: 0, solves: 0 },
  { id: "w23", word: "ALQUIMIA", clue: "Química da Antiguidade voltada à transmutação", elo: 1410, attempts: 0, solves: 0 },
  { id: "w24", word: "ANACRONISMO", clue: "Erro de cronologia; atribuição de época incorreta", elo: 1580, attempts: 0, solves: 0 },
  { id: "w25", word: "HEDONISTA", clue: "Pessoa dedicada à busca pelo prazer próprio", elo: 1530, attempts: 0, solves: 0 },
  { id: "w26", word: "EFEMERO", clue: "Que tem curtíssima duração; passageiro", elo: 1490, attempts: 0, solves: 0 },
  { id: "w27", word: "SINESTESIA", clue: "Cruzamento de diferentes sentidos sensoriais", elo: 1550, attempts: 0, solves: 0 },
  { id: "w28", word: "IDIOSSINCRASIA", clue: "Característica ou comportamento peculiar de alguém", elo: 1650, attempts: 0, solves: 0 },
  { id: "w29", word: "PRAGMATICO", clue: "Prático, objetivo, focado em resultados", elo: 1380, attempts: 0, solves: 0 },
  { id: "w30", word: "SARCOFAGO", clue: "Urna ou sepulcro antigo de pedra", elo: 1420, attempts: 0, solves: 0 },

  // ADDITIONAL INTERSECTION SUPPORTING WORDS
  { id: "w31", word: "AR", clue: "Mistura de gases da atmosfera", elo: 880, attempts: 0, solves: 0 },
  { id: "w32", word: "SOLO", clue: "Superfície da Terra onde pisamos", elo: 930, attempts: 0, solves: 0 },
  { id: "w33", word: "RATO", clue: "Roedor pequeno e ágil", elo: 945, attempts: 0, solves: 0 },
  { id: "w34", word: "BOLO", clue: "Doce assado feito de massa", elo: 910, attempts: 0, solves: 0 },
  { id: "w35", word: "LUA", clue: "Satélite natural da Terra", elo: 890, attempts: 0, solves: 0 },
  { id: "w36", word: "BOTA", clue: "Calçado resistente que cobre o tornozelo", elo: 935, attempts: 0, solves: 0 },
  { id: "w37", word: "ZERO", clue: "Algarismo correspondente à ausência de quantidade", elo: 1040, attempts: 0, solves: 0 },
  { id: "w38", word: "ZINCO", clue: "Elemento químico metálico de símbolo Zn", elo: 1210, attempts: 0, solves: 0 },
  { id: "w39", word: "SABOR", clue: "Sensação percebida pelo paladar", elo: 1010, attempts: 0, solves: 0 },
  { id: "w40", word: "ALFA", clue: "Primeira letra do alfabeto grego", elo: 1090, attempts: 0, solves: 0 },
  { id: "w41", word: "RITMO", clue: "Cadência regulada do som no tempo", elo: 1100, attempts: 0, solves: 0 },
  { id: "w42", word: "CORPO", clue: "Estrutura física material de um ser", elo: 1050, attempts: 0, solves: 0 },
  { id: "w43", word: "VALOR", clue: "Grau de utilidade ou preço de algo", elo: 1020, attempts: 0, solves: 0 },
  { id: "w44", word: "SAGAZ", clue: "Pessoa astuta, perspicaz e esperta", elo: 1350, attempts: 0, solves: 0 },
  { id: "w45", word: "NUVEM", clue: "Massa visível de vapor de água flutuante", elo: 980, attempts: 0, solves: 0 }
];

// Initialize remaining base ELO ratings if any words were seeded without ELO
export function initializeMissingElos(): void {
  wordsDatabase = wordsDatabase.map(w => {
    if (!w.elo) {
      w.elo = calculateInitialWordElo(w.word, w.clue);
    }
    return w;
  });
}

/**
 * Gets a subset of words within a target Elo range.
 */
export function getWordsInRatingRange(targetElo: number, range: number): WordInfo[] {
  return wordsDatabase.filter(
    w => Math.abs(w.elo - targetElo) <= range
  );
}

/**
 * Updates a word's statistics in memory.
 */
export function recordWordAttempt(wordId: string, success: boolean, newElo: number): void {
  const word = wordsDatabase.find(w => w.id === wordId);
  if (word) {
    word.attempts += 1;
    if (success) {
      word.solves += 1;
    }
    word.elo = newElo;
  }
}
