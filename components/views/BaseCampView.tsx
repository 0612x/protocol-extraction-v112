
import React, { useState,useEffect, useCallback } from 'react';
import { MetaState, ResourceType, BuildingType, Character, InventoryState,CardType} from '../../types';
import { LucideCoins, LucideGhost, LucideZap, LucidePackage, LucideCpu, LucideMap, LucideUser, LucidePlay, LucideShoppingCart,LucideActivity, LucideBox, LucideFileText, LucideSkull, LucideX } from 'lucide-react';
import { InventoryView } from './InventoryView';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT, LOOT_TABLE, STARTING_BLUEPRINTS, AGENT_TEMPLATES, EXP_THRESHOLDS } from '../../constants'; // 引入战利品表以生成悬赏
import { createEmptyGrid, removeItemFromGrid,canPlaceItem, placeItemInGrid } from '../../utils/gridLogic';
import { GridItem } from '../../types';

interface BaseCampViewProps {
  metaState: MetaState;
  setMetaState: React.Dispatch<React.SetStateAction<MetaState>>;
  onStartRun: () => void;
  onUpgradeBuilding: (type: BuildingType) => void;
}

type Tab = 'WAREHOUSE' | 'BODY' | 'START' | 'MISSION' | 'TRADE';
type BodySubTab = 'STATUS' | 'RECRUIT' | 'GALLERY';

export const BaseCampView: React.FC<BaseCampViewProps> = ({ metaState, setMetaState, onStartRun, onUpgradeBuilding }) => {
  const [activeTab, setActiveTab] = useState<Tab>('START');
  const [bodySubTab, setBodySubTab] = useState<BodySubTab>('STATUS');
  const [galleryItem, setGalleryItem] = useState<Partial<Character> | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string>(metaState.roster[0]?.id || '');
  
  // 招募克隆仓动画与确认面板状态
  const [isRecruiting, setIsRecruiting] = useState(false); 
  const [recruitmentResult, setRecruitmentResult] = useState<Character[] | null>(null); // 核心：支持十连抽数组

 // --- 黑市/交易核心系统状态 ---
  const [tradeSubTab, setTradeSubTab] = useState<'BOUNTY' | 'SHOP'>('BOUNTY');
  const [bounties, setBounties] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(300); // 5分钟倒计时
  
  // 核心优化：全局 Toast 提示状态，支持成功/失败类型，并缩短停留时间至 1.5 秒
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
      setToast({msg, type});
      setTimeout(() => setToast(null), 1500); // 1.5秒后快速消失
  }, []);

  // 市场货物生成引擎
  const generateMarket = useCallback(() => {
      const newBounties = [];
      for(let i=0; i<3; i++) {
          const reqCount = Math.floor(Math.random() * 2) + 1; 
          const reqs = [];
          let reward = 0;
          for(let j=0; j<reqCount; j++) {
              const template = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
              const qty = Math.floor(Math.random() * 3) + 1;
              reqs.push({ name: template.name, quantity: qty, type: template.type });
              reward += (template.value || 10) * qty * 1.5;
          }
          newBounties.push({ id: `bounty-${Date.now()}-${i}`, requirements: reqs, reward: Math.floor(reward) });
      }
      setBounties(newBounties);

      const newShop = [];
      const buyableTemplates = LOOT_TABLE.filter(t => t.type === 'CONSUMABLE' || t.type === 'ARTIFACT');
      for(let i=0; i<4; i++) {
          const template = buyableTemplates[Math.floor(Math.random() * buyableTemplates.length)];
          newShop.push({
              ...template,
              id: `shop-${Date.now()}-${i}`, 
              buyPrice: Math.floor((template.value || 10) * 2.5), // 黑市溢价 250%
              // 核心优化：只允许消耗品堆叠(随机1~3个)，武器/遗物等装备只能刷出 1 个！
              stock: template.type === 'CONSUMABLE' ? Math.floor(Math.random() * 3) + 1 : 1
          });
      }
      setShopItems(newShop);
      setRefreshCountdown(300); 
  }, []);

  // 维持黑市动态心跳
  useEffect(() => {
      if (bounties.length === 0 && shopItems.length === 0) generateMarket();
      const timer = setInterval(() => {
          setRefreshCountdown(prev => {
              if (prev <= 1) { generateMarket(); return 300; }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [generateMarket, bounties.length, shopItems.length]);

  const formatTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2, '0')}`;

  const selectedChar = metaState.roster.find(c => c.id === selectedCharId) || metaState.roster[0];

  // --- WAREHOUSE LOGIC ---
  const handleWarehouseUpdate = (newWarehouse: InventoryState | ((prev: InventoryState) => InventoryState)) => {
      setMetaState(prev => ({
          ...prev,
          warehouse: typeof newWarehouse === 'function' ? newWarehouse(prev.warehouse) : newWarehouse
      }));
  };

  const handleCharacterInventoryUpdate = (newInventory: InventoryState | ((prev: InventoryState) => InventoryState)) => {
          setMetaState(prev => ({
              ...prev,
              roster: prev.roster.map(c => {
                  if (c.id === selectedChar.id) {
                      const resolvedInventory = typeof newInventory === 'function' ? newInventory(c.inventory) : newInventory;
                      return { ...c, inventory: resolvedInventory };
                  }
                  return c;
              })
          }));
      };

      // --- 核心重构：统一抽卡与保底逻辑 (支持单抽/十连) ---
      const handleRecruit = (times: number, isAdvanced: boolean) => {
          const costPerPull = isAdvanced ? 100000 : 2000;
          const totalCost = costPerPull * times;

          if ((metaState.resources[ResourceType.GOLD] || 0) < totalCost) {
              showToast(`资金不足！需要 ${totalCost.toLocaleString()} 资金。`);
              return;
          }

          setIsRecruiting(true);
          setMetaState(prev => ({
              ...prev,
              resources: { ...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) - totalCost }
          }));

          setTimeout(() => {
              setMetaState(latestState => {
                  let currentPity = latestState.advancedRecruitPity || 0;
                  const newAgents: Character[] = [];

                  for (let i = 0; i < times; i++) {
                      let finalQuality: Quality = 'WHITE';
                      const rand = Math.random();

                      if (isAdvanced) {
                          if (currentPity >= 9) {
                              finalQuality = (Math.random() < 0.2) ? 'GOLD' : 'PURPLE';
                          } else {
                              if (rand <= 0.50) finalQuality = 'WHITE';
                              else if (rand <= 0.70) finalQuality = 'GREEN';
                              else if (rand <= 0.85) finalQuality = 'BLUE';
                              else if (rand <= 0.97) finalQuality = 'PURPLE';
                              else finalQuality = 'GOLD';
                          }

                          if (finalQuality === 'PURPLE' || finalQuality === 'GOLD') {
                              currentPity = 0; 
                          } else {
                              currentPity++;
                          }
                      } else {
                          if (rand <= 0.65) finalQuality = 'WHITE';
                          else if (rand <= 0.80) finalQuality = 'GREEN';
                          else if (rand <= 0.90) finalQuality = 'BLUE';
                          else if (rand <= 0.97) finalQuality = 'PURPLE';
                          else finalQuality = 'GOLD';
                      }

                      let pool = AGENT_TEMPLATES.filter(a => a.quality === finalQuality);
                      const template = pool[Math.floor(Math.random() * pool.length)];

                      const newId = `agent-${isAdvanced ? 'elite' : 'std'}-${Date.now()}-${i}`;
                      newAgents.push({
                          ...template,
                          id: newId,
                          exp: 0,
                          status: 'ALIVE',
                          stats: { 
                              level: template.level || 1,
                              pendingExp: 0,
                              passiveSkill: template.passiveSkill,
                              activeSkill: (template as any).activeSkill,
                              maxHp: template.stats?.maxHp || 30, 
                              currentHp: template.stats?.maxHp || 30, 
                              maxEnergy: 3, 
                              energy: 3, 
                              shield: 0,
                              damageBonus: 0,
                              shieldBonus: 0,
                              shieldStart: 0,
                              thorns: 0,
                              deck: [CardType.STRIKE, CardType.BLOCK, CardType.TECH, CardType.MOVE], 
                              blueprints: STARTING_BLUEPRINTS,
                              statuses: {},
                              charge: 0
                          },
                          inventory: { items: [], grid: createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT), width: INVENTORY_WIDTH, height: INVENTORY_HEIGHT }
                      } as Character);
                  }
                  
                  setRecruitmentResult(newAgents);

                  return isAdvanced ? { ...latestState, advancedRecruitPity: currentPity } : latestState;
              });
          }, 3000);
      };

      const renderResource = (type: ResourceType, icon: React.ReactNode) => (
    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 border border-stone-800 rounded-full">
      <span className="text-stone-400">{icon}</span>
      <span className="text-stone-200 font-mono text-sm">{metaState.resources[type] || 0}</span>
    </div>
  );

  const renderStartTab = () => (
    <div className="flex flex-col items-center justify-center h-full gap-8 animate-fade-in w-full px-6">
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold text-stone-300 tracking-widest">
                深渊潜行 <span className="text-stone-600 text-lg">DIVE</span>
            </h1>
            <p className="text-xs text-stone-500 italic">"准备好面对未知了吗？"</p>
        </div>

        {selectedChar.status === 'DEAD' ? (
            <div className="w-full max-w-sm p-8 bg-stone-900/40 border border-stone-800 rounded-xl flex flex-col items-center gap-4 shadow-md">
                <div className="p-4 bg-red-950/50 rounded-full text-stone-600 shadow-inner">
                    <LucideSkull size={48} className="opacity-50" />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-stone-500">当前素体已失去生命体征</h3>
                    <p className="text-xs text-stone-600 mt-1">请前往 [素体] 面板清理残骸或切换素体</p>
                </div>
            </div>
        ) : (
            <div className="w-full max-w-sm p-8 bg-stone-900/40 border border-stone-700 rounded-xl hover:border-dungeon-red transition-all cursor-pointer group shadow-lg hover:shadow-dungeon-red/20" onClick={() => onStartRun(selectedCharId)}>
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-dungeon-red/10 rounded-full text-dungeon-red group-hover:bg-dungeon-red group-hover:text-white transition-colors duration-500">
                        <LucidePlay size={48} className="ml-1" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-stone-200 group-hover:text-white">开始行动</h3>
                        <p className="text-xs text-stone-500 mt-1">当前编队: {selectedChar.name}</p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderMissionTab = () => (
      <div className="flex flex-col items-center gap-6 w-full max-w-md animate-fade-in p-4">
        <div className="text-center space-y-1">
            <h2 className="text-2xl font-display font-bold text-stone-300">任务板</h2>
            <p className="text-xs text-stone-500">MISSIONS</p>
        </div>
        <div className="w-full p-4 bg-stone-900/50 border border-stone-800 rounded text-center text-stone-500 italic">
            暂无可用任务...
        </div>
      </div>
  );

  const renderTradeTab = () => {
      const currentItems = metaState.warehouse.items;

      const handleFulfillBounty = (bounty: any) => {
          let canFulfill = true;
          for(let req of bounty.requirements) {
              const owned = currentItems.filter(i => i.name === req.name).reduce((acc, i) => acc + (i.quantity || 1), 0);
              if (owned < req.quantity) {
                  canFulfill = false;
                  break;
              }
          }
          if (!canFulfill) return;
          
          let newGrid = [...metaState.warehouse.grid];
          let newItems = [...currentItems];
          
          for(let req of bounty.requirements) {
              let needed = req.quantity;
              for(let i = newItems.length - 1; i >= 0; i--) {
                  if (needed <= 0) break;
                  if (newItems[i].name === req.name) {
                      const qty = newItems[i].quantity || 1;
                      if (qty <= needed) {
                          needed -= qty;
                          newGrid = removeItemFromGrid(newGrid, newItems[i].id);
                          newItems.splice(i, 1);
                      } else {
                          newItems[i] = { ...newItems[i], quantity: qty - needed };
                          needed = 0;
                      }
                  }
              }
          }
          
          setMetaState(prev => ({
              ...prev,
              resources: { ...prev.resources, GOLD: (prev.resources[ResourceType.GOLD] || 0) + bounty.reward },
              warehouse: { ...prev.warehouse, items: newItems, grid: newGrid }
          }));
          
          setBounties(prev => prev.filter(b => b.id !== bounty.id));
          showToast(`交付成功！佣金 +${bounty.reward} ₮`, 'success'); // 增加成功提示
      };

      const handleBuyItem = (shopItem: any) => {
          if ((metaState.resources[ResourceType.GOLD] || 0) < shopItem.buyPrice) {
              showToast("资金不足！黑市交易概不赊账。");
              return;
          }
          
          let currentWarehouseItems = [...metaState.warehouse.items];
          let currentWarehouseGrid = [...metaState.warehouse.grid];
          let placed = false;

          if (shopItem.type === 'CONSUMABLE') {
              for (const wItem of currentWarehouseItems) {
                  if (wItem.type === 'CONSUMABLE' && wItem.name === shopItem.name) {
                      wItem.quantity = (wItem.quantity || 1) + 1;
                      placed = true;
                      break;
                  }
              }
          }

          if (!placed) {
              const uniqueId = `bought-${Date.now()}-${Math.floor(Math.random()*10000)}`;
              const itemToPlace = { 
                  ...shopItem, 
                  id: uniqueId, 
                  isIdentified: true, 
                  quantity: 1, 
                  rotation: 0 as const, 
                  shape: shopItem.originalShape || shopItem.shape,
                  originalShape: shopItem.originalShape || shopItem.shape 
              };
              delete itemToPlace.buyPrice;
              delete itemToPlace.stock;

              const wHeight = metaState.warehouse.height || INVENTORY_HEIGHT;
              const wWidth = metaState.warehouse.width || INVENTORY_WIDTH;

              for (let y = 0; y < wHeight; y++) {
                  if (placed) break;
                  for (let x = 0; x < wWidth; x++) {
                      if (canPlaceItem(currentWarehouseGrid, itemToPlace, x, y, metaState.warehouse.unlockedRows, 'WAREHOUSE')) {
                          const newItem = { ...itemToPlace, x, y };
                          currentWarehouseGrid = placeItemInGrid(currentWarehouseGrid, newItem, x, y);
                          currentWarehouseItems.push(newItem);
                          placed = true;
                          break;
                      }
                  }
              }
          }

          if (!placed) {
              showToast("仓库空间已满！走私货无处安放，请先清理仓库。");
              return;
          }

          setMetaState(prev => ({
              ...prev,
              resources: { ...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) - shopItem.buyPrice },
              warehouse: { ...prev.warehouse, items: currentWarehouseItems, grid: currentWarehouseGrid }
          }));

          setShopItems(prev => prev.map(i => {
              if (i.id === shopItem.id) return { ...i, stock: i.stock - 1 };
              return i;
          }).filter(i => i.stock > 0));
          showToast(`购入成功！获得 ${shopItem.name}`, 'success'); // 增加成功提示
      };

      return (
          <div className="flex flex-col items-center gap-4 w-full h-full animate-fade-in p-4 lg:p-6 bg-stone-950">
              
              <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center gap-4 bg-black/80 p-4 rounded-xl border border-stone-800 shadow-[0_0_40px_rgba(0,0,0,0.6)] relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                  
                  <div className="flex items-center gap-4 relative z-10">
                      <div className="flex items-center gap-3 bg-dungeon-gold/10 px-5 py-2.5 rounded-lg border border-dungeon-gold/30 shadow-inner">
                          <LucideCoins className="text-dungeon-gold drop-shadow-[0_0_10px_rgba(202,138,4,0.8)] animate-pulse" size={28} />
                          <span className="text-2xl font-bold font-mono text-stone-200 tracking-wider">{metaState.resources[ResourceType.GOLD] || 0} <span className="text-sm text-stone-500 ml-1">₮</span></span>
                      </div>
                  </div>

                  <div className="flex items-center gap-4 relative z-10">
                      <div className="flex items-center gap-2 text-stone-400 bg-stone-900/80 px-4 py-2.5 rounded-lg border border-stone-700 shadow-inner">
                          <LucideActivity size={16} className="text-dungeon-gold" />
                          <span className="text-xs font-bold tracking-widest uppercase">
                              市场刷新: <span className="text-stone-200 font-bold ml-2 font-mono">{formatTime(refreshCountdown)}</span>
                          </span>
                      </div>
                      <button 
                          onClick={() => {
                              if ((metaState.resources[ResourceType.GOLD] || 0) >= 50) {
                                  setMetaState(prev => ({...prev, resources: {...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) - 50}}));
                                  generateMarket();
                              } else {
                                  showToast("资金不足！刷新黑市需要 50 金币。");
                              }
                          }}
                          className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold tracking-widest border border-stone-600 hover:border-dungeon-gold rounded-lg transition-all shadow-md flex items-center gap-2 group"
                      >
                          <LucideZap size={14} className="text-stone-400 group-hover:text-dungeon-gold transition-colors" /> 刷新 (🪙50)
                      </button>
                  </div>
              </div>

              <div className="flex w-full max-w-4xl bg-stone-900/80 p-1.5 rounded-lg border border-stone-800 shrink-0 shadow-inner">
                  <button 
                      className={`flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all rounded flex justify-center items-center gap-2 ${tradeSubTab === 'BOUNTY' ? 'bg-dungeon-gold text-black shadow-[0_0_15px_rgba(202,138,4,0.4)]' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/60'}`}
                      onClick={() => setTradeSubTab('BOUNTY')}
                  >
                      <LucideFileText size={16} /> 高危悬赏 (出售)
                  </button>
                  <button 
                      className={`flex-1 py-2.5 text-xs font-bold tracking-widest uppercase transition-all rounded flex justify-center items-center gap-2 ${tradeSubTab === 'SHOP' ? 'bg-dungeon-red text-white shadow-[0_0_15px_rgba(153,27,27,0.5)]' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/60'}`}
                      onClick={() => setTradeSubTab('SHOP')}
                  >
                      <LucideBox size={16} /> 黑市走私 (购买)
                  </button>
              </div>

              <div className="w-full max-w-4xl flex-1 overflow-y-auto no-scrollbar pb-10 space-y-4">
                  {tradeSubTab === 'BOUNTY' && (
                      <>
                          {bounties.length === 0 ? (
                              <div className="h-64 flex flex-col items-center justify-center text-stone-600 italic gap-4 bg-stone-900/20 rounded-xl border border-stone-800/50">
                                  <LucideFileText size={48} className="opacity-20" />
                                  <p className="font-bold text-sm tracking-widest">当前暂无悬赏订单，请等待链路同步...</p>
                              </div>
                          ) : (
                              bounties.map(bounty => {
                                  let canFulfill = true;
                                  return (
                                      <div key={bounty.id} className="relative bg-stone-900/60 border-l-4 border-l-dungeon-gold border-y border-r border-stone-800 rounded-r-xl p-5 flex flex-col md:flex-row justify-between gap-6 hover:bg-stone-800/80 transition-all shadow-lg overflow-hidden group">
                                          <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                              <LucideFileText size={140} />
                                          </div>
                                          
                                          <div className="flex flex-col gap-3 flex-1 relative z-10">
                                              <span className="text-xs font-bold tracking-widest text-stone-500">悬赏目标清单:</span>
                                              <div className="flex flex-wrap gap-2">
                                                  {bounty.requirements.map((req: any, idx: number) => {
                                                      const owned = currentItems.filter(i => i.name === req.name).reduce((acc, i) => acc + (i.quantity || 1), 0);
                                                      if (owned < req.quantity) canFulfill = false;
                                                      return (
                                                          <div key={idx} className={`px-3 py-1.5 rounded bg-black/50 border text-xs flex items-center gap-3 shadow-inner ${owned >= req.quantity ? 'border-dungeon-gold/50 text-dungeon-gold' : 'border-stone-700 text-stone-500'}`}>
                                                              <span className="font-bold">{req.name}</span>
                                                              <span className="font-mono bg-stone-900 px-1.5 rounded">{owned}/{req.quantity}</span>
                                                          </div>
                                                      );
                                                  })}
                                              </div>
                                          </div>

                                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l border-stone-800/80 pt-4 md:pt-0 md:pl-6 min-w-[140px] relative z-10">
                                              <div className="text-dungeon-gold font-bold font-mono text-lg flex items-center gap-1.5 drop-shadow-[0_0_5px_rgba(202,138,4,0.5)]">
                                                  <LucideCoins size={18} /> + {bounty.reward} 
                                              </div>
                                              {/* 核心优化：悬赏交付按钮的极致质感 */}
                                              <button 
                                                  className={`w-full py-2.5 px-4 rounded text-xs font-bold tracking-widest transition-all uppercase ${canFulfill ? 'bg-dungeon-gold text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(202,138,4,0.4)] hover:shadow-[0_0_20px_rgba(250,204,21,0.6)] hover:scale-105' : 'bg-stone-950 border border-stone-800 text-stone-700 cursor-not-allowed'}`}
                                                  onClick={() => handleFulfillBounty(bounty)}
                                                  disabled={!canFulfill}
                                              >
                                                  {canFulfill ? '交付订单' : '物资不足'}
                                              </button>
                                          </div>
                                      </div>
                                  )
                              })
                          )}
                      </>
                  )}

                  {tradeSubTab === 'SHOP' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {shopItems.length === 0 ? (
                              <div className="col-span-1 lg:col-span-2 h-64 flex flex-col items-center justify-center text-stone-600 italic gap-4 bg-stone-900/20 rounded-xl border border-stone-800/50">
                                  <LucideBox size={48} className="opacity-20" />
                                  <p className="font-bold text-sm tracking-widest">走私黑货已被抢购一空，请等待下一批空投...</p>
                              </div>
                          ) : (
                              shopItems.map(item => (
                                  <div key={item.id} className="relative p-4 bg-black/60 border border-stone-800 rounded-lg flex flex-col sm:flex-row gap-4 hover:border-stone-500 transition-all shadow-lg overflow-hidden group">
                                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-stone-800/40 to-transparent pointer-events-none z-0"></div>
                                      
                                      <div className={`w-16 h-16 shrink-0 border border-stone-700 rounded-md flex items-center justify-center shadow-inner ${item.color.replace('border-', 'bg-').split(' ')[0]} bg-opacity-20 relative z-10`}>
                                           <span className="text-2xl font-display font-bold text-white/90 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{item.name.charAt(0)}</span>
                                      </div>
                                      
                                      <div className="flex-1 flex flex-col justify-between relative z-10">
                                          <div className="flex justify-between items-start gap-2">
                                              <div>
                                                  <h4 className={`text-sm font-bold tracking-wider transition-colors ${item.rarity === 'LEGENDARY' ? 'text-yellow-400' : item.rarity === 'RARE' ? 'text-purple-400' : 'text-stone-200'}`}>{item.name}</h4>
                                                  <p className="text-[10px] text-stone-500 font-mono mt-1 line-clamp-2">{item.description}</p>
                                              </div>
                                              <div className="bg-stone-900 border border-stone-700 px-2 py-0.5 rounded text-[10px] font-bold text-stone-400 shrink-0">
                                                  库存: <span className="text-stone-200 font-mono">{item.stock}</span>
                                              </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-800/80">
                                              <div className="flex items-center gap-1.5 text-dungeon-red font-bold font-mono bg-red-950/30 px-3 py-1 rounded border border-red-900/50">
                                                  <LucideCoins size={14}/> {item.buyPrice}
                                              </div>
                                              {/* 核心优化：购买按钮的样式重构，与交付按钮手感统一 */}
                                              <button 
                                                  onClick={() => handleBuyItem(item)}
                                                  className="px-6 py-2 bg-dungeon-red text-white hover:bg-red-500 text-xs font-bold tracking-widest uppercase transition-all rounded shadow-[0_0_15px_rgba(153,27,27,0.4)] hover:shadow-[0_0_20px_rgba(220,38,38,0.6)] hover:scale-105"
                                              >
                                                  立刻购入
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderBodyTab = () => (
    <div className="flex flex-col w-full h-full animate-fade-in">
        {/* Sub-Nav */}
        <div className="flex justify-center gap-4 p-2 border-b border-stone-800 bg-black/40">
            <button onClick={() => setBodySubTab('STATUS')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${bodySubTab === 'STATUS' ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>状态</button>
            <button onClick={() => setBodySubTab('RECRUIT')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${bodySubTab === 'RECRUIT' ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>招募</button>
            <button onClick={() => setBodySubTab('GALLERY')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${bodySubTab === 'GALLERY' ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>图鉴</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
            {bodySubTab === 'STATUS' && (
                <div className="w-full max-w-md flex flex-col gap-6">
                    {/* Character Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {(() => {
                            const sortedRoster = [...metaState.roster].sort((a, b) => {
                                if (a.class === 'COMMANDER') return -1;
                                if (b.class === 'COMMANDER') return 1;
                                const score = { 'GOLD': 5, 'PURPLE': 4, 'BLUE': 3, 'GREEN': 2, 'WHITE': 1 };
                                const scoreA = score[a.quality as keyof typeof score] || 0;
                                const scoreB = score[b.quality as keyof typeof score] || 0;
                                if (scoreB !== scoreA) return scoreB - scoreA;
                                return b.level - a.level; // 同品质按等级降序
                            });

                            return sortedRoster.map(char => {
                                const qColor = char.quality === 'WHITE' ? 'border-stone-500' : char.quality === 'GREEN' ? 'border-green-500' : char.quality === 'BLUE' ? 'border-blue-500' : char.quality === 'PURPLE' ? 'border-purple-500' : char.quality === 'GOLD' ? 'border-yellow-500' : 'border-stone-800';
                                const iconColor = char.quality === 'GREEN' ? 'text-green-400' : char.quality === 'BLUE' ? 'text-blue-400' : char.quality === 'PURPLE' ? 'text-purple-400' : char.quality === 'GOLD' ? 'text-yellow-400' : 'text-stone-400';
                                const gradeColor = char.quality === 'PURPLE' ? 'text-purple-400' : char.quality === 'GOLD' ? 'text-yellow-400' : 'text-stone-300';
                                
                                return (
                                    <button 
                                        key={char.id}
                                        onClick={() => setSelectedCharId(char.id)}
                                        className={`flex-shrink-0 p-2 border rounded-lg flex flex-col items-center gap-1 min-w-[80px] transition-all hover:scale-105 ${selectedCharId === char.id ? `${qColor} bg-stone-800 shadow-md` : 'border-stone-800 bg-stone-900/50 opacity-60'}`}
                                    >
                                        <div className="relative">
                                            <LucideUser size={24} className={iconColor} />
                                            {char.grade && <div className={`absolute -bottom-1 -right-2 text-[8px] font-bold bg-black px-1 rounded border border-stone-800 ${gradeColor}`}>{char.grade}</div>}
                                        </div>
                                        <span className="text-[10px] truncate w-full text-center px-1">{char.name}</span>
                                    </button>
                                );
                            });
                        })()}
                    </div>

                    {/* Character Visual */}
                    <div className="flex justify-center">
                        <div className={`relative w-32 h-32 flex items-center justify-center border-2 rounded-full bg-black/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]
                            ${selectedChar.quality === 'WHITE' ? 'border-stone-500 shadow-stone-500/20' : 
                              selectedChar.quality === 'GREEN' ? 'border-green-500 shadow-green-500/20' : 
                              selectedChar.quality === 'BLUE' ? 'border-blue-500 shadow-blue-500/20' : 
                              selectedChar.quality === 'PURPLE' ? 'border-purple-500 shadow-purple-500/20' : 
                              selectedChar.quality === 'GOLD' ? 'border-yellow-500 shadow-yellow-500/20' : 'border-stone-700'}
                        `}>
                            <LucideUser size={64} className={`
                                ${selectedChar.quality === 'WHITE' ? 'text-stone-500' : 
                                  selectedChar.quality === 'GREEN' ? 'text-green-500' : 
                                  selectedChar.quality === 'BLUE' ? 'text-blue-500' : 
                                  selectedChar.quality === 'PURPLE' ? 'text-purple-500' : 
                                  selectedChar.quality === 'GOLD' ? 'text-yellow-500' : 'text-stone-600'}
                            `} />
                            <div className="absolute -bottom-2 px-3 py-1 bg-stone-800 border border-stone-600 rounded-full text-xs font-bold text-stone-300">
                                LV.{selectedChar.level}
                            </div>
                        </div>
                    </div>

                    {/* Skills Overview & Death State */}
                    {selectedChar.status === 'DEAD' ? (
                        <div className="w-full bg-red-950/20 border border-red-900/60 p-5 rounded-lg flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(153,27,27,0.1)]">
                            <LucideSkull size={32} className="text-red-500 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)]" />
                            <div className="text-center">
                                <div className="text-sm font-bold text-red-500 tracking-widest">此素体已无生命体征</div>
                                <div className="text-[10px] text-red-400/80 mt-1 leading-relaxed">必须清理残骸以释放编制空间。<br/>一旦执行，其保险区内所有遗物将永久丢失。</div>
                            </div>
                            <button 
                                className="mt-2 px-8 py-2.5 bg-red-900/80 hover:bg-red-600 text-white text-xs font-bold tracking-widest rounded transition-all shadow-lg border border-red-500/50"
                                onClick={(e) => {
                                    const el = e.currentTarget;
                                    if (el.dataset.primed !== 'true') {
                                        el.dataset.primed = 'true';
                                        el.classList.add('bg-red-600', 'animate-pulse', 'border-white');
                                        el.innerText = "⚠️ 确认销毁?";
                                        setTimeout(() => {
                                            if (el) {
                                                el.dataset.primed = 'false';
                                                el.classList.remove('bg-red-600', 'animate-pulse', 'border-white');
                                                el.innerText = "销毁残骸";
                                            }
                                        }, 3000);
                                    } else {
                                        const targetId = selectedChar.id;
                                        const commanderId = metaState.roster[0].id;
                                        setSelectedCharId(commanderId); // 立即让 UI 视口切换到活着的指挥官
                                        setTimeout(() => {
                                            setMetaState(prev => ({ ...prev, roster: prev.roster.filter(c => c.id !== targetId) })); // 延迟销毁数据防止 React 渲染崩溃
                                        }, 50);
                                    }
                                }}
                            >
                                销毁残骸
                            </button>
                        </div>
                    ) : (
                        selectedChar.class !== 'COMMANDER' && (
                            <>
                            <div className="w-full bg-stone-900/60 border border-stone-800 p-3 rounded-lg flex flex-col gap-2">
                                <div className="text-xs font-bold text-stone-500 mb-1">战斗回路 (被动/主动)</div>
                                {selectedChar.passiveSkill ? (
                                <div className="flex items-start gap-3 mb-2">
                                    <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${selectedChar.level >= 2 ? 'bg-stone-800 border border-stone-500 text-stone-200' : 'bg-black border border-stone-800 text-stone-600'}`}>
                                        <span className="text-xs font-bold">{selectedChar.passiveSkill.name[0]}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-sm font-bold flex items-center gap-2 text-stone-200">
                                            <span className="text-[10px] px-1 bg-stone-700 text-stone-300 rounded">被动</span>
                                            {selectedChar.passiveSkill.name} 
                                            {selectedChar.level < 2 && <span className="text-[9px] bg-red-900/50 text-red-400 px-1 rounded border border-red-800">Lv.2 解锁</span>}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${selectedChar.level >= 2 ? 'text-stone-400' : 'text-stone-600'}`}>{selectedChar.passiveSkill.desc}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-stone-600 italic">该素体品质过低，无任何技能回路。</div>
                            )}

                            {selectedChar.activeSkill && (
                                <div className="flex items-start gap-3 pt-2 border-t border-stone-800/50">
                                    <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${selectedChar.level >= 4 ? 'bg-dungeon-gold/20 border border-dungeon-gold text-dungeon-gold' : 'bg-black border border-stone-800 text-stone-600'}`}>
                                        <span className="text-xs font-bold">{selectedChar.activeSkill.name[0]}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-sm font-bold flex items-center gap-2 text-dungeon-gold">
                                            <span className="text-[10px] px-1 bg-yellow-900/50 text-yellow-500 rounded border border-yellow-700">主动</span>
                                            {selectedChar.activeSkill.name} 
                                            {selectedChar.level < 4 && <span className="text-[9px] bg-red-900/50 text-red-400 px-1 rounded border border-red-800">Lv.4 解锁</span>}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${selectedChar.level >= 4 ? 'text-stone-400' : 'text-stone-600'}`}>{selectedChar.activeSkill.desc}</div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-800">
                                <span className="text-[10px] text-stone-500 font-mono">EXP</span>
                                <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden border border-stone-800">
                                    <div className="h-full bg-blue-500" style={{ width: `${selectedChar.level < 5 ? (selectedChar.exp - EXP_THRESHOLDS[selectedChar.level-1<0?0:selectedChar.level-1]) / (EXP_THRESHOLDS[selectedChar.level] - EXP_THRESHOLDS[selectedChar.level-1<0?0:selectedChar.level-1]) * 100 : 100}%` }}></div>
                                </div>
                                <span className="text-[10px] text-stone-400 font-mono">{selectedChar.level < 5 ? `${selectedChar.exp}/${EXP_THRESHOLDS[selectedChar.level]}` : 'MAX'}</span>
                            </div>
                        </div>
                        
                        
                        </>
                        )
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center justify-center">
                            <span className="text-[10px] text-stone-500 tracking-wider mb-1">定位分类</span>
                            <span className="text-sm font-bold text-stone-300">
                                {selectedChar.class === 'COMMANDER' ? '指挥官' : selectedChar.class === 'OPERATOR' ? '标准型' : selectedChar.class === 'GHOST' ? '特化型' : '构造体'}
                            </span>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center justify-center">
                            <span className="text-[10px] text-stone-500 tracking-wider mb-1">品质评级</span>
                            <span className={`text-sm font-bold ${!selectedChar.quality ? 'text-stone-600' : selectedChar.quality === 'WHITE' ? 'text-stone-400' : selectedChar.quality === 'GREEN' ? 'text-green-400' : selectedChar.quality === 'BLUE' ? 'text-blue-400' : selectedChar.quality === 'PURPLE' ? 'text-purple-400' : 'text-yellow-400'}`}>
                                {!selectedChar.quality ? '无' : selectedChar.quality === 'WHITE' ? '次品 (C)' : selectedChar.quality === 'GREEN' ? '量产型 (B)' : selectedChar.quality === 'BLUE' ? '特化型 (A)' : selectedChar.quality === 'PURPLE' ? '精英 (S)' : '传奇 (SS)'}
                            </span>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center justify-center">
                            <span className="text-[10px] text-stone-500 tracking-wider mb-1">当前血量/血量上限</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-mono font-bold ${selectedChar.status === 'DEAD' ? 'text-red-500' : selectedChar.stats.currentHp <= selectedChar.stats.maxHp * 0.3 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                                    {selectedChar.stats.currentHp}
                                </span>
                                <span className="text-sm font-mono text-stone-500">/ {selectedChar.stats.maxHp}</span>
                            </div>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center justify-center">
                            <span className="text-[10px] text-stone-500 tracking-wider mb-1">当前体征</span>
                            <span className={`text-sm font-bold ${selectedChar.status === 'DEAD' ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : 'text-green-500'}`}>
                                {selectedChar.status === 'DEAD' ? '已阵亡' : '生命体征平稳'}
                            </span>
                        </div>
                    </div>
                    {/* 活体解雇/低价回收逻辑 (置于状态面板下方) */}
                    {selectedChar.status !== 'DEAD' && selectedChar.class !== 'COMMANDER' && (
                        <div className="mt-4 flex justify-center w-full">
                            <button 
                                className="w-[80%] py-3 border border-yellow-900/50 bg-yellow-950/20 text-yellow-600/80 hover:bg-yellow-900/40 hover:text-yellow-400 hover:border-yellow-500 rounded-lg flex justify-center items-center gap-2 text-sm font-bold transition-all duration-300 shadow-lg hover:shadow-[0_0_15px_rgba(161,98,7,0.3)] hover:scale-[1.02]"
                                onClick={(e) => {
                                    const el = e.currentTarget;
                                    if (el.dataset.primed !== 'true') {
                                        el.dataset.primed = 'true';
                                        el.innerHTML = "⚠️ 确认低价拆解?";
                                        el.classList.add('bg-yellow-900/80', 'text-white');
                                        setTimeout(() => {
                                            if (el) {
                                                el.dataset.primed = 'false';
                                                el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zap"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 折价回收`;
                                                el.classList.remove('bg-yellow-900/80', 'text-white');
                                            }
                                        }, 3000);
                                    } else {
                                        const targetId = selectedChar.id;
                                        const quality = selectedChar.quality;
                                        // 回收大打折扣：白 200 / 绿 500 / 蓝 1000 / 紫 5000 / 金 20000
                                        const refund = quality === 'WHITE' ? 200 : quality === 'GREEN' ? 500 : quality === 'BLUE' ? 1000 : quality === 'PURPLE' ? 5000 : quality === 'GOLD' ? 20000 : 0;
                                        
                                        const commanderId = metaState.roster[0].id;
                                        setSelectedCharId(commanderId);
                                        
                                        setTimeout(() => {
                                            setMetaState(prev => ({ 
                                                ...prev, 
                                                resources: { ...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) + refund },
                                                roster: prev.roster.filter(c => c.id !== targetId) 
                                            }));
                                            showToast(`素体已拆解，回收黑市资金 +${refund.toLocaleString()} ₮`, 'success');
                                        }, 50);
                                    }
                                }}
                            >
                                <LucideZap size={14} /> 折价回收
                            </button>
                        </div>
                    )}
                </div>
            )}

            {bodySubTab === 'GALLERY' && (
                <div className="w-full max-w-2xl flex flex-col gap-4 mt-4 animate-fade-in">
                    <div className="text-center space-y-2 mb-4">
                        <h3 className="text-2xl font-display font-bold text-stone-300 tracking-widest">素体图鉴</h3>
                        <p className="text-xs text-stone-500">已知战斗序列档案库 (按品质排列)</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pr-2 pb-10 custom-scrollbar">
                        {(() => {
                            const sortedTemplates = [...AGENT_TEMPLATES].sort((a, b) => {
                                const score = { 'GOLD': 5, 'PURPLE': 4, 'BLUE': 3, 'GREEN': 2, 'WHITE': 1 };
                                return (score[b.quality as keyof typeof score] || 0) - (score[a.quality as keyof typeof score] || 0);
                            });
                            
                            return sortedTemplates.map((tmpl, idx) => {
                                const qColor = tmpl.quality === 'WHITE' ? 'border-stone-500 bg-stone-800/30' : tmpl.quality === 'GREEN' ? 'border-green-500 bg-green-900/20' : tmpl.quality === 'BLUE' ? 'border-blue-500 bg-blue-900/20' : tmpl.quality === 'PURPLE' ? 'border-purple-500 bg-purple-900/20' : tmpl.quality === 'GOLD' ? 'border-yellow-500 bg-yellow-900/20' : 'border-stone-800';
                                const tColor = tmpl.quality === 'WHITE' ? 'text-stone-400' : tmpl.quality === 'GREEN' ? 'text-green-400' : tmpl.quality === 'BLUE' ? 'text-blue-400' : tmpl.quality === 'PURPLE' ? 'text-purple-400' : tmpl.quality === 'GOLD' ? 'text-yellow-400' : 'text-stone-400';
                                return (
                                    <button 
                                        key={idx} 
                                        onClick={() => setGalleryItem(tmpl)}
                                        className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all hover:scale-105 shadow-md hover:shadow-lg cursor-pointer ${qColor}`}
                                    >
                                        <div className="relative">
                                            <LucideUser size={32} className={tColor} />
                                            {tmpl.grade && <div className={`absolute -bottom-2 -right-2 text-[10px] font-bold bg-black px-1.5 rounded border border-stone-800 ${tColor}`}>{tmpl.grade}</div>}
                                        </div>
                                        <div className="text-xs font-bold text-center mt-1 truncate w-full text-stone-300">{tmpl.name}</div>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {bodySubTab === 'RECRUIT' && (
                <div className="flex flex-col items-center gap-6 mt-8 w-full max-w-2xl animate-fade-in">
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-display font-bold text-stone-300 tracking-widest">素体克隆中心</h3>
                        <p className="text-xs text-stone-500">消耗黑市资金培育新的作战素体</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-4">
                        {/* 标准素体 */}
                        <div className="p-6 border border-stone-700 hover:border-stone-500 transition-all bg-stone-900/60 rounded-xl flex flex-col items-center gap-4 shadow-lg group relative overflow-hidden">
                            <div className="absolute inset-0 bg-dungeon-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <LucideUser size={48} className="text-stone-400 group-hover:text-stone-300 transition-colors" />
                            <div className="text-center z-10 w-full">
                                <div className="font-bold text-stone-200 text-lg">标准素体 (OPERATOR)</div>
                                <div className="text-xs text-stone-500 mt-2">均衡的承载能力，标准的背包物理限制。</div>
                            </div>
                            
                            <div className="mt-4 flex gap-2 w-full">
                                <button 
                                    className="flex-1 py-3 bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-600 text-stone-400 hover:text-stone-200 font-bold rounded flex flex-col justify-center items-center gap-1 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isRecruiting}
                                    onClick={() => handleRecruit(1, false)}
                                >
                                    <div className="text-xs tracking-widest">单次招募</div>
                                    <div className="flex items-center gap-1 text-[10px] text-stone-500"><LucideCoins size={12} /> 2,000</div>
                                </button>
                                <button 
                                    className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-stone-400 text-stone-300 hover:text-white font-bold rounded flex flex-col justify-center items-center gap-1 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isRecruiting}
                                    onClick={() => handleRecruit(10, false)}
                                >
                                    <div className="text-xs tracking-widest text-dungeon-gold/80">十连招募</div>
                                    <div className="flex items-center gap-1 text-[10px] text-stone-400"><LucideCoins size={12} /> 20,000</div>
                                </button>
                            </div>
                        </div>
                        
                        {/* 高阶素体 */}
                        <div className="p-6 border border-purple-900/50 hover:border-purple-500 transition-all bg-stone-900/60 rounded-xl flex flex-col items-center gap-4 shadow-lg group relative overflow-hidden">
                            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <LucideZap size={48} className="text-purple-500 group-hover:text-purple-400 transition-colors drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                            <div className="text-center z-10 w-full">
                                <div className="font-bold text-stone-200 text-lg">高阶素体 (GHOST)</div>
                                <div className="text-xs text-stone-500 mt-2">高纯度战斗核心。大概率出现特化或精英个体。</div>
                                
                                <div className="mt-3 bg-black/50 border border-stone-800 rounded p-2 flex flex-col items-center">
                                    <div className="text-[10px] text-stone-400">特种招募进度</div>
                                    <div className="flex gap-1 mt-1">
                                        {Array.from({length: 10}).map((_, i) => (
                                            <div key={i} className={`w-3 h-1.5 rounded-sm ${i < (metaState.advancedRecruitPity || 0) ? 'bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.8)]' : 'bg-stone-800'}`}></div>
                                        ))}
                                    </div>
                                    <div className={`text-[10px] mt-1 font-bold ${((metaState.advancedRecruitPity || 0) >= 9) ? 'text-purple-400 animate-pulse' : 'text-stone-500'}`}>
                                        {((metaState.advancedRecruitPity || 0) >= 9) ? '下次招募必出【紫色或以上】' : '累计 10 次必出【紫色或以上】'}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-2 flex gap-2 w-full">
                                <button 
                                    className="flex-1 py-3 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-900/80 hover:border-purple-400 text-purple-300 hover:text-purple-100 font-bold rounded flex flex-col justify-center items-center gap-1 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isRecruiting}
                                    onClick={() => handleRecruit(1, true)}
                                >
                                    <div className="text-xs tracking-widest">单次特招</div>
                                    <div className="flex items-center gap-1 text-[10px] text-purple-400/60"><LucideCoins size={12} /> 100,000</div>
                                </button>
                                <button 
                                    className="flex-1 py-3 bg-purple-900/50 hover:bg-purple-800/70 border border-purple-700/80 hover:border-purple-300 text-purple-200 hover:text-white font-bold rounded flex flex-col justify-center items-center gap-1 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                    disabled={isRecruiting}
                                    onClick={() => handleRecruit(10, true)}
                                >
                                    <div className="text-xs tracking-widest text-dungeon-gold/80">十连特招</div>
                                    <div className="flex items-center gap-1 text-[10px] text-dungeon-gold/80"><LucideCoins size={12} /> 1,000,000</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );

  const renderWarehouseTab = () => {
    // 将素体选择器抽离，作为背包区的专属头部
    const characterSelector = (
        <>
            <div className="w-full overflow-x-auto no-scrollbar bg-black/80 border-b border-stone-800 p-2 shadow-inner">
                <div className="flex gap-2 min-w-max px-2">
                    {(() => {
                        const sortedRoster = [...metaState.roster].sort((a, b) => {
                            if (a.class === 'COMMANDER') return -1;
                            if (b.class === 'COMMANDER') return 1;
                            const score = { 'GOLD': 5, 'PURPLE': 4, 'BLUE': 3, 'GREEN': 2, 'WHITE': 1 };
                            const scoreA = score[a.quality as keyof typeof score] || 0;
                            const scoreB = score[b.quality as keyof typeof score] || 0;
                            if (scoreB !== scoreA) return scoreB - scoreA;
                            return b.level - a.level;
                        });

                        return sortedRoster.map(char => (
                            <button 
                                key={char.id}
                                onClick={() => setSelectedCharId(char.id)}
                                className={`relative flex items-center gap-3 px-3 py-1.5 rounded-lg border transition-all duration-200 group ${
                                    selectedCharId === char.id 
                                    ? 'bg-stone-800 border-stone-500 text-stone-100 shadow-[0_0_10px_rgba(0,0,0,0.5)]' 
                                    : 'bg-stone-900/40 border-stone-800 text-stone-600 hover:bg-stone-800 hover:border-stone-700'
                                }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${char.status === 'DEAD' ? 'bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.8)]' : (selectedCharId === char.id ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-stone-700')}`}></div>
                                <div className="flex flex-col items-start">
                                    <span className={`text-xs font-bold ${char.status === 'DEAD' ? 'text-red-500 line-through opacity-80' : (selectedCharId === char.id ? 'text-stone-200' : 'text-stone-500 group-hover:text-stone-400')}`}>{char.name}</span>
                                    <span className={`text-[8px] font-mono uppercase ${char.status === 'DEAD' ? 'text-red-600 font-bold' : 'text-stone-600'}`}>
                                        {char.status === 'DEAD' ? 'M.I.A (阵亡)' : (char.class === 'COMMANDER' ? '指挥官' : `素体 LV.${char.level}`)}
                                    </span>
                                </div>
                                {selectedCharId === char.id && (
                                    <div className="absolute inset-0 border border-stone-500/30 rounded-lg animate-pulse pointer-events-none"></div>
                                )}
                            </button>
                        ));
                    })()}
                </div>
            </div>
            
            {/* 新增：在仓库背包顶部插入红色回收横幅与清理按钮，方便拖拽完遗物后直接销毁 */}
            {selectedChar.status === 'DEAD' && (
                <div className="bg-red-950/80 border-b border-red-900 p-2 flex justify-between items-center px-4 shadow-[0_5px_15px_rgba(153,27,27,0.3)] z-10 relative">
                    <div className="flex items-center gap-3">
                        <span className="text-xl animate-pulse">⚠️</span>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-red-400 tracking-widest">M.I.A 遗物回收期</span>
                            <span className="text-[10px] text-red-500/80">将下方保险区内的遗物移至上方仓库后，点击右侧清理残骸。</span>
                        </div>
                    </div>
                    <button 
                        className="bg-red-900/80 hover:bg-red-600 text-white text-xs px-4 py-1.5 rounded shadow-lg transition-all border border-red-500/50 font-bold"
                        onClick={(e) => {
                            e.stopPropagation();
                            const el = e.currentTarget;
                            if (el.dataset.primed !== 'true') {
                                el.dataset.primed = 'true';
                                el.classList.add('bg-red-600', 'animate-pulse', 'border-white');
                                el.innerText = "⚠️ 确认销毁?";
                                setTimeout(() => {
                                    if (el) {
                                        el.dataset.primed = 'false';
                                        el.classList.remove('bg-red-600', 'animate-pulse', 'border-white');
                                        el.innerText = "清理残骸";
                                    }
                                }, 3000);
                            } else {
                                const targetId = selectedChar.id;
                                const commanderId = metaState.roster[0].id;
                                setSelectedCharId(commanderId);
                                setTimeout(() => {
                                    setMetaState(prev => ({ ...prev, roster: prev.roster.filter(c => c.id !== targetId) }));
                                }, 50);
                            }
                        }}
                    >
                        清理残骸
                    </button>
                </div>
            )}
        </>
    );

    return (
        <div className="flex flex-col h-full w-full animate-fade-in bg-stone-950">
            {/* Header: 只保留纯粹的仓库信息 */}
            <div className="flex justify-between items-center p-3 border-b border-stone-800 bg-black/60 backdrop-blur-md shrink-0 z-20 shadow-md">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-stone-900 rounded border border-stone-700 text-stone-400">
                        <LucidePackage size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-stone-200 tracking-wide">物资整备</h2>
                        <p className="text-[10px] text-stone-500 font-mono">LOGISTICS & SUPPLY</p>
                    </div>
                </div>
                <div className="px-2 py-1 bg-stone-900 rounded text-[10px] text-stone-500 border border-stone-800">
                    CAPACITY: {metaState.warehouse.items.length} / {INVENTORY_WIDTH * INVENTORY_HEIGHT}
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-stone-950">
                <InventoryView 
                    inventory={selectedChar.inventory} 
                    setInventory={handleCharacterInventoryUpdate}
                    onFinish={() => {}} 
                    isLootPhase={false} 
                    isCombat={false}
                    currentStage={1}
                    maxStage={5}
                    externalInventory={metaState.warehouse}
                    setExternalInventory={handleWarehouseUpdate}
                    externalTitle="基地仓库"
                    setMetaState={setMetaState} // 核心修复：传入此参数后，仓库内物品详情页将显示【出售】按钮！
                    customPlayerHeader={characterSelector}
                    playerLevel={selectedChar.level}
                    playerClass={selectedChar.class} 
                />
            </div>
        </div>
    );
  };

  const TabButton = ({ id, icon, label }: { id: Tab, icon: React.ReactNode, label: string }) => (
      <button 
          onClick={() => setActiveTab(id)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-300 border-t-2 ${activeTab === id ? 'border-dungeon-red bg-gradient-to-b from-stone-800/50 to-transparent text-stone-100' : 'border-transparent text-stone-600 hover:text-stone-400 hover:bg-stone-900/30'}`}
      >
          {icon}
          <span className="text-[10px] font-display tracking-wider uppercase scale-90">{label}</span>
      </button>
  );

  return (
    <div className="w-full h-full flex flex-col bg-dungeon-black text-stone-200 font-serif relative overflow-hidden">
      
      {/* 炫酷的抽卡/克隆仓沉浸式动画与结果确认蒙版 */}
      {isRecruiting && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md transition-all duration-500">
              <div className="absolute inset-0 pointer-events-none overflow-hidden flex flex-col items-center justify-center">
                  <div className="w-[200vw] h-2 bg-dungeon-gold/20 animate-scan-line shadow-[0_0_30px_rgba(202,138,4,0.5)]"></div>
              </div>

              {recruitmentResult ? (
                  <>
                  {recruitmentResult.length === 1 ? (
                      // 【阶段二】动画完毕，展示新角色并要求手动确认 (单抽)
                      <div className="relative flex flex-col items-center justify-center animate-fade-in-up mt-12 z-10">
                          <div className={`absolute inset-0 blur-[80px] rounded-full z-0 w-64 h-64 
                              ${recruitmentResult[0].quality === 'WHITE' ? 'bg-stone-500/10' : 
                                recruitmentResult[0].quality === 'GREEN' ? 'bg-green-500/10' : 
                                recruitmentResult[0].quality === 'BLUE' ? 'bg-blue-500/10' : 
                                recruitmentResult[0].quality === 'PURPLE' ? 'bg-purple-500/10' : 'bg-dungeon-gold/10'}
                          `}></div>
                          <div className={`relative w-32 h-32 flex items-center justify-center border-4 rounded-full bg-black/50 z-10
                              ${recruitmentResult[0].quality === 'WHITE' ? 'border-stone-500 shadow-[0_0_50px_rgba(120,113,108,0.5)]' : 
                                recruitmentResult[0].quality === 'GREEN' ? 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)]' : 
                                recruitmentResult[0].quality === 'BLUE' ? 'border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]' : 
                                recruitmentResult[0].quality === 'PURPLE' ? 'border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]' : 'border-dungeon-gold shadow-[0_0_50px_rgba(202,138,4,0.5)]'}
                          `}>
                              <LucideUser size={80} className={`
                                  ${recruitmentResult[0].quality === 'WHITE' ? 'text-stone-400 drop-shadow-[0_0_15px_rgba(120,113,108,1)]' : 
                                    recruitmentResult[0].quality === 'GREEN' ? 'text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,1)]' : 
                                    recruitmentResult[0].quality === 'BLUE' ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,1)]' : 
                                    recruitmentResult[0].quality === 'PURPLE' ? 'text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,1)]' : 'text-dungeon-gold drop-shadow-[0_0_15px_rgba(202,138,4,1)]'}
                              `} />
                          </div>
                          <div className="text-4xl font-display font-bold text-stone-100 tracking-widest mt-8 z-10 drop-shadow-md flex items-center gap-3">
                              {recruitmentResult[0].name}
                              <span className={`text-xl font-bold px-2 py-0.5 rounded
                                  ${recruitmentResult[0].quality === 'WHITE' ? 'bg-stone-800 text-stone-400' : 
                                    recruitmentResult[0].quality === 'GREEN' ? 'bg-green-900 text-green-400' : 
                                    recruitmentResult[0].quality === 'BLUE' ? 'bg-blue-900 text-blue-400' : 
                                    recruitmentResult[0].quality === 'PURPLE' ? 'bg-purple-900 text-purple-400' : 'bg-yellow-900 text-yellow-400'}
                              `}>{recruitmentResult[0].grade}</span>
                          </div>
                          <div className="flex gap-4 mt-3 z-10">
                              <span className="px-3 py-1 bg-stone-900 border border-stone-700 text-stone-400 font-mono text-xs rounded uppercase">定位: {recruitmentResult[0].class === 'OPERATOR' ? '标准型' : recruitmentResult[0].class === 'GHOST' ? '特化型' : '构造体'}</span>
                          </div>
                          {recruitmentResult[0].passiveSkill && (
                              <div className="mt-4 px-4 py-2 bg-black/60 border border-stone-700 rounded z-10 max-w-sm text-center">
                                  <div className="text-xs font-bold text-dungeon-gold mb-1">初始回路: {recruitmentResult[0].passiveSkill.name}</div>
                                  <div className="text-[10px] text-stone-400">{recruitmentResult[0].passiveSkill.desc}</div>
                              </div>
                          )}
                      </div>
                  ) : (
                      // 十连抽结果展示
                      <div className="relative flex flex-col items-center justify-center animate-fade-in-up mt-8 w-full max-w-4xl z-10">
                            <div className="text-3xl font-display font-bold text-dungeon-gold mb-6 tracking-widest drop-shadow-[0_0_15px_rgba(202,138,4,0.8)]">战术序列重组完成</div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-h-[65vh] overflow-y-auto p-4 custom-scrollbar w-full">
                                {recruitmentResult.map((res, idx) => {
                                    const bColor = res.quality === 'WHITE' ? 'border-stone-500' : res.quality === 'GREEN' ? 'border-green-500' : res.quality === 'BLUE' ? 'border-blue-500' : res.quality === 'PURPLE' ? 'border-purple-500' : 'border-yellow-500';
                                    const tColor = res.quality === 'WHITE' ? 'text-stone-400' : res.quality === 'GREEN' ? 'text-green-400' : res.quality === 'BLUE' ? 'text-blue-400' : res.quality === 'PURPLE' ? 'text-purple-400' : 'text-yellow-400';
                                    const bgColor = res.quality === 'WHITE' ? 'bg-stone-800' : res.quality === 'GREEN' ? 'bg-green-900' : res.quality === 'BLUE' ? 'bg-blue-900' : res.quality === 'PURPLE' ? 'bg-purple-900' : 'bg-yellow-900';
                                    return (
                                        <div key={idx} className={`relative flex flex-col items-center p-3 border rounded-xl bg-black/80 shadow-[0_0_15px_rgba(0,0,0,0.5)] w-full ${bColor} animate-fade-in`} style={{ animationDelay: `${idx * 50}ms` }}>
                                            <div className={`w-12 h-12 flex items-center justify-center border-2 rounded-full mb-2 bg-black/50 ${bColor} ${tColor}`}>
                                                <LucideUser size={24} />
                                            </div>
                                            <div className="text-[11px] font-bold text-stone-100 text-center truncate w-full">{res.name}</div>
                                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 border border-black ${bgColor} ${tColor}`}>{res.grade}</div>
                                            {res.passiveSkill ? (
                                                <div className="text-[9px] text-stone-400 mt-2 truncate w-full text-center bg-stone-900 px-1 py-0.5 rounded border border-stone-800">{res.passiveSkill.name}</div>
                                            ) : (
                                                <div className="text-[9px] text-stone-600 mt-2 italic">无技能</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                      </div>
                  )}
                  
                  <button 
                      className="mt-8 px-16 py-3 bg-dungeon-gold text-black font-bold text-lg tracking-widest hover:bg-yellow-400 hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-all z-10 rounded shadow-lg"
                      onClick={() => {
                          setMetaState(prev => ({
                              ...prev,
                              roster: [...prev.roster, ...recruitmentResult]
                          }));
                          setRecruitmentResult(null);
                          setIsRecruiting(false);
                      }}
                  >
                      确认唤醒
                  </button>
                  </>
              ) : (
                  // 【阶段一】气泡上升与激光扫描动画
                  <div className="relative w-64 h-96 flex flex-col items-center justify-center mt-12 animate-pulse">
                      <style>{`
                          @keyframes scan-laser { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                          @keyframes bubble-rise { 0% { bottom: -10px; transform: translateX(0); opacity: 1; } 100% { bottom: 100%; transform: translateX(-10px); opacity: 0; } }
                      `}</style>
                      <div className="absolute inset-0 border-4 border-dungeon-gold/30 rounded-t-[100px] rounded-b-xl shadow-[0_0_100px_rgba(202,138,4,0.15)] overflow-hidden bg-stone-900/20">
                          <div className="absolute w-2 h-2 rounded-full bg-white/30 left-1/4" style={{ animation: 'bubble-rise 2s ease-in infinite' }}></div>
                          <div className="absolute w-3 h-3 rounded-full bg-white/30 left-1/2" style={{ animation: 'bubble-rise 1.5s ease-in infinite 0.5s' }}></div>
                          <div className="absolute w-2 h-2 rounded-full bg-white/30 left-3/4" style={{ animation: 'bubble-rise 2.5s ease-in infinite 0.2s' }}></div>
                          
                          <div className="absolute w-full h-1 bg-dungeon-gold shadow-[0_0_20px_#ca8a04]" style={{ animation: 'scan-laser 1.5s linear infinite' }}></div>
                          <div className="absolute bottom-0 w-full bg-dungeon-gold/30 transition-all ease-in-out" style={{ height: '100%', transitionDuration: '3000ms' }}></div>
                      </div>
                      
                      <LucideUser size={120} className="text-dungeon-gold/50 z-10" strokeWidth={1} style={{ filter: 'blur(2px)' }} />
                      
                      <div className="absolute -bottom-20 flex flex-col items-center gap-2">
                          <div className="text-dungeon-gold font-mono tracking-widest animate-pulse font-bold text-lg drop-shadow-[0_0_10px_rgba(202,138,4,0.8)]">
                              基因序列重组中...
                          </div>
                          <div className="text-[10px] text-stone-500 font-mono uppercase">
                              Initializing Cellular Matrix // {Math.floor(Math.random()*100)}%
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-900/20 via-black to-black pointer-events-none"></div>
      <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
      
      {/* Top Bar */}
      <div className="relative z-10 w-full p-2 flex justify-between items-center px-4 border-b border-stone-800/50 bg-black/20">
          <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <div className="text-[10px] text-stone-500 font-mono">ONLINE</div>
          </div>
          <div className="flex gap-3">
             <div className="flex items-center gap-1 text-stone-400 text-xs">
                 <LucideCoins size={12} className="text-yellow-600" /> {metaState.resources[ResourceType.GOLD]}
             </div>
             <div className="flex items-center gap-1 text-stone-400 text-xs">
                 <LucideZap size={12} className="text-blue-500" /> {metaState.resources[ResourceType.TECH_SCRAP]}
             </div>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
          {activeTab === 'START' && renderStartTab()}
          {activeTab === 'MISSION' && renderMissionTab()}
          {activeTab === 'BODY' && renderBodyTab()}
          {activeTab === 'WAREHOUSE' && renderWarehouseTab()}
          {activeTab === 'TRADE' && renderTradeTab()}
      </div>

      {/* Bottom Navigation Tabs */}
      <div className="relative z-20 flex bg-black border-t border-stone-800 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
          <TabButton id="WAREHOUSE" icon={<LucidePackage size={18} />} label="仓库" />
          <TabButton id="BODY" icon={<LucideCpu size={18} />} label="素体" />
          <TabButton id="START" icon={<LucidePlay size={18} />} label="开始" />
          <TabButton id="MISSION" icon={<LucideMap size={18} />} label="任务" />
          <TabButton id="TRADE" icon={<LucideShoppingCart size={18} />} label="交易" />
      </div>

      {/* 素体图鉴详情弹窗 */}
      {galleryItem && (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center backdrop-blur-md animate-fade-in p-4" onClick={() => setGalleryItem(null)}>
              <div className={`bg-stone-900 border-2 w-full max-w-sm rounded-xl p-6 flex flex-col shadow-2xl relative
                  ${galleryItem.quality === 'WHITE' ? 'border-stone-500' : galleryItem.quality === 'GREEN' ? 'border-green-500' : galleryItem.quality === 'BLUE' ? 'border-blue-500' : galleryItem.quality === 'PURPLE' ? 'border-purple-500' : 'border-yellow-500'}
              `} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setGalleryItem(null)} className="absolute top-4 right-4 text-stone-500 hover:text-white transition-colors">
                      <LucideX size={24} />
                  </button>
                  
                  <div className="flex flex-col items-center gap-4 mb-6">
                      <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center shadow-lg bg-black/50
                          ${galleryItem.quality === 'WHITE' ? 'border-stone-500 text-stone-500' : galleryItem.quality === 'GREEN' ? 'border-green-500 text-green-500' : galleryItem.quality === 'BLUE' ? 'border-blue-500 text-blue-500' : galleryItem.quality === 'PURPLE' ? 'border-purple-500 text-purple-500' : 'border-yellow-500 text-yellow-500'}
                      `}>
                          <LucideUser size={48} />
                      </div>
                      <div className="text-center">
                          <h2 className="text-2xl font-bold text-stone-100 flex items-center justify-center gap-2">
                              {galleryItem.name}
                              <span className={`text-sm px-2 py-0.5 rounded border font-mono
                                  ${galleryItem.quality === 'WHITE' ? 'border-stone-500 text-stone-400 bg-stone-900' : galleryItem.quality === 'GREEN' ? 'border-green-500 text-green-400 bg-green-950' : galleryItem.quality === 'BLUE' ? 'border-blue-500 text-blue-400 bg-blue-950' : galleryItem.quality === 'PURPLE' ? 'border-purple-500 text-purple-400 bg-purple-950' : 'border-yellow-500 text-yellow-400 bg-yellow-950'}
                              `}>{galleryItem.grade}</span>
                          </h2>
                          <div className="text-xs text-stone-500 mt-1 uppercase tracking-widest">{galleryItem.class === 'OPERATOR' ? '标准型 (OPERATOR)' : galleryItem.class === 'GHOST' ? '特化型 (GHOST)' : '构造体 (CONSTRUCT)'}</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-black/50 p-2 rounded border border-stone-800 text-center">
                          <div className="text-[10px] text-stone-500 mb-1">基础生命值</div>
                          <div className="font-mono text-lg text-dungeon-red font-bold">{galleryItem.stats?.maxHp}</div>
                      </div>
                      <div className="bg-black/50 p-2 rounded border border-stone-800 text-center">
                          <div className="text-[10px] text-stone-500 mb-1">品质层级</div>
                          <div className={`font-bold text-sm mt-1
                              ${galleryItem.quality === 'WHITE' ? 'text-stone-400' : galleryItem.quality === 'GREEN' ? 'text-green-400' : galleryItem.quality === 'BLUE' ? 'text-blue-400' : galleryItem.quality === 'PURPLE' ? 'text-purple-400' : 'text-yellow-400'}
                          `}>
                              {galleryItem.quality === 'WHITE' ? '次品' : galleryItem.quality === 'GREEN' ? '量产型' : galleryItem.quality === 'BLUE' ? '特化型' : galleryItem.quality === 'PURPLE' ? '精英' : '传奇'}
                          </div>
                      </div>
                  </div>

                  <div className="space-y-3">
                      {galleryItem.passiveSkill ? (
                          <div className="bg-black/40 border border-stone-700 p-3 rounded">
                              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 w-max mb-2">被动技能 (Lv.2 解锁)</div>
                              <div className="font-bold text-stone-200 text-sm mb-1">{galleryItem.passiveSkill.name}</div>
                              <div className="text-xs text-stone-400 leading-relaxed">{galleryItem.passiveSkill.desc}</div>
                          </div>
                      ) : (
                          <div className="text-center text-stone-600 italic text-sm">该素体无技能回路</div>
                      )}

                      {(galleryItem as any).activeSkill && (
                          <div className="bg-black/40 border border-dungeon-gold/30 p-3 rounded relative overflow-hidden">
                              <div className="absolute inset-0 bg-dungeon-gold/5 pointer-events-none"></div>
                              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-900/50 text-dungeon-gold border border-dungeon-gold/50 w-max mb-2 relative z-10">主动技能 (Lv.4 解锁)</div>
                              <div className="font-bold text-dungeon-gold text-sm mb-1 relative z-10">{(galleryItem as any).activeSkill.name}</div>
                              <div className="text-xs text-stone-400 leading-relaxed relative z-10">{(galleryItem as any).activeSkill.desc}</div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

     {/* 核心优化：全局浮动 Toast 提示面板 (小巧、透明、快速) */}
      {toast && (
          <div className={`absolute top-12 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded shadow-lg font-bold tracking-widest flex items-center gap-2 text-xs transition-all pointer-events-none backdrop-blur-sm
              ${toast.type === 'error' ? 'bg-red-950/80 border border-red-900/50 text-red-200 shadow-[0_0_15px_rgba(153,27,27,0.5)]' : 'bg-stone-900/80 border border-stone-600/50 text-stone-300 shadow-[0_0_15px_rgba(0,0,0,0.8)]'}
          `}>
              <span className={toast.type === 'error' ? 'text-red-500 animate-pulse text-sm' : 'text-dungeon-gold text-sm'}>
                  {toast.type === 'error' ? '⚠️' : '✓'}
              </span>
              {toast.msg}
          </div>
      )}

    </div>
  );
};
