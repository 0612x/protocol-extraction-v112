
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

export const EXP_THRESHOLDS = [0, 200, 600, 1400, 3000];

export const AGENT_TEMPLATES: Partial<Character>[] = [
  { name: 'D-014 (拾荒者)', class: 'OPERATOR', quality: 'WHITE', grade: 'C', level: 1, stats: { maxHp: 30 } as any },
  { name: 'D-089 (苦工)', class: 'OPERATOR', quality: 'WHITE', grade: 'C', level: 1, stats: { maxHp: 30 } as any },
  { name: 'D-112 (耗材)', class: 'OPERATOR', quality: 'WHITE', grade: 'C', level: 1, stats: { maxHp: 30 } as any },
  { name: 'D-255 (测试体)', class: 'OPERATOR', quality: 'WHITE', grade: 'C', level: 1, stats: { maxHp: 30 } as any },
  { name: 'D-404 (盲流)', class: 'OPERATOR', quality: 'WHITE', grade: 'C', level: 1, stats: { maxHp: 30 } as any },

 { name: 'Alpha-重装', class: 'OPERATOR', quality: 'GREEN', grade: 'B', level: 1, stats: { maxHp: 35 } as any, passiveSkill: { id: 'bulwark', name: '坚毅', desc: '每场战斗开始时，自动获得相当于最大生命值 10% 的护甲。', type: 'PASSIVE' } },
  { name: 'Alpha-医护', class: 'OPERATOR', quality: 'GREEN', grade: 'B', level: 1, stats: { maxHp: 35 } as any, passiveSkill: { id: 'medic', name: '自愈细胞', desc: '战斗胜利后，恢复 10% 最大生命值。', type: 'PASSIVE' } },
  { name: 'Alpha-狂暴', class: 'OPERATOR', quality: 'GREEN', grade: 'B', level: 1, stats: { maxHp: 35 } as any, passiveSkill: { id: 'berserker', name: '嗜血', desc: '生命值低于 50% 时，所有攻击伤害 +1。', type: 'PASSIVE' } },
  { name: 'Alpha-斥候', class: 'OPERATOR', quality: 'GREEN', grade: 'B', level: 1, stats: { maxHp: 35 } as any, passiveSkill: { id: 'scout', name: '轻盈', desc: '每场战斗首回合，额外抽 1 张牌。', type: 'PASSIVE' } },
  { name: 'Alpha-工兵', class: 'OPERATOR', quality: 'GREEN', grade: 'B', level: 1, stats: { maxHp: 35 } as any, passiveSkill: { id: 'sapper', name: '带刺装甲', desc: '始终拥有 1 点反伤（Thorns）。', type: 'PASSIVE' } },

  { name: 'Beta-刺客', class: 'GHOST', quality: 'BLUE', grade: 'A', level: 1, stats: { maxHp: 40 } as any, passiveSkill: { id: 'assassin', name: '致命弱点', desc: '造成伤害时，有 5% 概率造成双倍伤害。', type: 'PASSIVE' } },
  { name: 'Beta-暴徒', class: 'GHOST', quality: 'BLUE', grade: 'A', level: 1, stats: { maxHp: 40 } as any, passiveSkill: { id: 'thug', name: '越战越勇', desc: '每击杀一名敌人，本局游戏永久增加 1 点基础伤害。', type: 'PASSIVE' } },
 { name: 'Beta-毒师', class: 'GHOST', quality: 'BLUE', grade: 'A', level: 1, stats: { maxHp: 40 } as any, passiveSkill: { id: 'venom', name: '剧毒附魔', desc: '你打出的每张攻击牌有 50% 概率对敌人施加 1 层中毒。', type: 'PASSIVE' } },
  { name: 'Beta-拾荒王', class: 'GHOST', quality: 'BLUE', grade: 'A', level: 1, stats: { maxHp: 40 } as any, passiveSkill: { id: 'scrapper', name: '废物利用', desc: '丢弃手牌时，每丢弃 1 张恢复 1 点生命。', type: 'PASSIVE' } },

  // PURPLE ELITES
  { name: 'Gamma-血猎', class: 'OPERATOR', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any, 
    passiveSkill: { id: 'bloodhound', name: '鲜血渴望', desc: '对流血的敌人造成伤害 +50%。', type: 'PASSIVE' },
    activeSkill: { id: 'bloodhound', name: '撕裂打击', desc: '对目标造成 15 点无视护甲的真实伤害，并施加 3 层流血。', type: 'ACTIVE' } },
  { name: 'Gamma-壁垒', class: 'OPERATOR', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any, 
    passiveSkill: { id: 'aegis', name: '绝对防御', desc: '护甲获取量增加 20%。', type: 'PASSIVE' },
    activeSkill: { id: 'aegis', name: '立场超载', desc: '立刻获得相当于你当前生命值的护甲。', type: 'ACTIVE' } },
  { name: 'Gamma-幽灵', class: 'GHOST', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any, 
    passiveSkill: { id: 'phantom', name: '光学迷彩', desc: '拥有 5% 绝对闪避率（免除伤害）。', type: 'PASSIVE' },
    activeSkill: { id: 'phantom', name: '虚空潜行', desc: '获得 2 层闪避效果（免除后续 2 次受到的伤害）。', type: 'ACTIVE' } },
  { name: 'Gamma-纵火狂', class: 'CONSTRUCT', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any,
    passiveSkill: { id: 'pyro', name: '余烬', desc: '敌人身上的燃烧层数不会随回合衰减。', type: 'PASSIVE' },
    activeSkill: { id: 'pyro', name: '烈焰风暴', desc: '引爆敌人，造成等同于其燃烧层数的瞬间伤害，并恢复这些层数。', type: 'ACTIVE' } },
  { name: 'Gamma-黑客', class: 'CONSTRUCT', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any, 
    passiveSkill: { id: 'hacker', name: '内存拓展', desc: '你的手牌上限 +1。', type: 'PASSIVE' },
    activeSkill: { id: 'hacker', name: '数据窃取', desc: '强制将敌人的攻击意图伤害数值减去 20%。', type: 'ACTIVE' } },
  { name: 'Gamma-死灵', class: 'GHOST', quality: 'PURPLE', grade: 'S', level: 1, stats: { maxHp: 45 } as any, 
    passiveSkill: { id: 'necromancer', name: '灵魂汲取', desc: '击杀敌人会增加 2 点最大生命值上限（单局有效）。', type: 'PASSIVE' },
    activeSkill: { id: 'necromancer', name: '濒死爆发', desc: '消耗当前 50% 生命值，造成消耗量 2 倍的伤害。', type: 'ACTIVE' } },

 // GOLD LEGENDARIES
  { name: 'Omega-女武神', class: 'OPERATOR', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any, 
    passiveSkill: { id: 'valkyrie', name: '瓦尔哈拉之光', desc: '[被动] 受到致命伤害时，免除死亡并恢复 50% 生命值（单局限一次）。', type: 'PASSIVE' },
    activeSkill: { id: 'valkyrie', name: '神罚雷击', desc: '扣除 10 点生命值，造成 20 点雷击伤害，50% 概率暴击翻倍。', type: 'ACTIVE' } },
  { name: 'Omega-暴君', class: 'CONSTRUCT', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any, 
    passiveSkill: { id: 'tyrant', name: '绝对碾压', desc: '敌人的所有护甲获取减半。', type: 'PASSIVE' },
    activeSkill: { id: 'tyrant', name: '处决指令', desc: '敌人生命值低于 30% 时，70% 概率直接秒杀。', type: 'ACTIVE' } },
  { name: 'Omega-先知', class: 'GHOST', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any, 
    passiveSkill: { id: 'oracle', name: '全知之眼', desc: '清晰看到敌人下两个回合的攻击意图。', type: 'PASSIVE' },
    activeSkill: { id: 'oracle', name: '命运篡改', desc: '强制将敌人当前的意图更改为“窥视”(发呆)，并立刻抽取 3 张牌。', type: 'ACTIVE' } },
 { name: 'Omega-巨兽', class: 'CONSTRUCT', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any, 
    passiveSkill: { id: 'behemoth', name: '厚重生物', desc: '受到的所有最终伤害强制 -1。', type: 'PASSIVE' },
    activeSkill: { id: 'behemoth', name: '撼地践踏', desc: '获得相当于最大生命值 50% 的护甲，并强制将敌人当前意图更改为“窥视”(发呆)。', type: 'ACTIVE' } },
  { name: 'Omega-赌徒', class: 'OPERATOR', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any,
    passiveSkill: { id: 'high_roller', name: '孤注一掷', desc: '你的伤害随机在 50% ~ 200% 之间波动。', type: 'PASSIVE' },
    activeSkill: { id: 'high_roller', name: '清空弹匣', desc: '丢弃所有手牌。每丢弃一张牌，造成 2 伤害并恢复 1 生命。', type: 'ACTIVE' } },
  { name: 'Omega-虚空', class: 'GHOST', quality: 'GOLD', grade: 'SS', level: 1, stats: { maxHp: 50 } as any, 
    passiveSkill: { id: 'void', name: '虚无剥夺', desc: '敌人的最大生命值在战斗开始时强制扣除 10%。', type: 'PASSIVE' },
    activeSkill: { id: 'void', name: '黑洞坍缩', desc: '直接将敌我双方的生命值同时减半。', type: 'ACTIVE' } }
];
// (追加在 constants.ts 最底部)

// --- 战区地图生态 (数值放大器与环境变数) ---
export const MAPS = [
    { id: 'MAP-01', name: '废弃矿坑', req: 0, hpMult: 1.0, dmgMult: 1.0, desc: '新手村/破产区。无环境变数。', color: 'text-stone-400', border: 'border-stone-500' },
    { id: 'MAP-02', name: '生化废都', req: 15000, hpMult: 1.5, dmgMult: 1.2, desc: '开局玩家自动叠加 1 层中毒。', color: 'text-green-500', border: 'border-green-600' },
    { id: 'MAP-03', name: '虚空裂隙', req: 50000, hpMult: 2.0, dmgMult: 1.5, desc: '开局玩家自动叠加 1 层虚弱。', color: 'text-purple-500', border: 'border-purple-600' },
    { id: 'MAP-04', name: '欧米伽核心', req: 150000, hpMult: 3.0, dmgMult: 2.0, desc: '本局内，玩家的最大生命值强制降低 20%。', color: 'text-red-500', border: 'border-red-600' }
];

// --- 20 种纯机制驱动的怪物池 (无 Map 绑定) ---
export const ENEMY_TEMPLATES: any[] = [
    // 强攻型 AI (名字触发词: 鼠, 犬, 兵, 巨像)
    { name: '拾荒新兵', maxHp: 15, intents: [{type:'ATTACK', value:3, description:'攻击', turnsRemaining:1}] },
    { name: '矿坑鼠', maxHp: 12, statuses: { 'DODGE': 1 }, intents: [{type:'ATTACK', value:2, description:'撕咬', turnsRemaining:1}] },
    { name: '嗜血狂犬', maxHp: 20, intents: [{type:'ATTACK', value:4, description:'流血撕咬', turnsRemaining:1}] },
    { name: '雷暴巨像', maxHp: 35, intents: [{type:'DEBUFF', value:0, description:'感电', turnsRemaining:1}, {type:'ATTACK', value:5, description:'高压', turnsRemaining:1}] },
    { name: '拾荒老兵', maxHp: 25, intents: [{type:'DEFEND', value:5, description:'掩体', turnsRemaining:1}, {type:'ATTACK', value:4, description:'射击', turnsRemaining:1}] },

    // 重装型 AI (名字触发词: 机甲, 软泥, 医疗机, 暴徒, 守卫)
    { name: '防爆机甲', maxHp: 40, shield: 20, intents: [{type:'DEFEND', value:8, description:'铁壁', turnsRemaining:1}, {type:'ATTACK', value:4, description:'碾压', turnsRemaining:1}] },
    { name: '废料软泥', maxHp: 30, statuses: { 'THORNS': 1 }, intents: [{type:'ATTACK', value:2, description:'酸蚀冲撞', turnsRemaining:1}] },
    { name: '生锈医疗机', maxHp: 25, intents: [{type:'HEAL', value:5, description:'急救协议', turnsRemaining:1}] },
    { name: '武装暴徒', maxHp: 35, statuses: { 'STRENGTH': 1 }, intents: [{type:'ATTACK', value:4, description:'狂暴连打', turnsRemaining:1}] },
    { name: '欧米伽守卫 (精英)', maxHp: 60, intents: [{type:'DEFEND', value:15, description:'绝境防爆', turnsRemaining:1}, {type:'ATTACK', value:6, description:'光刃', turnsRemaining:1}] },

    // 生化型 AI (名字触发词: 毒, 腐蚀, 感染, 幼虫, 瘟疫)
    { name: '毒液孢子', maxHp: 30, intents: [{type:'DEBUFF', value:0, description:'剧毒', turnsRemaining:1}, {type:'ATTACK', value:2, description:'撞击', turnsRemaining:1}] },
    { name: '腐蚀变异体', maxHp: 35, intents: [{type:'DEBUFF', value:0, description:'腐蚀', turnsRemaining:1}, {type:'ATTACK', value:3, description:'酸液', turnsRemaining:1}] },
    { name: '盲眼感染者', maxHp: 25, intents: [{type:'DEBUFF', value:0, description:'致盲(虚弱)', turnsRemaining:1}, {type:'ATTACK', value:2, description:'抓挠', turnsRemaining:1}] },
    { name: '自爆幼虫', maxHp: 10, intents: [{type:'WAIT', value:0, description:'倒计时', turnsRemaining:1}, {type:'ATTACK', value:30, description:'自爆', turnsRemaining:1}] },
    { name: '瘟疫母体 (精英)', maxHp: 70, intents: [{type:'DEBUFF', value:0, description:'生化熔炉(毒/腐蚀)', turnsRemaining:1}, {type:'ATTACK', value:5, description:'重压', turnsRemaining:1}] },

    // 虚空精神型 AI (名字触发词: 信徒, 凝视者, 吞噬者, 拟态, 看守者)
    { name: '绝望信徒', maxHp: 35, intents: [{type:'POLLUTE', value:0, description:'精神污染', turnsRemaining:1}, {type:'ATTACK', value:4, description:'法球', turnsRemaining:1}] },
    { name: '虚空凝视者', maxHp: 40, intents: [{type:'POLLUTE', value:0, description:'序列异化', turnsRemaining:1}, {type:'ATTACK', value:3, description:'凝视', turnsRemaining:1}] },
    { name: '记忆吞噬者', maxHp: 35, intents: [{type:'ATTACK', value:4, description:'汲取充能', turnsRemaining:1}] },
    { name: '深渊拟态', maxHp: 10, intents: [{type:'BUFF', value:0, description:'镜面反射', turnsRemaining:1}, {type:'ATTACK', value:4, description:'镜像击', turnsRemaining:1}] },
    { name: '裂隙看守者 (精英)', maxHp: 75, statuses: { 'THORNS': 2 }, intents: [{type:'POLLUTE', value:0, description:'虚空倒刺', turnsRemaining:1}, {type:'ATTACK', value:5, description:'裁决', turnsRemaining:1}] },

    // 最终首领
    { name: '[隐藏 Boss] 叛逃的指挥官', maxHp: 120, statuses: { 'STRENGTH': 1, 'DODGE': 1 }, intents: [{type:'DEFEND', value:10, description:'战术规避', turnsRemaining:1}, {type:'HEAL', value:10, description:'自愈细胞', turnsRemaining:1}, {type:'ATTACK', value:6, description:'致命射击', turnsRemaining:1}] }
];

// --- 50 个绝对保底安全的奇遇事件池 ---
export const EVENTS_POOL: GameEvent[] = [
    // 类别一：安全拾荒
    { id: 'ev1', title: '【破损急救箱】', description: '墙角有一个积灰的急救箱。', choices: [ { label: '打开 (+20HP)', healHp: 20 }, { label: '离开' } ] },
    { id: 'ev2', title: '【散落的金库】', description: '地上散落着一堆加密芯片。', choices: [ { label: '捡走 (+1500₮)', addGold: 1500 }, { label: '离开' } ] },
    { id: 'ev3', title: '【漏电充能站】', description: '高压电弧在跳动。', choices: [ { label: '拼一把 (满充能, -5HP)', addCharge: 10, damageHp: 5 }, { label: '离开' } ] },
    { id: 'ev4', title: '【废弃睡袋】', description: '一个相对安全的休息点。', choices: [ { label: '小憩 (回30%血)', healHpPct: 0.3 }, { label: '离开' } ] },
    { id: 'ev5', title: '【死去的士兵】', description: '一具冰冷的尸体。', choices: [ { label: '掩埋行善 (最大生命+5)', addMaxHp: 5 }, { label: '离开' } ] },
    { id: 'ev6', title: '【旧地下泉水】', description: '清澈的水流，似乎能洗刷污染。', choices: [ { label: '饮用 (清除负面状态)', removeDebuffs: true }, { label: '离开' } ] },
    { id: 'ev7', title: '【生锈保险箱】', description: '锁芯已经锈死。', choices: [ { label: '暴力拆解 (+2000₮, -3HP)', addGold: 2000, damageHp: 3 }, { label: '离开' } ] },
    { id: 'ev8', title: '【无人机残骸】', description: '电池里还有剩余电量。', choices: [ { label: '提取能源 (+5充能)', addCharge: 5 }, { label: '离开' } ] },
    { id: 'ev9', title: '【防暴盾残片】', description: '一块坚硬的复合材料。', choices: [ { label: '穿戴 (战力提升)', getRelic: true }, { label: '离开' } ] },
    { id: 'ev10', title: '【遗留的补给】', description: '一个半开的军用背包。', choices: [ { label: '搜刮 (战力提升)', getRelic: true }, { label: '离开' } ] },

    // 类别二：黑市消费
    { id: 'ev11', title: '【阴暗的游商】', description: '"朋友，买条命吗？"', choices: [ { label: '买药 (-3000₮, 满血)', reqGold: 3000, healHpPct: 1.0 }, { label: '太贵了离开' } ] },
    { id: 'ev12', title: '【走私贩子】', description: '他向你展示了一个黑匣子。', choices: [ { label: '买盲盒 (-8000₮, 战力提升)', reqGold: 8000, getRelic: true }, { label: '离开' } ] },
    { id: 'ev13', title: '【地下诊所】', description: '非法的手术台。', choices: [ { label: '强化骨骼 (-5000₮, MaxHP+5)', reqGold: 5000, addMaxHp: 5 }, { label: '离开' } ] },
    { id: 'ev14', title: '【武器改装匠】', description: '火花四溅的作坊。', choices: [ { label: '磨刀 (-4000₮, 获得狂暴)', reqGold: 4000, addBuff: 'STRENGTH' }, { label: '离开' } ] },
    { id: 'ev15', title: '【情报贩子】', description: '他手里掌握着前方的怪物弱点。', choices: [ { label: '买情报 (-2000₮, 敌虚弱)', reqGold: 2000, addDebuff: 'WEAK' }, { label: '离开' } ] },
    { id: 'ev16', title: '【流浪医生】', description: '需要净化血液中的毒素吗？', choices: [ { label: '血清 (-3000₮, 清除Debuff)', reqGold: 3000, removeDebuffs: true }, { label: '离开' } ] },
    { id: 'ev17', title: '【黑客终端】', description: '接入深网可能获得高额算力。', choices: [ { label: '骇入 (-3000₮, 充能满)', reqGold: 3000, addCharge: 10 }, { label: '离开' } ] },
    { id: 'ev18', title: '【神秘售货机】', description: '投入金币，赌个运气。', choices: [ { label: '抽奖 (-5000₮, +10000₮)', reqGold: 5000, addGold: 10000 }, { label: '离开' } ] },
    { id: 'ev19', title: '【雇佣兵营地】', description: '他们可以为你提供临时火力支援。', choices: [ { label: '雇佣 (-6000₮, 战力提升)', reqGold: 6000, getRelic: true }, { label: '离开' } ] },
    { id: 'ev20', title: '【贪婪的难民】', description: '他饿极了，盯着你的钱包。', choices: [ { label: '施舍 (-5000₮, 战力提升)', reqGold: 5000, getRelic: true }, { label: '无视' } ] },

    // 类别三：高风险博弈
    { id: 'ev21', title: '【诡雷背包】', description: '尸体紧紧抓着背包，下面压着地雷。', choices: [ { label: '硬扯 (-15HP, 战力提升)', damageHp: 15, getRelic: true }, { label: '放弃' } ] },
    { id: 'ev22', title: '【不稳定的源晶】', description: '辐射让你头晕目眩。', choices: [ { label: '徒手拿 (+10000₮, MaxHP-10)', addGold: 10000, addMaxHp: -10 }, { label: '离开' } ] },
    { id: 'ev23', title: '【被压住的金砖】', description: '墙体随时会塌。', choices: [ { label: '抽离 (+6000₮, -5HP, 虚弱)', addGold: 6000, damageHp: 5, addDebuff: 'WEAK' }, { label: '离开' } ] },
    { id: 'ev24', title: '【疯狂赌徒】', description: '"用你一半的血，换我手里的钱！"', choices: [ { label: '赌命 (-50%血, +15000₮)', reqHpPct: 0.5, addGold: 15000 }, { label: '拒绝' } ] },
    { id: 'ev25', title: '【毒气室宝箱】', description: '弥漫着致命气体。', choices: [ { label: '闭气冲刺 (+5000₮, 中毒)', addGold: 5000, addDebuff: 'POISON' }, { label: '离开' } ] },
    { id: 'ev26', title: '【血肉藤蔓包囊】', description: '里面包裹着什么。', choices: [ { label: '扯断 (-10HP, 流血, 战力提升)', damageHp: 10, addDebuff: 'BLEED', getRelic: true }, { label: '离开' } ] },
    { id: 'ev27', title: '【高压电网】', description: '强行跨越会受到电击。', choices: [ { label: '强行跨越 (-15HP, 感电, 满充能)', damageHp: 15, addDebuff: 'SHOCK', addCharge: 10 }, { label: '绕路离开' } ] },
    { id: 'ev28', title: '【尖刺陷阱】', description: '前方满是尖刺。', choices: [ { label: '冒险跨越 (-10HP, +3000₮)', damageHp: 10, addGold: 3000 }, { label: '离开' } ] },
    { id: 'ev29', title: '【未知的注射器】', description: '不明液体。', choices: [ { label: '注射 (满血, -20HP)', healHpPct: 1.0, damageHp: 20 }, { label: '扔掉' } ] },
    { id: 'ev30', title: '【辐射池】', description: '池底有闪光。', choices: [ { label: '打捞 (腐蚀, 战力提升)', addDebuff: 'CORROSION', getRelic: true }, { label: '离开' } ] },

    // 类别四：机制异化
    { id: 'ev31', title: '【血肉祭坛】', description: '献上生命，换取力量。', choices: [ { label: '献祭 (-10 MaxHP, 获得狂暴)', addMaxHp: -10, addBuff: 'STRENGTH' }, { label: '离开' } ] },
    { id: 'ev32', title: '【遗忘方尖碑】', description: '凝视深渊。', choices: [ { label: '凝视 (回50血, 塞入崩坏牌)', healHp: 50, addCard: CardType.GLITCH }, { label: '离开' } ] },
    { id: 'ev33', title: '【异化胚胎】', description: '跳动的肉球。', choices: [ { label: '吞噬 (-5 MaxHP, 获得荆棘)', addMaxHp: -5, addBuff: 'THORNS' }, { label: '离开' } ] },
    { id: 'ev34', title: '【记忆清洗椅】', description: '洗去过往。', choices: [ { label: '坐下 (清空充能, 回满血)', addCharge: -99, healHpPct: 1.0 }, { label: '离开' } ] },
    { id: 'ev35', title: '【低语黑石】', description: '石头在说话。', choices: [ { label: '倾听 (获得狂暴, 塞入崩坏牌)', addBuff: 'STRENGTH', addCard: CardType.GLITCH }, { label: '离开' } ] },
    { id: 'ev36', title: '【克隆人坟场】', description: '吸收残魂碎片。', choices: [ { label: '吸收 (MaxHP+5, 受10真伤)', addMaxHp: 5, damageHp: 10 }, { label: '离开' } ] },
    { id: 'ev37', title: '【旧神雕像】', description: '诡异的膜拜物。', choices: [ { label: '祈祷 (中毒+腐蚀, 战力提升)', addDebuff: 'POISON', getRelic: true }, { label: '离开' } ] },
    { id: 'ev38', title: '【思维提取器】', description: '头痛欲裂。', choices: [ { label: '提取 (+10充能, 虚弱)', addCharge: 10, addDebuff: 'WEAK' }, { label: '离开' } ] },
    { id: 'ev39', title: '【战术演算机】', description: '升级系统。', choices: [ { label: '下载 (战力提升)', getRelic: true }, { label: '离开' } ] },
    { id: 'ev40', title: '【废弃兵工厂】', description: '倾其所有。', choices: [ { label: '改造 (-所有金币, 战力提升)', reqGold: 999999, getRelic: true }, { label: '离开' } ] },

    // 类别五：强制撤离点
    { id: 'ev41', title: '【损坏的逃生舱】', description: '如果有资金，可以重新启动。', choices: [ { label: '支付修理 (-20000₮) 撤离!', reqGold: 20000, extract: true }, { label: '太贵了, 继续' } ] },
    { id: 'ev42', title: '【地下走私通道】', description: '看门人要求血的代价。', choices: [ { label: '割肉贿赂 (-50%血) 撤离!', reqHpPct: 0.5, extract: true }, { label: '继续前进' } ] },
    { id: 'ev43', title: '【黑客直升机】', description: '需要能量发射信号。', choices: [ { label: '倾注能量 (-10充能) 撤离!', addCharge: -10, extract: true }, { label: '不撤离' } ] },
    { id: 'ev44', title: '【通风管道】', description: '太狭窄了，必须丢弃重物。', choices: [ { label: '丢弃负重 (-10000₮) 撤离!', reqGold: 10000, extract: true }, { label: '不跑' } ] },
    { id: 'ev45', title: '【军方救援信标】', description: '极其危险的引路灯。', choices: [ { label: '顶住压力 (-30HP) 撤离!', damageHp: 30, extract: true }, { label: '无视离开' } ] },
    { id: 'ev46', title: '【黑市传送门】', description: '以物换物，等价交换。', choices: [ { label: '以物换物 (-20 MaxHP) 撤离!', addMaxHp: -20, extract: true }, { label: '拒绝' } ] },
    { id: 'ev47', title: '【旧排水渠】', description: '污水横流的逃生口。', choices: [ { label: '极限逃生 (-90%血) 撤离!', reqHpPct: 0.9, extract: true }, { label: '算了吧' } ] },
    { id: 'ev48', title: '【雇佣兵车队】', description: '他们顺路返回地表。', choices: [ { label: '买座位 (-15000₮) 撤离!', reqGold: 15000, extract: true }, { label: '没钱' } ] },
    { id: 'ev49', title: '【不稳定的裂隙】', description: '跳进去，听天由命。', choices: [ { label: '纵身一跃 (清空充能/状态) 撤离!', addCharge: -99, removeDebuffs: true, extract: true }, { label: '太危险' } ] },
    { id: 'ev50', title: '【总部的紧急传唤】', description: '你收到了强制回收的绿灯信号！', choices: [ { label: '响应召回 (免费安全撤离)', extract: true }, { label: '继续战斗' } ] }
];





