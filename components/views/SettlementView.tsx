import React, { useState, useEffect } from 'react';
import { GridItem } from '../../types';
import { LucideCheckCircle, LucideSkull, LucideArchive, LucideAlertTriangle } from 'lucide-react';

interface SettlementViewProps {
  outcome: 'VICTORY' | 'DEFEAT';
  extractedItems: GridItem[];
  lostItems: GridItem[];
  totalValue: number;
  isCommander: boolean;
  onConfirm: () => void;
}

export const SettlementView: React.FC<SettlementViewProps> = ({ outcome, extractedItems, lostItems, totalValue, isCommander, onConfirm }) => {
  const [introFinished, setIntroFinished] = useState(false);

  // 控制 3 秒的黑屏沉浸式动画
  useEffect(() => {
    const timer = setTimeout(() => setIntroFinished(true), 1500); 
    return () => clearTimeout(timer);
  }, []);

  if (!introFinished) {
    return (
      <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black overflow-hidden pointer-events-none">
         {outcome === 'VICTORY' ? (
             <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                 <div className="w-24 h-1 bg-dungeon-gold/80 mb-4 shadow-[0_0_20px_rgba(202,138,4,1)]"></div>
                 <h2 className="text-4xl md:text-5xl font-display tracking-[0.5em] text-dungeon-gold drop-shadow-[0_0_15px_rgba(202,138,4,0.8)]">EXTRACTION</h2>
                 <h2 className="text-3xl md:text-4xl font-display tracking-[0.5em] text-stone-300">COMPLETE</h2>
                 <p className="text-sm font-mono text-stone-400 mt-8 animate-pulse tracking-widest">UPLOADING PAYLOAD...</p>
             </div>
         ) : (
             <div className="flex flex-col items-center gap-6 animate-fade-in">
                 <style>{`
                    @keyframes scan-laser { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                 `}</style>
                 <div className="w-full h-1 bg-red-900/50 absolute shadow-[0_0_30px_rgba(220,38,38,1)]" style={{ animation: 'scan-laser 1s linear infinite' }}></div>
                 <h2 className="text-4xl md:text-6xl font-display tracking-[0.5em] text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,1)] animate-pulse">SIGNAL</h2>
                 <h2 className="text-3xl md:text-5xl font-display tracking-[0.5em] text-red-900 blur-[1px]">LOST</h2>
                 <p className="text-sm font-mono text-red-800 mt-8 uppercase tracking-widest font-bold">Vital signs: TERMINATED</p>
             </div>
         )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-stone-950 text-stone-200 animate-fade-in p-6 overflow-y-auto">
      <div className="text-center mt-12 mb-8 space-y-4">
        {outcome === 'VICTORY' ? (
          <>
            <LucideCheckCircle size={64} className="text-dungeon-gold mx-auto animate-pulse" />
            <h1 className="text-4xl font-display font-bold text-dungeon-gold tracking-widest">撤离成功</h1>
            <p className="text-sm text-stone-400">所有收集的物资已成功运回基地。</p>
          </>
        ) : (
          <>
            <LucideSkull size={64} className="text-red-600 mx-auto animate-pulse" />
            <h1 className="text-4xl font-display font-bold text-red-600 tracking-widest">理智耗尽</h1>
            {isCommander ? (
                <p className="text-sm text-red-400">指挥官意识已断开连接。非保险区物资全部遗失。</p>
            ) : (
                <p className="text-sm text-red-400">该素体已阵亡(M.I.A)。仅保险区内的物资得以留存，请在基地回收。</p>
            )}
          </>
        )}
      </div>

      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-6 space-y-6 mb-8 shadow-xl">
        <div className="flex justify-between items-center border-b border-stone-700 pb-4">
            <span className="text-stone-400 font-bold">回收物资总估值</span>
            <span className="text-2xl font-mono text-dungeon-gold font-bold">₮ {totalValue}</span>
        </div>

        <div>
            <h3 className="text-sm font-bold text-stone-300 flex items-center gap-2 mb-3">
                <LucideArchive size={16} className="text-green-500" /> 成功带回 ({extractedItems.length} 件)
            </h3>
            <div className="flex flex-wrap gap-2">
                {extractedItems.map(item => (
                    <div key={item.id} className="px-2 py-1 bg-stone-800 border border-stone-600 rounded text-xs text-stone-300">
                        {item.name} {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ''}
                    </div>
                ))}
                {extractedItems.length === 0 && <span className="text-xs text-stone-600 italic">空空如也...</span>}
            </div>
        </div>

        {outcome === 'DEFEAT' && (
            <div>
                <h3 className="text-sm font-bold text-stone-300 flex items-center gap-2 mb-3">
                    <LucideAlertTriangle size={16} className="text-red-500" /> 永远遗失 ({lostItems.length} 件)
                </h3>
                <div className="flex flex-wrap gap-2 opacity-60">
                    {lostItems.map(item => (
                        <div key={item.id} className="px-2 py-1 bg-red-950/40 border border-red-900 rounded text-xs text-red-400 line-through">
                            {item.name}
                        </div>
                    ))}
                    {lostItems.length === 0 && <span className="text-xs text-stone-600 italic">未造成额外损失</span>}
                </div>
            </div>
        )}
      </div>

      <button 
        onClick={onConfirm}
        className="mt-auto w-full py-4 bg-stone-800 text-stone-200 font-display font-bold tracking-widest border border-stone-600 hover:bg-stone-700 hover:text-white transition-all shadow-lg rounded"
      >
        返回基地
      </button>
    </div>
  );
};