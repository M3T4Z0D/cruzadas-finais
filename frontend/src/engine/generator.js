import { gridTemplates } from "./templates";
import { wordsDatabase } from "./dictionary";

function findIntersections(slots) {
  const intersections = [];

  for (let i = 0; i < slots.length; i++) {
    const slotA = slots[i];
    for (let j = i + 1; j < slots.length; j++) {
      const slotB = slots[j];

      if (slotA.direction === slotB.direction) continue;

      const horiz = slotA.direction === "horizontal" ? slotA : slotB;
      const vert = slotA.direction === "vertical" ? slotA : slotB;
      const horizIndex = slotA.direction === "horizontal" ? i : j;
      const vertIndex = slotA.direction === "vertical" ? i : j;

      const intersectRow = horiz.startRow;
      const intersectCol = vert.startCol;

      const isRowValid = intersectRow >= vert.startRow && intersectRow < vert.startRow + vert.length;
      const isColValid = intersectCol >= horiz.startCol && intersectCol < horiz.startCol + horiz.length;

      if (isRowValid && isColValid) {
        const charIndexHoriz = intersectCol - horiz.startCol;
        const charIndexVert = intersectRow - vert.startRow;

        intersections.push({
          slotAIndex: horizIndex,
          charIndexA: charIndexHoriz,
          slotBIndex: vertIndex,
          charIndexB: charIndexVert,
        });
      }
    }
  }

  return intersections;
}

export function generateBoardForElo(targetElo, preferredTemplateId) {
  let template = gridTemplates.find(t => t.id === preferredTemplateId);
  if (!template) {
    template = gridTemplates[Math.floor(Math.random() * gridTemplates.length)];
  }

  const slots = JSON.parse(JSON.stringify(template.slots));
  const intersections = findIntersections(slots);

  let eloTolerance = 150;
  let attempts = 0;
  let success = false;
  let assignments = new Array(slots.length).fill("");

  function solve(slotIndex, candidatesBySlot) {
    if (slotIndex === slots.length) {
      return true;
    }

    const candidates = candidatesBySlot[slotIndex];

    for (const candidate of candidates) {
      if (assignments.includes(candidate.word)) continue;

      let isValid = true;
      for (const inter of intersections) {
        if (inter.slotAIndex === slotIndex || inter.slotBIndex === slotIndex) {
          const otherIndex = inter.slotAIndex === slotIndex ? inter.slotBIndex : inter.slotAIndex;
          const ourCharIndex = inter.slotAIndex === slotIndex ? inter.charIndexA : inter.charIndexB;
          const otherCharIndex = inter.slotAIndex === slotIndex ? inter.charIndexB : inter.charIndexA;

          if (assignments[otherIndex] !== "") {
            const ourChar = candidate.word[ourCharIndex];
            const otherChar = assignments[otherIndex][otherCharIndex];

            if (ourChar !== otherChar) {
              isValid = false;
              break;
            }
          }
        }
      }

      if (isValid) {
        assignments[slotIndex] = candidate.word;
        if (solve(slotIndex + 1, candidatesBySlot)) {
          return true;
        }
        assignments[slotIndex] = "";
      }
    }

    return false;
  }

  let candidatesBySlot = [];
  while (!success && attempts < 5) {
    candidatesBySlot = slots.map(slot => {
      let matches = wordsDatabase.filter(
        w => w.word.length === slot.length && Math.abs(w.elo - targetElo) <= eloTolerance
      );

      if (matches.length === 0) {
        matches = wordsDatabase.filter(
          w => w.word.length === slot.length && Math.abs(w.elo - targetElo) <= eloTolerance + 200
        );
      }

      if (matches.length === 0) {
        matches = wordsDatabase.filter(w => w.word.length === slot.length);
      }

      return matches.sort(() => Math.random() - 0.5);
    });

    success = solve(0, candidatesBySlot);

    if (!success) {
      eloTolerance += 150;
      attempts++;
    }
  }

  if (!success) {
    return getFallbackBoard(template);
  }

  const cluesList = [];
  const solutionsMap = {};
  let totalElo = 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const assignedWord = assignments[i];
    const dictWord = wordsDatabase.find(w => w.word === assignedWord);

    totalElo += dictWord.elo;
    solutionsMap[slot.id] = assignedWord;

    cluesList.push({
      id: slot.id,
      clueText: dictWord.clue,
      direction: slot.direction,
      arrowDirection: slot.arrowDirection,
      clueRow: slot.clueRow,
      clueCol: slot.clueCol,
      startRow: slot.startRow,
      startCol: slot.startCol,
      length: slot.length,
    });
  }

  return {
    templateId: template.id,
    rows: template.rows,
    cols: template.cols,
    matrix: template.matrix,
    clues: cluesList,
    solutions: solutionsMap,
    averageElo: Math.round(totalElo / slots.length),
  };
}

function getFallbackBoard(template) {
  const fallbackSolutions = {
    template_7x7: {
      h1: "JANELA",
      h2: "BRASIL",
      h3: "FLAUTA",
      h4: "LIVROS",
      v1: "RITMO",
      v2: "SUJAR",
      v3: "LAVAS",
    },
    template_10x10: {
      h1: "ALQUIMIAS",
      h2: "OXIGENIOS",
      h3: "XILOFONES",
      h4: "ANACRONIS",
      v1: "GUITARRA",
      v2: "ESPINHAS",
      v3: "CURIOSOS",
    },
  };

  const selectedSolutions = fallbackSolutions[template.id] || fallbackSolutions["template_7x7"];
  const cluesList = template.slots.map(slot => {
    const word = selectedSolutions[slot.id];
    const dictWord = wordsDatabase.find(w => w.word === word) || { clue: "Palavra padrão do sistema", elo: 1200 };
    return {
      id: slot.id,
      clueText: dictWord.clue,
      direction: slot.direction,
      arrowDirection: slot.arrowDirection,
      clueRow: slot.clueRow,
      clueCol: slot.clueCol,
      startRow: slot.startRow,
      startCol: slot.startCol,
      length: slot.length,
    };
  });

  return {
    templateId: template.id,
    rows: template.rows,
    cols: template.cols,
    matrix: template.matrix,
    clues: cluesList,
    solutions: selectedSolutions,
    averageElo: 1200,
  };
}
