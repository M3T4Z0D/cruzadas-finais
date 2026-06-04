/**
 * ELO Rating System Engine for Players and Crossword Words.
 */

/**
 * Calculates the expected score for an entity A compared to entity B.
 * @param ratingA The Elo rating of entity A (e.g., Player)
 * @param ratingB The Elo rating of entity B (e.g., Word)
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Updates the ratings of both the player and the word after a solve attempt.
 * @param playerRating Current rating of the player
 * @param wordRating Current rating of the word
 * @param actualScore Score of the player: 1.0 (solve without hints), 0.5 (solve with clues), 0.0 (fail/skip)
 * @param KPlayer Scaling factor for player update (default: 32, or 40 for new players)
 * @param KWord Scaling factor for word update (default: 16)
 */
export function updateRatings(
  playerRating: number,
  wordRating: number,
  actualScore: number,
  KPlayer: number = 32,
  KWord: number = 16
): { newPlayerRating: number; newWordRating: number } {
  const expectedPlayer = getExpectedScore(playerRating, wordRating);
  const expectedWord = 1 - expectedPlayer;

  const actualWordScore = 1.0 - actualScore;

  // Calculate new ratings
  const newPlayerRating = Math.round(playerRating + KPlayer * (actualScore - expectedPlayer));
  const newWordRating = Math.round(wordRating + KWord * (actualWordScore - expectedWord));

  // Ensure ratings don't drop below a reasonable minimum (e.g., 100)
  return {
    newPlayerRating: Math.max(100, newPlayerRating),
    newWordRating: Math.max(100, newWordRating),
  };
}

/**
 * Estimates an initial ELO rating for a word based on structural and linguistic features in Portuguese.
 * @param word The target word (e.g., "BRASILIA")
 * @param clue The clue text (e.g., "Capital do país")
 */
export function calculateInitialWordElo(word: string, clue: string): number {
  const cleanWord = word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let score = 1200; // Base Elo

  // 1. Length Factor: Longer words tend to be harder to guess, but provide more intersection helper letters.
  // We'll add a moderate penalty for longer words.
  score += cleanWord.length * 15;

  // 2. Letter Rarity Factor: Letters like X, Z, W, Y, K are rare in Portuguese and make crossing harder.
  const rareLetters = ["X", "Z", "W", "Y", "K"];
  const mediumLetters = ["J", "Q", "H", "G", "F", "V"];

  for (const letter of cleanWord) {
    if (rareLetters.includes(letter)) {
      score += 45;
    } else if (mediumLetters.includes(letter)) {
      score += 20;
    }
  }

  // 3. Clue Complexity Factor:
  // - Very short clues (1-2 words) are often abstract/synonyms (harder).
  // - Longer clues (5+ words) provide more context (easier).
  const wordCount = clue.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) {
    score += 40;
  } else if (wordCount >= 6) {
    score -= 30;
  }

  return Math.round(score);
}
