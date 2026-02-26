
import React, { useState, useEffect } from 'react';
import { GamePhase, PlayerStats, Enemy, InventoryState, CardType, Blueprint, GridItem, MetaState, ResourceType, BuildingType, Character } from './types';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT, WAREHOUSE_WIDTH, WAREHOUSE_HEIGHT, STARTING_BLUEPRINTS, BLUEPRINT_POOL, SAFE_ZONE_WIDTH, STAGES_PER_DEPTH, EQUIPMENT_ROW_COUNT } from './constants';
import { createEmptyGrid, removeItemFromGrid, placeItemInGrid } from './utils/gridLogic';
import { CombatView } from './components/views/CombatView';
import { InventoryView } from './components/views/InventoryView';
import { MetaView } from './components/views/MetaView';
import { BaseCampView } from './components/views/BaseCampView';
import { WarehouseView } from './components/views/WarehouseView';
import { ExtractionView } from './components/views/ExtractionView';
import { DraftView } from './components/views/DraftView';
import { LucideX, LucideSkull } from 'lucide-react';

const INITIAL_PLAYER: PlayerStats = {
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
    [ResourceType.GOLD]: 100,
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
  roster: [
    {
      id: 'commander-001',
      name: '本体 (指挥官)',
      class: 'COMMANDER',
      level: 0,
      exp: 0,
      stats: INITIAL_PLAYER,
      inventory: INITIAL_INVENTORY
    },
    {
      id: 'char-001',
      name: 'Alpha-01',
      class: 'OPERATOR',
      level: 1,
      exp: 0,
      stats: INITIAL_PLAYER,
      inventory: INITIAL_INVENTORY
    }
  ]
};

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('MENU');
  // 彻底移除由于 localStorage 遗留括号导致的报错，纯净初始化
  const [metaState, setMetaState] = useState<MetaState>(INITIAL_META_STATE);
  const [player, setPlayer] = useState<PlayerStats>(INITIAL_PLAYER);
  const [inventory, setInventory] = useState<InventoryState>(INITIAL_INVENTORY);
  const [depth, setDepth] = useState(1);
  const [stage, setStage] = useState(1); // 1 to 5
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [draftOptions, setDraftOptions] = useState<Blueprint[]>([]);
  const [isCombatInventoryOpen, setIsCombatInventoryOpen] = useState(false);
  
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
        const newMaxHp = Math.max(1, INITIAL_PLAYER.maxHp + hpBonus); // Ensure min 1 HP
        // Clamp current HP if max HP drops (e.g. unequipped an HP item)
        const newCurrentHp = Math.min(prev.currentHp, newMaxHp);
        
        return {
            ...prev,
            maxHp: newMaxHp,
            currentHp: newCurrentHp,
            damageBonus: dmgBonus,
            shieldBonus: shldBonus,
            shieldStart: shldStart,
            thorns: thornsVal
        };
    });
  }, [inventory.items]);

  const generateEnemy = (level: number, currentStage: number): Enemy => {
    // Difficulty Curve Logic - MICRO NUMBERS
    // A full basic combo (Strike+Strike+BP) deals 2+2+4 = 8 Damage.
    
    const depthScale = 1 + ((level - 1) * 0.4);

    const STAGE_CONFIGS: Record<number, Partial<Enemy>> = {
        1: {
            name: "腐化软泥",
            maxHp: 54, // Buffed: 36 * 1.5
            intents: [
                { type: 'ATTACK', value: 3, description: '撞击', turnsRemaining: 1 }, 
                { type: 'WAIT', value: 0, description: '蠕动', turnsRemaining: 1 }
            ]
        },
        2: {
            name: "墓穴巡逻兵",
            maxHp: 80, // Buffed: 54 * 1.5
            intents: [
                { type: 'ATTACK', value: 4, description: '锈刀挥砍', turnsRemaining: 1 },
                // Changed from '格挡姿态' to '硬化' (Thorns) to match CombatView logic
                { type: 'BUFF', value: 3, description: '硬化', turnsRemaining: 1 }
            ]
        },
        3: {
            name: "虚空信徒",
            maxHp: 115, // Buffed: 75 * 1.5
            intents: [
                { type: 'POLLUTE', value: 0, description: '精神污染', turnsRemaining: 1 },
                { type: 'ATTACK', value: 6, description: '暗影箭', turnsRemaining: 1 } 
            ]
        },
        4: {
            name: "深渊骑士 (精英)",
            maxHp: 180, // Buffed: 120 * 1.5
            intents: [
                { type: 'ATTACK', value: 8, description: '重斩', turnsRemaining: 1 },
                { type: 'ATTACK', value: 12, description: '蓄力处决', turnsRemaining: 2 }, 
                // Add a buff move for variety
                { type: 'BUFF', value: 2, description: '狂暴', turnsRemaining: 1 }
            ]
        },
        5: {
            name: `区域守门人: 巨像 (BOSS)`,
            maxHp: 270, // Buffed: 180 * 1.5
            intents: [
                 { type: 'POLLUTE', value: 0, description: '异化指令', turnsRemaining: 1 },
                 { type: 'ATTACK', value: 9, description: '粉碎', turnsRemaining: 1 }, 
                 // Changed from '自我修复' (BUFF) to '再生' (HEAL)
                 { type: 'HEAL', value: 10, description: '再生', turnsRemaining: 1 }
            ]
        }
    };

    const config = STAGE_CONFIGS[currentStage] || STAGE_CONFIGS[1];
    
    const scaledHp = Math.floor(config.maxHp! * depthScale);
    // Scale intents damage (Attack) AND Healing/Buffs
    const scaledIntents = config.intents!.map(i => ({
        ...i,
        value: (i.type === 'ATTACK' || i.type === 'HEAL' || i.type === 'BUFF') 
            ? Math.floor(i.value * depthScale) 
            : i.value
    }));

    return {
      name: config.name!,
      maxHp: scaledHp,
      currentHp: scaledHp,
      statuses: {},
      intents: scaledIntents,
      currentIntentIndex: 0
    };
  };

  const enterBaseCamp = () => {
    setPhase('BASE_CAMP');
  };

  const handleLoseCombat = () => {
    // On Death: Only keep items in Safe Zone
    const safeItems = inventory.items.filter(item => {
        const isInSafeRow = item.y >= EQUIPMENT_ROW_COUNT;
        const isInSafeCol = item.x < SAFE_ZONE_WIDTH;
        return isInSafeRow && isInSafeCol;
    });
    
    setMetaState(prev => {
        const char = prev.roster[0];
        let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
        
        // Reconstruct grid for saved items
        safeItems.forEach(item => {
             // FIX: Pass rotation: 0 because 'item.shape' is already rotated in state.
             const itemForPlacement = { ...item, rotation: 0 as const };
             newGrid = placeItemInGrid(newGrid, itemForPlacement, item.x, item.y);
        });

        const newChar = {
            ...char,
            inventory: {
                ...char.inventory,
                items: safeItems,
                grid: newGrid
            }
        };
        return { ...prev, roster: [newChar, ...prev.roster.slice(1)] };
    });

    alert(`理智耗尽... 非保留区的战利品已全部遗失。仅保留了 ${safeItems.length} 件物品。`);
    setPhase('BASE_CAMP');
  };

  const handleExtract = () => {
    // On Extract: Keep ALL items
    const allItems = inventory.items;

    setMetaState(prev => {
        const char = prev.roster[0];
        let newGrid = createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT);
        
        // Reconstruct grid
        allItems.forEach(item => {
             // FIX: Pass rotation: 0 because 'item.shape' is already rotated in state.
             const itemForPlacement = { ...item, rotation: 0 as const };
             newGrid = placeItemInGrid(newGrid, itemForPlacement, item.x, item.y);
        });

        const newChar = {
            ...char,
            inventory: {
                ...char.inventory,
                items: allItems,
                grid: newGrid
            }
        };
        return { ...prev, roster: [newChar, ...prev.roster.slice(1)] };
    });
    
    alert(`成功撤离！带回了 ${inventory.items.length} 件遗物。`);
    setPhase('BASE_CAMP');
  };

  const startExpedition = (charId?: string) => {
    // Load state from selected character in Roster
    const char = charId 
        ? metaState.roster.find(c => c.id === charId) || metaState.roster[0]
        : metaState.roster[0];

    setPlayer(char.stats);
    setInventory(char.inventory);

    setDepth(1);
    setStage(1);
    startCombat(1, 1);
  };

  const startCombat = (level: number, currentStage: number) => {
    setEnemy(generateEnemy(level, currentStage));
    // Apply start-of-combat stats (Shield)
    // IMPORTANT: This applies the *Passive* shield from items. 
    // The previous combat's accumulated shield was cleared in handleLootDone.
    setPlayer(prev => ({
        ...prev,
        shield: prev.shieldStart 
    }));
    setPhase('COMBAT');
  };

  const handleWinCombat = () => {
    // DROP RATE LOGIC:
    // Stage 4 (Elite) or Stage 5 (Boss) = Guaranteed Draft (100%)
    // Others = 25% Chance
    const isEliteOrBoss = stage >= 4;
    const shouldDraft = isEliteOrBoss || Math.random() < 0.25;

    if (shouldDraft) {
        // FILTER: Remove blueprints the player ALREADY owns
        const ownedIds = new Set(player.blueprints.map(bp => bp.id));
        const availablePool = BLUEPRINT_POOL.filter(bp => !ownedIds.has(bp.id));

        // If player has collected ALL blueprints, skip draft
        if (availablePool.length === 0) {
            setPhase('LOOT');
            return;
        }

        // Shuffle available unique blueprints
        const shuffledPool = [...availablePool].sort(() => 0.5 - Math.random());
        const options = shuffledPool.slice(0, 3);
        
        setDraftOptions(options);
        setPhase('DRAFT');
    } else {
        setPhase('LOOT');
    }
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
    // Keep HP and Deck
    setPlayer(prev => ({
        ...prev,
        statuses: {}, // Clear Buffs
        shield: 0     // Clear accumulated shield (passive shield re-applies in startCombat)
    }));

    if (stage === STAGES_PER_DEPTH) {
        setPhase('EXTRACTION');
    } else {
        setStage(s => s + 1);
        startCombat(depth, stage + 1);
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
                         />
                    </div>
                    <div className="p-4 bg-dungeon-dark border-t border-stone-800 text-center">
                        <p className="text-xs text-stone-500">战斗中仅可使用<span className="text-green-500">消耗品</span>，无法调整装备。</p>
                    </div>
                </div>
            )}
        </>
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
        />
      )}

      {phase === 'EXTRACTION' && (
        <ExtractionView 
          depth={depth}
          onContinue={handleContinue}
          onExtract={handleExtract}
        />
      )}

      {/* GOD MODE TOGGLE (Floating Dev Tool) */}
      <button 
          onClick={() => setIsGodMode(!isGodMode)}
          className={`absolute bottom-2 left-2 z-[9999] p-2 rounded-full border-2 text-[10px] font-bold shadow-2xl transition-all ${isGodMode ? 'bg-yellow-600 border-yellow-300 text-black animate-pulse' : 'bg-black/50 border-stone-700 text-stone-600 opacity-30 hover:opacity-100'}`}
          title="Toggle Invincibility"
      >
          <LucideSkull size={16} />
      </button>

    </div>
  );
}
