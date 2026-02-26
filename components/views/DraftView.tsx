
import React from 'react';
import { Blueprint, CardType } from '../../types';
import { CARD_DEFINITIONS } from '../../constants';
import { LucideScroll, LucideSword, LucideShield, LucideZap } from 'lucide-react';

interface DraftViewProps {
  options: Blueprint[];
  onDraft: (blueprint: Blueprint) => void;
}

const RARITY_LABELS: Record<string, string> = {
    'COMMON': '普通',
    'RARE': '稀有',
    'LEGENDARY': '传说'
};

export const DraftView: React.FC<DraftViewProps> = ({ options, onDraft }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'DAMAGE': return <LucideSword className="text-red-500" />;
      case 'DEFENSE': return <LucideShield className="text-stone-400" />;
      default: return <LucideZap className="text-purple-500" />;
    }
  };

  const getCardIcon = (type: CardType) => {
      // Simplified small icons for the sequence display
      const color = CARD_DEFINITIONS[type].color.split(' ')[1]; // rough hack to get text color class
      return <div className={`w-3 h-3 rounded-full border border-stone-600 ${color.replace('text-', 'bg-')}`}></div>;
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dungeon-black text-dungeon-flesh relative overflow-hidden font-serif p-6">
      
      {/* Background */}
      <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
      <div className="absolute inset-0 bg-radial-gradient from-purple-900/10 to-black pointer-events-none"></div>

      <div className="z-10 text-center mb-8">
        <h2 className="text-2xl font-display font-bold text-dungeon-gold tracking-widest mb-2">
            解析残骸
        </h2>
        <p className="text-sm text-stone-500 italic">
            从敌人的尸体中提取一种战斗蓝图...
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 w-full max-w-md z-10">
        {options.map((bp) => (
          <button
            key={bp.id}
            onClick={() => onDraft(bp)}
            className="group relative flex flex-col bg-stone-900/80 border border-stone-700 hover:border-dungeon-gold transition-all duration-300 p-4 text-left shadow-lg hover:bg-black"
          >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black border border-stone-800 rounded-sm">
                        {getIcon(bp.type)}
                    </div>
                    <div>
                        <div className="font-display font-bold text-lg text-stone-200 group-hover:text-dungeon-gold transition-colors">
                            {bp.name}
                        </div>
                        <div className="text-[10px] text-stone-600 uppercase tracking-widest">
                            {RARITY_LABELS[bp.rarity] || bp.rarity}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-3 bg-black/50 p-2 rounded-sm border border-white/5">
                <span className="text-xs text-stone-500 mr-2">序列:</span>
                {bp.sequence.map((card, idx) => (
                    <div key={idx} className="flex items-center">
                        {idx > 0 && <div className="w-2 h-px bg-stone-700 mx-1"></div>}
                        <div 
                            className="w-6 h-6 flex items-center justify-center bg-stone-800 border border-stone-600 rounded-sm text-[10px] font-bold"
                            title={CARD_DEFINITIONS[card].name}
                        >
                           {CARD_DEFINITIONS[card].name[0]}
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-sm text-stone-400 font-serif leading-relaxed">
                {bp.effectDescription}
            </p>

            {/* Selection Indicator */}
            <div className="absolute inset-0 border-2 border-dungeon-gold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none scale-105"></div>
          </button>
        ))}
      </div>
    </div>
  );
};
