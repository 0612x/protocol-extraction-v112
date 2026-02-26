
import React from 'react';
import { LucideArrowDownCircle, LucideTent, LucideFlame } from 'lucide-react';

interface ExtractionViewProps {
  onContinue: () => void;
  onExtract: () => void;
  depth: number;
}

export const ExtractionView: React.FC<ExtractionViewProps> = ({ onContinue, onExtract, depth }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-12 p-8 animate-fade-in bg-dungeon-black text-stone-300 font-serif relative">
       {/* Background */}
       <div className="absolute inset-0 bg-radial-gradient from-dungeon-rust/10 to-black pointer-events-none"></div>
       <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>

      <div className="text-center space-y-4 z-10">
        <h1 className="text-4xl font-display font-bold text-dungeon-flesh tracking-widest border-b border-stone-800 pb-4">
            区域 {depth} 肃清
        </h1>
        <p className="text-stone-500 italic">阴影暂时退却...</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
        {/* Continue Button */}
        <button 
          onClick={onContinue}
          className="flex-1 group relative border border-stone-800 bg-black/60 hover:border-dungeon-blood transition-all duration-500 p-8 flex flex-col items-center gap-4 overflow-hidden"
        >
          <div className="absolute inset-0 bg-dungeon-red opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
          <LucideArrowDownCircle size={48} strokeWidth={1} className="text-stone-600 group-hover:text-dungeon-blood transition-colors" />
          <div className="text-center z-10">
            <h2 className="text-xl font-display font-bold text-stone-300 group-hover:text-dungeon-blood mb-2">深入深渊</h2>
            <div className="text-xs text-stone-500">
                前往更深层区域。 <br/>
                <span className="text-dungeon-red">巨大的风险与机遇并存。</span>
            </div>
          </div>
        </button>

        {/* Extract Button */}
        <button 
          onClick={onExtract}
          className="flex-1 group relative border border-stone-800 bg-black/60 hover:border-dungeon-gold transition-all duration-500 p-8 flex flex-col items-center gap-4 overflow-hidden"
        >
          <div className="absolute inset-0 bg-dungeon-gold opacity-0 group-hover:opacity-5 transition-opacity duration-500"></div>
          <LucideFlame size={48} strokeWidth={1} className="text-stone-600 group-hover:text-dungeon-gold transition-colors" />
          <div className="text-center z-10">
            <h2 className="text-xl font-display font-bold text-stone-300 group-hover:text-dungeon-gold mb-2">撤离</h2>
            <div className="text-xs text-stone-500">
                确保你的战利品。 <br/>
                <span className="text-dungeon-gold">返回地表，结束远征。</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
