export const GRAVITY = 0.6;
export const JUMP_FORCE = -14;
const MOVE_SPEED = 5;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

// One simulation step. Rendering and block rewards consume the returned events.
export function stepPlayerPhysics(player, input, platforms) {
  const next = { ...player };
  const headHits = [];

  if (input.left) {
    next.velocityX = -MOVE_SPEED;
    next.facingRight = false;
  } else if (input.right) {
    next.velocityX = MOVE_SPEED;
    next.facingRight = true;
  } else {
    next.velocityX *= 0.8;
  }

  const jumped = input.jump && next.onGround;
  if (jumped) {
    next.velocityY = JUMP_FORCE;
    next.onGround = false;
    next.isJumping = true;
  }

  next.velocityY += GRAVITY;
  next.x += next.velocityX;
  next.y += next.velocityY;

  const wasOnGround = next.onGround;
  next.onGround = false;
  platforms.forEach((platform, index) => {
    if (!overlaps(next, platform)) return;

    if (next.velocityY > 0 && next.y + next.height - next.velocityY <= platform.y) {
      next.y = platform.y - next.height;
      next.velocityY = 0;
      next.onGround = true;
      next.isJumping = false;
    } else if (next.velocityY < 0 && next.y - next.velocityY >= platform.y + platform.height) {
      next.y = platform.y + platform.height;
      next.velocityY = 0;
      headHits.push(index);
    } else if (next.velocityX > 0) {
      next.x = platform.x - next.width;
    } else if (next.velocityX < 0) {
      next.x = platform.x + platform.width;
    }
  });

  return { player: next, jumped, landed: next.onGround && !wasOnGround, headHits };
}
