
import React from 'react';

interface MetaViewProps {
  onStartRun: () => void;
  playerLevel: number;
}

export const MetaView: React.FC<MetaViewProps> = ({ onStartRun, playerLevel }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-dungeon-black text-dungeon-flesh font-serif">
      
      {/* Atmosphere Background */}
      <div className="absolute inset-0 bg-radial-gradient from-dungeon-stone/20 to-black pointer-events-none"></div>
      <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
      
      {/* Fog/Smoke (Simulated) */}
      <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent opacity-80"></div>

      <div className="z-10 flex flex-col items-center gap-8 w-full max-w-sm animate-fade-in p-6 border-y-2 border-dungeon-stone/30 bg-black/40 backdrop-blur-sm">
        
        <div className="text-center space-y-2">
            <h1 className="text-5xl md:text-6xl font-display font-bold text-dungeon-blood tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
              暗区<span className="text-dungeon-stone">指令</span>
            </h1>
            <div className="text-xs font-serif tracking-[0.5em] text-dungeon-rust uppercase opacity-70">
              Protocol: Extraction
            </div>
        </div>
        
        <div className="w-full h-px bg-gradient-to-r from-transparent via-dungeon-rust to-transparent opacity-50"></div>

        <button 
          onClick={onStartRun}
          className="group relative w-full py-4 bg-transparent border border-dungeon-stone text-dungeon-flesh font-display text-xl tracking-widest hover:border-dungeon-blood hover:text-dungeon-blood transition-all duration-500"
        >
          <div className="absolute inset-0 bg-dungeon-red opacity-0 group-hover:opacity-10 transition-opacity duration-500"></div>
          <span className="relative z-10 group-hover:drop-shadow-[0_0_8px_rgba(138,11,11,0.8)]">开始潜入</span>
        </button>

        <div className="mt-4 w-full text-center">
             <div className="text-dungeon-gold font-display text-sm mb-2 opacity-80">- 状态 -</div>
             <div className="grid grid-cols-2 gap-4 text-xs text-stone-500 border border-dungeon-stone/30 p-4 bg-black/60">
                 <div className="flex flex-col items-center">
                     <span className="uppercase tracking-widest mb-1">理智</span>
                     <span className="text-dungeon-flesh text-lg font-serif">LV.{playerLevel}</span>
                 </div>
                 <div className="flex flex-col items-center">
                     <span className="uppercase tracking-widest mb-1">命运</span>
                     <span className="text-dungeon-flesh text-lg font-serif">未知</span>
                 </div>
             </div>
        </div>
        
        <div className="text-[10px] text-stone-700 font-serif italic">
            "在深渊凝视你之前，带上你的战利品逃离..."
        </div>
      </div>
    </div>
  );
};
