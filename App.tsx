
import React, { useState, useEffect } from 'react';
import { GamePhase, PlayerStats, Enemy, InventoryState, CardType, Blueprint, GridItem, MetaState, ResourceType, BuildingType, Character } from './types';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT, WAREHOUSE_WIDTH, WAREHOUSE_HEIGHT, STARTING_BLUEPRINTS, BLUEPRINT_POOL, SAFE_ZONE_WIDTH, STAGES_PER_DEPTH, EQUIPMENT_ROW_COUNT, AGENT_TEMPLATES, EXP_THRESHOLDS } from './constants';
import { createEmptyGrid, removeItemFromGrid, placeItemInGrid } from './utils/gridLogic';
import { CombatView } from './components/views/CombatView';
import { InventoryView } from './components/views/InventoryView';
import { MetaView } from './components/views/MetaView';
import { BaseCampView } from './components/views/BaseCampView';
import { WarehouseView } from './components/views/WarehouseView';
import { ExtractionView } from './components/views/ExtractionView';
import { DraftView } from './components/views/DraftView';
import { SettlementView } from './components/views/SettlementView'; // 引入结算界面
import { EventView } from './components/views/EventView'; // 新增奇遇面板
import { getPlayerZone } from './utils/gridLogic'; // 引入区域计算
import { LucideX, LucideSkull, LucideSettings, LucideLogOut, LucideTrash2, LucideBookOpen, LucideTarget, LucideMap, LucidePackage, LucideCpu, LucidePlay, LucideShoppingCart, LucideZap } from 'lucide-react';
import { GameEvent, EventChoice } from './types';
import { MAPS, ENEMY_TEMPLATES, EVENTS_POOL } from './constants';

const INITIAL_PLAYER: PlayerStats = {
  level: 0,
  pendingExp: 0,
  maxHp: 30, // Micro-Number Health Pool
  currentHp: 30,
  shield: 0,
  energy: 3,
  maxEnergy: 3,
  deck: [CardType.STRIKE, CardType.BLOCK, CardType.TECH, CardType.MOVE],
  blueprints: STARTING_BLUEPRINTS,
  statuses: {},
  damageBonus: 0,
  shieldBonus: 0,
  shieldStart: 0,
  thorns: 0
};

const INITIAL_INVENTORY: InventoryState = {
  grid: createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT),
  items: [],
  width: INVENTORY_WIDTH,
  height: INVENTORY_HEIGHT
};

const INITIAL_META_STATE: MetaState = {
  resources: {
    [ResourceType.GOLD]: 100000,
    [ResourceType.SOULS]: 0,
    [ResourceType.TECH_SCRAP]: 5,
    [ResourceType.INSIGHT]: 0
  },
  buildings: {
    [BuildingType.NEXUS]: { type: BuildingType.NEXUS, level: 1, isUnlocked: true },
    [BuildingType.ARMORY]: { type: BuildingType.ARMORY, level: 0, isUnlocked: true },
    [BuildingType.SANCTUARY]: { type: BuildingType.SANCTUARY, level: 0, isUnlocked: false },
    [BuildingType.LABORATORY]: { type: BuildingType.LABORATORY, level: 0, isUnlocked: true },
    [BuildingType.BLACK_MARKET]: { type: BuildingType.BLACK_MARKET, level: 0, isUnlocked: false }
  },
  unlockedBlueprints: [],
  unlockedItems: [],
  runHistory: [],
  warehouse: {
    grid: createEmptyGrid(WAREHOUSE_WIDTH, WAREHOUSE_HEIGHT),
    items: [],
    width: WAREHOUSE_WIDTH,
    height: WAREHOUSE_HEIGHT,
    unlockedRows: 14 // 初始全开，方便测试
  },
  advancedRecruitPity: 0,
  roster: [
    {
      id: 'commander-001',
      name: '本体 (指挥官)',
      class: 'COMMANDER',
      level: 0,
      exp: 0,
      stats: { ...INITIAL_PLAYER, charge: 0 },
      inventory: INITIAL_INVENTORY
    }
  ]
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  const [appTransition, setAppTransition] = useState<'NONE' | 'DYING' | 'EXTRACTING'>('NONE'); // 核心优化：全局过渡动画状态
  const [metaState, setMetaState] = useState<MetaState>(() => {
      // 保证初始有 5 行 (第一页) 仓库解锁
      const init = { ...INITIAL_META_STATE };
      init.warehouse.unlockedRows = 5; 
      init.roster.forEach(c => c.status = 'ALIVE');
      return init;
  });
  const [activeCharId, setActiveCharId] = useState<string | null>(null); // 记录当前出战人
  const [runResult, setRunResult] = useState<any>(null); // 结算数据
  const [player, setPlayer] = useState<PlayerStats>(INITIAL_PLAYER);
  const [inventory, setInventory] = useState<InventoryState>(INITIAL_INVENTORY);
  const [depth, setDepth] = useState(1);
  const [stage, setStage] = useState(1); // 1 to 5
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [draftOptions, setDraftOptions] = useState<Blueprint[]>([]);
  const [isCombatInventoryOpen, setIsCombatInventoryOpen] = useState(false);
  
  const [currentMap, setCurrentMap] = useState<string>('MAP-01'); // 当前战区
  const [pendingEvent, setPendingEvent] = useState<GameEvent | null>(null); // 待处理奇遇

  // System & Settings
  const [showOutGameMenu, setShowOutGameMenu] = useState(false);
  const [showGameGuide, setShowGameGuide] = useState(false); // 新增：游戏指南弹窗状态
  const [isDataLoaded, setIsDataLoaded] = useState(true); // 网页端直接设为 true，无需等待

  // Developer Tools
  const [isGodMode, setIsGodMode] = useState(false);

  // --- STATS CALCULATION (Passive Effects) ---
  useEffect(() => {
    let hpBonus = 0;
    let dmgBonus = 0;
    let shldBonus = 0;
    let shldStart = 0;
    let thornsVal = 0;

    inventory.items.forEach(item => {
        // Rule: Items only provide stats if they are in the EQUIPMENT ZONE (Rows 0, 1, 2)
        const isInEquipmentZone = item.y < EQUIPMENT_ROW_COUNT;

        if (isInEquipmentZone && item.type === 'ARTIFACT' && item.stats) {
            if (item.stats.hpBonus) hpBonus += item.stats.hpBonus;
            if (item.stats.damageBonus) dmgBonus += item.stats.damageBonus;
            if (item.stats.shieldBonus) shldBonus += item.stats.shieldBonus;
            if (item.stats.shieldStart) shldStart += item.stats.shieldStart;
            if (item.stats.thorns) thornsVal += item.stats.thorns;
        }
    });

    setPlayer(prev => {
            const activeChar = metaState.roster.find(c => c.id === activeCharId) || metaState.roster[0];
            const baseMaxHp = activeChar?.stats.maxHp || INITIAL_PLAYER.maxHp;
            const newMaxHp = Math.max(1, baseMaxHp + hpBonus + (prev.runMaxHpBonus || 0)); 
            const newCurrentHp = Math.min(prev.currentHp, newMaxHp);
            
            // 计算基于当前血量上限的护甲被动
            const isSapper = prev.passiveSkill?.id === 'sapper' && prev.level >= 2;
            const passiveThorns = isSapper ? 1 : 0;

            return {
                ...prev,
                maxHp: newMaxHp,
                currentHp: newCurrentHp,
                damageBonus: dmgBonus,
                shieldBonus: shldBonus,
                shieldStart: shldStart, // 修复：此处仅记录装备提供的初始护甲，重装的被动在开战时独立附加
                thorns: thornsVal + passiveThorns
            };
        });
      }, [inventory.items, activeCharId, metaState.roster]);

  const generateEnemy = (level: number, currentStage: number, mapId: string): Enemy => {
      const isBoss = currentStage % STAGES_PER_DEPTH === 0;
      const mapConfig = MAPS.find(m => m.id === mapId) || MAPS[0];
      
      // 1. 筛选怪物池 (精英和首领仅在特定层数出没)
      let pool = ENEMY_TEMPLATES.filter(e => !e.name.includes('Boss') && !e.name.includes('精英'));
      if (isBoss) {
          pool = ENEMY_TEMPLATES.filter(e => e.name.includes('Boss') || e.name.includes('守卫') || e.name.includes('母体') || e.name.includes('看守者'));
      } else if (currentStage === STAGES_PER_DEPTH - 1) {
          pool = ENEMY_TEMPLATES.filter(e => e.name.includes('精英'));
      }
      if (pool.length === 0) pool = ENEMY_TEMPLATES; 
      
      const template = pool[Math.floor(Math.random() * pool.length)];

      // 2. 获取地图的基础放大倍率与关卡深度加成
      const hpMult = mapConfig.hpMult || 1;
      const dmgMult = mapConfig.dmgMult || 1;
      const depthScale = 1 + ((level - 1) * 0.3); // 每大层增加30%

      const finalMaxHp = Math.floor(template.maxHp * hpMult * depthScale);

      // 3. 动态缩放意图数值
      const scaledIntents = template.intents.map((i: any) => ({
          ...i,
          value: (i.type === 'ATTACK') ? Math.floor(i.value * dmgMult * depthScale) : Math.floor(i.value * depthScale)
      }));

      return {
          name: template.name,
          maxHp: finalMaxHp,
          currentHp: finalMaxHp,
          shield: template.shield || 0,
          statuses: template.statuses ? { ...template.statuses } : {},
          intents: scaledIntents,
          currentIntentIndex: 0
      };
  };

  const enterBaseCamp = () => {
    setPhase('BASE_CAMP');
  };

  const handleLoseCombat = () => {
    setAppTransition('DYING'); // 触发死亡第一阶段电影级过渡

    // 延迟 2.5 秒执行结算逻辑，等待黑屏渐变动画播完
    setTimeout(() => {
        const activeChar = metaState.roster.find(c => c.id === activeCharId) || metaState.roster[0];
        const isCommander = activeChar.class === 'COMMANDER';
        const pLevel = isCommander ? 0 : activeChar.level;

        const safeItems: GridItem[] = [];
        const lostItems: GridItem[] = [];

        // 严苛过滤：任何一个方块（1）不在 SAFE 区，整个物品都会丢失！
        inventory.items.forEach(item => {
            let isSafe = true;
            for (let r = 0; r < item.shape.length; r++) {
                for (let c = 0; c < (item.shape[0]?.length || 0); c++) {
                    if (item.shape[r][c] === 1) {
                        if (getPlayerZone(item.x + c, item.y + r, pLevel) !== 'SAFE') {
                            isSafe = false;
                        }
                    }
                }
            }
            if (isSafe) safeItems.push(item);
            else lostItems.push(item);
        });

        const totalValue = safeItems.reduce((acc, item) => acc + (item.value || 0) * (item.quantity || 1), 0);

        const oldLevel = activeChar.level;
        const oldExp = activeChar.exp;
        let newExp = isCommander ? 0 : oldExp + player.pendingExp;
        let newLevel = oldLevel;
        let newMaxHp = activeChar.stats.maxHp;
        
        // 核心优化：即便战斗失败，只要获得了经验，也要正常判定升级
        if (!isCommander) {
            while (newLevel < 5 && newExp >= EXP_THRESHOLDS[newLevel]) {
                newLevel++;
                newMaxHp += 5;
            }
        }

        setMetaState(prev => {
            const newRoster = prev.roster.map(c => {
                if (c.id === activeCharId) {
                    let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
                    safeItems.forEach(i => {
                        const itemForPlacement = { ...i, rotation: 0 as const };
                        newGrid = placeItemInGrid(newGrid, itemForPlacement, i.x, i.y);
                    });

                    return {
                        ...c,
                        level: newLevel,
                        exp: newExp,
                        status: isCommander ? 'ALIVE' : 'DEAD', 
                        stats: { ...c.stats, level: newLevel, maxHp: newMaxHp, currentHp: isCommander ? newMaxHp : 0 },
                        inventory: { ...c.inventory, items: safeItems, grid: newGrid }
                    };
                }
                return c;
            });
            return { ...prev, roster: newRoster };
        });

        // 打包等级与经验数据用于过场动画
        setRunResult({ 
            outcome: 'DEFEAT', extractedItems: safeItems, lostItems, totalValue, isCommander, 
            expGained: player.pendingExp, oldLevel, oldExp, newLevel, newExp, charName: activeChar.name 
        });
        setPhase('SETTLEMENT');
        setAppTransition('NONE'); // 状态重置，切入 SettlementView
    }, 2500);
  };

  const handleExtract = () => {
    setAppTransition('EXTRACTING'); // 触发撤离第一阶段电影级过渡

    setTimeout(() => {
        const allItems = inventory.items;
        const totalValue = allItems.reduce((acc, item) => acc + (item.value || 0) * (item.quantity || 1), 0);
        const activeChar = metaState.roster.find(c => c.id === activeCharId) || metaState.roster[0];
        const isCommander = activeChar.class === 'COMMANDER';

        const oldLevel = activeChar.level;
        const oldExp = activeChar.exp;
        let newExp = isCommander ? 0 : oldExp + player.pendingExp;
        let newLevel = oldLevel;
        let newMaxHp = activeChar.stats.maxHp;
        
        if (!isCommander) {
            while (newLevel < 5 && newExp >= EXP_THRESHOLDS[newLevel]) {
                newLevel++;
                newMaxHp += 5;
            }
        }

       setMetaState(prev => {
            const newRoster = prev.roster.map(c => {
                if (c.id === activeCharId) {
                    let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
                    allItems.forEach(item => {
                        const itemForPlacement = { ...item, rotation: 0 as const };
                        newGrid = placeItemInGrid(newGrid, itemForPlacement, item.x, item.y);
                    });

                    return { 
                        ...c, 
                        level: newLevel,
                        exp: newExp,
                        stats: { ...c.stats, level: newLevel, maxHp: newMaxHp },
                        inventory: { ...c.inventory, items: allItems, grid: newGrid } 
                    };
                }
                return c;
            });
            return { ...prev, roster: newRoster };
        });
        
        setRunResult({ 
            outcome: 'VICTORY', extractedItems: allItems, lostItems: [], totalValue, isCommander, 
            expGained: player.pendingExp, oldLevel, oldExp, newLevel, newExp, charName: activeChar.name 
        });
        setPhase('SETTLEMENT');
        setAppTransition('NONE');
    }, 2500);
  };

  const startExpedition = (mapId: string, charId?: string) => {
    const char = charId ? metaState.roster.find(c => c.id === charId) || metaState.roster[0] : metaState.roster[0];
    if (char.status === 'DEAD') return; // 防御性拦截
    
    setCurrentMap(mapId);
    setActiveCharId(char.id); 
    
    // 强制削减 MAP-04 欧米伽核心环境变数：最大血量降低20%
    let initialMaxHp = char.stats.maxHp;
    let initialHp = char.stats.currentHp;
    if (mapId === 'MAP-04') {
        initialMaxHp = Math.floor(initialMaxHp * 0.8);
        initialHp = Math.min(initialHp, initialMaxHp);
    }

    setPlayer({
        ...char.stats,
        maxHp: initialMaxHp,
        currentHp: initialHp,
        charge: 0, 
        pendingExp: 0,
        runDamageBonus: 0, 
        runMaxHpBonus: 0 
    });
    setInventory(char.inventory);

    setDepth(1);
    setStage(1);
    startCombat(1, 1, char.id, mapId);
  };

  const startCombat = (level: number, currentStage: number, overrideCharId?: string, mapId?: string) => {
    const activeMap = mapId || currentMap;
    setEnemy(() => generateEnemy(level, currentStage, activeMap));

    setPlayer(prev => {
        const isBulwark = prev.passiveSkill?.id === 'bulwark' && prev.level >= 2;
        const passiveShield = isBulwark ? Math.floor(prev.maxHp * 0.1) : 0;
        
        // 施加地图全局 Debuff (MAP-02 中毒, MAP-03 虚弱)
        const newStatuses = { ...prev.statuses };
        if (activeMap === 'MAP-02') newStatuses['POISON'] = (newStatuses['POISON'] || 0) + 1;
        if (activeMap === 'MAP-03') newStatuses['WEAK'] = (newStatuses['WEAK'] || 0) + 1;

        return {
            ...prev,
            shield: prev.shieldStart + passiveShield,
            statuses: newStatuses
        };
   });
    setPhase('COMBAT');
  };

  const proceedToLootRouting = () => {
      const isEliteOrBoss = stage >= 4;
      const shouldDraft = isEliteOrBoss || Math.random() < 0.25;

      if (shouldDraft) {
          const ownedIds = new Set(player.blueprints.map(bp => bp.id));
          const availablePool = BLUEPRINT_POOL.filter(bp => !ownedIds.has(bp.id));

          if (availablePool.length === 0) {
              setPhase('LOOT');
              return;
          }

          const shuffledPool = [...availablePool].sort(() => 0.5 - Math.random());
          const options = shuffledPool.slice(0, 3);
          
          setDraftOptions(options);
          setPhase('DRAFT');
      } else {
          setPhase('LOOT');
      }
  };

  // 解析并执行奇遇选项 (必须和 handleWinCombat 平级！)
  const handleEventResolve = (choice: EventChoice) => {
      if (choice.reqGold && choice.reqGold !== 999999) {
          setMetaState(prev => ({...prev, resources: {...prev.resources, [ResourceType.GOLD]: Math.max(0, (prev.resources[ResourceType.GOLD] || 0) - choice.reqGold!)}}));
      } else if (choice.reqGold === 999999) {
          setMetaState(prev => ({...prev, resources: {...prev.resources, [ResourceType.GOLD]: 0}}));
      }
      
      if (choice.reqHpPct) {
          setPlayer(prev => ({...prev, currentHp: Math.max(1, prev.currentHp - Math.floor(prev.maxHp * choice.reqHpPct!))}));
      }

      setPlayer(prev => {
          let hp = prev.currentHp;
          let maxHp = prev.maxHp;
          let charge = prev.charge;
          let sts = { ...prev.statuses };

          if (choice.healHp) hp = Math.min(maxHp, hp + choice.healHp);
          if (choice.healHpPct) hp = Math.min(maxHp, hp + Math.floor(maxHp * choice.healHpPct));
          if (choice.damageHp) hp = Math.max(1, hp - choice.damageHp);
          if (choice.addMaxHp) {
              maxHp = Math.max(1, maxHp + choice.addMaxHp);
              hp = Math.min(hp, maxHp);
          }
          if (choice.addCharge) charge = Math.min(10, Math.max(0, charge + choice.addCharge));
          if (choice.addBuff) sts[choice.addBuff] = (sts[choice.addBuff] || 0) + 1;
          if (choice.addDebuff) sts[choice.addDebuff] = (sts[choice.addDebuff] || 0) + (choice.addDebuff === 'POISON' ? 2 : 1);
          if (choice.removeDebuffs) {
              delete sts['POISON']; delete sts['WEAK']; delete sts['CORROSION']; delete sts['BLEED']; delete sts['BURN']; delete sts['SHOCK'];
          }

          return { ...prev, currentHp: hp, maxHp, charge, statuses: sts };
      });

      if (choice.addGold) {
          setMetaState(prev => ({...prev, resources: {...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) + choice.addGold!}}));
      }
      if (choice.addCard) {
          setPlayer(prev => ({ ...prev, deck: [...prev.deck, choice.addCard!] }));
      }
      if (choice.getRelic) {
          setPlayer(prev => ({ ...prev, damageBonus: prev.damageBonus + 1, shieldBonus: prev.shieldBonus + 1 }));
      }

      if (choice.extract) {
          handleExtract();
          return;
      }

      if (player.currentHp <= 0 && !choice.healHp && !choice.healHpPct) {
          handleLoseCombat();
          return;
      }

      setPendingEvent(null);
      // 事件处理完毕后，直接开始下一层的战斗
      setStage(s => s + 1);
      startCombat(depth, stage + 1);
  };

  const handleWinCombat = () => {
    const expGain = stage === STAGES_PER_DEPTH ? 100 : stage >= STAGES_PER_DEPTH - 1 ? 30 : 15;
    setPlayer(prev => {
        let runHpBonus = prev.runMaxHpBonus || 0;
        if (prev.passiveSkill?.id === 'necromancer' && prev.level >= 2) runHpBonus += 2; 

        let newHp = prev.currentHp;
        if (prev.passiveSkill?.id === 'medic' && prev.level >= 2) {
            newHp = Math.min(prev.maxHp + (runHpBonus - (prev.runMaxHpBonus || 0)), newHp + Math.floor(prev.maxHp * 0.10));
        }

        let runDmgBonus = prev.runDamageBonus || 0;
        if (prev.passiveSkill?.id === 'thug' && prev.level >= 2) runDmgBonus += 1;

        return {
            ...prev,
            maxHp: prev.maxHp + (runHpBonus - (prev.runMaxHpBonus || 0)),
            currentHp: newHp,
            runMaxHpBonus: runHpBonus,
            runDamageBonus: runDmgBonus,
            pendingExp: prev.pendingExp + expGain
        };
    });

    // 战斗结束后，立刻进入掉落/蓝图选择环节
    proceedToLootRouting();
  };



  const handleDraft = (bp: Blueprint) => {
      setPlayer(prev => ({
          ...prev,
          blueprints: [...prev.blueprints, bp]
      }));
      setPhase('LOOT');
  };

  const handleLootDone = () => {
    // RESET STATUSES AND SHIELD between stages
    setPlayer(prev => ({
        ...prev,
        statuses: {}, 
        shield: 0     
    }));

    if (stage === STAGES_PER_DEPTH) {
        setPhase('EXTRACTION'); // 最后一层打完直接进入撤离
    } else {
        // 在玩家整理完战利品，准备前往下一层的路上，判定是否遭遇奇遇 (30%概率)
        const shouldEvent = Math.random() < 0.30;
        if (shouldEvent) {
            const randomEvent = EVENTS_POOL[Math.floor(Math.random() * EVENTS_POOL.length)];
            setPendingEvent(randomEvent);
            setPhase('EVENT');
        } else {
            setStage(s => s + 1);
            startCombat(depth, stage + 1);
        }
    }
  };

  const handleContinue = () => {
    setDepth(d => d + 1);
    setStage(1);
    startCombat(depth + 1, 1);
  };

  const handleUpgradeBuilding = (type: BuildingType) => {
    setMetaState(prev => {
        const building = prev.buildings[type];
        if (!building) return prev;
        
        // TODO: Cost check logic here
        
        return {
            ...prev,
            buildings: {
                ...prev.buildings,
                [type]: {
                    ...building,
                    level: building.level + 1
                }
            }
        };
    });
  };

  const handleConsumeItem = (item: GridItem) => {
      if (item.type !== 'CONSUMABLE') return;

      // Heal
      if (item.stats?.heal) {
          setPlayer(prev => ({
              ...prev,
              currentHp: Math.min(prev.maxHp, prev.currentHp + (item.stats?.heal || 0))
          }));
      }

      // Damage Bonus (Permanent per run)
      if (item.stats?.damageBonus) {
           setPlayer(prev => ({
               ...prev,
               damageBonus: prev.damageBonus + (item.stats?.damageBonus || 0)
           }));
      }

      // Cleanse
      if (item.stats?.cleanse) {
          setPlayer(prev => ({
              ...prev,
              statuses: {} // Clears all debuffs
          }));
      }
      
      // Remove from inventory
      const newItems = inventory.items.filter(i => i.id !== item.id);
      const newGrid = removeItemFromGrid(inventory.grid, item.id);
      setInventory({ ...inventory, items: newItems, grid: newGrid });
  };

  // 提取当前出战角色的核心信息，用于正确渲染局内背包形状和安全区限制
  const activeChar = metaState.roster.find(c => c.id === activeCharId) || metaState.roster[0];

  return (
    <div className="relative w-full h-[100dvh] md:max-w-[480px] md:h-[90vh] md:max-h-[900px] bg-neutral-900 text-stone-200 font-serif overflow-hidden md:shadow-2xl md:border border-stone-800 flex flex-col">
      {phase === 'MENU' && <MetaView onStartRun={enterBaseCamp} playerLevel={1} />}
      
      {phase === 'BASE_CAMP' && (
        <BaseCampView 
            metaState={metaState} 
            setMetaState={setMetaState}
            onStartRun={startExpedition}
            onUpgradeBuilding={handleUpgradeBuilding}
        />
      )}

      {phase === 'WAREHOUSE' && (
        <WarehouseView 
          metaState={metaState}
          setMetaState={setMetaState}
          onBack={() => setPhase('BASE_CAMP')}
        />
      )}
      
      {phase === 'COMBAT' && enemy && (
        <>
            <CombatView 
              key={`${depth}-${stage}`} 
              enemy={enemy} 
              player={player} 
              currentStage={stage} // Pass stage info
              maxStage={STAGES_PER_DEPTH}
              updatePlayer={setPlayer}
              onWin={handleWinCombat} 
              onLose={handleLoseCombat} 
              onOpenInventory={() => setIsCombatInventoryOpen(true)}
              isGodMode={isGodMode}
              currentMap={currentMap} // 核心优化：传入地图ID让环境变数生效
            />
            
            {/* Combat Inventory Overlay */}
            {isCombatInventoryOpen && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-fade-in">
                    <div className="flex justify-between items-center p-4 bg-dungeon-dark border-b border-stone-700">
                        <div className="flex items-center gap-2">
                             <h2 className="text-lg font-display font-bold text-stone-300">战术背包</h2>
                             <span className="text-xs text-red-500 font-bold border border-red-900 bg-red-950 px-2 py-0.5 rounded animate-pulse">
                                 战斗锁定中
                             </span>
                        </div>
                        <button onClick={() => setIsCombatInventoryOpen(false)} className="p-2 bg-stone-800 rounded-full hover:bg-red-900 text-stone-400 hover:text-white transition-colors">
                            <LucideX size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                         <InventoryView 
                            inventory={inventory} 
                            setInventory={setInventory} 
                            onFinish={() => setIsCombatInventoryOpen(false)} 
                            isLootPhase={false} 
                            isCombat={true} // LOCK MOVEMENT
                            onConsume={handleConsumeItem} 
                            currentStage={stage}
                            maxStage={STAGES_PER_DEPTH}
                            playerClass={activeChar.class} // 核心修复：传入角色职业以正确渲染背包网格布局
                            playerLevel={activeChar.level} // 核心修复：传入角色等级以正确渲染保险区
                         />
                    </div>
                    <div className="p-4 bg-dungeon-dark border-t border-stone-800 text-center">
                        <p className="text-xs text-stone-500">战斗中仅可使用<span className="text-green-500">消耗品</span>，无法调整装备。</p>
                    </div>
                </div>
            )}
        </>
      )}

      {phase === 'EVENT' && pendingEvent && (
          <EventView 
              event={pendingEvent} 
              player={player} 
              gold={metaState.resources[ResourceType.GOLD] || 0} 
              onResolve={handleEventResolve} 
          />
      )}

      {phase === 'DRAFT' && (
          <DraftView options={draftOptions} onDraft={handleDraft} />
      )}

      {phase === 'LOOT' && (
        <InventoryView 
          inventory={inventory} 
          setInventory={setInventory} 
          onFinish={handleLootDone} 
          isLootPhase={true}
          isCombat={false}
          onConsume={handleConsumeItem} 
          currentStage={stage}
          maxStage={STAGES_PER_DEPTH}
          playerClass={activeChar.class} // 核心修复：保证战利品整理时的背包形状一致
          playerLevel={activeChar.level} // 核心修复：保证保险区高亮显示
          currentMap={currentMap} // 传递地图环境，应用掉落权重和准入要求
        />
      )}

      {phase === 'EXTRACTION' && (
        <ExtractionView 
          depth={depth}
          onContinue={handleContinue}
          onExtract={handleExtract}
        />
      )}
    {phase === 'SETTLEMENT' && runResult && (
        <SettlementView 
            outcome={runResult.outcome}
            extractedItems={runResult.extractedItems}
            lostItems={runResult.lostItems}
            totalValue={runResult.totalValue}
            isCommander={runResult.isCommander}
            expGained={runResult.expGained}
            oldLevel={runResult.oldLevel}
            oldExp={runResult.oldExp}
            newLevel={runResult.newLevel}
            newExp={runResult.newExp}
            charName={runResult.charName}
            onConfirm={() => {
                setRunResult(null);
                setPhase('BASE_CAMP');
            }}
        />
      )}

      {/* 核心优化：全局死亡/撤离第一阶段过场动画 (沉浸式滤镜阻断层) */}
      {appTransition !== 'NONE' && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden">
              {/* 注意：这里没有写 pointer-events-none，它会充当一块隐形玻璃，绝对防止玩家在死亡渐变期间瞎点报错！ */}
              <style>{`
                  @keyframes fade-to-black {
                      0% { opacity: 0; }
                      40% { opacity: 0; }
                      100% { opacity: 1; }
                  }
                  @keyframes dramatic-zoom {
                      0% { transform: scale(1); opacity: 0; filter: blur(4px); }
                      15% { opacity: 1; filter: blur(0px); }
                      100% { transform: scale(1.15); opacity: 0; filter: blur(4px); }
                  }
              `}</style>
              
              {/* 背景强制渐黑，2.5秒后恰好与 SettlementView 的黑底无缝缝合 */}
              <div className="absolute inset-0 bg-black" style={{ animation: 'fade-to-black 2.5s forwards' }}></div>
              
              {appTransition === 'DYING' && (
                  <>
                      <div className="absolute inset-0 bg-red-950/30 animate-pulse mix-blend-color-burn"></div>
                      <div className="text-red-600 text-5xl md:text-7xl font-display font-bold tracking-[0.5em] drop-shadow-[0_0_30px_rgba(220,38,38,1)] z-10 text-center" style={{ animation: 'dramatic-zoom 2.5s forwards' }}>
                          CRITICAL FAILURE
                      </div>
                  </>
              )}

              {appTransition === 'EXTRACTING' && (
                  <>
                      <div className="absolute inset-0 bg-dungeon-gold/20 animate-pulse mix-blend-screen"></div>
                      <div className="text-dungeon-gold text-4xl md:text-6xl font-display font-bold tracking-[0.5em] drop-shadow-[0_0_30px_rgba(202,138,4,1)] z-10 text-center" style={{ animation: 'dramatic-zoom 2.5s forwards' }}>
                          UPLINK SECURED
                      </div>
                  </>
              )}
          </div>
      )}

      {/* 局外系统菜单按钮 */}
      {(phase === 'MENU' || phase === 'BASE_CAMP') && (
          <button 
              onClick={() => setShowOutGameMenu(true)}
              className="absolute top-4 right-4 z-[100] p-2.5 bg-black/60 border border-stone-700 text-stone-400 rounded-full hover:text-white hover:bg-stone-800 transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-sm"
          >
              <LucideSettings size={20} />
          </button>
      )}

      {/* 局外系统菜单弹窗 */}
      {showOutGameMenu && (
          <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setShowOutGameMenu(false)}>
              <div className="bg-dungeon-dark border border-stone-700 p-6 rounded-xl flex flex-col items-center gap-6 max-w-xs w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowOutGameMenu(false)} className="absolute top-3 right-3 text-stone-500 hover:text-white p-1 bg-stone-800 rounded-full"><LucideX size={18}/></button>
                  <div className="text-center mt-2">
                      <h2 className="text-2xl font-display font-bold text-stone-200 tracking-widest">系统设置</h2>
                      <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest">System Options</p>
                  </div>
                  <div className="w-full h-px bg-stone-800"></div>
                  
                  <div className="flex flex-col gap-3 w-full">
                  {/* 核心：新增的战地手册指南按钮 */}
                      <button 
                          onClick={() => {
                              setShowOutGameMenu(false);
                              setShowGameGuide(true);
                          }}
                          className="w-full py-3 bg-dungeon-gold/10 hover:bg-yellow-900/40 text-dungeon-gold border border-dungeon-gold/50 hover:border-yellow-400 transition-all rounded flex items-center justify-center gap-2 font-bold tracking-widest shadow-inner shadow-[0_0_10px_rgba(202,138,4,0.1)]"
                      >
                          <LucideBookOpen size={18} /> 深渊战地手册 (指南)
                      </button>
                      <button 
                          onClick={() => {
                              if (window.confirm("确定要重置游戏吗？此操作不可逆！")) {
                                  window.location.reload(); 
                              }
                          }}
                          className="w-full py-3 bg-red-950/40 hover:bg-red-900/80 text-red-500 hover:text-white border border-red-900/50 hover:border-red-500 transition-all rounded flex items-center justify-center gap-2 font-bold tracking-widest shadow-inner"
                      >
                          <LucideTrash2 size={18} /> 重置游戏
                      </button>
                      
                      <button 
                          onClick={() => window.alert("网页预览端无法直接退出，请关闭浏览器标签页。")}
                          className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 hover:border-stone-400 transition-all rounded flex items-center justify-center gap-2 font-bold tracking-widest shadow-inner"
                      >
                          <LucideLogOut size={18} /> 退出游戏
                      </button>
                  </div>
              </div>
          </div>
      )}
 {/* 新增：深渊战地手册（游戏完整指南）图文沉浸版弹窗 */}
      {showGameGuide && (
          <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center animate-fade-in p-4 md:p-8" onClick={() => setShowGameGuide(false)}>
              <div className="bg-stone-950 border border-stone-700 w-full max-w-4xl max-h-[90vh] rounded-xl flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  
                  {/* Header */}
                  <div className="flex justify-between items-center p-4 md:p-6 border-b border-stone-800 bg-black/80 shrink-0 relative z-20">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-900/30 rounded border border-yellow-700/50">
                              <LucideBookOpen className="text-dungeon-gold drop-shadow-[0_0_8px_rgba(202,138,4,0.8)]" size={28} />
                          </div>
                          <div>
                              <h2 className="text-xl md:text-2xl font-bold text-stone-100 tracking-[0.2em] font-display">深渊战地手册</h2>
                              <div className="text-[10px] text-stone-500 font-mono tracking-widest uppercase">Protocol: Extraction - Official Guide</div>
                          </div>
                      </div>
                      <button onClick={() => setShowGameGuide(false)} className="text-stone-500 hover:text-white hover:bg-red-900 bg-stone-900 p-2 rounded-full transition-colors border border-stone-800"><LucideX size={20} /></button>
                  </div>
                  
                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-12 custom-scrollbar relative z-10">
                      {/* 背景水印 */}
                      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none z-0">
                          <LucideTarget size={500} />
                      </div>

                      {/* 1. 核心法则 */}
                      <section className="relative z-10">
                          <h3 className="text-dungeon-gold font-bold text-xl md:text-2xl border-b border-stone-800 pb-3 mb-4 flex items-center gap-2 drop-shadow-md">
                              <LucideMap className="text-stone-500" size={24}/> 核心法则：深渊拾荒
                          </h3>
                          <div className="bg-stone-900/50 border-l-4 border-dungeon-red p-4 md:p-5 rounded text-stone-300 text-sm md:text-base leading-relaxed space-y-3 shadow-inner">
                              <p>在这片被虚空感染的废土上，你需要派遣<span className="text-blue-400 font-bold">战斗素体</span>深入不同危险等级的战区，击败畸变体并搜刮战利品。</p>
                              <p>整个协议的核心原则只有一个：<span className="text-red-500 font-bold bg-red-950/50 px-2 py-0.5 rounded border border-red-900/50">在素体死亡前撤离！</span></p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  <div className="bg-green-950/20 border border-green-900/30 p-3 rounded flex gap-3 items-start">
                                      <div className="text-green-500 text-xl font-bold mt-1">✓</div>
                                      <div>
                                          <div className="font-bold text-green-400">成功撤离</div>
                                          <div className="text-xs text-stone-400 mt-1">背包内安置在<span className="text-stone-200 font-bold">【安全区 (SAFE)】</span>的所有战利品转化为大量资金与物资，存入基地。</div>
                                      </div>
                                  </div>
                                  <div className="bg-red-950/20 border border-red-900/30 p-3 rounded flex gap-3 items-start">
                                      <div className="text-red-500 text-xl font-bold mt-1">✗</div>
                                      <div>
                                          <div className="font-bold text-red-500">阵亡 (M.I.A)</div>
                                          <div className="text-xs text-stone-400 mt-1">素体将沦为<span className="text-red-400 font-bold">报废残骸</span>。其携带的极品装备、未锁定的战利品全部永久丢失。贪婪往往是最大的敌人！</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>
                        {/* 2. 基地中枢 */}
                      <section className="relative z-10">
                          <h3 className="text-dungeon-gold font-bold text-xl md:text-2xl border-b border-stone-800 pb-3 mb-4 flex items-center gap-2 drop-shadow-md">
                              <LucideSettings className="text-stone-500" size={24}/> 基地设施 (Base Camp)
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/60 border border-stone-700 hover:border-stone-500 transition-colors p-4 rounded-lg shadow-md">
                                  <div className="text-dungeon-gold font-bold mb-2 flex items-center gap-2 text-lg"><LucidePackage size={18}/> 仓库区 (Warehouse)</div>
                                  <div className="text-xs md:text-sm text-stone-400 leading-relaxed">管理你的全局物资。你可以在这里将重要装备拖拽转移给即将出战的素体。背包采用严苛的物理空间（俄罗斯方块）机制，合理安排空间是“垃圾佬”的致胜关键。</div>
                              </div>
                              <div className="bg-black/60 border border-stone-700 hover:border-purple-500/50 transition-colors p-4 rounded-lg shadow-md">
                                  <div className="text-purple-400 font-bold mb-2 flex items-center gap-2 text-lg"><LucideCpu size={18}/> 素体管理 (Roster)</div>
                                  <div className="text-xs md:text-sm text-stone-400 leading-relaxed">查看当前拥有的所有克隆素体。你可以消耗黑市资金<span className="text-purple-400 font-bold bg-purple-900/30 px-1 rounded">招募 / 十连特招</span>更强力的作战单元。报废的素体残骸在此处手动销毁清理。</div>
                              </div>
                              <div className="bg-black/60 border border-stone-700 hover:border-red-500/50 transition-colors p-4 rounded-lg shadow-md">
                                  <div className="text-red-400 font-bold mb-2 flex items-center gap-2 text-lg"><LucidePlay size={18}/> 战区部署 (Deploy)</div>
                                  <div className="text-xs md:text-sm text-stone-400 leading-relaxed">选择突入的战区。越危险的地图需要越高价值的“携入战备估值”作为门票，但同时会掉落价值十万的【神话级】红卡遗物。</div>
                              </div>
                              <div className="bg-black/60 border border-stone-700 hover:border-green-500/50 transition-colors p-4 rounded-lg shadow-md">
                                  <div className="text-green-400 font-bold mb-2 flex items-center gap-2 text-lg"><LucideShoppingCart size={18}/> 黑市交易 (Trade)</div>
                                  <div className="text-xs md:text-sm text-stone-400 leading-relaxed">交付指定的垃圾物资完成高危悬赏以赚取大额佣金，或在黑市直接花费重金购买保命消耗品与强力被动遗物。</div>
                              </div>
                          </div>
                      </section>
                      {/* 3. 战斗系统 - 真实UI示例版 */}
                      <section className="relative z-10">
                          <h3 className="text-dungeon-gold font-bold text-xl md:text-2xl border-b border-stone-800 pb-3 mb-4 flex items-center gap-2 drop-shadow-md">
                              <LucideTarget className="text-stone-500" size={24}/> 战斗博弈：无能量，全靠蓝图！
                          </h3>
                          <div className="bg-blue-950/10 border border-blue-900/50 p-5 rounded-lg space-y-6 shadow-lg">
                              <p className="font-bold text-blue-400 text-lg flex items-center gap-2">
                                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-sm">核心机制</span> 行动缓冲区与战术蓝图
                              </p>
                              <p className="text-stone-300 text-sm">打牌<span className="text-dungeon-gold font-bold">不消耗任何能量</span>。每次出牌，卡牌会按顺序填入下方的<span className="text-white font-bold bg-stone-800 px-1 rounded">行动缓冲区(5格)</span>。单独打出的卡牌(除走位卡外)无效，必须根据右上角的<span className="text-yellow-400 font-bold">【战术蓝图】</span>进行精确的排列组合！</p>
                              
                              {/* 模拟蓝图与缓冲区互动示例 */}
                              <div className="bg-black/60 p-4 rounded-lg border border-stone-800 flex flex-col md:flex-row items-center justify-center gap-8">
                                  {/* 左侧：蓝图 */}
                                  <div className="flex flex-col items-center gap-2">
                                      <div className="text-[10px] text-stone-500 font-mono tracking-widest">目标蓝图：重击回路</div>
                                      <div className="flex flex-col items-center bg-stone-900 border border-stone-700 p-3 rounded-lg shadow-md w-32 relative overflow-hidden">
                                          <div className="absolute inset-0 bg-dungeon-gold/5"></div>
                                          <span className="text-xs font-bold text-stone-200 relative z-10 mb-2">重击回路</span>
                                          <div className="flex gap-1 mb-2 relative z-10">
                                              <div className="w-5 h-5 bg-red-950 border border-red-500 rounded-sm"></div>
                                              <div className="w-5 h-5 bg-red-950 border border-red-500 rounded-sm"></div>
                                              <div className="w-5 h-5 bg-blue-950 border border-blue-500 rounded-sm"></div>
                                          </div>
                                          <div className="text-[10px] text-stone-400 text-center relative z-10">造成 12 伤害</div>
                                      </div>
                                  </div>

                                  {/* 中间：箭头 */}
                                  <div className="text-stone-600 rotate-90 md:rotate-0 text-2xl font-bold animate-pulse">➔</div>

                                  {/* 右侧：缓冲区演示 */}
                                  <div className="flex flex-col items-center gap-2">
                                      <div className="text-[10px] text-stone-500 font-mono tracking-widest">你的缓冲区 (5槽位)</div>
                                      <div className="flex gap-2 p-4 bg-stone-950 border border-stone-700 rounded-lg shadow-inner">
                                          {/* 已填充匹配 */}
                                          <div className="w-10 h-14 bg-red-900/80 border-2 border-red-500 rounded flex items-center justify-center text-red-200 font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]">攻</div>
                                          <div className="w-10 h-14 bg-red-900/80 border-2 border-red-500 rounded flex items-center justify-center text-red-200 font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]">攻</div>
                                          <div className="w-10 h-14 bg-blue-900/80 border-2 border-blue-500 rounded flex items-center justify-center text-blue-200 font-bold shadow-[0_0_10px_rgba(59,130,246,0.5)]">防</div>
                                          {/* 空置 */}
                                          <div className="w-10 h-14 bg-black border border-stone-700 border-dashed rounded flex items-center justify-center text-stone-600 text-xs">空</div>
                                          <div className="w-10 h-14 bg-black border border-stone-700 border-dashed rounded flex items-center justify-center text-stone-600 text-xs">空</div>
                                      </div>
                                      <div className="text-[10px] text-green-400 font-bold animate-pulse mt-1">✔ 完美匹配！触发效果并清空前3格！</div>
                                  </div>
                              </div>

                              <div className="bg-red-950/40 border border-red-900/50 p-3 rounded flex items-start gap-2">
                                  <span className="text-red-500 font-bold">⚠️ 致命惩罚 (OVERLOAD)：</span>
                                  <span className="text-sm text-red-200/80">如果一直乱打牌导致 <span className="font-bold text-white">5个槽位全满</span> 且无法组成任何蓝图，将引发【系统过载】！你将受到直接物理反噬伤害，并被强制清空所有槽位。</span>
                              </div>
                          </div>
                      </section>

                      {/* 4. 敌方意图与素体技能 - 真实UI呈现 */}
                      <section className="relative z-10">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              {/* 敌方意图模型 */}
                              <div className="bg-stone-900/40 border border-stone-700/50 p-5 rounded-lg shadow-md flex flex-col">
                                  <h4 className="text-stone-300 font-bold text-lg mb-4 flex items-center gap-2"><LucideSkull className="text-stone-500" size={20}/> 畸变体意图判读</h4>
                                  <p className="text-xs text-stone-400 mb-4">怪物头顶会展示其本回合的动作，请针对性地激活防御蓝图进行反制。</p>
                                  <div className="space-y-3 flex-1 flex flex-col justify-center">
                                      <div className="flex items-center gap-3"><span className="text-red-100 font-bold font-mono text-xs w-20 text-center bg-red-900 border border-red-700 rounded py-1 shadow-md">ATTACK</span> <span className="text-sm text-stone-300">造成直接伤害，记得叠甲。</span></div>
                                      <div className="flex items-center gap-3"><span className="text-blue-100 font-bold font-mono text-xs w-20 text-center bg-blue-900 border border-blue-700 rounded py-1 shadow-md">BUFF</span> <span className="text-sm text-stone-300">提升其护甲效能或下回合攻击力。</span></div>
                                      <div className="flex items-center gap-3"><span className="text-purple-100 font-bold font-mono text-xs w-20 text-center bg-purple-900 border border-purple-700 rounded py-1 shadow-md">DEBUFF</span> <span className="text-sm text-stone-300">削弱护甲，或将废牌塞入你的牌库。</span></div>
                                      <div className="flex items-center gap-3"><span className="text-green-100 font-bold font-mono text-xs w-20 text-center bg-green-900 border border-green-700 rounded py-1 shadow-md">HEAL</span> <span className="text-sm text-stone-300">恢复生命值。必须爆发输出打断。</span></div>
                                      <div className="flex items-center gap-3"><span className="text-yellow-100 font-bold font-mono text-xs w-20 text-center bg-yellow-700 border border-yellow-500 rounded py-1 shadow-md animate-pulse">FLEE</span> <span className="text-sm text-stone-300">准备逃跑！不击杀则拿不到战利品！</span></div>
                                  </div>
                              </div>
                              
                              {/* 素体技能模型 */}
                              <div className="bg-purple-950/10 border border-purple-900/30 p-5 rounded-lg shadow-md flex flex-col">
                                  <h4 className="text-purple-400 font-bold text-lg mb-4 flex items-center gap-2"><LucideZap size={20}/> 战斗回路 (特化技能)</h4>
                                  <p className="text-xs text-stone-400 mb-4">蓝色品质及以上的素体在升级后，将解锁专属作战回路。</p>
                                  <div className="space-y-4 flex-1">
                                      {/* 被动技能卡片 UI */}
                                      <div className="bg-black/60 p-3 rounded-lg border-l-4 border-l-stone-500 border-y border-r border-stone-800 shadow-inner flex flex-col gap-1 relative overflow-hidden">
                                          <div className="absolute right-[-10px] top-[-10px] opacity-10"><LucideCpu size={60}/></div>
                                          <div className="flex justify-between items-center relative z-10">
                                              <span className="text-sm font-bold text-stone-200">全覆盖装甲</span>
                                              <span className="text-[9px] font-bold font-mono text-stone-400 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-700">被动 (Lv.2 解锁)</span>
                                          </div>
                                          <div className="text-xs text-stone-400 mt-1 relative z-10">全程生效。战斗开始时，直接获得 10 点护甲。</div>
                                      </div>
                                      {/* 主动技能卡片 UI */}
                                      <div className="bg-black/60 p-3 rounded-lg border-l-4 border-l-dungeon-gold border-y border-r border-stone-800 shadow-inner flex flex-col gap-1 relative overflow-hidden group">
                                          <div className="absolute inset-0 bg-dungeon-gold/5"></div>
                                          <div className="absolute right-[-10px] top-[-10px] opacity-10 text-dungeon-gold"><LucideZap size={60}/></div>
                                          <div className="flex justify-between items-center relative z-10">
                                              <span className="text-sm font-bold text-dungeon-gold">极限超载 (蓄能)</span>
                                              <span className="text-[9px] font-bold font-mono text-yellow-500 bg-yellow-950 px-1.5 py-0.5 rounded border border-yellow-700/50 shadow">主动 (Lv.4 解锁)</span>
                                          </div>
                                          <div className="text-xs text-stone-400 mt-1 relative z-10">打出特定卡牌可蓄能。满能后点击施放：清除所有异常状态并恢复30%生命值。</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>
                      
                      <div className="text-center text-stone-600 font-serif italic pt-8 pb-4 border-t border-stone-800/50 relative z-10">
                          "祝你好运，指挥官。深渊在看着你。"
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}



