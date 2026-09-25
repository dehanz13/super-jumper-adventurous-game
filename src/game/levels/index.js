import level1 from './level1';
import level2 from './level2';
import level3 from './level3';

// SHA-256 of JSON.stringify([level1, level2, level3]). Bump with every map edit.
export const LEVEL_SET_VERSION = 'sha256:2e77fac2230965b7a25f8e4234f154f9e2974be8ba1583303dcf649ba233bb5b';

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

const levels = Object.freeze([level1, level2, level3].map(freezeLevel));

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
