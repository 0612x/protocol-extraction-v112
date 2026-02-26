import React from 'react';
import { InventoryState, MetaState, GridItem } from '../../types';
import { InventoryView } from './InventoryView';

interface WarehouseViewProps {
  metaState: MetaState;
  setMetaState: React.Dispatch<React.SetStateAction<MetaState>>;
  onBack: () => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({ metaState, setMetaState, onBack }) => {
  const activeCharacter = metaState.roster.find(c => c.id === metaState.activeCharacterId);

  if (!activeCharacter) {
    return <div>No active character selected.</div>;
  }

  const handleCharacterInventoryUpdate = (newInventory: InventoryState | ((prev: InventoryState) => InventoryState)) => {
    setMetaState(prev => ({
      ...prev,
      roster: prev.roster.map(c => {
        if (c.id === activeCharacter.id) {
            const resolvedInventory = typeof newInventory === 'function' ? newInventory(c.inventory) : newInventory;
            return { ...c, inventory: resolvedInventory };
        }
        return c;
      }),
    }));
  };

  const handleWarehouseInventoryUpdate = (newInventory: InventoryState | ((prev: InventoryState) => InventoryState)) => {
    setMetaState(prev => ({
      ...prev,
      warehouse: typeof newInventory === 'function' ? newInventory(prev.warehouse) : newInventory,
    }));
  };

  return (
    <div className="h-full w-full bg-stone-900 text-white p-4 flex flex-col font-mono">
      <h1 className="text-3xl font-bold text-center mb-4 text-yellow-300">Warehouse</h1>
      <div className="flex-grow flex justify-center items-center overflow-hidden">
        <div className="w-full max-w-md h-full flex flex-col">
            <InventoryView
                inventory={activeCharacter.inventory}
                setInventory={handleCharacterInventoryUpdate}
                externalInventory={metaState.warehouse}
                setExternalInventory={handleWarehouseInventoryUpdate}
                externalTitle="基地仓库"
                onFinish={() => {}} 
                isLootPhase={false} 
                currentStage={0} 
                maxStage={0} 
                setMetaState={setMetaState}
            />
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <button 
          onClick={onBack}
          className="bg-yellow-500 hover:bg-yellow-600 text-stone-900 font-bold py-2 px-6 rounded-lg transition-colors"
        >
          Back to Base Camp
        </button>
      </div>
    </div>
  );
};
