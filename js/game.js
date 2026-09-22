const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const mineCount = document.querySelector('#mine-count');
const winningStreakElement = document.querySelector('#winning-streak');
const playerNameInput = document.querySelector('#player-name');
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
const boardSize = difficultySettings[difficulty].rows;
const boardColumns = difficultySettings[difficulty].columns;
const mineTotal = difficultySettings[difficulty].mines;
const streakStorageKey = 'lycheelab-winning-streak';
const highscoreStorageKey = 'lycheelab-highscores';
let cells = [];
let gameOver = false;
let activeMode = 'reveal';

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

function saveHighscore(streak) {
	const highscore = {
		date: new Date().toISOString().slice(0, 10),
		difficulty,
		name: playerNameInput.value.trim() || 'Spieler',
		streak
	};

	try {
		const storedHighscores = JSON.parse(localStorage.getItem(highscoreStorageKey) || '[]');
		const highscores = Array.isArray(storedHighscores) ? storedHighscores : [];
		highscores.push(highscore);
		highscores.sort((first, second) => second.streak - first.streak);
		localStorage.setItem(highscoreStorageKey, JSON.stringify(highscores.slice(0, 10)));
	} catch {
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
				neighborRow < boardSize &&
				neighborColumn >= 0 &&
				neighborColumn < boardColumns
			) {
				neighbors.push(cells[neighborRow * boardSize + neighborColumn]);
			}
		}
	}

	return neighbors;
}

function placeMines() {
	const mineIndexes = new Set();

	while (mineIndexes.size < mineTotal) {
		mineIndexes.add(Math.floor(Math.random() * cells.length));
	}

	mineIndexes.forEach((index) => {
		cells[index].isMine = true;
	});
}

function countAdjacentMines(cell) {
	return getNeighbors(cell.row, cell.column).filter((neighbor) => neighbor.isMine).length;
}

function revealCell(cell) {
	if (gameOver || cell.isRevealed || cell.isFlagged || cell.isMarked) {
		return;
	}

	if (cell.isMine) {
		cell.isRevealed = true;
		cell.element.classList.add('is-revealed');
		cell.element.textContent = '*';
		cell.element.setAttribute('aria-label', `Mine auf Feld ${cell.coordinate}`);
		gameOver = true;
		const streak = getWinningStreak();
		if (streak > 0) {
			saveHighscore(streak);
		}
		setWinningStreak(0);
		gameStatus.textContent = `Spiel verloren. Auf Feld ${cell.coordinate} lag eine Mine.`;
		cells.filter((currentCell) => currentCell.isMine).forEach((mine) => {
			mine.element.textContent = '*';
			mine.element.classList.add('is-mine');
		});
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

	if (cells.every((currentCell) => currentCell.isMine || currentCell.isRevealed)) {
		gameOver = true;
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
	cell.element.textContent = cell.isFlagged ? 'F' : '?';
	cell.element.classList.toggle('is-flagged', cell.isFlagged);
	cell.element.setAttribute(
		'aria-label',
		`${cell.isFlagged ? 'Markiertes' : 'Unaufgedecktes'} Feld ${cell.coordinate}`
	);
	mineCount.textContent = mineTotal - cells.filter((currentCell) => currentCell.isFlagged).length;
	gameStatus.textContent = cell.isFlagged
		? `Feld ${cell.coordinate} als vermutete Mine markiert.`
		: `Markierung von Feld ${cell.coordinate} entfernt.`;
}

function toggleMark(cell) {
	if (gameOver || cell.isRevealed || cell.isFlagged) {
		return;
	}

	cell.isMarked = !cell.isMarked;
	cell.element.textContent = cell.isMarked ? '?' : '';
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

function useActiveMode(cell) {
	if (activeMode === 'flag') {
		toggleFlag(cell);
		return;
	}

	if (activeMode === 'mark') {
		toggleMark(cell);
		return;
	}

	revealCell(cell);
}

function handleCellClick(event) {
	const cellElement = event.target.closest('.game-cell');
	const cell = cells.find((currentCell) => currentCell.element === cellElement);

	if (cell) {
		useActiveMode(cell);
	}
}

function moveFocus(currentCell, rowOffset, columnOffset) {
	const targetRow = currentCell.row + rowOffset;
	const targetColumn = currentCell.column + columnOffset;

	if (
		targetRow < 0 ||
		targetRow >= boardSize ||
		targetColumn < 0 ||
		targetColumn >= boardColumns
	) {
		return;
	}

	const targetCell = cells[targetRow * boardSize + targetColumn];
	targetCell.element.focus();
}

function handleCellKeyDown(event) {
	const cellElement = event.target.closest('.game-cell');
	const cell = cells.find((currentCell) => currentCell.element === cellElement);

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
	gameOver = false;
	gameStatus.textContent = 'Neues Spiel gestartet.';
	mineCount.textContent = mineTotal;
	winningStreakElement.textContent = getWinningStreak();

	board.style.gridTemplateColumns = `repeat(${boardColumns}, minmax(2rem, 3rem))`;

	for (let row = 0; row < boardSize; row += 1) {
		for (let column = 0; column < boardColumns; column += 1) {
			const cell = document.createElement('button');
			const coordinate = `${getColumnLabel(column)}${row + 1}`;
			const cellState = {
				column,
				coordinate,
				element: cell,
				isMine: false,
				isFlagged: false,
				isMarked: false,
				isRevealed: false,
				row
			};

			cell.type = 'button';
			cell.className = 'game-cell';
			cell.setAttribute('role', 'gridcell');
			cell.setAttribute('aria-label', `Unaufgedecktes Feld ${coordinate}`);
			cell.textContent = '?';
			cells.push(cellState);
			board.append(cell);
		}
	}

	placeMines();
}

modeButtons.forEach((button) => {
	button.addEventListener('click', () => setMode(button.dataset.mode));
});

board.addEventListener('click', handleCellClick);
board.addEventListener('keydown', handleCellKeyDown);
document.addEventListener('keydown', handleModeShortcut);
newGameButton.addEventListener('click', createBoard);
createBoard();
