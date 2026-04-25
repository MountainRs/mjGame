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

const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const TILE_SUIT = { w: '万', t: '筒', b: '条', f: '', d: '' };

function tileColorClass(t) {
  if (t.type === 'w') return 'tile-color-wan';
  if (t.type === 't') return 'tile-color-tong';
  if (t.type === 'b') return 'tile-color-tiao';
  if (t.type === 'f') return 'tile-color-feng';
  if (t.type === 'd' && t.value === 1) return 'tile-color-zhong';
  if (t.type === 'd' && t.value === 2) return 'tile-color-fa';
  return 'tile-color-bai';
}

function tileKeyStr(t) { return t.type + t.value; }

function tileTopContent(t) {
  if (t.type === 'f') return { text: ['', '东', '南', '西', '北'][t.value], isHtml: false };
  if (t.type === 'd') return { text: ['', '中', '發', '白'][t.value], isHtml: false };
  if (t.type === 'w') return { text: NUM_CN[t.value], isHtml: false };
  if (t.type === 't') return { text: renderDots(t.value), isHtml: true };
  return { text: renderBamboo(t.value), isHtml: true };
}

function tileBottomContent(t) {
  return TILE_SUIT[t.type] || '';
}

function renderDots(n) {
  const dot = '<span class="tile-dot"></span>';
  const layouts = {
    1: [[1]],
    2: [[1],[1]],
    3: [[1],[1],[1]],
    4: [[1,1],[1,1]],
    5: [[1,1],[1],[1,1]],
    6: [[1,1,1],[1,1,1]],
    7: [[1,1,1],[1],[1,1,1]],
    8: [[1,1,1,1],[1,1,1,1]],
    9: [[1,1,1],[1,1,1],[1,1,1]]
  };
  const rows = layouts[n] || [[1]];
  let html = '<div class="tile-dots">';
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) html += dot;
    if (row !== rows[rows.length - 1]) html += '<br>';
  }
  html += '</div>';
  return html;
}

function renderBamboo(n) {
  const stick = '<span class="tile-stick"></span>';
  let html = '<div class="tile-bamboo">';
  for (let i = 0; i < Math.min(n, 7); i++) html += stick;
  html += '</div>';
  return html;
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch(err) {} };
  ws.onclose = () => { setTimeout(() => { if (!ws || ws.readyState === WebSocket.CLOSED) connect(); }, 2000); };
  ws.onerror = () => {};
}

function send(msg) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }

function handleMessage(msg) {
  switch (msg.type) {
    case 'connected': playerId = msg.playerId; break;
    case 'roomJoined':
      roomId = msg.roomId; myIndex = msg.playerIndex; players = msg.players;
      showView('roomView'); updateRoomUI(); break;
    case 'playerJoined': players = msg.players; updateRoomUI(); break;
    case 'playerLeft': players = msg.players; updateRoomUI(); break;
    case 'gameStart':
      myHand = msg.hand; myIndex = msg.playerIndex; players = msg.players;
      showView('gameView'); renderGameStart(msg); break;
    case 'handUpdate': myHand = msg.hand; renderMyHand(); break;
    case 'drawTile':
      myHand.push(msg.tile); sortHand(); renderMyHand(); updateWallCount(msg.wallCount); break;
    case 'listeningHint': showListeningHint(msg.tiles); break;
    case 'playerDraw':
      updatePlayerTileCount(msg.playerIndex, msg.handCount); updateWallCount(msg.wallCount); break;
    case 'playerDiscard':
      addDiscardTile(msg.playerIndex, msg.tile);
      if (msg.playerIndex === myIndex) { myHand = myHand.filter(t => t.id !== msg.tile.id); renderMyHand(); }
      hideListeningHint();
      break;
    case 'turnInfo':
      currentPlayerIdx = msg.currentPlayer; currentPhase = msg.phase;
      isMyTurn = msg.currentPlayer === myIndex; updateTurnDisplay(); break;
    case 'actionRequest':
      currentActions = msg.actions; currentActionTile = msg.tile;
      showActions(msg.actions, msg.message); break;
    case 'peng':
      hideActions();
      if (msg.playerIndex === myIndex) { for (const t of msg.meld) myHand = myHand.filter(h => h.id !== t.id); }
      updateMelds(msg.playerIndex, msg.meld);
      showStatusMsg(`${getPlayerName(msg.playerIndex)} 碰！`);
      setTimeout(hideStatusMsg, 1500); break;
    case 'gang':
      hideActions();
      if (msg.playerIndex === myIndex) { for (const t of msg.meld) myHand = myHand.filter(h => h.id !== t.id); renderMyHand(); }
      updateMelds(msg.playerIndex, msg.meld);
      showStatusMsg(`${getPlayerName(msg.playerIndex)} 杠！`);
      setTimeout(hideStatusMsg, 1500); break;
    case 'gameOver': hideActions(); hideListeningHint(); showGameOver(msg); break;
    case 'gameReset':
      hideActions(); hideStatusMsg(); hideGameOver(); hideListeningHint();
      players = msg.players; myHand = [];
      showView('roomView'); updateRoomUI(); break;
    case 'error': alert(msg.message); break;
    case 'playerDisconnected': showStatusMsg(`${msg.playerName} 断线了`); break;
  }
}

function getPlayerName(idx) {
  if (!players[idx]) return '?';
  return idx === myIndex ? '你' : players[idx].name;
}

function updateRoomUI() {
  document.getElementById('roomCode').textContent = roomId;
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const p = players[i];
    const card = document.createElement('div');
    card.className = 'player-card' + (p ? ' ready' : '');
    card.innerHTML = `<div class="p-name">${p ? p.name : '等待加入...'}</div><div class="p-status">${p ? (p.isBot ? '🤖 机器人' : '👤 玩家') : '---'}</div>`;
    list.appendChild(card);
  }
  const btnStart = document.getElementById('btnStart');
  const btnAddBot = document.getElementById('btnAddBot');
  btnStart.disabled = players.length < 4;
  btnAddBot.disabled = players.length >= 4;
  btnStart.style.opacity = players.length < 4 ? '0.5' : '1';
  btnAddBot.style.opacity = players.length >= 4 ? '0.5' : '1';
  document.getElementById('roomStatus').textContent = players.length < 4 ? `还需要 ${4 - players.length} 名玩家` : '人已齐，可以开始！';
}

function createRoom() { send({ type: 'createRoom', name: document.getElementById('playerName').value.trim() || '玩家' }); }
function joinRoom() { const rid = document.getElementById('roomId').value.trim().toUpperCase(); if (!rid) { alert('请输入房间号'); return; } send({ type: 'joinRoom', roomId: rid, name: document.getElementById('playerName').value.trim() || '玩家' }); }
function addBot() { send({ type: 'addBot' }); }
function startGame() { send({ type: 'startGame' }); }
function copyRoomLink() { const url = `${location.protocol}//${location.host}?room=${roomId}`; navigator.clipboard.writeText(url).catch(() => prompt('复制:', url)); }

function sortHand() {
  const order = { w: 0, t: 1, b: 2, f: 3, d: 4 };
  myHand.sort((a, b) => a.type !== b.type ? order[a.type] - order[b.type] : a.value - b.value);
}

function renderGameStart(msg) {
  sortHand(); renderMyHand(); updateWallCount(msg.wallCount);
  currentPlayerIdx = msg.dealer; updateTurnDisplay();
  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) { if (i === myIndex) continue; const el = positions[i]; if (el) el.querySelector('.player-name').textContent = players[i].name; }
  document.getElementById('roomInfo').textContent = `房间: ${roomId}`;
  document.querySelector('#discardArea .discard-inner').innerHTML = '';
  for (const pos of Object.values(positions)) { const m = pos?.querySelector('.player-melds'); if (m) m.innerHTML = ''; }
}

function getPlayerPositions() {
  const r = {};
  const elIds = ['playerBottom', 'playerRight', 'playerTop', 'playerLeft'];
  for (let i = 0; i < 4; i++) r[i] = document.getElementById(elIds[(i - myIndex + 4) % 4]);
  return r;
}

function renderMyHand() {
  const container = document.getElementById('myHand');
  container.innerHTML = '';
  for (const tile of myHand) {
    const el = createTileElement(tile, true);
    el.classList.add('clickable');
    el.addEventListener('click', () => onTileClick(tile));
    container.appendChild(el);
  }
}

function createTileElement(tile, showSuit) {
  const el = document.createElement('div');
  el.className = 'tile ' + tileColorClass(tile);
  if (tile.isLaizi) el.classList.add('laizi');
  el.dataset.id = tile.id;
  const top = tileTopContent(tile);
  const bottom = tileBottomContent(tile);
  let html = '';
  if (tile.isLaizi) html += '<span class="tile-badge">赖</span>';
  html += `<span class="tile-top">${top.isHtml ? top.text : top.text}</span>`;
  if (showSuit && bottom) html += `<span class="tile-bottom">${bottom}</span>`;
  el.innerHTML = html;
  return el;
}

function createSmallTile(tile) {
  const el = createTileElement(tile, false);
  el.classList.add('tile-small');
  const bottom = tileBottomContent(tile);
  if (bottom) {
    const bEl = document.createElement('span');
    bEl.className = 'tile-bottom';
    bEl.textContent = bottom;
    el.appendChild(bEl);
  }
  return el;
}

function onTileClick(tile) {
  if (!isMyTurn) return;
  send({ type: 'discard', tileId: tile.id });
  isMyTurn = false;
}

function showActions(actions) {
  const bar = document.getElementById('actionBar');
  bar.classList.remove('hidden');
  ownTurnActions = actions.includes('discard');
  document.getElementById('btnHu').style.display = actions.includes('hu') ? '' : 'none';
  document.getElementById('btnGang').style.display = actions.includes('gang') ? '' : 'none';
  document.getElementById('btnPeng').style.display = actions.includes('peng') ? '' : 'none';
  document.getElementById('btnPass').style.display = (actions.includes('peng') || actions.includes('gang') || actions.includes('hu')) ? '' : 'none';
  document.getElementById('btnPass').textContent = ownTurnActions ? '跳过' : '过';
  if (actions.includes('discard') && actions.length === 1) { bar.classList.add('hidden'); isMyTurn = true; }
}

function hideActions() { document.getElementById('actionBar').classList.add('hidden'); currentActions = []; }

function doAction(action) {
  if (action === 'pass') {
    hideActions();
    if (ownTurnActions) { isMyTurn = true; } else { send({ type: 'action', action: 'pass' }); isMyTurn = false; }
    return;
  }
  send({ type: 'action', action });
  hideActions();
}

function updateTurnDisplay() {
  const positions = getPlayerPositions();
  for (let i = 0; i < 4; i++) { const el = positions[i]; if (!el) continue; const label = el.querySelector('.player-label'); if (label) label.classList.toggle('active-player', i === currentPlayerIdx); }
  const ti = document.getElementById('turnInfo');
  if (currentPlayerIdx === myIndex) { ti.textContent = '轮到你出牌'; ti.style.color = '#2ecc71'; }
  else { ti.textContent = `${getPlayerName(currentPlayerIdx)} 的回合`; ti.style.color = '#fff'; }
}

function updateWallCount(c) { document.getElementById('wallCount').textContent = `余: ${c}`; }

function updatePlayerTileCount(playerIdx, count) {
  const positions = getPlayerPositions();
  const el = positions[playerIdx];
  if (!el || playerIdx === myIndex) return;
  const tilesEl = el.querySelector('.player-tiles');
  if (tilesEl) { tilesEl.innerHTML = ''; for (let i = 0; i < count; i++) { const b = document.createElement('div'); b.className = 'tile-back'; tilesEl.appendChild(b); } }
}

function addDiscardTile(playerIdx, tile) {
  const area = document.querySelector('#discardArea .discard-inner');
  area.querySelectorAll('.last-discard').forEach(t => t.classList.remove('last-discard'));
  const el = createTileElement(tile, false);
  el.classList.add('tile-discard', 'last-discard');
  const bottom = tileBottomContent(tile);
  if (bottom) { const bEl = document.createElement('span'); bEl.className = 'tile-bottom'; bEl.textContent = bottom; el.appendChild(bEl); }
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
  for (const t of meld) group.appendChild(createSmallTile(t));
  meldsEl.appendChild(group);
  if (playerIdx !== myIndex) {
    const tilesEl = el.querySelector('.player-tiles');
    if (tilesEl) {
      const backs = tilesEl.querySelectorAll('.tile-back');
      for (let i = 0; i < meld.length - 1 && i < backs.length; i++) backs[i]?.remove();
    }
  }
}

function showListeningHint(tiles) {
  const hint = document.getElementById('listeningHint');
  const container = document.getElementById('listeningTiles');
  container.innerHTML = '';
  for (const t of tiles) {
    const span = document.createElement('span');
    span.className = 'waiting-tile';
    const name = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const suit = { w: '万', t: '筒', b: '条', f: ['', '东', '南', '西', '北'], d: ['', '中', '發', '白'] };
    if (t.type === 'f') span.textContent = suit.f[t.value];
    else if (t.type === 'd') span.textContent = suit.d[t.value];
    else span.textContent = name[t.value] + suit[t.type];
    container.appendChild(span);
  }
  hint.classList.remove('hidden');
}

function hideListeningHint() { document.getElementById('listeningHint').classList.add('hidden'); }

function showStatusMsg(msg) { const el = document.getElementById('gameStatus'); el.textContent = msg; el.classList.remove('hidden'); }
function hideStatusMsg() { document.getElementById('gameStatus').classList.add('hidden'); }

function showGameOver(msg) {
  const modal = document.getElementById('gameOverModal');
  const title = document.getElementById('gameOverTitle');
  const info = document.getElementById('gameOverInfo');
  if (msg.isDraw) { title.textContent = '流局'; title.style.color = '#f39c12'; }
  else { title.textContent = msg.isSelfDraw ? `${msg.winnerName} 自摸！` : `${msg.winnerName} 胡了！`; title.style.color = '#f1c40f'; }
  let html = '';
  for (const h of msg.hands) {
    html += `<div class="player-result ${h.isWinner ? 'winner' : ''}">`;
    html += `<div class="result-name">${h.playerName}${h.isWinner ? ' 🏆' : ''}</div>`;
    html += '<div class="result-label">手牌</div><div class="hand-display">';
    for (const t of h.hand) html += tileResultHtml(t);
    html += '</div>';
    if (h.melds && h.melds.length > 0) {
      html += '<div class="result-label">副露</div><div class="meld-display">';
      for (const meld of h.melds) { html += '<div class="meld-group">'; for (const t of meld) html += tileResultHtml(t); html += '</div>'; }
      html += '</div>';
    }
    html += '</div>';
  }
  info.innerHTML = html;
  modal.classList.remove('hidden');
}

function tileResultHtml(t) {
  const cls = tileColorClass(t);
  const top = tileTopContent(t);
  const bottom = tileBottomContent(t);
  const laiziCls = t.isLaizi ? ' laizi' : '';
  const badge = t.isLaizi ? '<span class="tile-badge">赖</span>' : '';
  return `<div class="tile tile-small${laiziCls} ${cls}">${badge}<span class="tile-top">${top.isHtml ? top.text : top.text}</span>${bottom ? `<span class="tile-bottom">${bottom}</span>` : ''}</div>`;
}

function hideGameOver() { document.getElementById('gameOverModal').classList.add('hidden'); }
function restartGame() { hideGameOver(); send({ type: 'restart' }); }

window.addEventListener('load', () => {
  connect();
  const room = new URLSearchParams(location.search).get('room');
  if (room) document.getElementById('roomId').value = room.toUpperCase();
});
