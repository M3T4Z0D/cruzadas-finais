/**
 * ELO Rating System Engine for Players and Crossword Words (Frontend Client Version).
 */

export function getExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function updateRatings(playerRating, wordRating, actualScore, KPlayer = 32, KWord = 16) {
  const expectedPlayer = getExpectedScore(playerRating, wordRating);
  const expectedWord = 1 - expectedPlayer;

  const actualWordScore = 1.0 - actualScore;

  const newPlayerRating = Math.round(playerRating + KPlayer * (actualScore - expectedPlayer));
  const newWordRating = Math.round(wordRating + KWord * (actualWordScore - expectedWord));

  return {
    newPlayerRating: Math.max(100, newPlayerRating),
    newWordRating: Math.max(100, newWordRating),
  };
}

export function calculateInitialWordElo(word, clue) {
  const cleanWord = word.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let score = 1200; // Base Elo

  score += cleanWord.length * 15;

  const rareLetters = ["X", "Z", "W", "Y", "K"];
  const mediumLetters = ["J", "Q", "H", "G", "F", "V"];

  for (const letter of cleanWord) {
    if (rareLetters.includes(letter)) {
      score += 45;
    } else if (mediumLetters.includes(letter)) {
      score += 20;
    }
  }

  const wordCount = clue.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) {
    score += 40;
  } else if (wordCount >= 6) {
    score -= 30;
  }

  return Math.round(score);
}
