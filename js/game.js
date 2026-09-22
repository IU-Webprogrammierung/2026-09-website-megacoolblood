const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const mineCount = document.querySelector('#mine-count');
const boardSize = 9;
const mineTotal = 10;
let cells = [];
let gameOver = false;

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
	if (gameOver || cell.isRevealed) {
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
	gameStatus.textContent = `Feld ${cell.coordinate} aufgedeckt.`;
}

function handleCellClick(event) {
	const cellElement = event.target.closest('.game-cell');
	const cell = cells.find((currentCell) => currentCell.element === cellElement);

	if (cell) {
		revealCell(cell);
	}
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

board.addEventListener('click', handleCellClick);
newGameButton.addEventListener('click', createBoard);
createBoard();
