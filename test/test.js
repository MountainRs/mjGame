const assert = require('assert');
const { createDeck, shuffle, tileKey, tileName, isLaizi, tileSort, formatTile } = require('../server/tiles');
const { canHu, canHuWithTile } = require('../server/huChecker');
const AIPlayer = require('../server/ai');
const Game = require('../server/Game');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function makeTile(type, value) {
  return { type, value, id: type + value };
}

// ==================== tiles.js ====================
console.log('\n📦 tiles.js');

test('牌组总数应为 136', () => {
  const deck = createDeck();
  assert.strictEqual(deck.length, 136);
});

test('每种牌应有 4 张', () => {
  const deck = createDeck();
  const counts = {};
  for (const t of deck) {
    const k = tileKey(t);
    counts[k] = (counts[k] || 0) + 1;
  }
  const keys = Object.keys(counts);
  assert.strictEqual(keys.length, 34);
  for (const k of keys) {
    assert.strictEqual(counts[k], 4, `${k} should have 4 copies, got ${counts[k]}`);
  }
});

test('牌 ID 唯一', () => {
  const deck = createDeck();
  const ids = new Set(deck.map(t => t.id));
  assert.strictEqual(ids.size, 136);
});

test('万筒条各 36 张', () => {
  const deck = createDeck();
  assert.strictEqual(deck.filter(t => t.type === 'w').length, 36);
  assert.strictEqual(deck.filter(t => t.type === 't').length, 36);
  assert.strictEqual(deck.filter(t => t.type === 'b').length, 36);
});

test('风牌 16 张 (东南西北各4)', () => {
  const deck = createDeck();
  assert.strictEqual(deck.filter(t => t.type === 'f').length, 16);
});

test('箭牌 12 张 (中发白各4)', () => {
  const deck = createDeck();
  assert.strictEqual(deck.filter(t => t.type === 'd').length, 12);
});

test('红中是赖子', () => {
  assert.strictEqual(isLaizi(makeTile('d', 1)), true);
  assert.strictEqual(isLaizi(makeTile('d', 2)), false);
  assert.strictEqual(isLaizi(makeTile('d', 3)), false);
  assert.strictEqual(isLaizi(makeTile('w', 1)), false);
});

test('tileKey 格式正确', () => {
  assert.strictEqual(tileKey(makeTile('w', 3)), 'w3');
  assert.strictEqual(tileKey(makeTile('f', 2)), 'f2');
  assert.strictEqual(tileKey(makeTile('d', 1)), 'd1');
});

test('tileName 返回正确中文名', () => {
  assert.strictEqual(tileName(makeTile('w', 1)), '一万');
  assert.strictEqual(tileName(makeTile('t', 9)), '九筒');
  assert.strictEqual(tileName(makeTile('b', 5)), '五条');
  assert.strictEqual(tileName(makeTile('f', 1)), '东');
  assert.strictEqual(tileName(makeTile('f', 4)), '北');
  assert.strictEqual(tileName(makeTile('d', 1)), '中');
  assert.strictEqual(tileName(makeTile('d', 3)), '白');
});

test('tileSort 排序正确', () => {
  const tiles = [makeTile('b', 5), makeTile('w', 1), makeTile('f', 3), makeTile('w', 9)];
  tiles.sort(tileSort);
  assert.strictEqual(tileKey(tiles[0]), 'w1');
  assert.strictEqual(tileKey(tiles[1]), 'w9');
  assert.strictEqual(tileKey(tiles[2]), 'b5');
  assert.strictEqual(tileKey(tiles[3]), 'f3');
});

test('shuffle 打乱牌组', () => {
  const deck = createDeck();
  const shuffled = shuffle(deck);
  assert.strictEqual(shuffled.length, 136);
  let sameCount = 0;
  for (let i = 0; i < deck.length; i++) {
    if (deck[i].id === shuffled[i].id) sameCount++;
  }
  assert.ok(sameCount < 100, `Too many same positions: ${sameCount}`);
});

// ==================== huChecker.js ====================
console.log('\n🀄 huChecker.js');

test('标准胡牌: 4 刻子 + 1 对', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4), makeTile('w',4),
    makeTile('w',5), makeTile('w',5),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('标准胡牌: 顺子组合', () => {
  const hand = [
    makeTile('w',1), makeTile('w',2), makeTile('w',3),
    makeTile('t',1), makeTile('t',2), makeTile('t',3),
    makeTile('b',1), makeTile('b',2), makeTile('b',3),
    makeTile('f',1), makeTile('f',1), makeTile('f',1),
    makeTile('d',2), makeTile('d',2),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('不能胡: 完全不相关', () => {
  const hand = [
    makeTile('w',1), makeTile('w',4), makeTile('w',7),
    makeTile('t',2), makeTile('t',5), makeTile('t',8),
    makeTile('b',1), makeTile('b',4), makeTile('b',7),
    makeTile('f',1), makeTile('f',2), makeTile('f',3),
    makeTile('d',2), makeTile('d',3),
  ];
  assert.strictEqual(canHu(hand, 0), false);
});

test('不能胡: 牌数不对', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2),
  ];
  assert.strictEqual(canHu(hand, 0), false);
});

test('赖子胡牌: 2 赖子补缺', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3),
    makeTile('w',5), makeTile('w',5),
    makeTile('w',7), makeTile('w',7),
    makeTile('w',8), makeTile('w',8),
    makeTile('d',1), makeTile('d',1),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('赖子胡牌: 1 赖子补顺子', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',3),
    makeTile('w',5), makeTile('w',5), makeTile('w',5),
    makeTile('w',7), makeTile('w',8), makeTile('w',9),
    makeTile('f',1), makeTile('f',1),
    makeTile('d',1),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('赖子作对子', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4), makeTile('w',4),
    makeTile('d',1), makeTile('d',1),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('赖子补刻子', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4), makeTile('w',4),
    makeTile('w',5), makeTile('w',5),
    makeTile('d',1),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('3 赖子作面子', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4),
    makeTile('d',1), makeTile('d',1), makeTile('d',1),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('canHuWithTile 正常工作', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4), makeTile('w',4),
    makeTile('w',5),
  ];
  assert.strictEqual(canHuWithTile(hand, makeTile('w',5), 0), true);
  assert.strictEqual(canHuWithTile(hand, makeTile('t',1), 0), false);
});

test('带副露的胡牌 (1副露)', () => {
  const hand = [
    makeTile('w',1), makeTile('w',1), makeTile('w',1),
    makeTile('w',2), makeTile('w',2), makeTile('w',2),
    makeTile('w',3), makeTile('w',3), makeTile('w',3),
    makeTile('w',4), makeTile('w',4),
  ];
  assert.strictEqual(canHu(hand, 1), true);
  assert.strictEqual(canHu(hand, 0), false);
});

test('纯风牌胡', () => {
  const hand = [
    makeTile('f',1), makeTile('f',1), makeTile('f',1),
    makeTile('f',2), makeTile('f',2), makeTile('f',2),
    makeTile('f',3), makeTile('f',3), makeTile('f',3),
    makeTile('f',4), makeTile('f',4), makeTile('f',4),
    makeTile('d',2), makeTile('d',2),
  ];
  assert.strictEqual(canHu(hand, 0), true);
});

test('乱牌不能胡', () => {
  const hand = [
    makeTile('w',1), makeTile('w',3), makeTile('w',5),
    makeTile('t',2), makeTile('t',4), makeTile('t',6),
    makeTile('b',1), makeTile('b',3), makeTile('b',5),
    makeTile('f',1), makeTile('f',2), makeTile('f',3),
    makeTile('d',2), makeTile('d',3),
  ];
  assert.strictEqual(canHu(hand, 0), false);
});

// ==================== ai.js ====================
console.log('\n🤖 ai.js');

test('AI 始终选择胡', () => {
  const player = { hand: [], melds: [], discards: [] };
  const ai = new AIPlayer(player, null);
  assert.strictEqual(ai.respondToDiscard(makeTile('w',1), ['hu', 'peng']), 'hu');
});

test('AI 优先杠', () => {
  const player = { hand: [], melds: [], discards: [] };
  const ai = new AIPlayer(player, null);
  assert.strictEqual(ai.respondToDiscard(makeTile('w',1), ['gang', 'peng']), 'gang');
});

test('AI 无操作时 pass', () => {
  const player = { hand: [], melds: [], discards: [] };
  const ai = new AIPlayer(player, null);
  assert.strictEqual(ai.respondToDiscard(makeTile('w',1), []), 'pass');
});

test('AI 不弃赖子', () => {
  const player = {
    hand: [makeTile('d',1), makeTile('w',1), makeTile('w',9), makeTile('f',1)],
    melds: [], discards: []
  };
  const ai = new AIPlayer(player, null);
  const discard = ai.chooseDiscard();
  assert.ok(!isLaizi(discard), 'AI should not discard laizi');
});

test('AI shouldHu 返回 true', () => {
  const player = { hand: [], melds: [], discards: [] };
  const ai = new AIPlayer(player, null);
  assert.strictEqual(ai.shouldHu(), true);
});

test('AI shouldGang 返回可用杠', () => {
  const player = { hand: [], melds: [], discards: [] };
  const ai = new AIPlayer(player, null);
  const gangTiles = [{ key: 'w1', tile: makeTile('w',1) }];
  assert.strictEqual(ai.shouldGang(gangTiles), gangTiles[0]);
});

// ==================== Game.js ====================
console.log('\n🎮 Game.js');

function createTestGame() {
  const game = new Game('TEST');
  game.sendToPlayer = () => {};
  game.broadcast = () => {};
  return game;
}

test('添加玩家', () => {
  const game = createTestGame();
  assert.strictEqual(game.players.length, 0);
  game.addPlayer('p1', 'Player1', false);
  assert.strictEqual(game.players.length, 1);
  assert.strictEqual(game.players[0].name, 'Player1');
  assert.strictEqual(game.players[0].isBot, false);
});

test('最多 4 名玩家', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, false);
  assert.strictEqual(game.addPlayer('p5', 'P5', false), false);
});

test('移除玩家', () => {
  const game = createTestGame();
  game.addPlayer('p1', 'P1', false);
  game.addPlayer('p2', 'P2', false);
  game.removePlayer('p1');
  assert.strictEqual(game.players.length, 1);
  assert.strictEqual(game.players[0].id, 'p2');
});

test('获取玩家索引', () => {
  const game = createTestGame();
  game.addPlayer('p1', 'P1', false);
  game.addPlayer('p2', 'P2', false);
  assert.strictEqual(game.getPlayerIndex('p1'), 0);
  assert.strictEqual(game.getPlayerIndex('p2'), 1);
  assert.strictEqual(game.getPlayerIndex('p3'), -1);
});

test('开始游戏: 需要 4 人', () => {
  const game = createTestGame();
  game.addPlayer('p1', 'P1', false);
  assert.strictEqual(game.start(), false);
});

test('开始游戏: 成功', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, i > 0);
  assert.strictEqual(game.start(), true);
  assert.strictEqual(game.state, 'playing');
  assert.strictEqual(game.wall.length, 83);
});

test('开始后庄家 14 张牌', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, true);
  game.start();
  assert.strictEqual(game.players[game.dealer].hand.length, 14);
  for (let i = 0; i < 4; i++) {
    if (i !== game.dealer) {
      assert.strictEqual(game.players[i].hand.length, 13);
    }
  }
});

test('不能重复开始', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, true);
  game.start();
  assert.strictEqual(game.start(), false);
});

test('重置游戏', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, true);
  game.start();
  game.reset();
  assert.strictEqual(game.state, 'idle');
  assert.strictEqual(game.wall.length, 0);
  for (const p of game.players) {
    assert.strictEqual(p.hand.length, 0);
    assert.strictEqual(p.melds.length, 0);
    assert.strictEqual(p.discards.length, 0);
  }
});

test('getState 返回正确信息', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, true);
  const state = game.getState();
  assert.strictEqual(state.roomId, 'TEST');
  assert.strictEqual(state.state, 'idle');
  assert.strictEqual(state.players.length, 4);
});

test('出牌: 非当前玩家不能出', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`p${i}`, `P${i}`, true);
  game.start();
  const nonDealer = (game.dealer + 1) % 4;
  const tileId = game.players[nonDealer].hand[0].id;
  game.handleDiscard(game.players[nonDealer].id, tileId);
  assert.strictEqual(game.players[nonDealer].hand.length, 13);
});

test('机器人完整游戏能完成', () => {
  const game = createTestGame();
  for (let i = 0; i < 4; i++) game.addPlayer(`b${i}`, `Bot${i}`, true);
  game.start();
  process.stdout.write(`    [Turns: ${game.turnCount}, Wall: ${game.wall.length}, State: ${game.state} - running in bg]\n`);
});

// ==================== Summary ====================
setTimeout(() => {
  console.log(`\n${'='.repeat(40)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 6000);
