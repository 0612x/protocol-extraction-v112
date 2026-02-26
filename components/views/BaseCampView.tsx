
import React, { useState } from 'react';
import { MetaState, ResourceType, BuildingType, Character, InventoryState } from '../../types';
import { LucideCoins, LucideGhost, LucideZap, LucidePackage, LucideCpu, LucideMap, LucideUser, LucidePlay, LucideShoppingCart } from 'lucide-react';
import { InventoryView } from './InventoryView';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT } from '../../constants';

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

        <div className="w-full max-w-sm p-8 bg-stone-900/40 border border-stone-700 rounded-xl hover:border-dungeon-red transition-all cursor-pointer group shadow-lg hover:shadow-dungeon-red/20" onClick={onStartRun}>
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-dungeon-red/10 rounded-full text-dungeon-red group-hover:bg-dungeon-red group-hover:text-white transition-colors duration-500">
                    <LucidePlay size={48} className="ml-1" />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-bold text-stone-200 group-hover:text-white">开始行动</h3>
                    <p className="text-xs text-stone-500 mt-1">当前选中: {selectedChar.name}</p>
                </div>
            </div>
        </div>
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

  const renderTradeTab = () => (
      <div className="flex flex-col items-center gap-6 w-full max-w-md animate-fade-in p-4">
        <div className="text-center space-y-1">
            <h2 className="text-2xl font-display font-bold text-stone-300">黑市交易</h2>
            <p className="text-xs text-stone-500">TRADE</p>
        </div>
        <div className="w-full p-4 bg-stone-900/50 border border-stone-800 rounded text-center text-stone-500 italic">
            黑市暂未开放...
        </div>
      </div>
  );

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
                <div className="text-center text-stone-500 italic mt-10">招募系统开发中...</div>
            )}
        </div>
    </div>
  );

  const renderWarehouseTab = () => {
    // 将素体选择器抽离，作为背包区的专属头部
    const characterSelector = (
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
                        <div className={`w-2 h-2 rounded-full ${selectedCharId === char.id ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-stone-700'}`}></div>
                        <div className="flex flex-col items-start">
                            <span className={`text-xs font-bold ${selectedCharId === char.id ? 'text-stone-200' : 'text-stone-500 group-hover:text-stone-400'}`}>{char.name}</span>
                            <span className="text-[8px] font-mono text-stone-600 uppercase">{char.class} LV.{char.level}</span>
                        </div>
                        {selectedCharId === char.id && (
                            <div className="absolute inset-0 border border-stone-500/30 rounded-lg animate-pulse pointer-events-none"></div>
                        )}
                    </button>
                ))}
            </div>
        </div>
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
                    customPlayerHeader={characterSelector}
                    playerLevel={selectedChar.level}
                    playerClass={selectedChar.class} // 关键：向下层透传当前职业
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
