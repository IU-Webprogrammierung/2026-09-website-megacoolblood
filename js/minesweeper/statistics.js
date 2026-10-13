const statisticsList = document.querySelector('#statistics-list');
const statisticsStorageKey = 'lycheelab-statistics';
const difficultyLabels = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  expert: 'Experte'
};

function getStatistics() {
  try {
    const storedStatistics = JSON.parse(localStorage.getItem(statisticsStorageKey) || '{}');
    return storedStatistics && typeof storedStatistics === 'object' ? storedStatistics : {};
  } catch {
    return {};
  }
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
    const data = statistics[difficulty];
    const card = document.createElement('article');
    const heading = document.createElement('h2');
    const values = document.createElement('dl');
    const gamesPlayed = Number(data.gamesPlayed) || 0;
    const wins = Number(data.wins) || 0;
    const successRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    card.className = 'statistics-card';
    heading.textContent = difficultyLabels[difficulty];
    values.append(
      createStatistic('Minen geräumt', Number(data.minesCleared) || 0),
      createStatistic('Erfolgsquote', `${successRate} %`),
      createStatistic('Aktuelle Serie', Number(data.currentStreak) || 0),
      createStatistic('Beste Serie', Number(data.bestStreak) || 0)
    );
    card.append(heading, values);
    statisticsList.append(card);
  });
}

renderStatistics();
