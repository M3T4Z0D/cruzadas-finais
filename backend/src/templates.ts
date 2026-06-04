export interface ClueSlot {
  id: string;
  clueText?: string;
  wordId?: string;
  direction: "horizontal" | "vertical";
  arrowDirection: "right" | "down";
  clueRow: number; // The cell containing the clue (0)
  clueCol: number;
  startRow: number; // The first playable letter cell (1)
  startCol: number;
  length: number;
}

export interface GridTemplate {
  id: string;
  rows: number;
  cols: number;
  matrix: number[][]; // 0: Clue/Black, 1: Letter Input
  slots: ClueSlot[];
}

export const gridTemplates: GridTemplate[] = [
  // TEMPLATE 1: 7x7 Mini Grid (Perfect Cruzadas Diretas Alignment)
  {
    id: "template_7x7",
    rows: 7,
    cols: 7,
    matrix: [
      [0, 1, 1, 1, 1, 1, 1], // H1 starts at (0,1) length 6. Clue H1 at (0,0)
      [0, 0, 0, 0, 0, 0, 0], // Clue boxes for V1 at (1,2), V2 at (1,4), V3 at (1,6)
      [0, 1, 1, 1, 1, 1, 1], // H2 starts at (2,1) length 6. Clue H2 at (2,0)
      [0, 0, 1, 0, 1, 0, 1], // V1, V2, V3 pass
      [0, 1, 1, 1, 1, 1, 1], // H3 starts at (4,1) length 6. Clue H3 at (4,0)
      [0, 0, 1, 0, 1, 0, 1], // V1, V2, V3 pass
      [0, 1, 1, 1, 1, 1, 1]  // H4 starts at (6,1) length 6. Clue H4 at (6,0)
    ],
    slots: [
      // Horizontals: Clue Row/Col MUST be immediately left of start Row/Col
      { id: "h1", direction: "horizontal", arrowDirection: "right", clueRow: 0, clueCol: 0, startRow: 0, startCol: 1, length: 6 },
      { id: "h2", direction: "horizontal", arrowDirection: "right", clueRow: 2, clueCol: 0, startRow: 2, startCol: 1, length: 6 },
      { id: "h3", direction: "horizontal", arrowDirection: "right", clueRow: 4, clueCol: 0, startRow: 4, startCol: 1, length: 6 },
      { id: "h4", direction: "horizontal", arrowDirection: "right", clueRow: 6, clueCol: 0, startRow: 6, startCol: 1, length: 6 },
      // Verticals: Clue Row/Col MUST be immediately above start Row/Col
      { id: "v1", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 2, startRow: 2, startCol: 2, length: 5 },
      { id: "v2", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 4, startRow: 2, startCol: 4, length: 5 },
      { id: "v3", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 6, startRow: 2, startCol: 6, length: 5 }
    ]
  },

  // TEMPLATE 2: 10x10 Balanced Grid (Perfect Cruzadas Diretas Alignment)
  {
    id: "template_10x10",
    rows: 10,
    cols: 10,
    matrix: [
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1], // H1 starts at (0,1) length 9. Clue H1 at (0,0)
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Clue boxes for V1 at (1,2), V2 at (1,5), V3 at (1,8)
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1], // H2 starts at (2,1) length 9. Clue H2 at (2,0)
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0], // V1, V2, V3 pass
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0], // V1, V2, V3 pass
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1], // H3 starts at (5,1) length 9. Clue H3 at (5,0)
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0], // V1, V2, V3 pass
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0], // V1, V2, V3 pass
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1], // H4 starts at (8,1) length 9. Clue H4 at (8,0)
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0]  // V1, V2, V3 pass
    ],
    slots: [
      // Horizontals: Clue Row/Col MUST be immediately left of start Row/Col
      { id: "h1", direction: "horizontal", arrowDirection: "right", clueRow: 0, clueCol: 0, startRow: 0, startCol: 1, length: 9 },
      { id: "h2", direction: "horizontal", arrowDirection: "right", clueRow: 2, clueCol: 0, startRow: 2, startCol: 1, length: 9 },
      { id: "h3", direction: "horizontal", arrowDirection: "right", clueRow: 5, clueCol: 0, startRow: 5, startCol: 1, length: 9 },
      { id: "h4", direction: "horizontal", arrowDirection: "right", clueRow: 8, clueCol: 0, startRow: 8, startCol: 1, length: 9 },
      // Verticals: Clue Row/Col MUST be immediately above start Row/Col
      { id: "v1", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 2, startRow: 2, startCol: 2, length: 8 },
      { id: "v2", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 5, startRow: 2, startCol: 5, length: 8 },
      { id: "v3", direction: "vertical", arrowDirection: "down", clueRow: 1, clueCol: 8, startRow: 2, startCol: 8, length: 8 }
    ]
  }
];
