const board = document.querySelector('#game-board');
const newGameButton = document.querySelector('#new-game');
const boardSize = 9;

function createBoard() {
	board.replaceChildren();

	for (let row = 0; row < boardSize; row += 1) {
		for (let column = 0; column < boardSize; column += 1) {
			const cell = document.createElement('button');
			const cellNumber = row * boardSize + column + 1;

			cell.type = 'button';
			cell.className = 'game-cell';
			cell.setAttribute('role', 'gridcell');
			cell.setAttribute('aria-label', `Unaufgedecktes Feld ${cellNumber}`);
			cell.textContent = '?';
			board.append(cell);
		}
	}
}

newGameButton.addEventListener('click', createBoard);
createBoard();
