export type GameCategory =
  | "Strategy & Board"
  | "Logic & Number"
  | "Word & Language"
  | "Party, Social & Icebreakers";

export type GameAvailability = "available" | "coming_soon";

export type GameDefinition = {
  id: string;
  name: string;
  category: GameCategory;
  description: string;
  availability: GameAvailability;
  route?: string;
  engineId: string;
};

export const GAME_CATEGORIES: GameCategory[] = [
  "Strategy & Board",
  "Logic & Number",
  "Word & Language",
  "Party, Social & Icebreakers",
];

// Add future games here. Games with compatible mechanics may share an engineId;
// each game still keeps its own rules and presentation.
export const GAME_CATALOG: GameDefinition[] = [
  { id: "chess", name: "Chess", category: "Strategy & Board", description: "A classic two-player game of planning and tactics.", availability: "coming_soon", engineId: "board-grid" },
  { id: "draughts", name: "Draughts / Dama", category: "Strategy & Board", description: "Capture, move and crown your pieces.", availability: "coming_soon", engineId: "board-grid" },
  { id: "omweso", name: "Omweso", category: "Strategy & Board", description: "A traditional East African strategy game.", availability: "coming_soon", engineId: "mancala" },
  { id: "ludo", name: "Ludo", category: "Strategy & Board", description: "Race your pieces around the board and get them home.", availability: "coming_soon", engineId: "race-board" },
  { id: "ayo-bao", name: "Ayo / Bao", category: "Strategy & Board", description: "A traditional seed-sowing strategy game.", availability: "coming_soon", engineId: "mancala" },
  { id: "reversi", name: "Reversi / Othello", category: "Strategy & Board", description: "Outflank your opponent and control the board.", availability: "coming_soon", engineId: "board-grid" },

  { id: "sudoku", name: "Sudoku", category: "Logic & Number", description: "Complete the grid using logical deduction.", availability: "coming_soon", engineId: "number-puzzle" },
  { id: "kakuro", name: "Kakuro", category: "Logic & Number", description: "Use number combinations to complete the crossword-style grid.", availability: "coming_soon", engineId: "number-puzzle" },
  { id: "magic-squares", name: "Magic Squares", category: "Logic & Number", description: "Arrange numbers so every row, column and diagonal adds up.", availability: "coming_soon", engineId: "number-puzzle" },
  { id: "minesweeper", name: "Minesweeper", category: "Logic & Number", description: "Use clues to uncover safe squares without hitting a mine.", availability: "coming_soon", engineId: "grid-logic" },
  { id: "nonograms", name: "Nonograms / Picross", category: "Logic & Number", description: "Reveal hidden pixel pictures using number clues.", availability: "coming_soon", engineId: "grid-logic" },
  { id: "2048", name: "2048", category: "Logic & Number", description: "Combine matching tiles to reach the target number.", availability: "coming_soon", engineId: "number-puzzle" },
  { id: "kenken", name: "KenKen", category: "Logic & Number", description: "Solve arithmetic cages while completing the grid.", availability: "coming_soon", engineId: "number-puzzle" },

  { id: "scrabble-word-blitz", name: "Scrabble / Word Blitz", category: "Word & Language", description: "Build words and compete through remote word play.", availability: "coming_soon", engineId: "word-game" },
  { id: "boggle", name: "Boggle", category: "Word & Language", description: "Find as many words as you can in a letter grid.", availability: "coming_soon", engineId: "word-game" },
  { id: "hangman", name: "Hangman", category: "Word & Language", description: "Guess the hidden word before your attempts run out.", availability: "coming_soon", engineId: "word-game" },
  { id: "word-chain", name: "Word Chain", category: "Word & Language", description: "Build a chain of dictionary-verified words, taking turns against a friend.", availability: "available", route: "/games/word-chain", engineId: "word-chain" },
  { id: "cryptograms", name: "Cryptograms", category: "Word & Language", description: "Decode a message by solving its letter substitution.", availability: "coming_soon", engineId: "word-puzzle" },
  { id: "anidram", name: "Anidram / Word Scramble", category: "Word & Language", description: "Rearrange mixed-up letters to discover the word.", availability: "coming_soon", engineId: "word-game" },

  { id: "trivia-showdown", name: "Trivia Showdown", category: "Party, Social & Icebreakers", description: "Challenge friends with questions across different topics.", availability: "coming_soon", engineId: "quiz" },
  { id: "secret-agent", name: "Secret Agent / Imposter", category: "Party, Social & Icebreakers", description: "Find the hidden imposter through conversation and clues.", availability: "coming_soon", engineId: "social-deduction" },
  { id: "spyfall", name: "Spyfall", category: "Party, Social & Icebreakers", description: "Ask clever questions and uncover who does not know the location.", availability: "coming_soon", engineId: "social-deduction" },
  { id: "doodle-dash", name: "Doodle Dash", category: "Party, Social & Icebreakers", description: "Draw a prompt while everyone races to guess it.", availability: "coming_soon", engineId: "drawing-party" },
  { id: "most-likely-to", name: "Most Likely To", category: "Party, Social & Icebreakers", description: "Vote on who best fits a fun group prompt.", availability: "coming_soon", engineId: "voting-party" },
  { id: "two-truths-lie", name: "Two Truths and a Lie", category: "Party, Social & Icebreakers", description: "Share three statements and let the group spot the lie.", availability: "coming_soon", engineId: "social-party" },
  { id: "quick-draw-buzzer", name: "Quick-Draw Buzzer", category: "Party, Social & Icebreakers", description: "Be the quickest to buzz in and answer.", availability: "coming_soon", engineId: "buzzer-quiz" },
  { id: "icebreaker-bingo", name: "Virtual Icebreaker Bingo", category: "Party, Social & Icebreakers", description: "Meet fellow members through a lively bingo challenge.", availability: "coming_soon", engineId: "social-party" },
  { id: "caption-this", name: "Caption This!", category: "Party, Social & Icebreakers", description: "Write the funniest caption for a shared picture.", availability: "coming_soon", engineId: "voting-party" },
];
