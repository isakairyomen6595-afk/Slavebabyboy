function startCircleWalk(bot, defaultMove) {
  console.log('[Movement] Circle walk started');

  let angle = 0;

  addInterval(() => {
    if (!bot || !botState.connected) return;

    angle += 0.25;

    const x = Math.cos(angle);
    const z = Math.sin(angle);

    bot.lookAt(
      bot.entity.position.offset(x * 3, 0, z * 3),
      true
    ).catch(() => {});

    bot.setControlState('forward', true);
    bot.setControlState('left', Math.sin(angle) > 0);
    bot.setControlState('right', Math.sin(angle) < 0);
  }, 1000);

  bot.once('end', () => {
    bot.setControlState('forward', false);
    bot.setControlState('left', false);
    bot.setControlState('right', false);
  });
}

// ============================================================
// RANDOM JUMP
// ============================================================
function startRandomJump(bot) {
  console.log('[Movement] Random jump started');

  addInterval(() => {
    if (!bot || !botState.connected) return;

    bot.setControlState('jump', true);

    setTimeout(() => {
      if (bot) bot.setControlState('jump', false);
    }, 200);
  }, 5000);
}

// ============================================================
// LOOK AROUND
// ============================================================
function startLookAround(bot) {
  console.log('[Movement] Look-around started');

  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity) return;

    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;

    bot.look(yaw, pitch, true).catch(() => {});
  }, 5000);
}

// ============================================================
// AVOID MOBS
// ============================================================
function avoidMobs(bot) {
  console.log('[Module] Mob avoidance enabled');

  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity) return;

    const mobs = Object.values(bot.entities).filter(entity =>
      entity.type === 'mob' &&
      entity.position &&
      bot.entity.position.distanceTo(entity.position) < 5
    );

    if (mobs.length > 0) {
      bot.setControlState('back', true);

      setTimeout(() => {
        if (bot) bot.setControlState('back', false);
      }, 1000);
    }
  }, 2000);
}

// ============================================================
// COMBAT MODULE
// ============================================================
function combatModule(bot, mcData) {
  console.log('[Module] Combat module enabled');

  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity) return;

    const target = Object.values(bot.entities).find(entity =>
      entity.type === 'mob' &&
      entity.position &&
      bot.entity.position.distanceTo(entity.position) < 4
    );

    if (target) {
      bot.lookAt(target.position.offset(0, 1, 0), true)
        .then(() => bot.attack(target))
        .catch(() => {});
    }
  }, 1500);
}

// ============================================================
// BED MODULE
// ============================================================
function bedModule(bot, mcData) {
  console.log('[Module] Bed module enabled');
}

// ============================================================
// CHAT MODULE
// ============================================================
function chatModule(bot) {
  console.log('[Module] Chat module enabled');

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    if (message.toLowerCase() === 'hi') {
      bot.chat(`Hello ${username}!`);
    }
  });
}

// ============================================================
// START BOT
// ============================================================
console.log('============================================================');
console.log('[System] Minecraft AFK Bot starting...');
console.log('============================================================');

createBot();
