import { makeOuterSector } from './outerSectors';

export default makeOuterSector({
  name: 'Event Horizon', length: 5000, difficulty: 4,
  armorAt: 420, heartAt: 2720, bonusArmorAt: 3100,
  blockGroups: [[550, 300, 6], [1090, 350, 6], [1640, 270, 6], [2200, 330, 7], [2800, 250, 7], [3440, 310, 7], [4070, 270, 7], [4600, 340, 5]],
  enemySpawns: [
    ['skitter', 550], ['pulseDrone', 810], ['orbitSkimmer', 1070], ['rollpod', 1340],
    ['skitter', 1620], ['prismite', 1880], ['pulseDrone', 2160], ['orbitSkimmer', 2430],
    ['skitter', 2700], ['pebblit', 2980], ['pulseDrone', 3250], ['orbitSkimmer', 3530],
    ['rollpod', 3800], ['skitter', 4110], ['pulseDrone', 4410], ['warden', 4740],
  ],
});
