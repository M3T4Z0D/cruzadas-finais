import { calculateInitialWordElo } from "./elo";

export function normalizeWord(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
}

const rawSeededWords = [
  // EASY WORDS (approx. 900 - 1100 Elo)
  { id: "w1", displayWord: "Amor", clues: ["Sentimento de grande afeto"], elo: 950 },
  { id: "w2", displayWord: "Casa", clues: ["Local de moradia humana"], elo: 960 },
  { id: "w3", displayWord: "Gato", clues: ["Felino doméstico que mia"], elo: 980 },
  { id: "w4", displayWord: "Sol", clues: ["Estrela central do nosso sistema", "Astro-rei do sistema solar"], elo: 920 },
  { id: "w5", displayWord: "Bola", clues: ["Objeto esférico usado em jogos"], elo: 940 },
  { id: "w6", displayWord: "Mesa", clues: ["Móvel plano apoiado sobre pés"], elo: 970 },
  { id: "w7", displayWord: "Água", clues: ["Líquido essencial para a vida"], elo: 990 },
  { id: "w8", displayWord: "Brasil", clues: ["O maior país da América do Sul"], elo: 1020 },
  { id: "w9", displayWord: "Livro", clues: ["Conjunto de folhas escritas e encadernadas"], elo: 1050 },
  { id: "w10", displayWord: "Janela", clues: ["Abertura na parede para entrada de luz"], elo: 1080 },

  // MEDIUM WORDS (approx. 1100 - 1350 Elo)
  { id: "w11", displayWord: "Banana", clues: ["Fruta amarela e alongada"], elo: 1120 },
  { id: "w12", displayWord: "Futebol", clues: ["Esporte mais popular do Brasil"], elo: 1140 },
  { id: "w13", displayWord: "Oxigênio", clues: ["Gás essencial para a nossa respiração"], elo: 1220 },
  { id: "w14", displayWord: "Curioso", clues: ["Aquele que tem desejo de saber"], elo: 1180 },
  { id: "w15", displayWord: "Espinha", clues: ["Estrutura óssea dorsal ou pequena lesão na pele"], elo: 1250 },
  { id: "w16", displayWord: "Guitarra", clues: ["Instrumento musical de cordas com braço"], elo: 1280 },
  { id: "w17", displayWord: "Cérebro", clues: ["Órgão do pensamento e sistema nervoso"], elo: 1300 },
  { id: "w18", displayWord: "Química", clues: ["Ciência que estuda a matéria e suas reações"], elo: 1320 },
  { id: "w19", displayWord: "Floresta", clues: ["Grande área coberta por árvores"], elo: 1160 },
  { id: "w20", displayWord: "Viagem", clues: ["Ato de deslocar-se de um lugar para outro"], elo: 1190 },

  // HARD WORDS (approx. 1350 - 1650 Elo)
  { id: "w21", displayWord: "Xilofone", clues: ["Instrumento musical de percussão com lâminas"], elo: 1450 },
  { id: "w22", displayWord: "Quimera", clues: ["Ilusão, utopia ou monstro mitológico"], elo: 1480 },
  { id: "w23", displayWord: "Alquimia", clues: ["Química da Antiguidade voltada à transmutação"], elo: 1410 },
  { id: "w24", displayWord: "Anacronismo", clues: ["Erro de cronologia; atribuição de época incorreta"], elo: 1580 },
  { id: "w25", displayWord: "Hedonista", clues: ["Pessoa dedicada à busca pelo prazer próprio"], elo: 1530 },
  { id: "w26", displayWord: "Efêmero", clues: ["Que tem curtíssima duração; passageiro"], elo: 1490 },
  { id: "w27", displayWord: "Sinestesia", clues: ["Cruzamento de diferentes sentidos sensoriais"], elo: 1550 },
  { id: "w28", displayWord: "Idiossincrasia", clues: ["Característica ou comportamento peculiar de alguém"], elo: 1650 },
  { id: "w29", displayWord: "Pragmático", clues: ["Prático, objetivo, focado em resultados"], elo: 1380 },
  { id: "w30", displayWord: "Sarcófago", clues: ["Urna ou sepulcro antigo de pedra"], elo: 1420 },

  // ADDITIONAL INTERSECTION SUPPORTING WORDS
  { id: "w31", displayWord: "Ar", clues: ["Mistura de gases da atmosfera"], elo: 880 },
  { id: "w32", displayWord: "Solo", clues: ["Superfície da Terra onde pisamos"], elo: 930 },
  { id: "w33", displayWord: "Rato", clues: ["Roedor pequeno e ágil"], elo: 945 },
  { id: "w34", displayWord: "Bolo", clues: ["Doce assado feito de massa"], elo: 910 },
  { id: "w35", displayWord: "Lua", clues: ["Satélite natural da Terra"], elo: 890 },
  { id: "w36", displayWord: "Bota", clues: ["Calçado resistente que cobre o tornozelo"], elo: 935 },
  { id: "w37", displayWord: "Zero", clues: ["Algarismo correspondente à ausência de quantidade"], elo: 1040 },
  { id: "w38", displayWord: "Zinco", clues: ["Elemento químico metálico de símbolo Zn"], elo: 1210 },
  { id: "w39", displayWord: "Sabor", clues: ["Sensação percebida pelo paladar"], elo: 1010 },
  { id: "w40", displayWord: "Alfa", clues: ["Primeira letra do alfabeto grego"], elo: 1090 },
  { id: "w41", displayWord: "Ritmo", clues: ["Cadência regulada do som no tempo"], elo: 1100 },
  { id: "w42", displayWord: "Corpo", clues: ["Estrutura física material de um ser"], elo: 1050 },
  { id: "w43", displayWord: "Valor", clues: ["Grau de utilidade ou preço de algo"], elo: 1020 },
  { id: "w44", displayWord: "Sagaz", clues: ["Pessoa astuta, perspicaz e esperta"], elo: 1350 },
  { id: "w45", displayWord: "Nuvem", clues: ["Massa visível de vapor de água flutuante"], elo: 980 }
];

export let wordsDatabase = rawSeededWords.map(w => ({
  id: w.id,
  displayWord: w.displayWord,
  word: normalizeWord(w.displayWord),
  clues: w.clues,
  elo: w.elo,
  attempts: 0,
  solves: 0
}));

export function recordWordAttempt(wordId, success, newElo) {
  const word = wordsDatabase.find(w => w.id === wordId);
  if (word) {
    word.attempts += 1;
    if (success) {
      word.solves += 1;
    }
    word.elo = newElo;
  }
}

