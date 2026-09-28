const boardElement = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const gameStatus = document.querySelector('#game-status');
const scoreElement = document.querySelector('#game-score');
const bestScoreElement = document.querySelector('#best-score');
const boardSize = 4;
const bestScoreKey = 'lycheelab-2048-best-score';
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
let score = 0;
let bestScore = readBestScore();
let gameOver = false;
let hasWon = false;

function createEmptyBoard() {
	return Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
}

function readBestScore() {
	try {
		const storedScore = Number.parseInt(localStorage.getItem(bestScoreKey), 10);
		return Number.isNaN(storedScore) || storedScore < 0 ? 0 : storedScore;
	} catch {
		return 0;
	}
}

function saveBestScore() {
	try {
		localStorage.setItem(bestScoreKey, String(bestScore));
	} catch {
	}
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
	let gainedScore = 0;

	for (let index = 0; index < compactLine.length; index += 1) {
		if (compactLine[index] === compactLine[index + 1]) {
			const mergedValue = compactLine[index] * 2;
			mergedLine.push(mergedValue);
			gainedScore += mergedValue;
			index += 1;
		} else {
			mergedLine.push(compactLine[index]);
		}
	}

	while (mergedLine.length < boardSize) {
		mergedLine.push(0);
	}

	return { gainedScore, line: mergedLine };
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

function hasBoardChanged(previousBoard) {
	return board.some((row, rowIndex) => row.some((value, columnIndex) => value !== previousBoard[rowIndex][columnIndex]));
}

function canMove() {
	if (getEmptyPositions().length > 0) {
		return true;
	}

	for (let rowIndex = 0; rowIndex < boardSize; rowIndex += 1) {
		for (let columnIndex = 0; columnIndex < boardSize; columnIndex += 1) {
			const value = board[rowIndex][columnIndex];
			const rightValue = board[rowIndex][columnIndex + 1];
			const bottomValue = board[rowIndex + 1]?.[columnIndex];

			if (value === rightValue || value === bottomValue) {
				return true;
			}
		}
	}

	return false;
}

function updateScore() {
	scoreElement.textContent = score;
	bestScoreElement.textContent = bestScore;
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
	if (gameOver) {
		return;
	}

	const previousBoard = board.map((row) => row.slice());
	let gainedScore = 0;

	for (let index = 0; index < boardSize; index += 1) {
		const result = slideLine(getLine(direction, index));
		gainedScore += result.gainedScore;
		setLine(direction, index, result.line);
	}

	if (!hasBoardChanged(previousBoard)) {
		setGameStatus('Dieser Zug ist nicht möglich.');
		return;
	}

	addRandomTile();
	score += gainedScore;
	if (score > bestScore) {
		bestScore = score;
		saveBestScore();
	}

	if (!hasWon && board.some((row) => row.includes(2048))) {
		hasWon = true;
		setGameStatus('2048 erreicht. Du kannst weiterspielen.');
	} else if (!canMove()) {
		gameOver = true;
		setGameStatus('Kein Zug mehr möglich. Starte ein neues Spiel.');
	} else {
		setGameStatus(`Steine nach ${directionLabels[direction]} bewegt.`);
	}

	updateScore();
	renderBoard();
}

function startGame() {
	board = createEmptyBoard();
	score = 0;
	gameOver = false;
	hasWon = false;
	addRandomTile();
	addRandomTile();
	updateScore();
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
bestScoreElement.textContent = bestScore;
startGame();
