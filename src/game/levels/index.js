import level1 from './level1';
import level2 from './level2';
import level3 from './level3';

// The registry lists only levels that can currently be played to completion.
const levels = [level1, level2, level3];

export function getLevelData(levelNumber) {
  const level = levels[levelNumber - 1];
  if (!Number.isInteger(levelNumber) || !level) {
    throw new RangeError(`Level ${levelNumber} is unavailable`);
  }
  return level;
}

export function hasNextLevel(levelNumber) {
  return levelNumber < levels.length;
}
