const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const mineCount = document.querySelector('#mine-count');
const modeButtons = document.querySelectorAll('.mode-button');
const boardSize = 9;
const mineTotal = 10;
let cells = [];
let gameOver = false;
let activeMode = 'reveal';

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
				neighborColumn < boardSize
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
	if (gameOver || cell.isRevealed || cell.isFlagged) {
		return;
	}

	cell.isRevealed = true;
	cell.element.classList.add('is-revealed');

	if (cell.isMine) {
		cell.element.textContent = '*';
		cell.element.setAttribute('aria-label', `Mine auf Feld ${cell.coordinate}`);
		gameOver = true;
		gameStatus.textContent = `Spiel verloren. Auf Feld ${cell.coordinate} lag eine Mine.`;
		cells.filter((currentCell) => currentCell.isMine).forEach((mine) => {
			mine.element.textContent = '*';
			mine.element.classList.add('is-mine');
		});
		return;
	}

	const adjacentMines = countAdjacentMines(cell);
	cell.element.textContent = adjacentMines > 0 ? adjacentMines : '';
	cell.element.setAttribute(
		'aria-label',
		`${cell.coordinate}, ${adjacentMines} angrenzende Minen`
	);

	if (cells.every((currentCell) => currentCell.isMine || currentCell.isRevealed)) {
		gameOver = true;
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

function handleCellKeyDown(event) {
	const cellElement = event.target.closest('.game-cell');

	if (event.key === ' ') {
		event.preventDefault();
		const cell = cells.find((currentCell) => currentCell.element === cellElement);

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

	for (let row = 0; row < boardSize; row += 1) {
		for (let column = 0; column < boardSize; column += 1) {
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
