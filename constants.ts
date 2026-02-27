
import { Blueprint, CardType, GridItem } from './types';

export const CARD_DEFINITIONS: Record<CardType, { name: string; desc: string; color: string; icon?: string }> = {
  // CRUNCH: Base Value = 2
  [CardType.STRIKE]: { name: '痛击', desc: '造成 2 点伤害', color: 'border-red-900 text-red-500 bg-red-950/40 shadow-red-900/20' },
  [CardType.BLOCK]: { name: '招架', desc: '获得 2 点护甲', color: 'border-stone-600 text-stone-300 bg-stone-800/60 shadow-stone-900/20' },
  [CardType.TECH]: { name: '战术', desc: '抽取 1 张非战术牌', color: 'border-amber-700 text-amber-500 bg-amber-950/40 shadow-amber-900/20' },
  [CardType.MOVE]: { name: '闪避', desc: '闪避下一次攻击', color: 'border-emerald-800 text-emerald-400 bg-emerald-950/40 shadow-emerald-900/20' },
  
  // DISTINCT STYLES FOR POLLUTIONS
  [CardType.GLITCH]: { name: '精神崩坏', desc: '强行打出: -2HP 并重置序列', color: 'border-fuchsia-600 text-fuchsia-400 bg-fuchsia-950/60 shadow-fuchsia-900/40' },
  [CardType.TENTACLE]: { name: '异化增生', desc: '污染你的仪式', color: 'border-teal-800 text-teal-500 bg-black shadow-teal-900/20 border-dashed' },
  
  // Elements - Base 2
  [CardType.FIRE]: { name: '余烬', desc: '施加 2 回合燃烧', color: 'border-orange-600 text-orange-500 bg-orange-950/50 shadow-orange-900/30' },
  [CardType.ICE]: { name: '冰棱', desc: '获得 2 点护甲', color: 'border-cyan-600 text-cyan-400 bg-cyan-950/50 shadow-cyan-900/30' },
  [CardType.THUNDER]: { name: '雷击', desc: '2 伤害，施加 1 层感电', color: 'border-yellow-600 text-yellow-400 bg-yellow-950/50 shadow-yellow-900/30' },
  [CardType.POISON]: { name: '毒液', desc: '施加 2 层中毒', color: 'border-lime-700 text-lime-500 bg-lime-950/50 shadow-lime-900/30' },
};

// Initial Blueprints - Expanded to 6
export const STARTING_BLUEPRINTS: Blueprint[] = [
  {
    id: 'basic_strike',
    sequence: [CardType.STRIKE, CardType.STRIKE],
    name: '连斩',
    effectDescription: '触发：额外造成 4 点伤害', 
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 4 
  },
  {
    id: 'basic_block',
    sequence: [CardType.BLOCK, CardType.BLOCK],
    name: '骨盾',
    effectDescription: '触发：额外获得 4 点护甲',
    rarity: 'COMMON',
    type: 'DEFENSE',
    shield: 4 
  },
  {
    id: 'basic_cleanse',
    sequence: [CardType.TENTACLE, CardType.STRIKE],
    name: '斩断',
    effectDescription: '触发：清除污染并造成 3 点伤害',
    rarity: 'COMMON',
    type: 'UTILITY',
    damage: 3,
    special: 'CLEANSE'
  },
  {
    id: 'air_blade',
    sequence: [CardType.STRIKE, CardType.MOVE, CardType.STRIKE],
    name: '气刃散华',
    effectDescription: '触发：造成 10 点额外伤害',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 10
  },
  {
    id: 'tactical_avoid',
    sequence: [CardType.BLOCK, CardType.TECH],
    name: '战术规避',
    effectDescription: '触发：获得 3 点护甲，抽取 1 张牌',
    rarity: 'COMMON',
    type: 'DEFENSE',
    shield: 3,
    special: 'DRAW' // Simplified to draw logic in handler (draws 1)
  },
  {
    id: 'force_reject',
    sequence: [CardType.BLOCK, CardType.GLITCH],
    name: '强制排异',
    effectDescription: '触发：消耗【精神崩坏】免除惩罚，获得 5 点护甲',
    rarity: 'COMMON',
    type: 'DEFENSE',
    shield: 5
  }
];

// Pool of Blueprints
export const BLUEPRINT_POOL: Blueprint[] = [
  // --- BASIC ELEMENTAL STARTERS (EASY ACCESS) ---
  {
    id: 'fire_starter',
    sequence: [CardType.FIRE, CardType.STRIKE],
    name: '引火',
    effectDescription: '触发：+2 伤害，施加 2 回合燃烧。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 2,
    statusEffect: { type: 'BURN', amount: 2 }
  },
  {
    id: 'ice_shield',
    sequence: [CardType.ICE, CardType.BLOCK],
    name: '冰甲',
    effectDescription: '触发：+4 护甲。下回合抽 +1 牌。',
    rarity: 'COMMON',
    type: 'DEFENSE',
    shield: 4,
    statusEffect: { type: 'DRAW_NEXT', amount: 1 }
  },
  {
    id: 'thunder_strike',
    sequence: [CardType.THUNDER, CardType.STRIKE],
    name: '惊雷',
    effectDescription: '触发：造成 4 点伤害，施加 1 层感电。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 4,
    statusEffect: { type: 'SHOCK', amount: 1 }
  },
  {
    id: 'poison_dagger',
    sequence: [CardType.POISON, CardType.STRIKE],
    name: '涂毒',
    effectDescription: '触发：造成 2 点伤害，施加 3 层中毒。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 2,
    statusEffect: { type: 'POISON', amount: 3 }
  },

  // --- PHYSICAL / TACTICAL ---
  {
    id: 'shadow_strike',
    sequence: [CardType.MOVE, CardType.STRIKE],
    name: '影袭',
    effectDescription: '触发：额外造成 8 点伤害。',
    rarity: 'RARE',
    type: 'DAMAGE',
    damage: 8
  },
  {
    id: 'iron_fortress',
    sequence: [CardType.BLOCK, CardType.BLOCK, CardType.BLOCK],
    name: '绝对防御',
    effectDescription: '触发：额外获得 12 点护甲。',
    rarity: 'RARE',
    type: 'DEFENSE',
    shield: 12
  },
  {
    id: 'tactical_reload',
    sequence: [CardType.TECH, CardType.MOVE],
    name: '战术重组',
    effectDescription: '触发：额外抽取 2 张牌。',
    rarity: 'COMMON',
    type: 'UTILITY',
    special: 'DRAW'
  },
  {
    id: 'blood_rend',
    sequence: [CardType.STRIKE, CardType.BLOCK, CardType.STRIKE],
    name: '肢解',
    effectDescription: '触发：+6 伤害。若目标流血，伤害翻倍。',
    rarity: 'RARE',
    type: 'DAMAGE',
    damage: 6
  },
  {
    id: 'blood_letting',
    sequence: [CardType.STRIKE, CardType.TECH],
    name: '放血',
    effectDescription: '触发：+2 伤害，施加 3 层流血。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 2,
    statusEffect: { type: 'BLEED', amount: 3 }
  },
  {
    id: 'shadow_execute',
    sequence: [CardType.MOVE, CardType.STRIKE, CardType.STRIKE],
    name: '影袭处决',
    effectDescription: '触发：12 伤害。若目标生命低于 50%，伤害翻倍。',
    rarity: 'RARE',
    type: 'DAMAGE',
    damage: 12,
    special: 'EXECUTE_LOW_HP'
  },
  {
    id: 'absolute_domain',
    sequence: [CardType.BLOCK, CardType.BLOCK, CardType.MOVE],
    name: '绝对领域',
    effectDescription: '触发：+15 护甲。若下回合开始护甲未破，抽 2 张牌。',
    rarity: 'LEGENDARY',
    type: 'DEFENSE',
    shield: 15,
    special: 'ABSOLUTE_DOMAIN'
  },
  {
    id: 'brain_storm',
    sequence: [CardType.TECH, CardType.TECH, CardType.TECH],
    name: '头脑风暴',
    effectDescription: '触发：抽取 4 张牌。',
    rarity: 'RARE',
    type: 'UTILITY',
    special: 'DRAW' // Logic handled in executeBlueprint to draw 4
  },

  // --- FIRE SERIES ---
  {
    id: 'blazing_strike',
    sequence: [CardType.FIRE, CardType.STRIKE, CardType.FIRE],
    name: '烈焰斩',
    effectDescription: '触发：+4 伤害，施加 3 回合燃烧。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 4,
    statusEffect: { type: 'BURN', amount: 3 }
  },
  {
    id: 'inferno_burst',
    sequence: [CardType.FIRE, CardType.FIRE, CardType.STRIKE], 
    name: '地狱爆破',
    effectDescription: '触发：+10 伤害，燃烧 +4 回合。',
    rarity: 'RARE',
    type: 'DAMAGE',
    damage: 10, 
    statusEffect: { type: 'BURN', amount: 4 }
  },
  {
    id: 'wildfire_combustion',
    sequence: [CardType.FIRE, CardType.FIRE, CardType.STRIKE],
    name: '薪火爆燃',
    effectDescription: '触发：15 伤害。手牌越多伤害越高，随后丢弃所有手牌。',
    rarity: 'LEGENDARY',
    type: 'DAMAGE',
    damage: 15,
    special: 'DISCARD_HAND_DMG'
  },
  {
    id: 'burn_to_ash',
    sequence: [CardType.FIRE, CardType.GLITCH],
    name: '燃尽灰烬',
    effectDescription: '触发：消耗手牌中所有负面卡，每张转化为 5 点真实伤害。',
    rarity: 'RARE',
    type: 'DAMAGE',
    special: 'CONSUME_GLITCH_DMG'
  },

  // --- ICE SERIES ---
  {
    id: 'arctic_gaze',
    sequence: [CardType.ICE, CardType.ICE, CardType.BLOCK],
    name: '极寒凝视',
    effectDescription: '触发：+8 护甲。冻结敌人 1 回合。',
    rarity: 'LEGENDARY',
    type: 'DEFENSE',
    shield: 8, 
    special: 'FREEZE'
  },
  {
    id: 'glacial_barrier',
    sequence: [CardType.ICE, CardType.BLOCK, CardType.MOVE],
    name: '碎冰甲垒',
    effectDescription: '触发：+5 护甲。下回合抽 +1 牌。',
    rarity: 'RARE',
    type: 'DEFENSE',
    shield: 5, 
    statusEffect: { type: 'DRAW_NEXT', amount: 1 } 
  },
  {
    id: 'frost_nova',
    sequence: [CardType.ICE, CardType.TECH, CardType.ICE],
    name: '冰霜新星',
    effectDescription: '触发：你的下一张基础牌会被打出两次。',
    rarity: 'RARE',
    type: 'UTILITY',
    special: 'DOUBLE_CAST'
  },

  // --- THUNDER SERIES ---
  {
     id: 'static_field',
     sequence: [CardType.THUNDER, CardType.BLOCK],
     name: '静电场',
     effectDescription: '触发：+4 护甲，施加 2 层感电。',
     rarity: 'COMMON',
     type: 'DEFENSE',
     shield: 4,
     statusEffect: { type: 'SHOCK', amount: 2 }
  },
  {
    id: 'thunder_storm_reforged',
    sequence: [CardType.THUNDER, CardType.THUNDER, CardType.STRIKE],
    name: '雷霆风暴',
    effectDescription: '触发：+3 感电，随后造成 3 次 3 点伤害打击。', 
    rarity: 'RARE',
    type: 'DAMAGE',
    special: 'THUNDER_BURST' 
  },
  {
    id: 'thunder_step',
    sequence: [CardType.THUNDER, CardType.MOVE, CardType.TECH],
    name: '迅雷身法',
    effectDescription: '触发：抽 2 牌。下张牌不进入缓冲区！',
    rarity: 'RARE',
    type: 'UTILITY',
    special: 'BYPASS_BUFFER'
  },

  // --- POISON SERIES ---
  {
    id: 'toxic_cloud',
    sequence: [CardType.POISON, CardType.POISON],
    name: '毒云',
    effectDescription: '触发：额外施加 2 层中毒。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    statusEffect: { type: 'POISON', amount: 2 }
  },
  {
    id: 'toxic_spread',
    sequence: [CardType.POISON, CardType.POISON, CardType.STRIKE],
    name: '毒瘴蔓延',
    effectDescription: '触发：造成 5 点伤害，施加 4 层中毒。',
    rarity: 'COMMON',
    type: 'DAMAGE',
    damage: 5,
    statusEffect: { type: 'POISON', amount: 4 }
  },
  {
    id: 'chemical_catalysis',
    sequence: [CardType.POISON, CardType.TECH, CardType.POISON],
    name: '化学催化',
    effectDescription: '触发：使目标身上的中毒层数翻倍。',
    rarity: 'RARE',
    type: 'DAMAGE',
    special: 'DOUBLE_POISON'
  },
  {
    id: 'neurotoxin',
    sequence: [CardType.POISON, CardType.MOVE],
    name: '神经毒素',
    effectDescription: '触发：+2 中毒。若敌意图为攻击，削弱其攻击。',
    rarity: 'RARE',
    type: 'UTILITY',
    statusEffect: { type: 'POISON', amount: 2 },
    special: 'WEAKEN_ATTACK'
  },

  // --- MIXED ELEMENTS / VOID ---
  {
    id: 'venom_blast',
    sequence: [CardType.POISON, CardType.FIRE],
    name: '毒爆',
    effectDescription: '触发：施加 2 层中毒和 2 回合燃烧。',
    rarity: 'RARE',
    type: 'DAMAGE',
    statusEffect: { type: 'POISON', amount: 2 },
    special: 'DRAW' // Bonus draw
  },
  {
    id: 'superconductor',
    sequence: [CardType.ICE, CardType.THUNDER],
    name: '超导',
    effectDescription: '触发：+4 护甲，施加 1 层感电。',
    rarity: 'COMMON',
    type: 'DEFENSE',
    shield: 4,
    statusEffect: { type: 'SHOCK', amount: 1 }
  },
  {
    id: 'superconductor_blast',
    sequence: [CardType.ICE, CardType.THUNDER, CardType.STRIKE],
    name: '超导爆破',
    effectDescription: '触发：15 点穿透伤害，施加 2 层感电。',
    rarity: 'LEGENDARY',
    type: 'DAMAGE',
    special: 'PIERCE_DMG'
  },
  {
    id: 'poison_fire_clash',
    sequence: [CardType.POISON, CardType.FIRE, CardType.TECH],
    name: '毒火相攻',
    effectDescription: '触发：将目标所有中毒层数转化为等量燃烧。',
    rarity: 'RARE',
    type: 'DAMAGE',
    special: 'CONVERT_POISON_TO_BURN'
  },
  {
    id: 'void_corruption',
    sequence: [CardType.TECH, CardType.TECH],
    name: '腐化',
    effectDescription: '触发：施加 2 层腐败。',
    rarity: 'RARE',
    type: 'UTILITY',
    statusEffect: { type: 'CORRUPTION', amount: 2 }
  },
  {
    id: 'abyssal_corruption',
    sequence: [CardType.TECH, CardType.TENTACLE, CardType.TECH],
    name: '深渊腐化',
    effectDescription: '触发：施加 3 层腐败。抽取 1 张牌。',
    rarity: 'RARE',
    type: 'UTILITY',
    statusEffect: { type: 'CORRUPTION', amount: 3 },
    special: 'DRAW'
  },
  {
    id: 'void_detonate',
    sequence: [CardType.TECH, CardType.STRIKE, CardType.TECH], 
    name: '引爆禁咒',
    effectDescription: '触发：施加2层腐败，随后引爆所有腐败(x10)。', 
    rarity: 'LEGENDARY',
    type: 'DAMAGE',
    special: 'EXECUTE_CORRUPTION'
  },
  {
    id: 'ancient_forbidden_curse',
    sequence: [CardType.GLITCH, CardType.TECH, CardType.STRIKE],
    name: '旧日禁咒',
    effectDescription: '触发：清空缓冲，造成15%最大生命伤害。自伤5。',
    rarity: 'LEGENDARY',
    type: 'DAMAGE',
    special: 'PERCENT_HP_DMG'
  }
];

export const ITEM_SHAPES = {
  SQUARE_2x2: [[1, 1], [1, 1]],
  LINE_4: [[1, 1, 1, 1]],
  LINE_3: [[1, 1, 1]], // New
  LINE_2: [[1, 1]],
  L_SHAPE: [[1, 0, 0], [1, 0, 0], [1, 1, 0]],
  T_SHAPE: [[1, 1, 1], [0, 1, 0]],
  SINGLE: [[1]],
  Z_SHAPE: [[1, 1, 0], [0, 1, 1]],
  BOX_3x3: [[1,1,1],[1,1,1],[1,1,1]],
  U_SHAPE: [[1, 0, 1], [1, 1, 1]], // New
  CROSS: [[0,1,0],[1,1,1],[0,1,0]], // New
};

// Loot Table - Micro Stats
export const LOOT_TABLE: Omit<GridItem, 'id' | 'x' | 'y' | 'rotation' | 'isIdentified'>[] = [
  // --- CONSUMABLES ---
  { 
    name: '急救注射器', type: 'CONSUMABLE', rarity: 'COMMON', shape: ITEM_SHAPES.SINGLE, color: 'bg-red-700 border border-red-500', 
    stats: { heal: 10 }, value: 150,
    description: '消耗: 恢复 10 HP' 
  },
  { 
    name: '肾上腺素', type: 'CONSUMABLE', rarity: 'RARE', shape: ITEM_SHAPES.LINE_2, color: 'bg-yellow-600 border border-yellow-400', 
    stats: { heal: 2, damageBonus: 1 }, value: 800,
    description: '消耗: +2HP, 且本局游戏所有攻击卡牌伤害 +1' 
  },
  { 
    name: '神经镇静剂', type: 'CONSUMABLE', rarity: 'COMMON', shape: ITEM_SHAPES.SINGLE, color: 'bg-blue-600 border border-blue-400', 
    stats: { cleanse: true }, value: 200,
    description: '消耗: 清除所有负面状态 (Debuff)' 
  },

  // --- ARTIFACTS (COMMON) ---
  { 
    name: '磨刀石', type: 'ARTIFACT', rarity: 'COMMON', shape: ITEM_SHAPES.SINGLE, color: 'bg-stone-500 border border-stone-400', 
    stats: { damageBonus: 1 }, value: 300,
    description: '被动: 所有攻击卡牌伤害 +1' 
  },
  { 
    name: '碳纤维板', type: 'ARTIFACT', rarity: 'COMMON', shape: ITEM_SHAPES.SINGLE, color: 'bg-stone-600 border border-stone-400', 
    stats: { shieldStart: 3 }, value: 250,
    description: '被动: 战斗开始时获得 3 点护甲' 
  },
  { 
    name: '重型盾徽', type: 'ARTIFACT', rarity: 'COMMON', shape: ITEM_SHAPES.SINGLE, color: 'bg-blue-700 border border-blue-500', 
    stats: { shieldBonus: 1 }, value: 350,
    description: '被动: 护甲效能 +1 (所有护甲卡数值+1)' 
  },

  // --- ARTIFACTS (RARE) ---
  { 
    name: '锈蚀大剑', type: 'ARTIFACT', rarity: 'RARE', shape: ITEM_SHAPES.LINE_4, color: 'bg-orange-800 border border-orange-600', 
    stats: { damageBonus: 2 }, value: 1200,
    description: '被动: 所有攻击卡牌伤害 +2' 
  }, 
  { 
    name: '力场发生器', type: 'ARTIFACT', rarity: 'RARE', shape: ITEM_SHAPES.SQUARE_2x2, color: 'bg-blue-800 border border-cyan-500', 
    stats: { shieldStart: 5, shieldBonus: 2 }, value: 1500,
    description: '被动: 战始+5护甲, 护甲效能 +2' 
  },
  {
    name: '反应装甲', type: 'ARTIFACT', rarity: 'RARE', shape: ITEM_SHAPES.Z_SHAPE, color: 'bg-red-800 border border-red-500',
    stats: { thorns: 2 }, value: 1100,
    description: '被动: 荆棘+2 (受到攻击时反弹 2 点伤害)'
  },
  {
    name: '狂战士义眼', type: 'ARTIFACT', rarity: 'RARE', shape: ITEM_SHAPES.LINE_2, color: 'bg-red-600 border border-red-400',
    stats: { damageBonus: 2, hpBonus: -8 }, value: 1800,
    description: '被动: 攻击卡伤害 +2, 但生命上限 -8 (玻璃大炮)'
  },

  // --- ARTIFACTS (LEGENDARY) ---
  { 
    name: '刺客护符', type: 'ARTIFACT', rarity: 'LEGENDARY', shape: ITEM_SHAPES.L_SHAPE, color: 'bg-purple-800 border border-purple-500', 
    stats: { damageBonus: 1, hpBonus: 5 }, value: 5000,
    description: '被动: 攻击卡伤害+1, 生命上限+5' 
  },
  {
    name: '黑曜石方尖碑', type: 'ARTIFACT', rarity: 'LEGENDARY', shape: ITEM_SHAPES.T_SHAPE, color: 'bg-black border border-stone-600',
    stats: { shieldStart: 15 }, value: 6500,
    description: '被动: 战斗开始时获得 15 点巨额护甲'
  },
  {
    name: '虚空之心', type: 'ARTIFACT', rarity: 'LEGENDARY', shape: ITEM_SHAPES.CROSS, color: 'bg-purple-950 border border-purple-600',
    stats: { damageBonus: 3, shieldBonus: 2, hpBonus: -10 }, value: 8000,
    description: '被动: 攻击+3, 护甲效能+2, 但生命上限 -10'
  },

  // --- TRASH/LOOT ---
  { name: '古神之眼', type: 'LOOT', rarity: 'LEGENDARY', shape: ITEM_SHAPES.SQUARE_2x2, color: 'bg-dungeon-gold border border-yellow-200', stats: {}, value: 10000, description: '撤离: 高价值遗物' },
  { name: '损坏的逻辑核心', type: 'LOOT', rarity: 'RARE', shape: ITEM_SHAPES.T_SHAPE, color: 'bg-cyan-800 border border-cyan-400', stats: {}, value: 2000, description: '撤离: 兑换算力' },
  { name: '沉重的黄金', type: 'LOOT', rarity: 'RARE', shape: ITEM_SHAPES.BOX_3x3, color: 'bg-yellow-700 border border-yellow-500', stats: {}, value: 3500, description: '撤离: 极高价值，极其沉重' },
  { name: '异形骨架', type: 'LOOT', rarity: 'COMMON', shape: ITEM_SHAPES.U_SHAPE, color: 'bg-stone-700 border border-stone-500', stats: {}, value: 450, description: '撤离: 普通的生物样本' },
];

export const MAX_BUFFER_SIZE = 5;
export const HAND_SIZE = 5;
export const DRAW_AMOUNT = 2;
export const INVENTORY_WIDTH = 8;
export const INVENTORY_HEIGHT = 5; // 按照最新 8x5 结构要求更新
export const WAREHOUSE_WIDTH = 8;
export const WAREHOUSE_HEIGHT = 40; // 8页 * 5行 = 总计 40行满级仓库
export const SAFE_ZONE_WIDTH = 3; // Reduced to 3
export const EQUIPMENT_ROW_COUNT = 2; // Reduced to 2 rows to give more space for backpack
export const STAGES_PER_DEPTH = 5;
