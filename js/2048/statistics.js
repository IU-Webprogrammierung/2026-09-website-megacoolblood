const statisticsList = document.querySelector('#statistics-list');
const statisticsStatus = document.querySelector('#statistics-status');
const statisticsKey = 'lycheelab-2048-statistics';
const defaultStatistics = {
  actions: 0,
  gamesStarted: 0,
  highestTile: 0,
  invalidMoves: 0,
  losses: 0,
  moves: 0,
  totalScore: 0,
  undos: 0,
  wins: 0
};

function readStatistics() {
  try {
  const storedStatistics = JSON.parse(localStorage.getItem(statisticsKey) || '{}');

  return Object.keys(defaultStatistics).reduce((statistics, key) => {
   const value = Number(storedStatistics[key]);
   statistics[key] = Number.isFinite(value) && value >= 0 ? value : defaultStatistics[key];
   return statistics;
  }, { ...defaultStatistics });
  } catch {
  return { ...defaultStatistics };
  }
}

function formatNumber(value) {
  return value.toLocaleString('de-DE');
}

function createStatistic(label, value) {
  const wrapper = document.createElement('div');
  const title = document.createElement('dt');
  const result = document.createElement('dd');

  title.textContent = label;
  result.textContent = formatNumber(value);
  wrapper.append(title, result);
  return wrapper;
}

function renderStatistics() {
  const statistics = readStatistics();
  const hasPlayed = statistics.gamesStarted > 0 || statistics.actions > 0;
  const values = document.createElement('dl');

  values.className = 'statistics-card';
  values.append(
  createStatistic('Gestartete Spiele', statistics.gamesStarted),
  createStatistic('Züge', statistics.moves),
  createStatistic('Ungültige Züge', statistics.invalidMoves),
  createStatistic('Aktionen gesamt', statistics.actions),
  createStatistic('Zurückgenommene Züge', statistics.undos),
  createStatistic('Siege mit 2048', statistics.wins),
  createStatistic('Niederlagen', statistics.losses),
  createStatistic('Höchster Stein', statistics.highestTile),
  createStatistic('Gesamtpunkte', statistics.totalScore)
  );

  statisticsList.replaceChildren(values);
  statisticsStatus.textContent = hasPlayed
  ? 'Die Werte werden nach jedem Spielzug lokal aktualisiert.'
  : 'Noch keine 2048-Aktionen gespeichert.';
}

renderStatistics();
