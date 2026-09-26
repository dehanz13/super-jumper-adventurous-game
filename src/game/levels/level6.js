import { makeOuterSector } from './outerSectors';

export default makeOuterSector({
  name: 'Comet Relay', length: 4700, difficulty: 3,
  armorAt: 410, heartAt: 2530,
  blockGroups: [[570, 320, 5], [1120, 350, 5], [1700, 280, 6], [2300, 340, 6], [2910, 270, 6], [3510, 330, 6], [4170, 290, 6]],
  enemySpawns: [
    ['skitter', 550], ['orbitSkimmer', 800], ['pulseDrone', 1090], ['rollpod', 1370],
    ['skitter', 1670], ['prismite', 1960], ['orbitSkimmer', 2250], ['pulseDrone', 2530],
    ['skitter', 2800], ['pebblit', 3090], ['orbitSkimmer', 3380], ['rollpod', 3690],
    ['pulseDrone', 4040], ['skitter', 4390],
  ],
});
