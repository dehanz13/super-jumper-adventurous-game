const level = {
  name: "Crystal Caverns",
  maxOffset: 3200,
  platforms: [
    // Ground sections with larger gaps
    { x: 0, y: 500, width: 500, height: 100, type: 'ground' },
    { x: 650, y: 500, width: 400, height: 100, type: 'ground' },
    { x: 1200, y: 500, width: 300, height: 100, type: 'ground' },
    { x: 1700, y: 500, width: 500, height: 100, type: 'ground' },
    { x: 2400, y: 500, width: 400, height: 100, type: 'ground' },
    { x: 3000, y: 500, width: 800, height: 100, type: 'ground' },

    // Staircase platforms
    { x: 200, y: 420, width: 80, height: 30, type: 'brick' },
    { x: 300, y: 350, width: 80, height: 30, type: 'brick' },
    { x: 400, y: 280, width: 80, height: 30, type: 'question' },

    // Floating platform bridge over gap
    { x: 520, y: 380, width: 60, height: 30, type: 'brick' },
    { x: 600, y: 350, width: 60, height: 30, type: 'brick' },

    // Vertical challenge section
    { x: 750, y: 400, width: 100, height: 30, type: 'brick' },
    { x: 850, y: 320, width: 50, height: 30, type: 'question' },
    { x: 950, y: 240, width: 100, height: 30, type: 'brick' },
    { x: 1050, y: 160, width: 50, height: 30, type: 'question' },

    // Platform path over large gap
    { x: 1100, y: 350, width: 60, height: 30, type: 'brick' },
    { x: 1180, y: 300, width: 60, height: 30, type: 'brick' },

    // Zigzag platforms
    { x: 1350, y: 400, width: 100, height: 30, type: 'brick' },
    { x: 1500, y: 320, width: 100, height: 30, type: 'question' },
    { x: 1650, y: 400, width: 100, height: 30, type: 'brick' },

    // Challenge tower
    { x: 1850, y: 420, width: 120, height: 30, type: 'brick' },
    { x: 1880, y: 340, width: 60, height: 30, type: 'brick' },
    { x: 1850, y: 260, width: 120, height: 30, type: 'question' },
    { x: 1880, y: 180, width: 60, height: 30, type: 'brick' },

    // Bridge to final section
    { x: 2050, y: 350, width: 80, height: 30, type: 'brick' },
    { x: 2150, y: 320, width: 80, height: 30, type: 'brick' },
    { x: 2250, y: 350, width: 80, height: 30, type: 'brick' },
    { x: 2350, y: 380, width: 80, height: 30, type: 'brick' },

    // Descending platforms
    { x: 2500, y: 400, width: 100, height: 30, type: 'brick' },
    { x: 2650, y: 350, width: 50, height: 30, type: 'question' },
    { x: 2750, y: 300, width: 100, height: 30, type: 'brick' },
    { x: 2900, y: 250, width: 50, height: 30, type: 'question' },

    // Final approach
    { x: 3100, y: 380, width: 150, height: 30, type: 'brick' },
    { x: 3300, y: 320, width: 100, height: 30, type: 'brick' },
    { x: 3450, y: 260, width: 100, height: 30, type: 'brick' },
  ],
  coins: [
    // Staircase coins
    { x: 230, y: 370, collected: false },
    { x: 330, y: 300, collected: false },
    { x: 430, y: 230, collected: false },
    // Bridge coins
    { x: 540, y: 330, collected: false },
    { x: 620, y: 300, collected: false },
    // Vertical section
    { x: 790, y: 350, collected: false },
    { x: 865, y: 270, collected: false },
    { x: 990, y: 190, collected: false },
    { x: 1065, y: 110, collected: false },
    // Gap crossing
    { x: 1120, y: 300, collected: false },
    { x: 1200, y: 250, collected: false },
    // Zigzag
    { x: 1390, y: 350, collected: false },
    { x: 1540, y: 270, collected: false },
    { x: 1690, y: 350, collected: false },
    // Tower
    { x: 1900, y: 370, collected: false },
    { x: 1900, y: 290, collected: false },
    { x: 1900, y: 210, collected: false },
    { x: 1900, y: 130, collected: false },
    // Bridge
    { x: 2080, y: 300, collected: false },
    { x: 2180, y: 270, collected: false },
    { x: 2280, y: 300, collected: false },
    { x: 2380, y: 330, collected: false },
    // Descending
    { x: 2540, y: 350, collected: false },
    { x: 2665, y: 300, collected: false },
    { x: 2790, y: 250, collected: false },
    { x: 2915, y: 200, collected: false },
    // Final
    { x: 3160, y: 330, collected: false },
    { x: 3340, y: 270, collected: false },
    { x: 3490, y: 210, collected: false },
  ],
  enemies: [
    { x: 300, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'pebblit' },
    { x: 600, y: 455, width: 40, height: 48, velocityX: -2, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    { x: 900, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'pebblit' },
    { x: 1100, y: 455, width: 36, height: 36, velocityX: -1.5, alive: true, type: 'prismite' },
    { x: 1400, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'pebblit' },
    { x: 1600, y: 455, width: 40, height: 48, velocityX: -2.5, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    { x: 1800, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'pebblit' },
    { x: 2000, y: 455, width: 36, height: 36, velocityX: -2, alive: true, type: 'prismite' },
    { x: 2200, y: 455, width: 40, height: 48, velocityX: -2.5, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    { x: 2500, y: 455, width: 40, height: 40, velocityX: -2.5, alive: true, type: 'pebblit' },
    { x: 2700, y: 455, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'prismite' },
    { x: 3100, y: 455, width: 40, height: 40, velocityX: -2.5, alive: true, type: 'pebblit' },
    { x: 3300, y: 455, width: 40, height: 48, velocityX: -3, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    { x: 3450, y: 436, width: 64, height: 64, velocityX: 0, alive: true, type: 'warden', hp: 8, maxHp: 8, fireTimer: 0, jumpTimer: 0, facingLeft: true },
  ],
  powerUps: [
    { x: 430, y: 250, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
    { x: 865, y: 290, type: 'plasma', collected: false, spawned: false },
    { x: 1540, y: 290, type: 'spectrum', collected: false, velocityX: 2, spawned: false },
    { x: 2665, y: 320, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
    { x: 2915, y: 220, type: 'plasma', collected: false, spawned: false },
  ],
  flag: { x: 3600, y: 200, width: 20, height: 300 }
};

export default level;
