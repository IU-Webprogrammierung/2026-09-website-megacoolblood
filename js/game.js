const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const boardSize = 9;

function getColumnLabel(columnIndex) {
	let label = '';
	let remainingIndex = columnIndex;

	while (remainingIndex >= 0) {
		label = String.fromCharCode((remainingIndex % 26) + 65) + label;
		remainingIndex = Math.floor(remainingIndex / 26) - 1;
	}

	return label;
}

function createBoard() {
	board.replaceChildren();

	for (let row = 0; row < boardSize; row += 1) {
		for (let column = 0; column < boardSize; column += 1) {
			const cell = document.createElement('button');
			const coordinate = `${getColumnLabel(column)}${row + 1}`;

			cell.type = 'button';
			cell.className = 'game-cell';
			cell.setAttribute('role', 'gridcell');
			cell.setAttribute('aria-label', `Unaufgedecktes Feld ${coordinate}`);
			cell.textContent = '?';
			board.append(cell);
		}
	}
}

newGameButton.addEventListener('click', createBoard);
createBoard();
