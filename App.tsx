
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
import { LucideX, LucideSkull } from 'lucide-react';
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

        setMetaState(prev => {
            const newRoster = prev.roster.map(c => {
                if (c.id === activeCharId) {
                    let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
                    safeItems.forEach(i => {
                        const itemForPlacement = { ...i, rotation: 0 as const };
                        newGrid = placeItemInGrid(newGrid, itemForPlacement, i.x, i.y);
                    });
                    
                    let newExp = c.exp + player.pendingExp;
                    let newLevel = c.level;
                    let newMaxHp = c.stats.maxHp;

                    // 修复：指挥官永远不参与升级；素体战斗失败即阵亡，也无需升级。
                    // 直接删除了导致指挥官异常加血的升级判定循环。

                    return {
                        ...c,
                        level: isCommander ? 0 : newLevel,
                        exp: isCommander ? 0 : newExp,
                        status: isCommander ? 'ALIVE' : 'DEAD', 
                        stats: { ...c.stats, level: isCommander ? 0 : newLevel, maxHp: newMaxHp, currentHp: isCommander ? newMaxHp : 0 },
                        inventory: { ...c.inventory, items: safeItems, grid: newGrid }
                    };
                }
                return c;
            });
            return { ...prev, roster: newRoster };
        });

        setRunResult({ outcome: 'DEFEAT', extractedItems: safeItems, lostItems, totalValue, isCommander, expGained: player.pendingExp });
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

       setMetaState(prev => {
            const newRoster = prev.roster.map(c => {
                if (c.id === activeCharId) {
                    let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
                    allItems.forEach(item => {
                        const itemForPlacement = { ...item, rotation: 0 as const };
                        newGrid = placeItemInGrid(newGrid, itemForPlacement, item.x, item.y);
                    });

                    let newExp = c.exp + player.pendingExp;
                    let newLevel = c.level;
                    let newMaxHp = c.stats.maxHp;
                    if (c.class !== 'COMMANDER') {
                        while (newLevel < 5 && newExp >= EXP_THRESHOLDS[newLevel]) {
                            newLevel++;
                            newMaxHp += 5;
                        }
                    }

                    return { 
                        ...c, 
                        level: c.class === 'COMMANDER' ? 0 : newLevel,
                        exp: c.class === 'COMMANDER' ? 0 : newExp,
                        stats: { ...c.stats, level: newLevel, maxHp: newMaxHp },
                        inventory: { ...c.inventory, items: allItems, grid: newGrid } 
                    };
                }
                return c;
            });
            return { ...prev, roster: newRoster };
        });
        
        setRunResult({ outcome: 'VICTORY', extractedItems: allItems, lostItems: [], totalValue, isCommander: activeChar.class === 'COMMANDER', expGained: player.pendingExp });
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
    </div>
  );
}