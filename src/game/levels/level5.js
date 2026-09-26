import { makeOuterSector } from './outerSectors';

export default makeOuterSector({
  name: 'Nebula Foundry', length: 4450, difficulty: 2,
  armorAt: 395, heartAt: 2420, bonusArmorAt: 3100,
  blockGroups: [[540, 340, 4], [1050, 300, 5], [1600, 360, 5], [2210, 280, 5], [2840, 330, 5], [3510, 290, 6], [4000, 350, 4]],
  enemySpawns: [
    ['skitter', 550], ['pulseDrone', 820], ['pebblit', 1100], ['orbitSkimmer', 1360],
    ['rollpod', 1650], ['skitter', 1930], ['prismite', 2230], ['pulseDrone', 2500],
    ['orbitSkimmer', 2790], ['skitter', 3100], ['rollpod', 3520], ['pulseDrone', 4050],
  ],
});
