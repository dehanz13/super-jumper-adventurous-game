const level = {
  name: "Launch Fields",
  maxOffset: 2600,
  platforms: [
    // A continuous safe route lets the first sector teach movement and jumps.
    { x: 0, y: 500, width: 3500, height: 100, type: 'ground' },

    // Floating platforms - easy jumps
    { x: 300, y: 380, width: 100, height: 30, type: 'brick' },
    { x: 450, y: 300, width: 50, height: 30, type: 'question' },
    { x: 550, y: 300, width: 100, height: 30, type: 'brick' },
    { x: 700, y: 220, width: 50, height: 30, type: 'question' },

    { x: 1000, y: 350, width: 150, height: 30, type: 'brick' },
    { x: 1200, y: 280, width: 100, height: 30, type: 'brick' },
    { x: 1350, y: 200, width: 50, height: 30, type: 'question' },

    { x: 1700, y: 380, width: 200, height: 30, type: 'brick' },
    { x: 1950, y: 300, width: 100, height: 30, type: 'brick' },
    { x: 2100, y: 220, width: 150, height: 30, type: 'brick' },

    { x: 2600, y: 350, width: 100, height: 30, type: 'question' },
    { x: 2800, y: 280, width: 150, height: 30, type: 'brick' },
    { x: 3000, y: 200, width: 100, height: 30, type: 'brick' },
  ],
  coins: [
    { x: 320, y: 330, collected: false },
    { x: 360, y: 330, collected: false },
    { x: 465, y: 250, collected: false },
    { x: 570, y: 250, collected: false },
    { x: 610, y: 250, collected: false },
    { x: 715, y: 170, collected: false },
    { x: 1050, y: 300, collected: false },
    { x: 1100, y: 300, collected: false },
    { x: 1230, y: 230, collected: false },
    { x: 1365, y: 150, collected: false },
    { x: 1780, y: 330, collected: false },
    { x: 1830, y: 330, collected: false },
    { x: 1980, y: 250, collected: false },
    { x: 2150, y: 170, collected: false },
    { x: 2200, y: 170, collected: false },
    { x: 2630, y: 300, collected: false },
    { x: 2860, y: 230, collected: false },
    { x: 2910, y: 230, collected: false },
    { x: 3030, y: 150, collected: false },
  ],
  enemies: [
    { x: 500, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'pebblit' },
    { x: 1100, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'pebblit' },
    { x: 1700, y: 455, width: 40, height: 48, velocityX: -1.5, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    { x: 2350, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'pebblit' },
    { x: 2850, y: 455, width: 40, height: 40, velocityX: -1.5, alive: true, type: 'pebblit' },
  ],
  powerUps: [
    { x: 465, y: 270, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
    { x: 715, y: 190, type: 'plasma', collected: false, spawned: false },
    { x: 1365, y: 170, type: 'spectrum', collected: false, velocityX: 2, spawned: false },
    { x: 2630, y: 320, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
  ],
  flag: { x: 3200, y: 200, width: 20, height: 300 }
};

export default level;
