
"use strict";

/* ==================================================
   BLOOM & MATCH — GARDEN MAHJONG
   ================================================== */

const SAVE_KEY = "bloomMatchCompleteV2";

const NATURE_TILES = [
  "🌸", "🌼", "🌻", "🌷", "🌹", "🪻", "🌺", "🪷",
  "🍀", "🌿", "🌱", "🌵", "🌴", "🌳", "🌲", "🍄",
  "🍁", "🍂", "🌾", "🪴", "☘️", "🌰", "🪺", "🦋",
  "🐝", "🐞", "🐌", "🐸", "🐇", "🦊", "🦔", "🦉",
  "🦆", "🐢", "🐠", "🐬", "🐚", "🪸", "🍓", "🍒",
  "🍎", "🍊", "🍋", "🍇", "🍉", "🥝", "🌵", "🌳"
];

const LEVELS = [
  {
    name: "Sunny Meadow",
    description: "A peaceful place to begin.",
    layers: [[6, 4], [4, 2]]
  },
  {
    name: "Flower Garden",
    description: "Discover more flowers and greenery.",
    layers: [[8, 4], [6, 2], [2, 2]]
  },
  {
    name: "Butterfly Grove",
    description: "A little more planning is needed.",
    layers: [[8, 4], [6, 4], [4, 2], [2, 2]]
  },
  {
    name: "Secret Forest",
    description: "Look carefully beneath the upper tiles.",
    layers: [[8, 4], [8, 2], [6, 2], [4, 2], [2, 2]]
  },
  {
    name: "Enchanted Garden",
    description: "Your biggest garden challenge!",
    layers: [[8, 4], [8, 4], [6, 2], [4, 2], [2, 2]]
  }
];

const SHOP = [
  { id: "flower", emoji: "🌷", name: "Flower", cost: 5 },
  { id: "tree", emoji: "🌳", name: "Tree", cost: 10 },
  { id: "pond", emoji: "💧", name: "Pond", cost: 15 },
  { id: "bench", emoji: "🪑", name: "Bench", cost: 20 },
  { id: "butterflies", emoji: "🦋", name: "Butterflies", cost: 25 }
];

const TILE_WIDTH = 58;
const TILE_HEIGHT = 48;
const STEP_X = 62;
const STEP_Y = 52;
const MAX_COLUMNS = 8;
const MAX_ROWS = 4;

/* ==================================================
   HTML ELEMENTS
   ================================================== */

const board = document.getElementById("board");
const boardMessage = document.getElementById("boardMessage");
const movesDisplay = document.getElementById("moves");
const pairsDisplay = document.getElementById("pairs");
const seedsDisplay = document.getElementById("seeds");
const levelName = document.getElementById("levelName");
const levelDescription = document.getElementById("levelDescription");
const progressFill = document.getElementById("progressFill");
const gardenPanel = document.getElementById("gardenPanel");
const gardenItems = document.getElementById("gardenItems");
const gardenLevel = document.getElementById("gardenLevel");
const gardenMessage = document.getElementById("gardenMessage");

const hintBtn = document.getElementById("hintBtn");
const newGameBtn = document.getElementById("newGameBtn");
const gardenBtn = document.getElementById("gardenBtn");

const modal = document.getElementById("modal");
const modalEmoji = document.getElementById("modalEmoji");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalButton = document.getElementById("modalButton");

/* ==================================================
   GAME STATE
   ================================================== */

const state = {
  level: 1,
  seeds: 0,
  moves: 0,
  tiles: [],
  gardenItems: [],
  totalPairs: 0,
  gameWon: false
};

let selectedTileId = null;
let hintTimer = null;

/* ==================================================
   GENERAL HELPERS
   ================================================== */

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function setBoardMessage(text) {
  boardMessage.textContent = text;
}

function setGardenMessage(text) {
  gardenMessage.textContent = text;
}

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: state.level,
      seeds: state.seeds,
      gardenItems: state.gardenItems
    }));
  } catch (error) {
    console.warn("Could not save game progress:", error);
  }
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);

    if (!saved) return;

    const data = JSON.parse(saved);

    if (Number.isInteger(data.level)) {
      state.level = Math.max(1, Math.min(LEVELS.length, data.level));
    }

    if (Number.isFinite(data.seeds)) {
      state.seeds = Math.max(0, data.seeds);
    }

    if (Array.isArray(data.gardenItems)) {
      state.gardenItems = data.gardenItems.filter(id =>
        SHOP.some(item => item.id === id)
      );
    }
  } catch (error) {
    console.warn("Could not load saved progress:", error);
  }
}

/* ==================================================
   TILE POSITIONS AND MATCHING RULES
   ================================================== */

function getPositionsForLevel(levelNumber) {
  const level = LEVELS[levelNumber - 1];
  const positions = [];

  level.layers.forEach(([columns, rows], layer) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const gridCol = col + (MAX_COLUMNS - columns) / 2;
        const gridRow = row + (MAX_ROWS - rows) / 2;

        positions.push({
          id: `${layer}-${col}-${row}`,
          layer,
          col,
          row,
          columns,
          rows,
          x: gridCol * STEP_X + layer * 5,
          y: gridRow * STEP_Y - layer * 5,
          removed: false
        });
      }
    }
  });

  return positions;
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + TILE_WIDTH &&
    a.x + TILE_WIDTH > b.x &&
    a.y < b.y + TILE_HEIGHT &&
    a.y + TILE_HEIGHT > b.y
  );
}

function positionIsCovered(tile, remaining) {
  return remaining.some(other =>
    other.layer > tile.layer &&
    rectanglesOverlap(tile, other)
  );
}

function positionHasFreeSide(tile, remaining) {
  const leftBlocked = remaining.some(other =>
    other.layer === tile.layer &&
    other.row === tile.row &&
    other.col === tile.col - 1
  );

  const rightBlocked = remaining.some(other =>
    other.layer === tile.layer &&
    other.row === tile.row &&
    other.col === tile.col + 1
  );

  return !leftBlocked || !rightBlocked;
}

function positionIsFree(tile, remaining) {
  return (
    !positionIsCovered(tile, remaining) &&
    positionHasFreeSide(tile, remaining)
  );
}

/*
  Build a legal removal sequence first.

  The generator chooses two currently playable positions,
  removes them from its temporary layout, and repeats.

  Those two positions receive matching emojis later. Therefore,
  a matching pair exists at every stage of the planned sequence.
*/
function findRemovalOrder(originalPositions) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let remaining = shuffle(originalPositions);
    const order = [];
    let failed = false;

    while (remaining.length > 0) {
      const free = remaining.filter(tile =>
        positionIsFree(tile, remaining)
      );

      if (free.length < 2) {
        failed = true;
        break;
      }

      const first = free[Math.floor(Math.random() * free.length)];

      const candidates = free
        .filter(tile => tile.id !== first.id)
        .map(tile => ({
          tile,
          distance:
            Math.abs(tile.x - first.x) +
            Math.abs(tile.y - first.y) +
            Math.abs(tile.layer - first.layer) * 30
        }))
        .sort((a, b) => b.distance - a.distance);

      /*
        Prefer tiles farther apart to avoid placing most matching
        pairs next to each other.
      */
      const count = Math.max(
        1,
        Math.ceil(candidates.length * 0.65)
      );

      const choices = candidates.slice(0, count);
      const second = choices[
        Math.floor(Math.random() * choices.length)
      ].tile;

      order.push(first, second);

      remaining = remaining.filter(tile =>
        tile.id !== first.id && tile.id !== second.id
      );
    }

    if (!failed && order.length === originalPositions.length) {
      return order;
    }
  }

  return null;
}

/* ==================================================
   CREATE A NEW BOARD
   ================================================== */

function createBoard() {
  const positions = getPositionsForLevel(state.level);
  let removalOrder = findRemovalOrder(positions);

  if (!removalOrder) {
    setBoardMessage(
      "This layout could not be generated. Click New Game to retry."
    );
    state.tiles = [];
    state.totalPairs = 0;
    renderBoard();
    updateStats();
    return;
  }

  const pairCount = removalOrder.length / 2;
  const emojis = shuffle(NATURE_TILES);
  const tiles = [];

  for (let i = 0; i < removalOrder.length; i += 2) {
    const emoji = emojis[(i / 2) % emojis.length];

    for (const position of [removalOrder[i], removalOrder[i + 1]]) {
      tiles.push({
        ...position,
        emoji,
        removed: false
      });
    }
  }

  /*
    Randomize the tile rendering order. The planned matching
    sequence remains valid because the assigned pairs are kept.
  */
  state.tiles = shuffle(tiles);
  state.totalPairs = pairCount;
  state.moves = 0;
  state.gameWon = false;
  selectedTileId = null;

  clearHint();
  hideModal();
  renderBoard();
  updateStats();

  const level = LEVELS[state.level - 1];
  setBoardMessage(`Find the matching pairs in ${level.name}!`);
}

/* ==================================================
   PLAYABLE TILES
   ================================================== */

function getRemainingTiles() {
  return state.tiles.filter(tile => !tile.removed);
}

function isFree(tile) {
  if (!tile || tile.removed) return false;

  const remaining = getRemainingTiles();

  return positionIsFree(tile, remaining);
}

function findAvailablePair() {
  const freeTiles = state.tiles.filter(tile => isFree(tile));

  for (let i = 0; i < freeTiles.length; i++) {
    for (let j = i + 1; j < freeTiles.length; j++) {
      if (freeTiles[i].emoji === freeTiles[j].emoji) {
        return [freeTiles[i], freeTiles[j]];
      }
    }
  }

  return null;
}

/* ==================================================
   DRAW THE BOARD
   ================================================== */

function renderBoard() {
  board.innerHTML = "";

  const remaining = getRemainingTiles();

  const sortedTiles = [...remaining].sort((a, b) =>
    a.layer - b.layer ||
    a.row - b.row ||
    a.col - b.col
  );

  for (const tile of sortedTiles) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "tile";
    button.dataset.id = tile.id;
    button.textContent = tile.emoji;
    button.setAttribute("aria-label", `Tile ${tile.emoji}`);

    const free = isFree(tile);

    if (free) {
      button.classList.add("free");
    } else {
      button.classList.add("blocked");
      button.disabled = true;
    }

    if (tile.id === selectedTileId) {
      button.classList.add("selected");
    }

    button.style.left = `${tile.x}px`;
    button.style.top = `${tile.y}px`;
    button.style.zIndex = String(tile.layer * 100 + tile.row * 10 + tile.col);

    button.addEventListener("click", () => chooseTile(tile.id));

    board.appendChild(button);
  }

  updateStats();
}

/* ==================================================
   SELECT AND MATCH
   ================================================== */

function chooseTile(id) {
  if (state.gameWon) return;

  const tile = state.tiles.find(item => item.id === id);

  if (!tile || tile.removed || !isFree(tile)) {
    setBoardMessage("That tile is blocked. Choose an available tile.");
    return;
  }

  clearHint();

  if (selectedTileId === id) {
    selectedTileId = null;
    renderBoard();
    setBoardMessage("Selection cleared. Choose a tile.");
    return;
  }

  if (selectedTileId === null) {
    selectedTileId = id;
    renderBoard();
    setBoardMessage(`You selected ${tile.emoji}. Find its match!`);
    return;
  }

  const first = state.tiles.find(item => item.id === selectedTileId);

  if (first && first.emoji === tile.emoji) {
    first.removed = true;
    tile.removed = true;

    selectedTileId = null;
    state.moves++;
    state.seeds++;

    renderBoard();
    saveProgress();

    setGardenMessage("🌱 You earned one seed! Choose a garden decoration.");

    if (getRemainingTiles().length === 0) {
      completeLevel();
      return;
    }

    const availablePair = findAvailablePair();

    if (!availablePair) {
      /*
        Keep the board unchanged rather than secretly moving tiles.
        The generated removal sequence should prevent this case.
      */
      setBoardMessage(
        "No matching free pair remains. Start a new game to try another board."
      );
    } else {
      setBoardMessage(`Beautiful match! ${tile.emoji} removed. +1 seed.`);
    }

    updateStats();
  } else {
    selectedTileId = id;
    renderBoard();
    setBoardMessage("Not a match. Try finding two identical pictures.");
  }
}

/* ==================================================
   LEVEL COMPLETION AND MODAL
   ================================================== */

function showModal(title, text, buttonText, emoji = "🌸") {
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalButton.textContent = buttonText;
  modalEmoji.textContent = emoji;

  modal.hidden = false;
}

function hideModal() {
  modal.hidden = true;
}

function completeLevel() {
  state.gameWon = true;

  const completedLevel = state.level;
  const bonus = completedLevel * 3;

  state.seeds += bonus;

  saveProgress();
  updateStats();
  updateGarden();

  if (completedLevel < LEVELS.length) {
    showModal(
      "🌸 Garden Growing!",
      `You completed ${LEVELS[completedLevel - 1].name}! You earned ${bonus} bonus seeds. Your next garden is ready.`,
      "Next Level",
      "🌷"
    );
  } else {
    showModal(
      "🏆 Master Gardener!",
      `You completed all ${LEVELS.length} gardens and earned ${bonus} bonus seeds. Your garden adventure is complete!`,
      "Play Again",
      "🌳"
    );
  }

  setBoardMessage("Level complete! Well done, gardener.");
  setGardenMessage(`🌼 Level completed! You earned ${bonus} bonus seeds.`);
}

function continueAfterWin() {
  hideModal();

  if (state.level < LEVELS.length) {
    state.level++;
  } else {
    state.level = 1;
  }

  createBoard();
  updateStats();
  saveProgress();

  setBoardMessage(`Welcome to ${LEVELS[state.level - 1].name}!`);
}

/* ==================================================
   HINT — NEVER CHANGES THE BOARD
   ================================================== */

function clearHint() {
  if (hintTimer !== null) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }

  board.querySelectorAll(".hint").forEach(element => {
    element.classList.remove("hint");
  });
}

function showHint() {
  clearHint();

  if (state.gameWon) return;

  const pair = findAvailablePair();

  if (!pair) {
    setBoardMessage(
      "No matching free pair is available. Click New Game to try another board."
    );
    return;
  }

  for (const tile of pair) {
    const element = [...board.querySelectorAll(".tile")]
      .find(button => button.dataset.id === tile.id);

    if (element) {
      element.classList.add("hint");
    }
  }

  setBoardMessage(`Hint: match these two ${pair[0].emoji} tiles!`);

  hintTimer = setTimeout(() => {
    clearHint();
  }, 1800);
}

/* ==================================================
   GARDEN AND SHOP
   ================================================== */

function updateGarden() {
  gardenItems.innerHTML = "";

  if (state.gardenItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "garden-empty";
    empty.textContent =
      "Your garden is waiting for its first flower! Earn seeds by matching tiles.";
    gardenItems.appendChild(empty);
  } else {
    for (const itemId of state.gardenItems) {
      const item = SHOP.find(shopItem => shopItem.id === itemId);

      if (!item) continue;

      const plant = document.createElement("span");
      plant.className = "garden-plant";
      plant.textContent = item.emoji;
      plant.title = item.name;

      gardenItems.appendChild(plant);
    }
  }

  updateShopButtons();
}

function updateShopButtons() {
  document.querySelectorAll(".shop-item").forEach(button => {
    const item = SHOP.find(shopItem =>
      shopItem.id === button.dataset.item
    );

    if (!item) return;

    const owned = state.gardenItems.includes(item.id);
    const name = button.querySelector("strong");
    const price = button.querySelector("small");

    button.disabled = owned || state.seeds < item.cost;

    if (name) {
      name.textContent = owned ? `${item.name} ✓` : item.name;
    }

    if (price) {
      price.textContent = owned ? "Owned" : `${item.cost} seeds`;
    }
  });
}

function buyGardenItem(itemId) {
  const item = SHOP.find(shopItem => shopItem.id === itemId);

  if (!item) return;

  if (state.gardenItems.includes(item.id)) {
    setGardenMessage(`You already own ${item.name}.`);
    return;
  }

  if (state.seeds < item.cost) {
    setGardenMessage(
      `You need ${item.cost - state.seeds} more seeds for ${item.name}.`
    );
    return;
  }

  state.seeds -= item.cost;
  state.gardenItems.push(item.id);

  saveProgress();
  updateGarden();
  updateStats();

  setGardenMessage(`${item.emoji} ${item.name} has grown in your garden!`);
}

function toggleGarden() {
  gardenPanel.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });

  gardenPanel.classList.add("garden-highlight");

  setTimeout(() => {
    gardenPanel.classList.remove("garden-highlight");
  }, 900);

  setGardenMessage("Welcome to your garden! Spend seeds to add decorations.");
}

/* ==================================================
   STATS AND PROGRESS
   ================================================== */

function updateStats() {
  movesDisplay.textContent = String(state.moves);
  pairsDisplay.textContent = String(getRemainingTiles().length / 2);
  seedsDisplay.textContent = String(state.seeds);
  levelName.textContent = LEVELS[state.level - 1].name;
  levelDescription.textContent = LEVELS[state.level - 1].description;
  gardenLevel.textContent = `Level ${state.level}`;

  const completedPairs =
    state.totalPairs - getRemainingTiles().length / 2;

  const percent = state.totalPairs > 0
    ? (completedPairs / state.totalPairs) * 100
    : 0;

  progressFill.style.width = `${percent}%`;

  updateShopButtons();
}

/* ==================================================
   BUTTON EVENTS
   ================================================== */

hintBtn.addEventListener("click", showHint);

newGameBtn.addEventListener("click", () => {
  createBoard();
  setBoardMessage("A new board is ready. Find your first matching pair!");
});

gardenBtn.addEventListener("click", toggleGarden);

modalButton.addEventListener("click", continueAfterWin);

document.querySelectorAll(".shop-item").forEach(button => {
  button.addEventListener("click", () => {
    buyGardenItem(button.dataset.item);
  });
});

/* ==================================================
   START THE GAME
   ================================================== */

loadProgress();
updateGarden();
createBoard();
updateStats();
