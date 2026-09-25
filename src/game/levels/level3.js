const level = {
  name: "Orbital Spires",
  maxOffset: 3800,
  platforms: [
    // Starting area
    { x: 0, y: 500, width: 300, height: 100, type: 'ground' },

    // Sky bridge - narrow platforms
    { x: 380, y: 450, width: 50, height: 30, type: 'brick' },
    { x: 480, y: 400, width: 50, height: 30, type: 'brick' },
    { x: 580, y: 350, width: 50, height: 30, type: 'question' },
    { x: 680, y: 300, width: 50, height: 30, type: 'brick' },
    { x: 780, y: 250, width: 50, height: 30, type: 'brick' },

    // Floating island
    { x: 880, y: 300, width: 200, height: 100, type: 'ground' },

    // Descending challenge
    { x: 1150, y: 350, width: 40, height: 30, type: 'brick' },
    { x: 1230, y: 400, width: 40, height: 30, type: 'brick' },
    { x: 1310, y: 450, width: 40, height: 30, type: 'question' },

    // Ground section
    { x: 1400, y: 500, width: 250, height: 100, type: 'ground' },
    // The tower is a high-reward route above recoverable ground.
    { x: 1600, y: 500, width: 800, height: 100, type: 'ground' },

    // Vertical tower climb
    { x: 1700, y: 450, width: 60, height: 30, type: 'brick' },
    { x: 1800, y: 380, width: 60, height: 30, type: 'brick' },
    { x: 1720, y: 310, width: 60, height: 30, type: 'question' },
    { x: 1650, y: 240, width: 60, height: 30, type: 'brick' },
    { x: 1720, y: 170, width: 60, height: 30, type: 'brick' },
    { x: 1650, y: 100, width: 60, height: 30, type: 'question' },

    // High bridge
    { x: 1800, y: 150, width: 40, height: 30, type: 'brick' },
    { x: 1880, y: 150, width: 40, height: 30, type: 'brick' },
    { x: 1960, y: 150, width: 40, height: 30, type: 'brick' },
    { x: 2040, y: 150, width: 40, height: 30, type: 'brick' },

    // Descending staircase
    { x: 2120, y: 200, width: 50, height: 30, type: 'brick' },
    { x: 2200, y: 260, width: 50, height: 30, type: 'brick' },
    { x: 2280, y: 320, width: 50, height: 30, type: 'question' },
    { x: 2360, y: 380, width: 50, height: 30, type: 'brick' },

    // Ground checkpoint
    { x: 2450, y: 500, width: 200, height: 100, type: 'ground' },
    // Recovery islands beneath the optional aerial gauntlet.
    { x: 2650, y: 500, width: 450, height: 100, type: 'ground' },
    { x: 3250, y: 500, width: 400, height: 100, type: 'ground' },
    { x: 3800, y: 500, width: 400, height: 100, type: 'ground' },

    // Gauntlet - alternating heights
    { x: 2720, y: 420, width: 40, height: 30, type: 'brick' },
    { x: 2800, y: 350, width: 40, height: 30, type: 'brick' },
    { x: 2880, y: 280, width: 40, height: 30, type: 'question' },
    { x: 2960, y: 350, width: 40, height: 30, type: 'brick' },
    { x: 3040, y: 420, width: 40, height: 30, type: 'brick' },
    { x: 3120, y: 350, width: 40, height: 30, type: 'brick' },
    { x: 3200, y: 280, width: 40, height: 30, type: 'question' },
    { x: 3280, y: 350, width: 40, height: 30, type: 'brick' },

    // Tiny platforms finale
    { x: 3380, y: 380, width: 30, height: 30, type: 'brick' },
    { x: 3450, y: 340, width: 30, height: 30, type: 'brick' },
    { x: 3520, y: 300, width: 30, height: 30, type: 'brick' },
    { x: 3590, y: 260, width: 30, height: 30, type: 'question' },

    // Final platform
    { x: 3700, y: 300, width: 150, height: 30, type: 'brick' },
    { x: 3850, y: 380, width: 350, height: 30, type: 'brick' },
    { x: 3900, y: 500, width: 300, height: 100, type: 'ground' },
  ],
  coins: [
    // Sky bridge
    { x: 395, y: 400, collected: false },
    { x: 495, y: 350, collected: false },
    { x: 595, y: 300, collected: false },
    { x: 695, y: 250, collected: false },
    { x: 795, y: 200, collected: false },
    // Floating island
    { x: 920, y: 250, collected: false },
    { x: 970, y: 250, collected: false },
    { x: 1020, y: 250, collected: false },
    // Descending
    { x: 1160, y: 300, collected: false },
    { x: 1240, y: 350, collected: false },
    { x: 1320, y: 400, collected: false },
    // Tower climb
    { x: 1720, y: 400, collected: false },
    { x: 1670, y: 330, collected: false },
    { x: 1740, y: 260, collected: false },
    { x: 1670, y: 190, collected: false },
    { x: 1740, y: 120, collected: false },
    { x: 1670, y: 50, collected: false },
    // High bridge
    { x: 1815, y: 100, collected: false },
    { x: 1895, y: 100, collected: false },
    { x: 1975, y: 100, collected: false },
    { x: 2055, y: 100, collected: false },
    // Descending staircase
    { x: 2135, y: 150, collected: false },
    { x: 2215, y: 210, collected: false },
    { x: 2295, y: 270, collected: false },
    { x: 2375, y: 330, collected: false },
    // Gauntlet
    { x: 2735, y: 370, collected: false },
    { x: 2815, y: 300, collected: false },
    { x: 2895, y: 230, collected: false },
    { x: 2975, y: 300, collected: false },
    { x: 3055, y: 370, collected: false },
    { x: 3135, y: 300, collected: false },
    { x: 3215, y: 230, collected: false },
    { x: 3295, y: 300, collected: false },
    // Finale
    { x: 3390, y: 330, collected: false },
    { x: 3460, y: 290, collected: false },
    { x: 3530, y: 250, collected: false },
    { x: 3600, y: 210, collected: false },
    // Final platform bonus
    { x: 3750, y: 250, collected: false },
    { x: 3800, y: 250, collected: false },
  ],
  enemies: [
    // Early enemies
    { x: 200, y: 455, width: 40, height: 40, velocityX: -2, alive: true, type: 'pebblit' },
    // Floating island enemies
    { x: 920, y: 255, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'prismite' },
    { x: 1000, y: 255, width: 40, height: 48, velocityX: 2.5, alive: true, type: 'rollpod', isShell: false, shellVelocity: 0 },
    // Ground section
    { x: 1450, y: 455, width: 40, height: 40, velocityX: -3, alive: true, type: 'pebblit' },
    { x: 1550, y: 455, width: 36, height: 36, velocityX: -2.5, alive: true, type: 'prismite' },
    // Hovermite in sky
    { x: 1700, y: 80, width: 40, height: 48, velocityX: 1.5, alive: true, type: 'hovermite', spawnTimer: 0 },
    // Checkpoint area
    { x: 2620, y: 455, width: 40, height: 40, velocityX: -3, alive: true, type: 'pebblit' },
    // Final ground
    { x: 4000, y: 436, width: 64, height: 64, velocityX: 0, alive: true, type: 'warden', hp: 10, maxHp: 10, fireTimer: 0, jumpTimer: 0, facingLeft: true },
  ],
  powerUps: [
    { x: 595, y: 320, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
    { x: 1320, y: 420, type: 'spectrum', collected: false, velocityX: 2, spawned: false },
    { x: 1740, y: 280, type: 'plasma', collected: false, spawned: false },
    { x: 2295, y: 290, type: 'spectrum', collected: false, velocityX: 2, spawned: false },
    { x: 2895, y: 250, type: 'plasma', collected: false, spawned: false },
    { x: 3600, y: 230, type: 'powerCell', collected: false, velocityX: 1, spawned: false },
  ],
  flag: { x: 4150, y: 200, width: 20, height: 300 }
};

export default level;
