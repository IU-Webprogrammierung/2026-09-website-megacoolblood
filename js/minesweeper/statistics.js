const statisticsList = document.querySelector('#statistics-list');
const presetOrder = Object.keys(minesweeperDifficulty.presets);

function getStatistics() {
  return minesweeperRunState.readStatistics() ?? {};
}

function getRulesRank(config) {
  const deviations = [!config.extraLives, !config.checks, config.noGuess];
  const count = deviations.filter(Boolean).length;
  const pattern = deviations.reduce((sum, isDeviation, index) => sum + (isDeviation ? 2 ** index : 0), 0);

  return count * 8 + pattern;
}

function compareDifficulties(first, second) {
  const firstPreset = minesweeperDifficulty.getPresetName(first.config);
  const secondPreset = minesweeperDifficulty.getPresetName(second.config);
  const sizeOrder = (entry, preset) => (preset ? [0, presetOrder.indexOf(preset), 0, 0] : [
    1,
    entry.config.rows * entry.config.columns,
    entry.config.mines,
    entry.config.rows
  ]);
  const firstOrder = [...sizeOrder(first, firstPreset), getRulesRank(first.config)];
  const secondOrder = [...sizeOrder(second, secondPreset), getRulesRank(second.config)];
  const difference = firstOrder.findIndex((value, index) => value !== secondOrder[index]);

  return difference === -1 ? 0 : firstOrder[difference] - secondOrder[difference];
}

function getAvailableDifficulties(statistics) {
  return Object.keys(statistics)
    .filter((key) => statistics[key] && typeof statistics[key] === 'object')
    .map((key) => ({ key, config: minesweeperDifficulty.parseDifficultyKey(key) }))
    .filter((entry) => entry.config)
    .sort(compareDifficulties);
}

function createStatistic(label, value) {
  const wrapper = document.createElement('div');
  const title = document.createElement('dt');
  const result = document.createElement('dd');
  title.textContent = label;
  result.append(value);
  wrapper.append(title, result);
  return wrapper;
}

// Visible as "01:23", read out as "1 Minute 23 Sekunden"; "–" when no timed win exists.
function createDuration(milliseconds, hasValue) {
  if (!hasValue) {
    return '–';
  }

  const time = document.createElement('time');
  const visibleText = document.createElement('span');
  const spokenText = document.createElement('span');

  time.dateTime = `PT${Math.floor(milliseconds / 1000)}S`;
  visibleText.setAttribute('aria-hidden', 'true');
  visibleText.textContent = minesweeperRunState.formatClockDuration(milliseconds);
  spokenText.className = 'visually-hidden';
  spokenText.textContent = minesweeperRunState.describeDuration(milliseconds);
  time.append(visibleText, spokenText);
  return time;
}

function renderStatistics() {
  const statistics = getStatistics();
  statisticsList.replaceChildren();
  const availableDifficulties = getAvailableDifficulties(statistics);

  if (availableDifficulties.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'Noch keine Statistiken vorhanden. Spiele zuerst eine Runde Minesweeper.';
    statisticsList.append(emptyState);
    return;
  }

  availableDifficulties.forEach(({ key, config }) => {
    const data = minesweeperRunState.readDifficultyStatistics(statistics, key);
    const card = document.createElement('article');
    const heading = document.createElement('h2');
    const values = document.createElement('dl');
    const gamesPlayed = data.gamesPlayed;
    const wins = data.wins;
    const successRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const hasTimes = data.timedWins > 0;
    const averageTimeMs = hasTimes ? Math.round(data.totalWinTimeMs / data.timedWins) : 0;
    const formatCount = (value) => value.toLocaleString('de-DE');

    card.className = 'statistics-card';
    heading.textContent = minesweeperDifficulty.getDifficultyLabel(config);
    values.append(
      createStatistic('Gewonnene Spiele', `${formatCount(wins)} von ${formatCount(gamesPlayed)}`),
      createStatistic('Erfolgsquote', `${successRate} %`),
      createStatistic('Minen geräumt', formatCount(data.minesCleared)),
      createStatistic('Falsche Flaggen', formatCount(data.wrongFlags)),
      createStatistic('Bestzeit', createDuration(data.bestTimeMs, hasTimes)),
      createStatistic('Durchschnittszeit', createDuration(averageTimeMs, hasTimes)),
      createStatistic('Langsamste Zeit', createDuration(data.slowestTimeMs, hasTimes)),
      createStatistic('Aktuelle Serie', formatCount(data.currentStreak)),
      createStatistic('Größte Siegesserie', formatCount(data.bestStreak)),
      createStatistic('Höchster Score', formatCount(data.bestSeriesRevealedFields))
    );
    card.append(heading, values);
    statisticsList.append(card);
  });
}

renderStatistics();
