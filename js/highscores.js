const highscoreList = document.querySelector('#highscore-list');
const highscoreStorageKey = 'lycheelab-highscores';

function getHighscores() {
	try {
		const storedHighscores = JSON.parse(localStorage.getItem(highscoreStorageKey) || '[]');
		return Array.isArray(storedHighscores) ? storedHighscores : [];
	} catch {
		return [];
	}
}

function renderHighscores() {
	const highscores = getHighscores();
	highscoreList.replaceChildren();

	if (highscores.length === 0) {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = '<td colspan="5">Noch keine Siegesserien vorhanden.</td>';
		highscoreList.append(emptyRow);
		return;
	}

	highscores.forEach((highscore, index) => {
		const row = document.createElement('tr');
		[index + 1, highscore.name, highscore.streak, highscore.difficulty, highscore.date].forEach((value) => {
			const cell = document.createElement('td');
			cell.textContent = value;
			row.append(cell);
		});
		highscoreList.append(row);
	});
}

renderHighscores();