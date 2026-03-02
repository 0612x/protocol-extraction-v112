import React from 'react';
import { GameEvent, EventChoice, PlayerStats } from '../../types';
import { LucideAlertTriangle, LucideLogOut, LucideHeart, LucideCoins, LucideZap, LucideSkull, LucideCheckCircle } from 'lucide-react';

interface EventViewProps {
    event: GameEvent;
    player: PlayerStats;
    gold: number;
    onResolve: (choice: EventChoice) => void;
}

export const EventView: React.FC<EventViewProps> = ({ event, player, gold, onResolve }) => {
    
    // 检查某个选项是否可以点击 (资金不足、血量不够扣都会置灰)
    const canAfford = (choice: EventChoice) => {
        if (choice.reqGold && choice.reqGold !== 999999 && gold < choice.reqGold) return false;
        if (choice.reqGold === 999999 && gold <= 0) return false; // 需要清空金币但本来就没钱，防止白嫖
        if (choice.reqHpPct && player.currentHp <= Math.floor(player.maxHp * choice.reqHpPct)) return false;
        return true;
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-stone-800/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md bg-stone-900/80 border border-stone-700 rounded-xl shadow-2xl overflow-hidden relative z-10">
                <div className="h-2 w-full bg-gradient-to-r from-stone-800 via-stone-500 to-stone-800"></div>
                
                <div className="p-6 flex flex-col gap-6">
                    <div className="text-center">
                        <div className="flex justify-center mb-3">
                            <div className="p-3 bg-black border border-stone-800 rounded-full text-stone-400">
                                <LucideAlertTriangle size={32} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-display font-bold text-stone-200 tracking-widest">{event.title}</h2>
                    </div>

                    <div className="bg-black/50 p-4 rounded-lg border border-stone-800 text-stone-400 text-sm leading-relaxed text-center italic shadow-inner">
                        “ {event.description} ”
                    </div>

                    <div className="flex flex-col gap-3 mt-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {event.choices.map((choice, idx) => {
                            const available = canAfford(choice);
                            const isLeave = choice.label.includes('离开') || choice.label.includes('放弃') || choice.label.includes('无视');
                            const isExtract = choice.extract;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => available && onResolve(choice)}
                                    disabled={!available}
                                    className={`
                                        relative overflow-hidden w-full text-left p-4 rounded-lg border transition-all flex justify-between items-center group
                                        ${!available 
                                            ? 'bg-black/60 border-stone-800 text-stone-700 cursor-not-allowed opacity-60' 
                                            : isExtract 
                                                ? 'bg-dungeon-gold/10 border-dungeon-gold/50 text-dungeon-gold hover:bg-dungeon-gold/20 shadow-[0_0_15px_rgba(202,138,4,0.1)]' 
                                                : isLeave 
                                                    ? 'bg-stone-900 border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-stone-200' 
                                                    : 'bg-stone-800 border-stone-600 text-stone-200 hover:bg-stone-700 hover:border-stone-400 hover:shadow-lg'
                                        }
                                    `}
                                >
                                    <div className="flex flex-col gap-1 z-10">
                                        <span className="font-bold text-sm tracking-widest">{choice.label}</span>
                                        
                                        {(!available && choice.reqGold) && (
                                            <span className="text-[10px] text-red-500 font-bold font-mono">资金不足 (需 {choice.reqGold === 999999 ? '全部' : choice.reqGold} ₮)</span>
                                        )}
                                        {(!available && choice.reqHpPct) && (
                                            <span className="text-[10px] text-red-500 font-bold font-mono">生命体征过低，无法承受该代价</span>
                                        )}
                                    </div>
                                    
                                    <div className="z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                                        {isExtract ? <LucideLogOut size={20} /> : isLeave ? <LucideCheckCircle size={20} /> : <LucideAlertTriangle size={20} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div className="pt-4 border-t border-stone-800 flex justify-around text-xs font-mono">
                        <div className="flex items-center gap-1.5 text-red-400">
                            <LucideHeart size={14}/> {player.currentHp} / {player.maxHp}
                        </div>
                        <div className="flex items-center gap-1.5 text-yellow-500">
                            <LucideCoins size={14}/> {gold} ₮
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <LucideZap size={14}/> {player.charge}/10
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};