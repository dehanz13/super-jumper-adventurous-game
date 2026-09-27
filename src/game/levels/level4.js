import { makeOuterSector } from './outerSectors';

export default makeOuterSector({
  name: 'Aurora Outpost', length: 4200, difficulty: 1,
  armorAt: 380, heartAt: 2280,
  blockGroups: [[600, 370, 3], [1170, 310, 4], [1780, 360, 4], [2470, 300, 5], [3180, 350, 4], [3750, 320, 4]],
  enemySpawns: [
    ['pebblit', 590], ['skitter', 870], ['rollpod', 1160], ['orbitSkimmer', 1490],
    ['prismite', 1840], ['pulseDrone', 2170], ['skitter', 2600], ['pebblit', 3000],
    ['orbitSkimmer', 3480], ['pulseDrone', 3890],
  ],
});
