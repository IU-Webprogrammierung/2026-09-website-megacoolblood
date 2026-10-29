const statisticsList = document.querySelector('#statistics-list');
const difficultyLabels = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  expert: 'Experte',
  maximum: 'Maximal (100 × 100)'
};

function getStatistics() {
  return minesweeperRunState.readStatistics() ?? {};
}

function createStatistic(label, value) {
  const wrapper = document.createElement('div');
  const title = document.createElement('dt');
  const result = document.createElement('dd');
  title.textContent = label;
  result.textContent = value;
  wrapper.append(title, result);
  return wrapper;
}

function renderStatistics() {
  const statistics = getStatistics();
  statisticsList.replaceChildren();
  const availableDifficulties = Object.keys(difficultyLabels).filter((difficulty) => statistics[difficulty]);

  if (availableDifficulties.length === 0) {
  const emptyState = document.createElement('p');
  emptyState.textContent = 'Noch keine Statistiken vorhanden. Spiele zuerst eine Runde Minesweeper.';
  statisticsList.append(emptyState);
  return;
  }

  availableDifficulties.forEach((difficulty) => {
  const data = minesweeperRunState.readDifficultyStatistics(statistics, difficulty);
  const card = document.createElement('article');
  const heading = document.createElement('h2');
  const values = document.createElement('dl');
  const gamesPlayed = data.gamesPlayed;
  const wins = data.wins;
  const successRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

  card.className = 'statistics-card';
  heading.textContent = difficultyLabels[difficulty];
  values.append(
   createStatistic('Minen geräumt', data.minesCleared),
   createStatistic('Erfolgsquote', `${successRate} %`),
   createStatistic('Aktuelle Serie', data.currentStreak),
   createStatistic('Höchster Score', data.bestSeriesRevealedFields.toLocaleString('de-DE'))
  );
  card.append(heading, values);
  statisticsList.append(card);
  });
}

renderStatistics();
