const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const config = require('./settings.json');
const express = require('express');
const http = require('http');
const https = require('https');

// ============================================================
// EXPRESS SERVER
// ============================================================

const app = express();
const PORT = process.env.PORT || 5000;

let bot = null;
let activeIntervals = [];
let reconnectTimeout = null;
let isReconnecting = false;

let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: []
};

// ============================================================
// DASHBOARD
// ============================================================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>${config.name} Status</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }

    .container {
      background: #1e293b;
      padding: 35px;
      border-radius: 20px;
      text-align: center;
      width: 400px;
      max-width: 85%;
    }

    h1 {
      color: #ccfbf1;
    }

    .card {
      background: #0f172a;
      padding: 15px;
      margin: 15px 0;
      border-radius: 12px;
      text-align: left;
      border-left: 5px solid #2dd4bf;
    }

    .label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .value {
      font-size: 18px;
      font-weight: bold;
      color: #2dd4bf;
      margin-top: 5px;
    }

    .dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ef4444;
      margin-right: 8px;
    }

    a {
      display: inline-block;
      margin-top: 15px;
      padding: 10px 20px;
      background: #2dd4bf;
      color: #0f172a;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
    }
  </style>
</head>

<body>

<div class="container">

  <h1>
    <span id="dot" class="dot"></span>
    ${config.name}
  </h1>

  <div class="card">
    <div class="label">Status</div>
    <div class="value" id="status">Connecting...</div>
  </div>

  <div class="card">
    <div class="label">Uptime</div>
    <div class="value" id="uptime">0h 0m 0s</div>
  </div>

  <div class="card">
    <div class="label">Coordinates</div>
    <div class="value" id="coords">Waiting...</div>
  </div>

  <div class="card">
    <div class="label">Server</div>
    <div class="value">${config.server.ip}</div>
  </div>

  <a href="/tutorial">Setup Guide</a>

</div>

<script>

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return h + 'h ' + m + 'm ' + s + 's';
}

async function update() {

  try {

    const response = await fetch('/health');
    const data = await response.json();

    const status = document.getElementById('status');
    const uptime = document.getElementById('uptime');
    const coords = document.getElementById('coords');
    const dot = document.getElementById('dot');

    if (data.status === 'connected') {

      status.innerText = 'Online & Running';
      status.style.color = '#2dd4bf';

      dot.style.background = '#4ade80';

    } else {

      status.innerText = 'Reconnecting...';
      status.style.color = '#f87171';

      dot.style.background = '#f87171';
    }

    uptime.innerText = formatUptime(data.uptime);

    if (data.coords) {

      coords.innerText =
        'X: ' + Math.floor(data.coords.x) +
        ' | Y: ' + Math.floor(data.coords.y) +
        ' | Z: ' + Math.floor(data.coords.z);

    } else {

      coords.innerText = 'Unknown Location';

    }

  } catch (err) {

    document.getElementById('status').innerText =
      'System Offline';

  }
}

setInterval(update, 1000);
update();

</script>

</body>
</html>
  `);
});

// ============================================================
// TUTORIAL
// ============================================================

app.get('/tutorial', (req, res) => {

  res.send(`
<!DOCTYPE html>
<html>

<head>

<title>${config.name} Setup Guide</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #0f172a;
  color: #cbd5e1;
  padding: 30px;
  max-width: 800px;
  margin: auto;
  line-height: 1.6;
}

h1, h2 {
  color: #2dd4bf;
}

.card {
  background: #1e293b;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

a {
  color: #38bdf8;
}

code {
  background: #334155;
  padding: 3px 6px;
  border-radius: 5px;
}

</style>

</head>

<body>

<h1>AFK Bot Setup Guide</h1>

<div class="card">

<h2>Aternos</h2>

<p>Make sure your Minecraft server is online and your IP and port are correct in settings.json.</p>

</div>

<div class="card">

<h2>Bot</h2>

<p>The bot connects automatically and will attempt to reconnect when disconnected.</p>

</div>

<div class="card">

<h2>Dashboard</h2>

<p>This page shows the bot's connection status and coordinates.</p>

</div>

<a href="/">Back to Dashboard</a>

</body>

</html>
  `);

});

// ============================================================
// HEALTH
// ============================================================

app.get('/health', (req, res) => {

  res.json({

    status: botState.connected
      ? 'connected'
      : 'disconnected',

    uptime: Math.floor(
      (Date.now() - botState.startTime) / 1000
    ),

    coords:
      bot && bot.entity
        ? bot.entity.position
        : null,

    lastActivity: botState.lastActivity,

    reconnectAttempts:
      botState.reconnectAttempts,

    memoryUsage:
      process.memoryUsage().heapUsed /
      1024 /
      1024
  });

});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `[Server] HTTP server started on port ${PORT}`
  );

});

// ============================================================
// DISCORD WEBHOOK
// ============================================================

function sendDiscordWebhook(message, color = 0x2dd4bf) {

  if (
    !config.discord ||
    !config.discord.webhook ||
    !config.discord.webhook.url
  ) {
    return;
  }

  try {

    const webhookUrl =
      new URL(config.discord.webhook.url);

    const data = JSON.stringify({

      embeds: [
        {
          description: message,
          color: color
        }
      ]

    });

    const request = https.request({

      hostname: webhookUrl.hostname,
      path: webhookUrl.pathname + webhookUrl.search,
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }

    });

    request.on('error', () => {});

    request.write(data);
    request.end();

  } catch (err) {

    console.log(
      '[Discord] Webhook error:',
      err.message
    );

  }

}

// ============================================================
// KEEP ALIVE
// ============================================================

const SELF_PING_INTERVAL = 10 * 60 * 1000;

function startSelfPing() {

  setInterval(() => {

    const url =
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${PORT}`;

    const protocol =
      url.startsWith('https')
        ? https
        : http;

    protocol
      .get(`${url}/ping`, () => {})
      .on('error', () => {});

  }, SELF_PING_INTERVAL);

  console.log(
    '[KeepAlive] Self-ping started.'
  );

}

startSelfPing();

// ============================================================
// MEMORY MONITOR
// ============================================================

setInterval(() => {

  const mem = process.memoryUsage();

  const heapMB =
    (mem.heapUsed / 1024 / 1024)
      .toFixed(2);

  console.log(
    `[Memory] Heap: ${heapMB} MB`
  );

}, 5 * 60 * 1000);

// ============================================================
// INTERVAL HELPERS
// ============================================================

function clearAllIntervals() {

  console.log(
    `[Cleanup] Clearing ${activeIntervals.length} intervals`
  );

  activeIntervals.forEach(id => {
    clearInterval(id);
  });

  activeIntervals = [];

}

function addInterval(callback, delay) {

  const id =
    setInterval(callback, delay);

  activeIntervals.push(id);

  return id;

}

// ============================================================
// RECONNECT DELAY
// ============================================================

function getReconnectDelay() {

  const utils = config.utils || {};

  const baseDelay =
    utils['auto-reconnect-delay'] || 2000;

  const maxDelay =
    utils['max-reconnect-delay'] || 15000;

  return Math.min(
    baseDelay +
      botState.reconnectAttempts * 1000,
    maxDelay
  );

}

// ============================================================
// CREATE BOT
// ============================================================

function createBot() {

  if (isReconnecting) {

    console.log(
      '[Bot] Already reconnecting.'
    );

    return;
  }

  if (bot) {

    clearAllIntervals();

    try {

      bot.removeAllListeners();
      bot.end();

    } catch (err) {

      console.log(
        '[Cleanup] Error:',
        err.message
      );

    }

    bot = null;

  }

  console.log(
    '[Bot] Creating bot instance...'
  );

  console.log(
    `[Bot] Connecting to ${config.server.ip}:${config.server.port}`
  );

  try {

    bot = mineflayer.createBot({

      username:
        config['bot-account'].username,

      password:
        config['bot-account'].password ||
        undefined,

      auth:
        config['bot-account'].type,

      host:
        config.server.ip,

      port:
        config.server.port,

      version:
        config.server.version,

      hideErrors: false,

      checkTimeoutInterval:
        120000

    });

    bot.loadPlugin(pathfinder);

    const connectionTimeout =
      setTimeout(() => {

        if (!botState.connected) {

          console.log(
            '[Bot] Connection timeout.'
          );

          scheduleReconnect();

        }

      }, 60000);

    // ========================================================
    // SPAWN
    // ========================================================

    bot.once('spawn', () => {

      clearTimeout(connectionTimeout);

      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      console.log(
        '[Bot] [+] Successfully spawned!'
      );

      // ======================================================
      // LOGIN
      // ======================================================

      bot.on('messagestr', msg => {

        const message =
          msg.toLowerCase();

        if (
          message.includes('login')
        ) {

          bot.chat('/login Perzuu');

          console.log(
            '[Auth] Login sent.'
          );

        }

        if (
          message.includes('register')
        ) {

          bot.chat(
            '/register Perzuu Perzuu'
          );

          console.log(
            '[Auth] Register sent.'
          );

        }

        if (
          message.includes(
            'commands.gamemode.success.self'
          ) ||
          message.includes(
            'set own game mode to creative mode'
          )
        ) {

          console.log(
            '[INFO] Creative Mode enabled.'
          );

          bot.chat(
            '/gamerule sendCommandFeedback false'
          );

        }

      });

      // ======================================================
      // MINECRAFT DATA
      // ======================================================

      const mcData =
        require('minecraft-data')(
          config.server.version
        );

      const defaultMove =
        new Movements(
          bot,
          mcData
        );

      initializeModules(
        bot,
        mcData,
        defaultMove
      );

      setupLeaveRejoin(
        bot,
        createBot
      );

      // ======================================================
      // COMMANDS
      // ======================================================

      setTimeout(() => {

        if (
          bot &&
          botState.connected
        ) {

          bot.chat(
            '/gamerule sendCommandFeedback false'
          );

        }

      }, 3000);

      setTimeout(() => {

        if (
          bot &&
          botState.connected
        ) {

          bot.chat(
            '/gamemode creative'
          );

          console.log(
            '[INFO] Creative command sent.'
          );

        }

      }, 4000);

      // ======================================================
      // DISCORD
      // ======================================================

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.connect
      ) {

        sendDiscordWebhook(
          `[+] **Connected** to \`${config.server.ip}\``,
          0x4ade80
        );

      }

    });

    // ========================================================
    // END
    // ========================================================

    bot.on('end', reason => {

      console.log(
        `[Bot] Disconnected: ${reason || 'Unknown reason'}`
      );

      botState.connected = false;

      clearAllIntervals();

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect &&
        reason !== 'Periodic Rejoin'
      ) {

        sendDiscordWebhook(
          `[-] **Disconnected**: ${reason || 'Unknown'}`,
          0xf87171
        );

      }

      if (
        config.utils &&
        config.utils['auto-reconnect']
      ) {

        scheduleReconnect();

      }

    });

    // ========================================================
    // KICK
    // ========================================================

    bot.on('kicked', reason => {

      console.log(
        '[KICK]',
        typeof reason === 'string'
          ? reason
          : JSON.stringify(
              reason,
              null,
              2
            )
      );

    });

    // ========================================================
    // ERROR
    // ========================================================

    bot.on('error', err => {

      console.log(
        `[Bot] Error: ${err.message}`
      );

      botState.errors.push({

        type: 'error',

        message:
          err.message,

        time:
          Date.now()

      });

    });

  } catch (err) {

    console.log(
      `[Bot] Failed: ${err.message}`
    );

    scheduleReconnect();

  }

}

// ============================================================
// RECONNECT
// ============================================================

function scheduleReconnect() {

  if (reconnectTimeout) {

    clearTimeout(
      reconnectTimeout
    );

  }

  if (isReconnecting) {
    return;
  }

  isReconnecting = true;

  botState.reconnectAttempts++;

  const delay =
    getReconnectDelay();

  console.log(
    `[Bot] Reconnecting in ${delay / 1000}s`
  );

  reconnectTimeout =
    setTimeout(() => {

      isReconnecting = false;

      createBot();

    }, delay);

}

// ============================================================
// MODULE INITIALIZATION
// ============================================================

function initializeModules(
  bot,
  mcData,
  defaultMove
) {

  console.log(
    '[Modules] Initializing...'
  );

  // ========================================================
  // POSITION
  // ========================================================

  if (
    config.position &&
    config.position.enabled
  ) {

    bot.pathfinder.setMovements(
      defaultMove
    );

    bot.pathfinder.setGoal(
      new GoalBlock(
        config.position.x,
        config.position.y,
        config.position.z
      )
    );

  }

  // ========================================================
  // ANTI AFK
  // ========================================================

  if (
    config.utils &&
    config.utils['anti-afk'] &&
    config.utils['anti-afk'].enabled
  ) {

    addInterval(() => {

      if (
        !bot ||
        !botState.connected
      ) {
        return;
      }

      bot.setControlState(
        'jump',
        true
      );

      setTimeout(() => {

        if (bot) {

          bot.setControlState(
            'jump',
            false
          );

        }

      }, 100);

      botState.lastActivity =
        Date.now();

    }, 30000);

    if (
      config.utils['anti-afk'].sneak
    ) {

      bot.setControlState(
        'sneak',
        true
      );

    }

  }

  // ========================================================
  // MOVEMENT
  // ========================================================

  if (
    config.movement &&
    config.movement['circle-walk'] &&
    config.movement['circle-walk'].enabled
  ) {

    startCircleWalk(
      bot,
      defaultMove
    );

  }

  if (
    config.movement &&
    config.movement['random-jump'] &&
    config.movement['random-jump'].enabled
  ) {

    startRandomJump(bot);

  }

  if (
    config.movement &&
    config.movement['look-around'] &&
    config.movement['look-around'].enabled
  ) {

    startLookAround(bot);

  }

  // ========================================================
  // CUSTOM MODULES
  // ========================================================

  if (
    config.modules &&
    config.modules.avoidMobs
  ) {

    avoidMobs(bot);

  }

  if (
    config.modules &&
    config.modules.combat
  ) {

    combatModule(
      bot,
      mcData
    );

  }

  if (
    config.modules &&
    config.modules.beds
  ) {

    bedModule(
      bot,
      mcData
    );

  }

  if (
    config.modules &&
    config.modules.chat
  ) {

    chatModule(bot);

  }

  console.log(
    '[Modules] All modules initialized!'
  );

}

// ============================================================
// LEAVE / REJOIN
// ============================================================

let setupLeaveRejoin;

try {

  setupLeaveRejoin =
    require('./leaveRejoin');

} catch (err) {

  console.log(
    '[Rejoin] leaveRejoin.js not found. Rejoin module disabled.'
  );

  setupLeaveRejoin =
    () => {};

}

// ============================================================
// CIRCLE WALK
// ============================================================

function startCircleWalk(
  bot,
  defaultMove
) {

  console.log(
    '[Movement] Circle walk started'
  );

  let angle = 0;

  addInterval(() => {

    if (
      !bot ||
      !botState.connected ||
      !bot.entity
    ) {
      return;
    }

    angle += 0.25;

    const x =
      Math.cos(angle);

    const z =
      Math.sin(angle);

    bot.setControlState(
      'forward',
      true
    );

    bot.setControlState(
      'left',
      Math.sin(angle) > 0
    );

    bot.setControlState(
      'right',
      Math.sin(angle) < 0
    );

    bot.lookAt(
      bot.entity.position.offset(
        x * 3,
        0,
        z * 3
      ),
      true
    ).catch(() => {});

  }, 1000);

}

// ============================================================
// RANDOM JUMP
// ============================================================

function startRandomJump(bot) {

  console.log(
    '[Movement] Random jump started'
  );

  addInterval(() => {

    if (
      !bot ||
      !botState.connected
    ) {
      return;
    }

    bot.setControlState(
      'jump',
      true
    );

    setTimeout(() => {

      if (bot) {

       
