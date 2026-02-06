const TILE = 32;
const MAP_W = 20;
const MAP_H = 14;

const tileMap = [
  "WWWWWWWWWWWWWWWWWWWW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WG.....G....G.....GW",
  "WG.GGGGG....GGGG..GW",
  "WG.G....GGGG....G.GW",
  "WG.G.GGG....GGG.G.GW",
  "WG...G..TTTT..G...GW",
  "WGGGGG..TTTT..GGGGGW",
  "WG...G..TTTT..G...GW",
  "WG.G.GGG....GGG.G.GW",
  "WG.G....GGGG....G.GW",
  "WG..GGGG....GGGG..GW",
  "WGGGGGGGGGGGGGGGGGGW",
  "WWWWWWWWWWWWWWWWWWWW"
];

const species = [
  {
    name: "Flameling",
    color: "#f97316",
    baseHp: 42,
    moves: [
      { name: "Spark", power: 10, accuracy: 0.95 },
      { name: "Ember Kick", power: 13, accuracy: 0.85 }
    ]
  },
  {
    name: "Leafairy",
    color: "#22c55e",
    baseHp: 48,
    moves: [
      { name: "Vine Tap", power: 9, accuracy: 0.95 },
      { name: "Petal Burst", power: 12, accuracy: 0.88 }
    ]
  },
  {
    name: "Aquabub",
    color: "#38bdf8",
    baseHp: 45,
    moves: [
      { name: "Bubble Shot", power: 10, accuracy: 0.95 },
      { name: "Wave Crash", power: 14, accuracy: 0.82 }
    ]
  },
  {
    name: "Boltusk",
    color: "#eab308",
    baseHp: 40,
    moves: [
      { name: "Zap Jab", power: 11, accuracy: 0.92 },
      { name: "Thunder Horn", power: 15, accuracy: 0.8 }
    ]
  }
];

const state = {
  mode: "overworld",
  player: { x: 2, y: 2, stepTicks: 0 },
  keys: new Set(),
  party: [spawnMonster("Leafairy", 5)],
  activeIndex: 0,
  encounter: null,
  turnLock: false,
  message: ""
};

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const dom = {
  objective: document.getElementById("objective"),
  partyList: document.getElementById("partyList"),
  overlay: document.getElementById("battleOverlay"),
  enemyName: document.getElementById("enemyName"),
  enemyHp: document.getElementById("enemyHp"),
  enemyHpBar: document.getElementById("enemyHpBar"),
  allyName: document.getElementById("allyName"),
  allyHp: document.getElementById("allyHp"),
  allyHpBar: document.getElementById("allyHpBar"),
  battleLog: document.getElementById("battleLog"),
  move1Btn: document.getElementById("move1Btn"),
  move2Btn: document.getElementById("move2Btn"),
  captureBtn: document.getElementById("captureBtn"),
  runBtn: document.getElementById("runBtn"),
  enemySprite: document.getElementById("enemySprite"),
  playerSprite: document.getElementById("playerSprite")
};

window.addEventListener("keydown", (e) => state.keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => state.keys.delete(e.key.toLowerCase()));

document.querySelector(".buttons").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action || state.mode !== "battle" || state.turnLock) return;

  if (action === "capture") return tryCapture();
  if (action === "run") return tryRun();
  if (action === "move1") return playerAttack(0);
  if (action === "move2") return playerAttack(1);
});

function spawnMonster(name, level = 3) {
  const template = species.find((s) => s.name === name) ?? species[0];
  return {
    name: template.name,
    color: template.color,
    level,
    maxHp: template.baseHp + level * 3,
    hp: template.baseHp + level * 3,
    moves: template.moves
  };
}

function randomWild() {
  const pick = species[Math.floor(Math.random() * species.length)];
  return spawnMonster(pick.name, 3 + Math.floor(Math.random() * 4));
}

function getActiveMon() {
  return state.party[state.activeIndex];
}

function stepGame() {
  if (state.mode === "overworld") {
    movePlayer();
    maybeEncounter();
  }
  draw();
  requestAnimationFrame(stepGame);
}

function movePlayer() {
  if (state.player.stepTicks > 0) {
    state.player.stepTicks -= 1;
    return;
  }

  const dir =
    state.keys.has("arrowup") || state.keys.has("w")
      ? [0, -1]
      : state.keys.has("arrowdown") || state.keys.has("s")
      ? [0, 1]
      : state.keys.has("arrowleft") || state.keys.has("a")
      ? [-1, 0]
      : state.keys.has("arrowright") || state.keys.has("d")
      ? [1, 0]
      : null;

  if (!dir) return;

  const [dx, dy] = dir;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!isWalkable(nx, ny)) return;

  state.player.x = nx;
  state.player.y = ny;
  state.player.stepTicks = 7;
}

function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const tile = tileMap[y][x];
  return tile !== "W";
}

function maybeEncounter() {
  const tile = tileMap[state.player.y][state.player.x];
  if (tile !== "G" || Math.random() > 0.028) return;

  state.encounter = randomWild();
  state.mode = "battle";
  state.turnLock = false;
  dom.overlay.classList.remove("hidden");
  dom.objective.textContent = "バトル中！技、捕獲、にげる を選ぼう。";
  setBattleLog(`野生の ${state.encounter.name} が現れた！`);
  syncBattleUI();
}

function playerAttack(moveIndex) {
  const ally = getActiveMon();
  if (!ally || ally.hp <= 0) return;

  const move = ally.moves[moveIndex];
  resolveMove(ally, state.encounter, move, true);
  if (state.encounter.hp <= 0) {
    ally.level += 1;
    ally.maxHp += 3;
    ally.hp = Math.min(ally.maxHp, ally.hp + 8);
    endBattle(`${state.encounter.name} を倒した！ ${ally.name} はLv${ally.level}になった。`);
    return;
  }

}

function enemyTurn() {
  const enemy = state.encounter;
  const ally = getActiveMon();
  const move = enemy.moves[Math.random() > 0.5 ? 1 : 0];
  resolveMove(enemy, ally, move, false);

  if (ally.hp <= 0) {
    const next = state.party.findIndex((m) => m.hp > 0);
    if (next === -1) {
      state.party.forEach((m) => (m.hp = m.maxHp));
      state.activeIndex = 0;
      endBattle("手持ちが全滅した…でもキャンプで回復した！");
      return;
    }

    state.activeIndex = next;
    setBattleLog(`${ally.name} は倒れた！ ${state.party[next].name} を繰り出した。`);
  }

  syncBattleUI();
}

function resolveMove(attacker, defender, move, fromPlayer) {
  state.turnLock = true;
  if (Math.random() > move.accuracy) {
    setBattleLog(`${attacker.name} の ${move.name} は外れた！`);
    state.turnLock = false;
    return;
  }

  const variance = 0.85 + Math.random() * 0.3;
  const damage = Math.max(2, Math.floor(move.power * variance));
  defender.hp = Math.max(0, defender.hp - damage);
  setBattleLog(`${attacker.name} の ${move.name}！ ${damage} ダメージ。`);
  syncBattleUI();

  setTimeout(() => {
    state.turnLock = false;
    if (fromPlayer && state.encounter.hp > 0) enemyTurn();
  }, 350);
}

function tryCapture() {
  const enemy = state.encounter;
  const hpRatio = enemy.hp / enemy.maxHp;
  const chance = 0.2 + (1 - hpRatio) * 0.6;

  if (Math.random() < chance && state.party.length < 6) {
    state.party.push({ ...enemy });
    endBattle(`${enemy.name} の捕獲に成功！`);
    return;
  }

  setBattleLog("ボールが揺れた…しかし逃げられた！");
  enemyTurn();
}

function tryRun() {
  if (Math.random() < 0.7) {
    endBattle("うまく逃げ切った！");
  } else {
    setBattleLog("逃げられない！");
    enemyTurn();
  }
}

function endBattle(message) {
  state.mode = "overworld";
  state.encounter = null;
  state.turnLock = false;
  dom.overlay.classList.add("hidden");
  dom.objective.textContent = "草むらを歩いてモンスターを探そう。";
  setBattleLog(message);
  renderParty();
}

function syncBattleUI() {
  if (!state.encounter) return;
  const ally = getActiveMon();
  const enemy = state.encounter;
  dom.enemyName.textContent = `Wild ${enemy.name} Lv${enemy.level}`;
  dom.enemyHp.textContent = `${enemy.hp} / ${enemy.maxHp}`;
  dom.enemyHpBar.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;

  dom.allyName.textContent = `${ally.name} Lv${ally.level}`;
  dom.allyHp.textContent = `${ally.hp} / ${ally.maxHp}`;
  dom.allyHpBar.style.width = `${(ally.hp / ally.maxHp) * 100}%`;

  dom.move1Btn.textContent = ally.moves[0].name;
  dom.move2Btn.textContent = ally.moves[1].name;

  dom.enemySprite.style.background = enemy.color;
  dom.playerSprite.style.background = ally.color;

  const disabled = state.turnLock;
  [dom.move1Btn, dom.move2Btn, dom.captureBtn, dom.runBtn].forEach((btn) => {
    btn.disabled = disabled;
  });

  renderParty();
}

function setBattleLog(text) {
  state.message = text;
  dom.battleLog.textContent = text;
}

function renderParty() {
  dom.partyList.innerHTML = "";
  state.party.forEach((mon, idx) => {
    const li = document.createElement("li");
    const marker = idx === state.activeIndex ? "▶" : "・";
    li.textContent = `${marker} ${mon.name} Lv${mon.level} HP ${mon.hp}/${mon.maxHp}`;
    dom.partyList.appendChild(li);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      const tile = tileMap[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (tile === "W") {
        ctx.fillStyle = "#334155";
      } else if (tile === "G") {
        ctx.fillStyle = "#22c55e";
      } else if (tile === "T") {
        ctx.fillStyle = "#facc15";
      } else {
        ctx.fillStyle = "#86efac";
      }

      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = "rgba(15,23,42,0.12)";
      ctx.strokeRect(px, py, TILE, TILE);
    }
  }

  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(state.player.x * TILE + 4, state.player.y * TILE + 4, TILE - 8, TILE - 8);

  ctx.fillStyle = "#0f172a";
  ctx.font = "16px sans-serif";
  ctx.fillText("🧭 草むら(G)を歩いてバトル", 14, 22);
}

renderParty();
stepGame();
