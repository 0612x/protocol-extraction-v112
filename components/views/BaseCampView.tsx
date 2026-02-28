
import React, { useState,useEffect, useCallback } from 'react';
import { MetaState, ResourceType, BuildingType, Character, InventoryState,CardType} from '../../types';
import { LucideCoins, LucideGhost, LucideZap, LucidePackage, LucideCpu, LucideMap, LucideUser, LucidePlay, LucideShoppingCart,LucideActivity, LucideBox, LucideFileText } from 'lucide-react';
import { InventoryView } from './InventoryView';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT, LOOT_TABLE, STARTING_BLUEPRINTS } from '../../constants'; // 引入战利品表以生成悬赏
import { createEmptyGrid, removeItemFromGrid,canPlaceItem, placeItemInGrid } from '../../utils/gridLogic';
import { GridItem } from '../../types';

interface BaseCampViewProps {
  metaState: MetaState;
  setMetaState: React.Dispatch<React.SetStateAction<MetaState>>;
  onStartRun: () => void;
  onUpgradeBuilding: (type: BuildingType) => void;
}

type Tab = 'WAREHOUSE' | 'BODY' | 'START' | 'MISSION' | 'TRADE';
type BodySubTab = 'STATUS' | 'SKILLS' | 'RECRUIT';

export const BaseCampView: React.FC<BaseCampViewProps> = ({ metaState, setMetaState, onStartRun, onUpgradeBuilding }) => {
  const [activeTab, setActiveTab] = useState<Tab>('START');
  const [bodySubTab, setBodySubTab] = useState<BodySubTab>('STATUS');
  const [selectedCharId, setSelectedCharId] = useState<string>(metaState.roster[0]?.id || '');
  
  // 招募克隆仓动画与确认面板状态
  const [isRecruiting, setIsRecruiting] = useState(false); 
  const [recruitmentResult, setRecruitmentResult] = useState<Character | null>(null);

  // 黑市交易核心状态
  const [tradeSubTab, setTradeSubTab] = useState<'BOUNTY' | 'SHOP'>('BOUNTY');
  const [bounties, setBounties] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [refreshCountdown, setRefreshCountdown] = useState<number>(300); // 默认 5分钟 (300秒)

  // 刷新黑市数据的核心逻辑
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
      // 黑市走私只卖消耗品和遗物
      const buyableTemplates = LOOT_TABLE.filter(t => t.type === 'CONSUMABLE' || t.type === 'ARTIFACT');
      for(let i=0; i<4; i++) {
          const template = buyableTemplates[Math.floor(Math.random() * buyableTemplates.length)];
          newShop.push({
              ...template,
              id: `shop-${Date.now()}-${i}`,
              buyPrice: Math.floor((template.value || 10) * 2.5), // 黑市买入价格是基准价值的 2.5 倍
              stock: Math.floor(Math.random() * 3) + 1 // 随机库存 1~3 个
          });
      }
      setShopItems(newShop);
      setRefreshCountdown(300); // 重置倒计时
  }, []);

  // 初始加载及自动刷新计时器
  useEffect(() => {
      if (bounties.length === 0 && shopItems.length === 0) {
          generateMarket();
      }
      const timer = setInterval(() => {
          setRefreshCountdown(prev => {
              if (prev <= 1) {
                  generateMarket();
                  return 300;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [generateMarket, bounties.length, shopItems.length]);

  // 格式化时间显示
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
            <div 
                className="w-full max-w-sm p-8 bg-red-950/20 border border-red-900/60 rounded-xl hover:bg-red-900/40 hover:border-red-600 transition-all cursor-pointer group shadow-[0_0_30px_rgba(153,27,27,0.2)]" 
                onClick={() => {
                    if(window.confirm(`【警告】确定要清理 ${selectedChar.name} 的残骸吗？\n一旦清理，其保险区内所有未被转移到仓库的遗物将永久蒸发！`)) {
                        setMetaState(prev => ({ ...prev, roster: prev.roster.filter(c => c.id !== selectedCharId) }));
                        setSelectedCharId(metaState.roster[0].id); 
                    }
                }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-red-900/30 rounded-full text-red-500 group-hover:bg-red-600 group-hover:text-white transition-colors duration-500 shadow-inner">
                        <span className="text-4xl">☠️</span>
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-red-500 group-hover:text-red-400">清理残骸</h3>
                        <p className="text-xs text-red-800 mt-1 font-bold">不可逆操作: {selectedChar.name} 将被永久删除</p>
                    </div>
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

      // 悬赏订单交付逻辑
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
              resources: { ...prev.resources, GOLD: (prev.resources.GOLD || 0) + bounty.reward },
              warehouse: { ...prev.warehouse, items: newItems, grid: newGrid }
          }));
          
          // 交付完成直接从列表移除，不再立即补充，等待刷新
          setBounties(prev => prev.filter(b => b.id !== bounty.id));
      };

      // 走私物品购买逻辑
      const handleBuyItem = (shopItem: any) => {
          if ((metaState.resources['GOLD'] || 0) < shopItem.buyPrice) {
              alert("资金不足！");
              return;
          }
          
          let currentWarehouseItems = [...metaState.warehouse.items];
          let currentWarehouseGrid = [...metaState.warehouse.grid];
          let placed = false;

          // 优先尝试堆叠消耗品
          if (shopItem.type === 'CONSUMABLE') {
              for (const wItem of currentWarehouseItems) {
                  if (wItem.type === 'CONSUMABLE' && wItem.name === shopItem.name) {
                      wItem.quantity = (wItem.quantity || 1) + 1;
                      placed = true;
                      break;
                  }
              }
          }

          // 寻找空位放置
          if (!placed) {
              // 自动将购买物品设置为已鉴定、0旋转角度，并恢复真实形状
              const itemToPlace = { ...shopItem, isIdentified: true, quantity: 1, rotation: 0, originalShape: shopItem.shape };
              delete itemToPlace.buyPrice;
              delete itemToPlace.stock;

              for (let y = 0; y < metaState.warehouse.height; y++) {
                  if (placed) break;
                  for (let x = 0; x < metaState.warehouse.width; x++) {
                      // 必须放入仓库内，检查解锁行数
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
              alert("仓库空间不足！请先清理仓库。");
              return;
          }

          // 扣除金币、更新仓库、扣减黑市库存
          setMetaState(prev => ({
              ...prev,
              resources: { ...prev.resources, GOLD: (prev.resources.GOLD || 0) - shopItem.buyPrice },
              warehouse: { ...prev.warehouse, items: currentWarehouseItems, grid: currentWarehouseGrid }
          }));

          setShopItems(prev => prev.map(i => {
              if (i.id === shopItem.id) return { ...i, stock: i.stock - 1 };
              return i;
          }).filter(i => i.stock > 0));
      };

      return (
          <div className="flex flex-col items-center gap-4 w-full max-w-2xl animate-fade-in p-6 mx-auto h-full">
            
            {/* 顶部标题与黑市刷新栏 */}
            <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 bg-stone-900/80 p-4 rounded-xl border border-stone-800 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <LucideCoins className="text-dungeon-gold" size={24} />
                        <span className="text-xl font-bold text-stone-200">{metaState.resources['GOLD'] || 0}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-400 font-mono">
                        <LucideActivity size={14} className="inline mr-1 text-dungeon-gold animate-pulse"/>
                        市场刷新: {formatTime(refreshCountdown)}
                    </span>
                    <button 
                        onClick={() => {
                            if ((metaState.resources['GOLD'] || 0) >= 50) {
                                setMetaState(prev => ({...prev, resources: {...prev.resources, GOLD: (prev.resources.GOLD || 0) - 50}}));
                                generateMarket();
                            } else {
                                alert("刷新黑市需要 50 资金！");
                            }
                        }}
                        className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs border border-stone-600 rounded transition-colors shadow-md flex items-center gap-1"
                    >
                        立刻刷新 (🪙50)
                    </button>
                </div>
            </div>

            {/* 导航 Tab */}
            <div className="flex w-full rounded-lg overflow-hidden border border-stone-700 shrink-0">
                <button 
                    className={`flex-1 py-2 text-sm font-bold tracking-widest transition-colors ${tradeSubTab === 'BOUNTY' ? 'bg-dungeon-gold text-black' : 'bg-stone-900 text-stone-500 hover:bg-stone-800'}`}
                    onClick={() => setTradeSubTab('BOUNTY')}
                >
                    悬赏订单 (出售)
                </button>
                <button 
                    className={`flex-1 py-2 text-sm font-bold tracking-widest transition-colors ${tradeSubTab === 'SHOP' ? 'bg-dungeon-gold text-black' : 'bg-stone-900 text-stone-500 hover:bg-stone-800'}`}
                    onClick={() => setTradeSubTab('SHOP')}
                >
                    黑市走私 (购买)
                </button>
            </div>

            <div className="w-full flex-1 overflow-y-auto space-y-4 px-1 pb-4 no-scrollbar">
                {tradeSubTab === 'BOUNTY' && (
                    <>
                        {bounties.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-stone-500 italic gap-2">
                                <LucideFileText size={32} className="opacity-20" />
                                当前暂无悬赏订单，请等待黑市刷新...
                            </div>
                        ) : (
                            bounties.map(bounty => {
                                let canFulfill = true;
                                return (
                                    <div key={bounty.id} className="p-4 bg-stone-900/50 border border-stone-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-stone-500 transition-colors shadow-md">
                                        <div className="flex flex-col gap-2 flex-1">
                                            <span className="text-xs font-bold text-stone-400">所需物资清单</span>
                                            <div className="flex flex-wrap gap-2">
                                                {bounty.requirements.map((req: any, idx: number) => {
                                                    const owned = currentItems.filter(i => i.name === req.name).reduce((acc, i) => acc + (i.quantity || 1), 0);
                                                    if (owned < req.quantity) canFulfill = false;
                                                    return (
                                                        <div key={idx} className={`px-2 py-1 rounded border text-xs flex items-center gap-2 ${owned >= req.quantity ? 'bg-green-900/20 border-green-700 text-green-400' : 'bg-stone-950 border-stone-700 text-stone-500'}`}>
                                                            <span>{req.name}</span>
                                                            <span className="font-mono">{owned}/{req.quantity}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-stone-800 pt-3 sm:pt-0 sm:pl-4 min-w-[120px]">
                                            <div className="text-dungeon-gold font-bold flex items-center gap-1">
                                                <LucideCoins size={14} /> + {bounty.reward} 
                                            </div>
                                            <button 
                                                className={`w-full py-1.5 rounded font-bold text-xs transition-all shadow-lg ${canFulfill ? 'bg-dungeon-gold text-black hover:bg-yellow-400' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}
                                                onClick={() => handleFulfillBounty(bounty)}
                                                disabled={!canFulfill}
                                            >
                                                交付订单
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </>
                )}

                {tradeSubTab === 'SHOP' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {shopItems.length === 0 ? (
                            <div className="col-span-1 sm:col-span-2 h-40 flex flex-col items-center justify-center text-stone-500 italic gap-2">
                                <LucideBox size={32} className="opacity-20" />
                                走私货已被抢购一空，请等待下一批黑市货物...
                            </div>
                        ) : (
                            shopItems.map(item => (
                                <div key={item.id} className="p-3 bg-stone-900/50 border border-stone-700 rounded-xl flex gap-3 hover:border-stone-500 transition-colors shadow-md">
                                    <div className={`w-12 h-12 rounded border flex items-center justify-center shrink-0 shadow-inner ${item.color.replace('border-', 'bg-').split(' ')[0]}`}>
                                         <span className="text-white/80 font-bold font-mono">{item.name.charAt(0)}</span>
                                    </div>
                                    <div className="flex flex-col flex-1 justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-stone-200">{item.name} <span className="text-[10px] text-stone-500 ml-1">x{item.stock}</span></div>
                                            <div className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">{item.description}</div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                                                <LucideCoins size={12}/> {item.buyPrice}
                                            </span>
                                            <button 
                                                onClick={() => handleBuyItem(item)}
                                                className="px-4 py-1 bg-stone-800 hover:bg-dungeon-gold hover:text-black text-stone-300 text-xs font-bold rounded transition-colors shadow"
                                            >
                                                购入
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
            <button onClick={() => setBodySubTab('SKILLS')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${bodySubTab === 'SKILLS' ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>技能</button>
            <button onClick={() => setBodySubTab('RECRUIT')} className={`px-4 py-1 text-xs font-bold rounded-full transition-colors ${bodySubTab === 'RECRUIT' ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-300'}`}>招募</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
            {bodySubTab === 'STATUS' && (
                <div className="w-full max-w-md flex flex-col gap-6">
                    {/* Character Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {metaState.roster.map(char => (
                            <button 
                                key={char.id}
                                onClick={() => setSelectedCharId(char.id)}
                                className={`flex-shrink-0 p-2 border rounded-lg flex flex-col items-center gap-1 min-w-[80px] ${selectedCharId === char.id ? 'border-stone-400 bg-stone-800' : 'border-stone-800 bg-stone-900/50 opacity-60'}`}
                            >
                                <LucideUser size={24} />
                                <span className="text-[10px]">{char.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Character Visual */}
                    <div className="flex justify-center">
                        <div className="relative w-32 h-32 flex items-center justify-center border-2 border-stone-700 rounded-full bg-black/50 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                            <LucideUser size={64} className="text-stone-500" />
                            <div className="absolute -bottom-2 px-3 py-1 bg-stone-800 border border-stone-600 rounded-full text-xs font-bold text-stone-300">
                                LV.{selectedChar.level}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center">
                            <span className="text-[10px] text-stone-500 uppercase tracking-wider">Class</span>
                            <span className="text-sm font-bold text-stone-300">{selectedChar.class}</span>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center">
                            <span className="text-[10px] text-stone-500 uppercase tracking-wider">Max HP</span>
                            <span className="text-xl font-mono text-stone-200">{selectedChar.stats.maxHp}</span>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center">
                            <span className="text-[10px] text-stone-500 uppercase tracking-wider">Energy</span>
                            <span className="text-xl font-mono text-stone-200">{selectedChar.stats.maxEnergy}</span>
                        </div>
                        <div className="p-3 bg-stone-900/50 border border-stone-800 rounded flex flex-col items-center">
                            <span className="text-[10px] text-stone-500 uppercase tracking-wider">Sanity</span>
                            <span className="text-xl font-mono text-stone-200">100%</span>
                        </div>
                    </div>
                </div>
            )}
            
            {bodySubTab === 'SKILLS' && (
                <div className="text-center text-stone-500 italic mt-10">技能树系统开发中...</div>
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
                            <div className="text-center z-10">
                                <div className="font-bold text-stone-200 text-lg">标准素体 (OPERATOR)</div>
                                <div className="text-xs text-stone-500 mt-2">均衡的承载能力，标准的背包物理限制。</div>
                            </div>
                            {/* 核心优化5：抽卡/克隆招募动画集成 */}
                            <button 
                                className="mt-4 w-full py-3 bg-stone-950 hover:bg-dungeon-gold/20 border border-stone-600 hover:border-dungeon-gold text-stone-300 hover:text-dungeon-gold font-bold rounded flex justify-center items-center gap-2 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isRecruiting}
                                onClick={() => {
                                    const cost = 2000;
                                    if ((metaState.resources[ResourceType.GOLD] || 0) >= cost) {
                                        setIsRecruiting(true); // 激活克隆舱动画
                                        
                                        // 立即扣除金币，但延迟发放角色
                                        setMetaState(prev => ({
                                            ...prev,
                                            resources: { ...prev.resources, [ResourceType.GOLD]: (prev.resources[ResourceType.GOLD] || 0) - cost }
                                        }));

                                        setTimeout(() => {
                                            const newId = `agent-${Date.now()}`;
                                            const newAgent: Character = {
                                                id: newId,
                                                name: `Alpha-${Math.floor(Math.random() * 90) + 10}`,
                                                class: 'OPERATOR',
                                                level: 1,
                                                exp: 0,
                                                status: 'ALIVE',
                                                // 核心修复：完美对齐最新版的微数值框架、状态组 (statuses) 和初始套牌！不再引发白屏报错！
                                                stats: { 
                                                    maxHp: 30, 
                                                    currentHp: 30, 
                                                    maxEnergy: 3, 
                                                    energy: 3, 
                                                    shield: 0,
                                                    damageBonus: 0,
                                                    shieldBonus: 0,
                                                    shieldStart: 0,
                                                    thorns: 0,
                                                    deck: [CardType.STRIKE, CardType.BLOCK, CardType.TECH, CardType.MOVE], 
                                                    blueprints: STARTING_BLUEPRINTS,
                                                    statuses: {} // 关键修复点：提供空的状态对象，防止读取 CORROSION 时崩溃
                                                },
                                                inventory: { items: [], grid: createEmptyGrid(INVENTORY_WIDTH, INVENTORY_HEIGHT), width: INVENTORY_WIDTH, height: INVENTORY_HEIGHT }
                                            };
                                            // 暂存招募结果，弹出确认面板等待用户手动收下，不再自动关闭
                                            setRecruitmentResult(newAgent);
                                        }, 3000);
                                    } else {
                                        alert("资金不足！培养标准素体需要 2000 资金。");
                                    }
                                }}
                            >
                                <LucideCoins size={16} className="text-dungeon-gold" /> {isRecruiting ? '培养池运作中...' : '2000 招募'}
                            </button>
                        </div>
                        
                        {/* 高阶素体 */}
                        <div className="p-6 border border-stone-800 bg-black/40 rounded-xl flex flex-col items-center gap-4 shadow-lg opacity-60">
                            <LucideZap size={48} className="text-stone-600" />
                            <div className="text-center">
                                <div className="font-bold text-stone-500 text-lg">高阶素体 (GHOST)</div>
                                <div className="text-xs text-stone-600 mt-2">特化型战斗核心。需要更高级的科技解锁。</div>
                            </div>
                            <button className="mt-4 w-full py-3 bg-stone-900 border border-stone-800 text-stone-700 font-bold rounded cursor-not-allowed">
                                科技未解锁
                            </button>
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
                    {metaState.roster.map(char => (
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
                    ))}
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
          <div className="absolute inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-500">
              {recruitmentResult ? (
                  // 【阶段二】动画完毕，展示新角色并要求手动确认
                  <div className="relative flex flex-col items-center justify-center animate-fade-in-up mt-12">
                      <div className="absolute inset-0 bg-dungeon-gold/10 blur-[80px] rounded-full z-0 w-64 h-64"></div>
                      <div className="relative w-32 h-32 flex items-center justify-center border-4 border-dungeon-gold rounded-full bg-black/50 shadow-[0_0_50px_rgba(202,138,4,0.5)] z-10">
                          <LucideUser size={80} className="text-dungeon-gold drop-shadow-[0_0_15px_rgba(202,138,4,1)]" />
                      </div>
                      <div className="text-4xl font-display font-bold text-stone-100 tracking-widest mt-8 z-10 drop-shadow-md">
                          {recruitmentResult.name}
                      </div>
                      <div className="flex gap-4 mt-3 z-10">
                          <span className="px-3 py-1 bg-stone-900 border border-stone-700 text-stone-400 font-mono text-xs rounded uppercase">CLASS: {recruitmentResult.class}</span>
                          <span className="px-3 py-1 bg-amber-950/50 border border-dungeon-gold/50 text-dungeon-gold font-mono text-xs rounded">LV.{recruitmentResult.level}</span>
                      </div>
                      <button 
                          className="mt-12 px-16 py-4 bg-dungeon-gold text-black font-bold text-lg tracking-widest hover:bg-yellow-400 hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-all z-10 rounded shadow-lg"
                          onClick={() => {
                              setMetaState(prev => ({
                                  ...prev,
                                  roster: [...prev.roster, recruitmentResult]
                              }));
                              setRecruitmentResult(null);
                              setIsRecruiting(false);
                          }}
                      >
                          确认唤醒
                      </button>
                  </div>
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

    </div>
  );
};
