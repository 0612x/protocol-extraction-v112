
import React from 'react';
import { CardType } from '../../types';
import { CARD_DEFINITIONS } from '../../constants';
import { LucideSword, LucideShield, LucideSkull, LucideScroll, LucideGhost, LucideDroplets, LucideFlame, LucideSnowflake, LucideZap, LucideBiohazard, LucideBrain, LucideSprout } from 'lucide-react';

interface CardProps {
  type: CardType;
  onClick?: () => void;
  // Pointer events for drag handling
  onPointerDown?: (e: React.PointerEvent) => void;
  disabled?: boolean;
  selected?: boolean;
  isComboFinisher?: boolean;
  style?: React.CSSProperties;
  bonusDamage?: number;
  bonusShield?: number;
  isDragging?: boolean; // New prop to remove transitions during drag
}

export const Card: React.FC<CardProps> = ({ 
    type, 
    onClick, 
    onPointerDown,
    disabled, 
    selected, 
    isComboFinisher, 
    style, 
    bonusDamage = 0, 
    bonusShield = 0,
    isDragging = false
}) => {
  const def = CARD_DEFINITIONS[type];
  
  const getIcon = () => {
      switch(type) {
          case CardType.STRIKE: return <LucideSword size={40} strokeWidth={1.5} className="text-dungeon-red drop-shadow-md" />;
          case CardType.BLOCK: return <LucideShield size={40} strokeWidth={1.5} className="text-slate-400 drop-shadow-md" />;
          case CardType.TECH: return <LucideScroll size={40} strokeWidth={1.5} className="text-amber-500 drop-shadow-md" />;
          case CardType.MOVE: return <LucideGhost size={40} strokeWidth={1.5} className="text-emerald-500 drop-shadow-md" />;
          
          // Pollutions
          case CardType.TENTACLE: return <LucideSprout size={40} strokeWidth={1.5} className="text-teal-500 drop-shadow-md" />; // Buffer Corruption
          case CardType.GLITCH: return <LucideBrain size={40} strokeWidth={1.5} className="text-fuchsia-400" />; // Mental Corruption
          
          // New Elements
          case CardType.FIRE: return <LucideFlame size={40} strokeWidth={1.5} className="text-orange-500 drop-shadow-md" />;
          case CardType.ICE: return <LucideSnowflake size={40} strokeWidth={1.5} className="text-cyan-400 drop-shadow-md" />;
          case CardType.THUNDER: return <LucideZap size={40} strokeWidth={1.5} className="text-yellow-400 drop-shadow-md" />;
          case CardType.POISON: return <LucideBiohazard size={40} strokeWidth={1.5} className="text-lime-500 drop-shadow-md" />;

          default: return <LucideSkull size={40} strokeWidth={1.5} />;
      }
  };

  // Improved card styles for visibility against dark backgrounds
  const getCardStyle = () => {
     switch(type) {
         // STRIKE: Deep Red/Brown Stone
         case CardType.STRIKE: return "border-dungeon-blood bg-[#2a1a1a] shadow-[0_4px_10px_rgba(127,29,29,0.3)]";
         // BLOCK: Iron/Slate
         case CardType.BLOCK: return "border-slate-500 bg-[#1e293b] shadow-[0_4px_10px_rgba(71,85,105,0.3)]";
         // TECH: Aged Parchment/Brass
         case CardType.TECH: return "border-amber-600 bg-[#2d2418] shadow-[0_4px_10px_rgba(180,83,9,0.2)]";
         // MOVE: Deep Emerald
         case CardType.MOVE: return "border-emerald-700 bg-[#0f291e] shadow-[0_4px_10px_rgba(4,120,87,0.2)]";
         
         // GLITCH: Cyber Psychosis (Neon Pink/Fuchsia)
         case CardType.GLITCH: return "border-fuchsia-600 bg-[#2e022e] animate-pulse shadow-[0_0_15px_rgba(232,121,249,0.3)]";
         // TENTACLE: Eldritch Corruption (Dark Teal/Black)
         case CardType.TENTACLE: return "border-teal-900 bg-[#020e0e] border-dashed shadow-[0_0_10px_rgba(20,184,166,0.1)]";
         
         // New Elements
         case CardType.FIRE: return "border-orange-600 bg-[#331100] shadow-[0_4px_10px_rgba(234,88,12,0.3)]";
         case CardType.ICE: return "border-cyan-600 bg-[#082f49] shadow-[0_4px_10px_rgba(8,145,178,0.3)]";
         case CardType.THUNDER: return "border-yellow-600 bg-[#2d2005] shadow-[0_4px_10px_rgba(202,138,4,0.3)]";
         case CardType.POISON: return "border-lime-700 bg-[#1a2e05] shadow-[0_4px_10px_rgba(101,163,13,0.3)]";
     }
  };

  const renderDescription = () => {
      // Show stats with bonuses if applicable
      if (type === CardType.STRIKE || type === CardType.THUNDER) {
          const base = 2; // FIX: Base is now strictly 2
          const total = base + bonusDamage;
          return (
              <span>
                  造成 <span className={bonusDamage > 0 ? "text-green-400 font-bold" : ""}>{total}</span> 点伤害
                  {bonusDamage > 0 && <span className="text-[9px] text-green-500 ml-1">(+{bonusDamage})</span>}
              </span>
          );
      }
      if (type === CardType.BLOCK || type === CardType.ICE) {
          const base = 2; // FIX: Base is now strictly 2
          const total = base + bonusShield;
          return (
              <span>
                  获得 <span className={bonusShield > 0 ? "text-blue-400 font-bold" : ""}>{total}</span> 点护甲
                  {bonusShield > 0 && <span className="text-[9px] text-blue-500 ml-1">(+{bonusShield})</span>}
              </span>
          );
      }
      return def.desc;
  };

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      onPointerDown={!disabled ? onPointerDown : undefined}
      style={style}
      className={`
        absolute w-28 h-44 rounded-lg flex flex-col items-center justify-between p-2 select-none origin-bottom touch-none
        border-2
        ${getCardStyle()}
        ${disabled ? 'opacity-50 grayscale brightness-75 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:z-50 hover:brightness-125'}
        ${selected ? 'ring-2 ring-dungeon-gold scale-105' : ''}
        ${isComboFinisher && !disabled ? 'ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-pulse' : ''}
        ${!isDragging ? 'transition-all duration-300' : 'z-[100]'} 
        shadow-xl
      `}
    >
      {/* Inner Border (simulating tarot card frame) */}
      <div className={`absolute inset-1 border border-white/10 rounded-md pointer-events-none`}></div>
      
      {/* Combo Finisher Badge */}
      {isComboFinisher && !disabled && (
          <div className="absolute -top-3 -right-3 z-50 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-full shadow-lg animate-bounce border border-white">
              连击!
          </div>
      )}

      {/* Background Texture */}
      <div className="absolute inset-0 bg-paper opacity-5 pointer-events-none mix-blend-overlay rounded-lg"></div>

      {/* Header */}
      <div className="flex justify-between w-full z-10 border-b border-white/10 pb-1 relative mt-1">
        <div className="font-display font-bold text-sm tracking-wide uppercase text-stone-200 drop-shadow-sm px-1">{def.name}</div>
        
        {/* Cost Hexagon */}
        <div className="w-5 h-5 bg-black/50 border border-stone-600 rounded-sm flex items-center justify-center shadow-sm">
            <span className="text-[10px] text-dungeon-gold font-display font-bold">1</span>
        </div>
      </div>
      
      {/* Icon Area - Central focus */}
      <div className={`flex-1 flex items-center justify-center relative w-full ${type === CardType.GLITCH ? 'animate-glitch' : ''}`}>
         {/* Subtle radial glow behind icon */}
         <div className="absolute w-16 h-16 bg-white/5 rounded-full blur-xl"></div>
         {getIcon()}
      </div>
      
      {/* Description Box */}
      <div className="w-full relative z-10 min-h-[3.5rem] flex items-center justify-center bg-black/30 rounded-sm mb-1 border border-white/5 p-1">
          <div className="relative text-[11px] text-center font-serif leading-tight text-stone-300 font-medium">
            {renderDescription()}
          </div>
      </div>
    </div>
  );
};
