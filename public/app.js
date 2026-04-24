let ws = null;
let playerId = null;
let roomId = null;
let myIndex = -1;
let players = [];
let myHand = [];
let currentActions = [];
let currentActionTile = null;
let currentPhase = '';
let currentPlayerIdx = -1;
let isMyTurn = false;
let ownTurnActions = false;

const TILE_DISPLAY = {
  w: ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  t: ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  b: ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  f: ['', '東', '南', '西', '北'],
  d: ['', '中', '發', '白']
};

const TILE_SUIT = { w: '万', t: '筒', b: '条', f: '', d: '' };
const TILE_COLOR = {
  w: '#cc0000', t: '#0066cc', b: '#009933',
  f: '#333399',
  d1: '#cc0000', d2: '#009933', d3: '#5555cc'
};

function tileColor(t) {
  if (t.type === 'd') return TILE_COLOR['d' + t.value];
  return TILE_COLOR[t.type];
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    handleMessage(msg);
  };

  ws.onclose = () => {
    setTimeout(() => {
      if (!ws || ws.readyState === WebSocket.CLOSED) connect();
    }, 2000);
  };

  ws.onerror = () => {};
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'connected':
      playerId = msg.playerId;
      break;

    case 'roomJoined':
      roomId = msg.roomId;
      myIndex = msg.playerIndex;
      players = msg.players;
      showView('roomView');
      updateRoomUI();
      break;

    case 'playerJoined':
      players = msg.players;
      updateRoomUI();
      break;

    case 'playerLeft':
      players = msg.players;
      updateRoomUI();
      break;

    case 'gameStart':
      myHand = msg.hand;
      myIndex = msg.playerIndex;
      players = msg.players;
      showView('gameView');
      renderGameStart(msg);
      break;

    case 'handUpdate':
      myHand = msg.hand;
      renderMyHand();
      break;

    case 'drawTile':
      myHand.push(msg.tile);
      sortHand();
      renderMyHand();
      updateWallCount(msg.wallCount);
      break;

    case 'playerDraw':
      updatePlayerTileCount(msg.playerIndex, msg.handCount);
      updateWallCount(msg.wallCount);
      break;

    case 'playerDiscard':
      addDiscardTile(msg.playerIndex, msg.tile);
      if (msg.playerIndex === myIndex) {
        myHand = myHand.filter(t => t.id !== msg.tile.id);
        renderMyHand();
      }
      break;

    case 'turnInfo':
      currentPlayerIdx = msg.currentPlayer;
      currentPhase = msg.phase;
      isMyTurn = msg.currentPlayer === myIndex;
      updateTurnDisplay();
      break;

    case 'actionRequest':
      currentActions = msg.actions;
      currentActionTile = msg.tile;
      showActions(msg.actions, msg.message);
      break;

    case 'peng':
      hideActions();
      const pengPlayer = msg.playerIndex;
      if (pengPlayer === myIndex) {
        const meld = msg.meld;
        for (const t of meld) {
          myHand = myHand.filter(h => h.id !== t.id);
        }
      }
      updateMelds(pengPlayer, msg.meld);
      showStatusMsg(`${getPlayerName(pengPlayer)} 碰！`);
      setTimeout(() => hideStatusMsg(), 1500);
      break;

    case 'gang':
      hideActions();
      const gangPlayer = msg.playerIndex;
      if (gangPlayer === myIndex) {
        const meld = msg.meld;
        for (const t of meld) {
          myHand = myHand.filter(h => h.id !== t.id);
        }
        renderMyHand();
      }
      updateMelds(gangPlayer, msg.meld);
      showStatusMsg(`${getPlayerName(gangPlayer)} 杠！`);
      setTimeout(() => hideStatusMsg(), 1500);
      break;

    case 'gameOver':
      hideActions();
      showGameOver(msg);
      break;

    case 'gameReset':
      hideActions();
      hideStatusMsg();
      hideGameOver();
      players = msg.players;
      myHand = [];
      showView('roomView');
      updateRoomUI();
      break;

    case 'error':
      alert(msg.message);
      break;

    case 'playerDisconnected':
      showStatusMsg(`${msg.playerName} 断线了`);
      break;
  }
}

function getPlayerName(idx) {
  if (!players[idx]) return '?';
  if (idx === myIndex) return '你';
  return players[idx].name;
}

function updateRoomUI() {
  document.getElementById('roomCode').textContent = roomId;
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const p = players[i];
    const card = document.createElement('div');
    card.className = 'player-card' + (p ? ' ready' : '');
    card.innerHTML = `
      <div class="p-name">${p ? p.name : '等待加入...'}</div>
      <div class="p-status">${p ? (p.isBot ? '🤖 机器人' : '👤 玩家') : '---'}</div>
    `;
    list.appendChild(card);
  }

  const btnStart = document.getElementById('btnStart');
  const btnAddBot = document.getElementById('btnAddBot');
  btnStart.disabled = players.length < 4;
  btnAddBot.disabled = players.length >= 4;
  btnStart.style.opacity = players.length < 4 ? '0.5' : '1';
  btnAddBot.style.opacity = players.length >= 4 ? '0.5' : '1';

  const statusEl = document.getElementById('roomStatus');
  statusEl.textContent = players.length < 4 ? `还需要 ${4 - players.length} 名玩家` : '人已齐，可以开始！';
}

function createRoom() {
  const name = document.getElementById('playerName').value.trim() || '玩家';
  send({ type: 'createRoom', name });
}

function joinRoom() {
  const name = document.getElementById('playerName').value.trim() || '玩家';
  const rid = document.getElementById('roomId').value.trim().toUpperCase();
  if (!rid) { alert('请输入房间号'); return; }
  send({ type: 'joinRoom', roomId: rid, name });
}

function addBot() {
  send({ type: 'addBot' });
}

function startGame() {
  send({ type: 'startGame' });
}

function copyRoomLink() {
  const url = `${location.protocol}//${location.host}?room=${roomId}`;
  navigator.clipboard.writeText(url).then(() => {
    alert('链接已复制: ' + url);
  }).catch(() => {
    prompt('复制以下链接:', url);
  });
}

function sortHand() {
  const order = { w: 0, t: 1, b: 2, f: 3, d: 4 };
  myHand.sort((a, b) => {
    if (a.type !== b.type) return order[a.type] - order[b.type];
    return a.value - b.value;
  });
}

function renderGameStart(msg) {
  sortHand();
  renderMyHand();
  updateWallCount(msg.wallCount);
  currentPlayerIdx = msg.dealer;
  updateTurnDisplay();

  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) {
    if (i === myIndex) continue;
    const el = positions[i];
    if (el) {
      el.querySelector('.player-name').textContent = players[i].name;
    }
  }

  document.getElementById('roomInfo').textContent = `房间: ${roomId}`;
  clearDiscardArea();
}

function getPlayerPositions() {
  const offsets = [0, 1, 2, 3];
  const result = {};
  for (let i = 0; i < 4; i++) {
    const pos = (i - myIndex + 4) % 4;
    const elIds = ['playerBottom', 'playerRight', 'playerTop', 'playerLeft'];
    result[i] = document.getElementById(elIds[pos]);
  }
  return result;
}

function renderMyHand() {
  const container = document.getElementById('myHand');
  container.innerHTML = '';
  for (const tile of myHand) {
    const el = createTileElement(tile, true);
    el.classList.add('clickable');
    el.addEventListener('click', () => onTileClick(tile, el));
    container.appendChild(el);
  }
}

function createTileElement(tile, showSuit) {
  const el = document.createElement('div');
  el.className = 'tile';
  if (tile.isLaizi) el.classList.add('laizi');
  el.dataset.id = tile.id;

  const color = tileColor(tile);
  const main = TILE_DISPLAY[tile.type][tile.value];
  const suit = TILE_SUIT[tile.type];

  el.innerHTML = `<span class="tile-main" style="color:${color}">${main}</span>${showSuit && suit ? `<span class="tile-suit" style="color:${color}">${suit}</span>` : ''}`;

  return el;
}

function createSmallTile(tile) {
  const el = createTileElement(tile, false);
  el.classList.add('tile-small');
  return el;
}

function createDiscardTile(tile) {
  const el = createTileElement(tile, false);
  el.classList.add('tile-discard');
  return el;
}

function onTileClick(tile, el) {
  if (!isMyTurn) return;
  if (currentPhase === 'discard' && currentActions.includes('discard')) {
    send({ type: 'discard', tileId: tile.id });
    isMyTurn = false;
  }
}

function showActions(actions, message) {
  const bar = document.getElementById('actionBar');
  bar.classList.remove('hidden');
  ownTurnActions = actions.includes('discard');

  document.getElementById('btnHu').style.display = actions.includes('hu') ? '' : 'none';
  document.getElementById('btnGang').style.display = actions.includes('gang') ? '' : 'none';
  document.getElementById('btnPeng').style.display = actions.includes('peng') ? '' : 'none';
  document.getElementById('btnPass').style.display = (actions.includes('peng') || actions.includes('gang') || actions.includes('hu')) ? '' : 'none';

  if (ownTurnActions) {
    document.getElementById('btnPass').textContent = '跳过';
  } else {
    document.getElementById('btnPass').textContent = '过';
  }

  if (actions.includes('discard') && actions.length === 1) {
    bar.classList.add('hidden');
    isMyTurn = true;
  }
}

function hideActions() {
  document.getElementById('actionBar').classList.add('hidden');
  currentActions = [];
}

function doAction(action) {
  if (action === 'hu') {
    send({ type: 'action', action: 'hu' });
    hideActions();
  } else if (action === 'gang') {
    send({ type: 'action', action: 'gang' });
    hideActions();
  } else if (action === 'peng') {
    send({ type: 'action', action: 'peng' });
    hideActions();
  } else if (action === 'pass') {
    hideActions();
    if (ownTurnActions) {
      isMyTurn = true;
    } else {
      send({ type: 'action', action: 'pass' });
      isMyTurn = false;
    }
  }
}

function updateTurnDisplay() {
  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) {
    const el = positions[i];
    if (!el) continue;
    const label = el.querySelector('.player-label');
    if (label) {
      label.classList.toggle('active-player', i === currentPlayerIdx);
    }
  }

  const turnInfo = document.getElementById('turnInfo');
  if (currentPlayerIdx === myIndex) {
    turnInfo.textContent = '轮到你出牌';
    turnInfo.style.color = '#2ecc71';
  } else {
    turnInfo.textContent = `${getPlayerName(currentPlayerIdx)} 的回合`;
    turnInfo.style.color = '#fff';
  }
}

function updateWallCount(count) {
  document.getElementById('wallCount').textContent = `余: ${count}`;
}

function updatePlayerTileCount(playerIdx, count) {
  const positions = getPlayerPositions();
  const el = positions[playerIdx];
  if (!el || playerIdx === myIndex) return;
  const tilesEl = el.querySelector('.player-tiles');
  if (tilesEl) {
    tilesEl.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const back = document.createElement('div');
      back.className = 'tile-back';
      tilesEl.appendChild(back);
    }
  }
}

function clearDiscardArea() {
  document.querySelector('#discardArea .discard-inner').innerHTML = '';
}

function addDiscardTile(playerIdx, tile) {
  const area = document.querySelector('#discardArea .discard-inner');
  const allDiscards = area.querySelectorAll('.tile-discard');
  allDiscards.forEach(t => t.classList.remove('last-discard'));

  const el = createDiscardTile(tile);
  el.classList.add('last-discard');
  el.title = `${getPlayerName(playerIdx)} 打出`;
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
}

function updateMelds(playerIdx, meld) {
  const positions = getPlayerPositions();
  const el = positions[playerIdx];
  if (!el) return;
  const meldsEl = el.querySelector('.player-melds');
  if (!meldsEl) return;

  const group = document.createElement('div');
  group.className = 'meld-group';
  for (const t of meld) {
    group.appendChild(createSmallTile(t));
  }
  meldsEl.appendChild(group);

  if (playerIdx !== myIndex) {
    const tilesEl = el.querySelector('.player-tiles');
    if (tilesEl) {
      const backs = tilesEl.querySelectorAll('.tile-back');
      if (backs.length > 0) backs[0].remove();
      if (meld.length > 3) {
        const extra = meld.length - 3;
        for (let i = 0; i < extra && backs.length > i + 1; i++) {
          if (backs[i + 1]) backs[i + 1].remove();
        }
      }
    }
  }
}

function showStatusMsg(msg) {
  const el = document.getElementById('gameStatus');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideStatusMsg() {
  document.getElementById('gameStatus').classList.add('hidden');
}

function showGameOver(msg) {
  const modal = document.getElementById('gameOverModal');
  const title = document.getElementById('gameOverTitle');
  const info = document.getElementById('gameOverInfo');

  if (msg.isDraw) {
    title.textContent = '流局';
    title.style.color = '#f39c12';
  } else {
    title.textContent = msg.isSelfDraw ? `${msg.winnerName} 自摸！` : `${msg.winnerName} 胡了！`;
    title.style.color = '#f1c40f';
  }

  let html = '';
  for (const h of msg.hands) {
    const isW = h.isWinner;
    html += `<div class="player-result ${isW ? 'winner' : ''}">`;
    html += `<div class="result-name">${h.playerName}${isW ? ' 🏆' : ''}</div>`;

    html += '<div class="result-label">手牌</div><div class="hand-display">';
    for (const t of h.hand) {
      html += tileHtml(t);
    }
    html += '</div>';

    if (h.melds && h.melds.length > 0) {
      html += '<div class="result-label">副露</div><div class="meld-display">';
      for (const meld of h.melds) {
        html += '<div class="meld-group">';
        for (const t of meld) {
          html += tileHtml(t);
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
  }

  info.innerHTML = html;
  modal.classList.remove('hidden');
}

function tileHtml(t) {
  const color = tileColor(t);
  const main = TILE_DISPLAY[t.type][t.value];
  const laiziCls = t.isLaizi ? ' laizi' : '';
  return `<div class="tile tile-small${laiziCls}"><span class="tile-main" style="color:${color}">${main}</span></div>`;
}

function hideGameOver() {
  document.getElementById('gameOverModal').classList.add('hidden');
}

function restartGame() {
  hideGameOver();
  send({ type: 'restart' });
}

window.addEventListener('load', () => {
  connect();

  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (room) {
    document.getElementById('roomId').value = room.toUpperCase();
  }
});
