const TILE_NAMES = {
  w: ['', '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'],
  t: ['', '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒'],
  b: ['', '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条'],
  f: ['', '东', '南', '西', '北'],
  d: ['', '中', '发', '白']
};

const TILE_DISPLAY = {
  w: ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'],
  t: ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  b: ['', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  f: ['', '東', '南', '西', '北'],
  d: ['', '中', '發', '白']
};

const TILE_SUIT_LABEL = { w: '万', t: '筒', b: '条', f: '', d: '' };

function createDeck() {
  const deck = [];
  let id = 0;
  for (const type of ['w', 't', 'b']) {
    for (let v = 1; v <= 9; v++) {
      for (let c = 0; c < 4; c++) {
        deck.push({ id: id++, type, value: v });
      }
    }
  }
  for (let v = 1; v <= 4; v++) {
    for (let c = 0; c < 4; c++) {
      deck.push({ id: id++, type: 'f', value: v });
    }
  }
  for (let v = 1; v <= 3; v++) {
    for (let c = 0; c < 4; c++) {
      deck.push({ id: id++, type: 'd', value: v });
    }
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tileKey(tile) {
  return `${tile.type}${tile.value}`;
}

function tileName(tile) {
  return TILE_NAMES[tile.type][tile.value];
}

function tileColor(tile) {
  if (tile.type === 'd' && tile.value === 1) return '#cc0000';
  if (tile.type === 'd' && tile.value === 2) return '#009933';
  if (tile.type === 'd' && tile.value === 3) return '#5555cc';
  if (tile.type === 'f') return '#333399';
  if (tile.type === 'w') return '#cc0000';
  if (tile.type === 't') return '#0066cc';
  if (tile.type === 'b') return '#009933';
  return '#333';
}

function tileBg(tile) {
  if (tile.type === 'd' && tile.value === 3) return '#eef';
  return '#fffef5';
}

function isLaizi(tile) {
  return tile.type === 'd' && tile.value === 1;
}

function tileSort(a, b) {
  const order = { w: 0, t: 1, b: 2, f: 3, d: 4 };
  if (a.type !== b.type) return order[a.type] - order[b.type];
  return a.value - b.value;
}

function formatTile(tile) {
  const disp = TILE_DISPLAY[tile.type][tile.value];
  const suit = TILE_SUIT_LABEL[tile.type];
  return disp + suit;
}

module.exports = {
  createDeck, shuffle, tileKey, tileName, tileColor, tileBg,
  isLaizi, tileSort, formatTile, TILE_NAMES, TILE_DISPLAY, TILE_SUIT_LABEL
};
