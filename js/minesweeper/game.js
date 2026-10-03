const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const mineCount = document.querySelector('#mine-count');
const winningStreakElement = document.querySelector('#winning-streak');
const modeButtons = document.querySelectorAll('.mode-button');
const difficultySettings = {
	beginner: { columns: 9, mines: 10, rows: 9 },
	intermediate: { columns: 16, mines: 40, rows: 16 },
	expert: { columns: 30, mines: 99, rows: 16 }
};

function getStoredDifficulty() {
	try {
		return localStorage.getItem('lycheelab-difficulty');
	} catch {
		return null;
	}
}

const storedDifficulty = getStoredDifficulty();
const difficulty = difficultySettings[storedDifficulty] ? storedDifficulty : 'beginner';
const boardRows = difficultySettings[difficulty].rows;
const boardColumns = difficultySettings[difficulty].columns;
const mineTotal = difficultySettings[difficulty].mines;
const streakStorageKey = 'lycheelab-winning-streak';
const statisticsStorageKey = 'lycheelab-statistics';
const gameStateStorageKey = 'lycheelab-minesweeper-game';
const iconPaths = {
	flag: '../../assets/icons/flag.svg',
	mine: '../../assets/icons/mine.svg',
	questionmark: '../../assets/icons/questionmark.svg'
};
let mineCurrentCount = difficultySettings[difficulty].mines;
let cells = [];
let gameOver = false;
let newGame = true;
let activeMode = 'reveal';
let activeCell = null;

function getWinningStreak() {
	try {
		const storedStreak = Number.parseInt(localStorage.getItem(streakStorageKey), 10);
		return Number.isNaN(storedStreak) || storedStreak < 0 ? 0 : storedStreak;
	} catch {
		return 0;
	}
}

function setWinningStreak(streak) {
	winningStreakElement.textContent = streak;

	try {
		localStorage.setItem(streakStorageKey, String(streak));
	} catch {
	}
}

function recordGameResult(won) {
	try {
		const storedStatistics = JSON.parse(localStorage.getItem(statisticsStorageKey) || '{}');
		const statistics = storedStatistics && typeof storedStatistics === 'object' ? storedStatistics : {};
		const storedDifficultyStatistics = statistics[difficulty] || {};
		const difficultyStatistics = {
			bestStreak: Number(storedDifficultyStatistics.bestStreak) || 0,
			currentStreak: Number(storedDifficultyStatistics.currentStreak) || 0,
			gamesPlayed: Number(storedDifficultyStatistics.gamesPlayed) || 0,
			minesCleared: Number(storedDifficultyStatistics.minesCleared) || 0,
			wins: Number(storedDifficultyStatistics.wins) || 0
		};

		difficultyStatistics.gamesPlayed += 1;
		if (won) {
			difficultyStatistics.wins += 1;
			difficultyStatistics.minesCleared += mineTotal;
			difficultyStatistics.currentStreak += 1;
			difficultyStatistics.bestStreak = Math.max(
				difficultyStatistics.bestStreak,
				difficultyStatistics.currentStreak
			);
		} else {
			difficultyStatistics.currentStreak = 0;
		}

		statistics[difficulty] = difficultyStatistics;
		localStorage.setItem(statisticsStorageKey, JSON.stringify(statistics));
	} catch {
	}
}

function setCellContent(cell, iconName, fallbackText) {
	cell.element.replaceChildren();

	if (!iconName) {
		cell.element.textContent = fallbackText;
		return;
	}

	const icon = document.createElement('img');
	icon.className = 'game-cell-icon';
	icon.src = iconPaths[iconName];
	icon.alt = '';
	cell.element.append(icon);
}

function saveGameState() {
	const gameState = {
		difficulty,
		gameOver,
		newGame,
		mineCurrentCount,
		cells: cells.map((row) => row.map((cell) => ({
			isFlagged: cell.isFlagged,
			isMarked: cell.isMarked,
			isMine: cell.isMine,
			isRevealed: cell.isRevealed
		})))
	};

	try {
		localStorage.setItem(gameStateStorageKey, JSON.stringify(gameState));
	} catch {
	}
}

function restoreCellPresentation(cell) {
	cell.element.classList.toggle('is-flagged', cell.isFlagged);
	cell.element.classList.toggle('is-marked', cell.isMarked);
	cell.element.classList.toggle('is-revealed', cell.isRevealed);

	if (cell.isRevealed) {
		const adjacentMines = countAdjacentMines(cell);
		cell.element.textContent = adjacentMines > 0 ? adjacentMines : '';
		cell.element.setAttribute(
			'aria-label',
			`${cell.coordinate}, ${adjacentMines} angrenzende Minen`
		);
	} else if (cell.isFlagged) {
		setCellContent(cell, 'flag', '?');
		cell.element.setAttribute('aria-label', `Als Flagge markiertes Feld ${cell.coordinate}`);
	} else if (cell.isMarked) {
		setCellContent(cell, 'questionmark', '');
		cell.element.setAttribute('aria-label', `Als Fragezeichen markiertes Feld ${cell.coordinate}`);
	} else {
		cell.element.textContent = '?';
		cell.element.setAttribute('aria-label', `Unaufgedecktes Feld ${cell.coordinate}`);
	}
}

function getColumnLabel(columnIndex) {
	let label = '';
	let remainingIndex = columnIndex;

	while (remainingIndex >= 0) {
		label = String.fromCharCode((remainingIndex % 26) + 65) + label;
		remainingIndex = Math.floor(remainingIndex / 26) - 1;
	}

	return label;
}

function getNeighbors(row, column) {
	const neighbors = [];

	for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
		for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
			const neighborRow = row + rowOffset;
			const neighborColumn = column + columnOffset;

			if (
				(rowOffset !== 0 || columnOffset !== 0) &&
				neighborRow >= 0 &&
				neighborRow < boardRows &&
				neighborColumn >= 0 &&
				neighborColumn < boardColumns
			) {
				neighbors.push(cells[neighborRow][neighborColumn]);
			}
		}
	}

	return neighbors;
}

function placeMines(firstCell) {
	const mineIndexes = new Set();
	const noMineIndexes = new Set([firstCell.row * boardColumns + firstCell.column]);

	getNeighbors(firstCell.row, firstCell.column).forEach((neighbor) => {
		noMineIndexes.add(neighbor.row * boardColumns + neighbor.column);
	});

	while (mineIndexes.size < mineTotal) {
		let index = Math.floor(Math.random() * boardRows * boardColumns);
		if (!noMineIndexes.has(index)) {
			mineIndexes.add(index);
		}
	}
	let row;
	let column;

	mineIndexes.forEach((index) => {
		column = index % boardColumns;
		row = (index - column) / boardColumns;
		cells[row][column].isMine = true;
	});
}

function countFlags(cells) {
	return cells.filter((cell) => cell.isFlagged).length;
}

function countMines(cells) {
	return cells.filter((cell) => cell.isMine).length;
}

function countAdjacentMines(cell) {
	return countMines(getNeighbors(cell.row, cell.column));
}

function revealCell(cell) {
	if (gameOver || cell.isRevealed || cell.isFlagged || cell.isMarked) {
		return;
	}

	if (cell.isMine) {
		cell.isRevealed = true;
		cell.element.classList.add('is-revealed');
		setCellContent(cell, 'mine', '*');
		cell.element.setAttribute('aria-label', `Mine auf Feld ${cell.coordinate}`);
		gameOver = true;
		recordGameResult(false);
		setWinningStreak(0);
		gameStatus.textContent = `Spiel verloren. Auf Feld ${cell.coordinate} lag eine Mine.`;
		gameOverRevealMines();
		return;
	}

	const cellsToReveal = [cell];
	let currentIndex = 0;

	while (currentIndex < cellsToReveal.length) {
		const currentCell = cellsToReveal[currentIndex];
		currentIndex += 1;

		if (currentCell.isRevealed || currentCell.isFlagged || currentCell.isMarked) {
			continue;
		}

		currentCell.isRevealed = true;
		currentCell.element.classList.add('is-revealed');
		const adjacentMines = countAdjacentMines(currentCell);
		currentCell.element.textContent = adjacentMines > 0 ? adjacentMines : '';
		currentCell.element.setAttribute(
			'aria-label',
			`${currentCell.coordinate}, ${adjacentMines} angrenzende Minen`
		);

		if (adjacentMines === 0) {
			getNeighbors(currentCell.row, currentCell.column).forEach((neighbor) => {
				if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMarked) {
					cellsToReveal.push(neighbor);
				}
			});
		}
	}

	if (cells.every((row) => row.every((currentCell) => currentCell.isMine || currentCell.isRevealed))) {
		gameOver = true;
		recordGameResult(true);
		const streak = getWinningStreak() + 1;
		setWinningStreak(streak);
		gameStatus.textContent = 'Gewonnen. Alle sicheren Felder sind aufgedeckt.';
		return;
	}

	gameStatus.textContent = `Feld ${cell.coordinate} aufgedeckt.`;
}

function toggleFlag(cell) {
	if (gameOver || cell.isRevealed || cell.isMarked) {
		return;
	}

	cell.isFlagged = !cell.isFlagged;
	setCellContent(cell, cell.isFlagged ? 'flag' : null, '?');
	cell.element.classList.toggle('is-flagged', cell.isFlagged);
	cell.element.setAttribute(
		'aria-label',
		`${cell.isFlagged ? 'Markiertes' : 'Unaufgedecktes'} Feld ${cell.coordinate}`
	);
	mineCurrentCount = mineCurrentCount + (cell.isFlagged ? -1 : 1);
	mineCount.textContent = mineCurrentCount;
	gameStatus.textContent = cell.isFlagged
		? `Feld ${cell.coordinate} als vermutete Mine markiert.`
		: `Markierung von Feld ${cell.coordinate} entfernt.`;
}

function toggleMark(cell) {
	if (gameOver || cell.isRevealed || cell.isFlagged) {
		return;
	}

	cell.isMarked = !cell.isMarked;
	setCellContent(cell, cell.isMarked ? 'questionmark' : null, '');
	cell.element.classList.toggle('is-marked', cell.isMarked);
	cell.element.setAttribute(
		'aria-label',
		`${cell.isMarked ? 'Markiertes' : 'Unaufgedecktes'} Feld ${cell.coordinate}`
	);
	gameStatus.textContent = cell.isMarked
		? `Feld ${cell.coordinate} mit einem Fragezeichen markiert.`
		: `Markierung von Feld ${cell.coordinate} entfernt.`;
}

function setMode(mode) {
	activeMode = mode;
	modeButtons.forEach((button) => {
		const isActive = button.dataset.mode === activeMode;
		button.classList.toggle('is-active', isActive);
		button.setAttribute('aria-pressed', String(isActive));
	});
}

function activeNumber(cell) {
	let neighbors = getNeighbors(cell.row, cell.column);
	let flaggedNeighbors = countFlags(neighbors);
	let adjacentMines = countMines(neighbors);
	if (flaggedNeighbors === adjacentMines) {
		neighbors
			.filter((neighbor) => !neighbor.isRevealed && !neighbor.isFlagged)
			.forEach((neighbor) => {
				revealCell(neighbor);
			})
			;
	}
}

function useActiveMode(cell, mode = activeMode) {
	if (newGame) {
		if (mode !== 'reveal') {
			return;
		}

		placeMines(cell);
		newGame = false;
	}

	if (cell.isRevealed) {
		activeNumber(cell);
	} else if (mode === 'flag') {
		toggleFlag(cell);
	} else if (mode === 'mark') {
		toggleMark(cell);
	} else {
		revealCell(cell);
	}

	saveGameState();
}

function handleCellClick(event) {
	const cellElement = event.target.closest('.game-cell');
	if (!cellElement) {
		return;
	}
	const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

	if (cell) {
		setActiveCell(cell);
		useActiveMode(cell);
	}
}

function handleCellContextMenu(event) {
	event.preventDefault();

	const cellElement = event.target.closest('.game-cell');
	if (!cellElement) {
		return;
	}
	const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

	if (!cell) {
		return;
	}

	setActiveCell(cell);

	const contextMode = activeMode === 'reveal' ? 'flag' : 'reveal';

	if (activeMode !== 'mark') {
		useActiveMode(cell, contextMode);
	}
}

function setActiveCell(nextCell, shouldFocus = false) {
	if (activeCell !== nextCell) {
		if (activeCell) {
			activeCell.element.tabIndex = -1;
		}

		activeCell = nextCell;
		activeCell.element.tabIndex = 0;
	}

	if (shouldFocus) {
		activeCell.element.focus();
	}
}

function moveFocus(currentCell, rowOffset, columnOffset) {
	const targetRow = currentCell.row + rowOffset;
	const targetColumn = currentCell.column + columnOffset;

	if (
		targetRow < 0 ||
		targetRow >= boardRows ||
		targetColumn < 0 ||
		targetColumn >= boardColumns
	) {
		return;
	}

	const targetCell = cells[targetRow][targetColumn];
	setActiveCell(targetCell, true);
}

function handleCellKeyDown(event) {
	const cellElement = event.target.closest('.game-cell');
	const cell = cells[cellElement.getAttribute('row')][cellElement.getAttribute('column')];

	if (cell && event.key.startsWith('Arrow')) {
		const movement = {
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1],
			ArrowUp: [-1, 0]
		}[event.key];

		if (movement) {
			event.preventDefault();
			moveFocus(cell, movement[0], movement[1]);
		}
		return;
	}

	if (event.key === ' ') {
		event.preventDefault();

		if (cell) {
			useActiveMode(cell);
		}
		return;
	}
}


function handleModeShortcut(event) {
	const modeShortcuts = { a: 'reveal', f: 'flag', m: 'mark' };
	const mode = modeShortcuts[event.key.toLowerCase()];

	if (!mode || event.target.matches('input, select, textarea')) {
		return;
	}

	event.preventDefault();
	setMode(mode);
}

function createBoard() {
	board.replaceChildren();
	cells = [];
	activeCell = null;
	gameOver = false;
	newGame = true;
	gameStatus.textContent = 'Neues Spiel gestartet.';
	mineCurrentCount = mineTotal;
	mineCount.textContent = mineCurrentCount;
	winningStreakElement.textContent = getWinningStreak();

	board.style.gridTemplateColumns = `repeat(${boardColumns}, var(--cell-size))`;

	for (let row = 0; row < boardRows; row += 1) {
		cells[row] = [];
		for (let column = 0; column < boardColumns; column += 1) {
			const cell = document.createElement('button');
			const coordinate = `${getColumnLabel(column)}${row + 1}`;
			const cellState = {
				row,
				column,
				coordinate,
				element: cell,
				isMine: false,
				isFlagged: false,
				isMarked: false,
				isRevealed: false
			};

			cell.type = 'button';
			cell.className = 'game-cell';
			cell.tabIndex = -1;
			cell.setAttribute('aria-label', `Unaufgedecktes Feld ${coordinate}`);
			cell.setAttribute('row', `${row}`);
			cell.setAttribute('column', `${column}`);
			cell.textContent = '?';
			cells[row][column] = cellState;
			board.append(cell);
		}
	}

	setActiveCell(cells[0][0]);
}

function gameOverRevealMines() {
	cells.forEach(row => row.filter((currentCell) => currentCell.isMine && !currentCell.isFlagged).forEach((mine) => {
		setCellContent(mine, 'mine', '*');
		mine.element.classList.add('is-mine');
	}));
	cells.forEach(row => row.filter((currentCell) => !currentCell.isMine && currentCell.isFlagged).forEach((flag) => {
		flag.element.classList.add('is-wrong-flag');
	}));
	cells.forEach(row => row.filter((currentCell) => currentCell.isMine && currentCell.isFlagged).forEach((flag) => {
		flag.element.classList.add('is-correct-flag');
	}));
}

function startNewGame() {
	try {
		localStorage.removeItem(gameStateStorageKey);
	} catch {
	}

	createBoard();
	saveGameState();
}

function loadGameState() {
	let savedGameState;

	try {
		savedGameState = JSON.parse(localStorage.getItem(gameStateStorageKey) || 'null');
	} catch {
		savedGameState = null;
	}

	if (
		!savedGameState ||
		savedGameState.difficulty !== difficulty ||
		!Array.isArray(savedGameState.cells) ||
		savedGameState.cells.length !== boardRows
	) {
		createBoard();
		return;
	}

	createBoard();

	savedGameState.cells.forEach((savedRow, row) => {
		if (!Array.isArray(savedRow) || savedRow.length !== boardColumns) {
			return;
		}

		savedRow.forEach((savedCell, column) => {
			cells[row][column].isMine = Boolean(savedCell.isMine);
			cells[row][column].isFlagged = Boolean(savedCell.isFlagged);
			cells[row][column].isMarked = Boolean(savedCell.isMarked);
			cells[row][column].isRevealed = Boolean(savedCell.isRevealed);
		});
	});

	cells.forEach((row) => row.forEach((cell) => restoreCellPresentation(cell)));

	gameOver = Boolean(savedGameState.gameOver);
	newGame = Boolean(savedGameState.newGame);
	mineCurrentCount = Number.isFinite(savedGameState.mineCurrentCount)
		? savedGameState.mineCurrentCount
		: mineTotal;
	mineCount.textContent = mineCurrentCount;
	gameStatus.textContent = gameOver
		? 'Gespeichertes Spiel beendet.'
		: 'Gespeichertes Spiel fortgesetzt.';
	if (gameOver) {
		gameOverRevealMines();
	}
}

modeButtons.forEach((button) => {
	button.addEventListener('click', () => setMode(button.dataset.mode));
});

board.addEventListener('click', handleCellClick);
board.addEventListener('contextmenu', handleCellContextMenu);
board.addEventListener('keydown', handleCellKeyDown);
document.addEventListener('keydown', handleModeShortcut);
newGameButton.addEventListener('click', startNewGame);
loadGameState();
