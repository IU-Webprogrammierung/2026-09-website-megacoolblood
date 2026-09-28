const boardElement = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const boardSize = 4;
const directions = {
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up'
};
const directionLabels = {
	down: 'unten',
	left: 'links',
	right: 'rechts',
	up: 'oben'
};
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

function slideLine(line) {
	const compactLine = line.filter((value) => value !== 0);
	const mergedLine = [];

	for (let index = 0; index < compactLine.length; index += 1) {
		if (compactLine[index] === compactLine[index + 1]) {
			const mergedValue = compactLine[index] * 2;
			mergedLine.push(mergedValue);
			index += 1;
		} else {
			mergedLine.push(compactLine[index]);
		}
	}

	while (mergedLine.length < boardSize) {
		mergedLine.push(0);
	}

	return { line: mergedLine };
}

function getLine(direction, index) {
	if (direction === 'left' || direction === 'right') {
		const line = board[index].slice();
		return direction === 'right' ? line.reverse() : line;
	}

	const line = board.map((row) => row[index]);
	return direction === 'down' ? line.reverse() : line;
}

function setLine(direction, index, line) {
	const outputLine = direction === 'left' || direction === 'up' ? line : line.reverse();

	if (direction === 'left' || direction === 'right') {
		board[index] = outputLine;
		return;
	}

	outputLine.forEach((value, rowIndex) => {
		board[rowIndex][index] = value;
	});
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

function setGameStatus(message) {
	gameStatus.textContent = message;
}

function move(direction) {
	const previousBoard = board.map((row) => row.slice());

	for (let index = 0; index < boardSize; index += 1) {
		const result = slideLine(getLine(direction, index));
		setLine(direction, index, result.line);
	}

	addRandomTile();
	setGameStatus(`Steine nach ${directionLabels[direction]} bewegt.`);
	renderBoard();
}

function startGame() {
	board = createEmptyBoard();
	addRandomTile();
	addRandomTile();
	renderBoard();
	setGameStatus('Neues Spiel gestartet.');
	boardElement.focus();
}

function handleKeyDown(event) {
	const direction = directions[event.key];

	if (!direction) {
		return;
	}

	event.preventDefault();
	move(direction);
}

newGameButton.addEventListener('click', startGame);
boardElement.addEventListener('keydown', handleKeyDown);
startGame();
