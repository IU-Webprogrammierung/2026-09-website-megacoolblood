const boardElement = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const boardSize = 4;
let board = [];

function createEmptyBoard() {
	return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
}


function getEmptyPositions() {
	const positions = [];

	board.forEach((row, rowIndex) => {
		row.forEach((value, columnIndex) => {
			if (value === 0) {
				positions.push({ columnIndex, rowIndex });
			}
		});
	});

	return positions;
}

function addRandomTile() {
	const emptyPositions = getEmptyPositions();

	if (emptyPositions.length === 0) {
		return;
	}

	const position = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
	board[position.rowIndex][position.columnIndex] = Math.random() < 0.9 ? 2 : 4;
}

function getTileLabel(value) {
	return value === 0 ? 'Leeres Feld' : `Stein mit ${value}`;
}

function renderBoard() {
	boardElement.replaceChildren();

	board.forEach((row, rowIndex) => {
		row.forEach((value, columnIndex) => {
			const tile = document.createElement('div');
			tile.className = `tile tile-${value}`;
			tile.setAttribute('role', 'gridcell');
			tile.setAttribute('aria-rowindex', rowIndex + 1);
			tile.setAttribute('aria-colindex', columnIndex + 1);
			tile.setAttribute('aria-label', getTileLabel(value));
			tile.textContent = value === 0 ? '' : value;
			boardElement.append(tile);
		});
	});
}

function startGame() {
	board = createEmptyBoard();
	addRandomTile();
	addRandomTile();
	renderBoard();
	boardElement.focus();
}

newGameButton.addEventListener('click', startGame);

startGame();
