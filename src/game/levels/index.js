import level1 from './level1';
import level2 from './level2';
import level3 from './level3';
import level4 from './level4';
import level5 from './level5';
import level6 from './level6';
import level7 from './level7';

// SHA-256 of JSON.stringify(levels). Bump with every map edit.
export const LEVEL_SET_VERSION = 'sha256:6f72fe1026a63a69e5c97a385c7c51a7c4cd19b51b4b82858df39b0cec88361f';

// The registry lists only levels that can currently be played to completion.
function freezeLevel(level) {
  for (const value of Object.values(level)) {
    if (Array.isArray(value)) {
      value.forEach(Object.freeze);
      Object.freeze(value);
    } else if (value && typeof value === 'object') {
      Object.freeze(value);
    }
  }
  return Object.freeze(level);
}

const levels = Object.freeze([level1, level2, level3, level4, level5, level6, level7].map(freezeLevel));

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
