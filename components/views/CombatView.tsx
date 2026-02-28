
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardType, Enemy, PlayerStats, Blueprint, EnemyIntent } from '../../types';
import { CARD_DEFINITIONS, HAND_SIZE, MAX_BUFFER_SIZE, DRAW_AMOUNT, STARTING_BLUEPRINTS, BLUEPRINT_POOL } from '../../constants';
import { Card } from '../ui/Card';
import { LucideSword, LucideShield, LucideBookOpen, LucideX, LucideGhost, LucideHeart, LucideEye, LucideTrash2, LucideDroplets, LucideFlame, LucideSnowflake, LucideZap, LucideBiohazard, LucideBrain, LucideSprout, LucideTrendingUp, LucideHeartCrack, LucideBicepsFlexed, LucidePlus, LucideOrbit, LucideChevronsUp, LucideBackpack, LucideScrollText, LucideTarget, LucideLock, LucideDownload, LucideSkull, LucideHourglass, LucideUndo2, LucideFilter, LucideLayers, LucideMenu } from 'lucide-react';

interface CombatViewProps {
  enemy: Enemy;
  player: PlayerStats;
  currentStage: number;
  maxStage: number;
  onWin: () => void;
  onLose: () => void;
  updatePlayer: (stats: PlayerStats | ((prev: PlayerStats) => PlayerStats)) => void;
  onOpenInventory: () => void;
  isGodMode: boolean;
  combatType?: 'NORMAL' | 'EXTRACTION';
}

// Visual Effect Type
type VfxType = 'SLASH' | 'BLOCK' | 'HEAL' | 'BUFF' | 'POISON' | 'TEXT' | 'FREEZE' | 'BURN' | 'THUNDER' | 'GHOST' | 'DEBUFF';
interface VfxInstance {
    id: number;
    type: VfxType;
    x: number; // Percent 0-100
    y: number; // Percent 0-100
    content?: string; // For text
    color?: string;
    icon?: React.ReactNode;
}

// Internal Interface for Hand Cards to ensure uniqueness
interface HandCard {
    id: string;
    type: CardType;
    isPolluting?: boolean; // For animation
}

// Helper: Get raw calculations for card positioning
const getCardCalculations = (index: number, total: number) => {
   const angleStep = Math.min(6, 40 / total); 
   const baseAngle = -((total - 1) * angleStep) / 2;
   const rotation = baseAngle + index * angleStep;
   
   const yOffset = Math.abs(index - (total - 1) / 2) * (12 - Math.min(6, total)); 
   const xSpread = Math.min(55, 320 / total); 
   const xOffset = (index - (total - 1) / 2) * xSpread;

   return { xOffset, yOffset, rotation };
};

// Return style for hand rendering
const getCardStyle = (index: number, total: number, extraOffset: {x: number, y: number} = {x:0, y:0}) => {
   const { xOffset, yOffset, rotation } = getCardCalculations(index, total);
   return {
       transform: `translateX(calc(-50% + ${xOffset}px + ${extraOffset.x}px)) translateY(${yOffset + extraOffset.y}px) rotate(${rotation}deg)`
   };
};

const INTENT_LABELS: Record<string, string> = {
    'ATTACK': '杀意',
    'BUFF': '突变',
    'HEAL': '再生',
    'DEBUFF': '诅咒',
    'POLLUTE': '精神侵蚀',
    'WAIT': '窥视'
};

const getBlueprintCategory = (bp: Blueprint): string => {
    const s = new Set(bp.sequence);
    if (s.has(CardType.GLITCH) || s.has(CardType.TENTACLE)) return 'VOID';
    if (s.has(CardType.POISON)) return 'POISON';
    if (s.has(CardType.THUNDER)) return 'THUNDER';
    if (s.has(CardType.ICE)) return 'ICE';
    if (s.has(CardType.FIRE)) return 'FIRE';
    return 'PHYSICAL';
};

export const CombatView: React.FC<CombatViewProps> = ({ enemy: initialEnemy, player, currentStage, maxStage, onWin, onLose, updatePlayer, onOpenInventory, isGodMode, combatType = 'NORMAL' }) => {
  const [enemy, setEnemy] = useState<Enemy>(initialEnemy);
  const [hand, setHand] = useState<HandCard[]>([]);
  const [buffer, setBuffer] = useState<CardType[]>([]);
  
  const [lastDrawAmount, setLastDrawAmount] = useState(DRAW_AMOUNT);

  // Animation States
  const [pollutedBufferIndex, setPollutedBufferIndex] = useState<number | null>(null);

  const [lastCombo, setLastCombo] = useState<string | null>(null);
  const [turn, setTurn] = useState<number>(1);
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // Input Lock
  const [combatLog, setCombatLog] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [enemyLunge, setEnemyLunge] = useState(false); 
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const [showComboList, setShowComboList] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  
  // 核心优化：增加菜单状态与回合倒计时系统
  const [showMenu, setShowMenu] = useState(false); 
  const TURN_LIMIT = 30;
  const [timeLeft, setTimeLeft] = useState(TURN_LIMIT);

  // --- CHECK WIN/LOSS ---
  useEffect(() => {
      if (player.currentHp <= 0 && !isGodMode) {
          onLose();
      } else if (enemy.currentHp <= 0) {
          onWin();
      } else if (combatType === 'EXTRACTION' && turn > 3) {
          // Survival Win Condition
          onWin();
      }
  }, [player.currentHp, enemy.currentHp, turn, combatType, isGodMode]);
  
  // Archive Modal State
  const [archiveCategory, setArchiveCategory] = useState<string>('ALL');

  // Card Drag State
  const [dragCardIndex, setDragCardIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Hover Lock (prevents sticky hover after play)
  const [isHoverDisabled, setIsHoverDisabled] = useState(false);

  // Flying Cards Animation State
  const [flyingCards, setFlyingCards] = useState<{
      id: number, 
      card: CardType, 
      isDrag: boolean, 
      xOffset: number, 
      yOffset: number,
      rotation?: number,
      dropX?: number,
      dropY?: number
  }[]>([]);

  // VFX State
  const [vfxList, setVfxList] = useState<VfxInstance[]>([]);
  const vfxIdCounter = useRef(0);

  const logTickerRef = useRef<HTMLDivElement>(null);

  const enemyRef = useRef(enemy);
  const playerRef = useRef(player);
  const handRef = useRef(hand); // 抓取最新手牌供倒计时使用

  useEffect(() => { enemyRef.current = enemy; }, [enemy]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { handRef.current = hand; }, [hand]);

  // 倒计时核心逻辑
  useEffect(() => {
      if (isPlayerTurn) setTimeLeft(TURN_LIMIT);
  }, [turn, isPlayerTurn]);

  const handleTimeOut = useCallback(() => {
      addLog('>> [系统] 神经链接过载，强制终止思考时间');
      let currentHand = [...handRef.current];
      // 如果超时且手牌超限，强制从右侧丢弃
      if (currentHand.length > HAND_SIZE) {
          currentHand = currentHand.slice(0, HAND_SIZE);
          setHand(currentHand);
          addLog(`>> [系统] 强制切断了最右侧的 ${handRef.current.length - HAND_SIZE} 个过载神经(丢弃卡牌)`);
      }
      setIsDiscarding(false);
      setIsHoverDisabled(true); 
      setTimeout(() => {
          setIsHoverDisabled(false);
          executeEnemyTurn();
      }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 故意省略 executeEnemyTurn 防止无限触发

  useEffect(() => {
      if (!isPlayerTurn || isProcessing || showMenu) return; // 思考锁定时或打开菜单时暂停倒计时
      const timer = setInterval(() => {
          setTimeLeft(prev => {
              if (prev <= 1) {
                  clearInterval(timer);
                  handleTimeOut();
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [isPlayerTurn, isProcessing, showMenu, handleTimeOut]);

  useEffect(() => {
    drawCards(HAND_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (player.currentHp <= 0) {
      onLose();
    } else if (enemy.currentHp <= 0) {
      onWin();
    }
  }, [player.currentHp, enemy.currentHp, onWin, onLose]);

  // --- AUTOMATIC BUFFER CHECKER ---
  useEffect(() => {
      if (buffer.length === 0) return;

      const checkBufferState = () => {
          const bufferStr = buffer.join('-');
          
          // 1. Check for Blueprints (Combos)
          const match = playerRef.current.blueprints.find(bp => {
              const seqStr = bp.sequence.join('-');
              return bufferStr.endsWith(seqStr);
          });

          if (match) {
              setIsProcessing(true); // LOCK INPUT
              setTimeout(() => executeBlueprint(match), 100); 
              return;
          }

          // 2. Check for Overflow
          if (buffer.length >= MAX_BUFFER_SIZE) {
               setIsProcessing(true); // LOCK INPUT
               addLog('>> 精神过载! 玩家受到 5 点反噬伤害');
               triggerShake('sm');
               triggerVfx('POISON', 50, 80); 
               if (!isGodMode) {
                   updatePlayer(prev => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 5) }));
               } else {
                   addLog('>> [GOD MODE] 伤害已免疫');
               }
               setTimeout(() => {
                   setBuffer([]); 
                   setIsProcessing(false); // UNLOCK
               }, 300); 
          }
      };

      checkBufferState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer]); 

  // --- VFX SYSTEM ---
  const triggerVfx = (type: VfxType, x: number, y: number, content?: string, color?: string, icon?: React.ReactNode) => {
      const id = vfxIdCounter.current++;
      const offsetX = (Math.random() - 0.5) * 10; 
      const offsetY = (Math.random() - 0.5) * 5;
      setVfxList(prev => [...prev, { id, type, x: x + offsetX, y: y + offsetY, content, color, icon }]);
      setTimeout(() => {
          setVfxList(prev => prev.filter(v => v.id !== id));
      }, 800); 
  };

  const addLog = (msg: string) => setCombatLog(prev => [msg, ...prev].slice(0, 30));

  const triggerShake = (intensity: 'sm' | 'lg' = 'sm') => {
    setShake(true);
    setScreenFlash(intensity === 'lg' ? 'bg-red-900/30' : null);
    setTimeout(() => {
        setShake(false);
        setScreenFlash(null);
    }, 400); 
  };

  // --- THORNS LOGIC (Reflect Damage) ---
  const checkEnemyThorns = () => {
      const thorns = enemyRef.current.statuses['THORNS'] || 0;
      if (thorns > 0) {
          if (isGodMode) {
              addLog(`>> [GOD MODE] 免疫荆棘反伤`);
              return;
          }

          triggerVfx('TEXT', 80, 50, `-${thorns}`, 'text-red-500', <LucideSprout size={20}/>);
          triggerShake('sm');
          setScreenFlash('bg-red-900/40');
          setTimeout(() => setScreenFlash(null), 200);
          addLog(`>> 受到荆棘反伤: -${thorns} HP`);

          updatePlayer(prev => {
               let dmg = thorns;
               let shield = prev.shield;
               let hp = prev.currentHp;
               
               // Thorns logic: Hits Shield first
               if (shield >= dmg) {
                   shield -= dmg;
                   dmg = 0;
               } else {
                   dmg -= shield;
                   shield = 0;
                   hp = Math.max(0, hp - dmg);
               }
               return { ...prev, shield, currentHp: hp };
          });
      }
  };

  const generateCard = (currentTurn: number, exclude: CardType[] = []): CardType => {
      // Logic simplified: No longer check for unlocked blueprints. 
      // All elemental cards have a chance to appear.
      let candidate: CardType;
      let attempts = 0;
      
      // Infinite loop protection (max 20 tries)
      do {
          const rand = Math.random();
          // Probabilities
          if (rand < 0.35) candidate = CardType.STRIKE;
          else if (rand < 0.60) candidate = CardType.BLOCK;
          else if (rand < 0.85) {
              // Element Pool (Fire, Ice, Thunder, Poison)
              const eRand = Math.random();
              if (eRand < 0.25) candidate = CardType.FIRE;
              else if (eRand < 0.50) candidate = CardType.ICE;
              else if (eRand < 0.75) candidate = CardType.THUNDER;
              else candidate = CardType.POISON;
          }
          else if (rand < 0.95) candidate = CardType.TECH;
          else candidate = CardType.MOVE;
          
          attempts++;
          if (attempts > 20) return CardType.STRIKE;
      } while (exclude.includes(candidate));
      
      return candidate;
  };

  const drawCards = (amount: number) => {
    setLastDrawAmount(amount);
    const newCards: HandCard[] = [];
    for (let i = 0; i < amount; i++) {
      newCards.push({
          id: `card-${Date.now()}-${Math.random()}`,
          type: generateCard(turn)
      });
    }
    setHand(prev => [...prev, ...newCards]);
  };

  const willCompleteCombo = (card: CardType): boolean => {
      const testBuffer = [...buffer, card];
      const bufferStr = testBuffer.join('-');
      return player.blueprints.some(bp => {
          const seqStr = bp.sequence.join('-');
          return bufferStr.endsWith(seqStr);
      });
  };

  const calculateDamageInfo = (baseDamage: number, target: Enemy): { damage: number, isShocked: boolean } => {
     let dmg = baseDamage;
     let isShocked = false;

     if ((playerRef.current.statuses['WEAK'] || 0) > 0) {
         dmg = Math.max(1, dmg - 1);
     }

     if ((target.statuses['SHOCK'] || 0) > 0) {
         dmg = Math.floor(dmg * 1.5);
         isShocked = true;
     }
     return { damage: dmg, isShocked };
  };

  const executeBlueprint = (bp: Blueprint) => {
    addLog(`>> 蓝图激活: ${bp.name}`);
    triggerShake('sm');
    setLastCombo(bp.name);
    
    // Clear buffer and UNLOCK rapidly
    setTimeout(() => {
        setBuffer([]); 
        setLastCombo(null);
        setIsProcessing(false); 
    }, 450);

    const currentEnemy = enemyRef.current;
    const currentPlayer = playerRef.current;
    const dmgBonus = currentPlayer.damageBonus || 0;
    
    let damage = bp.damage ? bp.damage + dmgBonus : 0; 
    let shield = bp.shield || 0;

    // --- Special Effect Handlers ---

    if (bp.id === 'blood_rend' && (currentEnemy.statuses['BLEED'] || 0) > 0) {
        damage *= 2;
        addLog('>> 处决! 伤害翻倍');
    }

    if (bp.special === 'EXECUTE_LOW_HP') {
         if (currentEnemy.currentHp < currentEnemy.maxHp * 0.5) {
             damage *= 2;
             addLog('>> 影袭处决! 目标虚弱，伤害翻倍');
             triggerVfx('SLASH', 50, 50, '斩杀', 'text-red-600');
         }
    }

    if (bp.special === 'EXECUTE_CORRUPTION') {
        // SELF-PRIMING LOGIC: Apply 2 stacks first
        const primeAmount = 2;
        addLog(`>> 禁咒前置: 腐化 +${primeAmount}`);
        triggerVfx('TEXT', 50, 50, `腐化 +${primeAmount}`, 'text-purple-500', <LucideSkull size={20}/>);
        
        // Calculate total stacks (existing + prime)
        const stacks = (currentEnemy.statuses['CORRUPTION'] || 0) + primeAmount;
        const corruptionDmg = stacks * 10;
        damage += corruptionDmg;

        setEnemy(prev => ({ 
            ...prev, 
            statuses: { ...prev.statuses, CORRUPTION: 0 } 
        }));
        
        addLog(`>> 禁咒引爆! ${corruptionDmg} 伤害 (消耗${stacks}层)`);
        triggerVfx('POISON', 50, 30, `${corruptionDmg}`, 'text-purple-400', <LucideSkull size={20}/>);
    }

    if (bp.special === 'PERCENT_HP_DMG') {
        const hpDmg = Math.floor(currentEnemy.maxHp * 0.15);
        damage += hpDmg;
        addLog(`>> 旧日禁咒: 造成 ${hpDmg} (15%) 伤害`);
        
        // Self Damage
        if (!isGodMode) {
             updatePlayer(prev => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 5) }));
             addLog('>> 反噬: -5 HP');
             triggerShake('lg');
        }
    }

    if (bp.special === 'PIERCE_DMG') {
         // Assuming base damage calc handles basic reduction, but pierce usually ignores shield?
         // In this game enemy has no shield mechanic yet, so it acts as true damage or high base.
         damage = 15 + dmgBonus; // Override base
         addLog('>> 超导爆破: 穿透伤害!');
         triggerVfx('THUNDER', 50, 50);
    }

    if (bp.special === 'DISCARD_HAND_DMG') {
         const count = hand.length;
         const bonus = count * 3;
         damage = 15 + bonus;
         addLog(`>> 薪火爆燃: 消耗 ${count} 张手牌, +${bonus} 伤害`);
         setHand([]); // Discard all
         triggerVfx('BURN', 50, 50, '燃尽', 'text-orange-500');
    }

    if (bp.special === 'CONSUME_GLITCH_DMG') {
         // Count glitches in hand
         const glitches = hand.filter(c => c.type === CardType.GLITCH || c.type === CardType.TENTACLE);
         const count = glitches.length;
         const trueDmg = count * 5;
         
         if (count > 0) {
             damage += trueDmg;
             // Remove glitches
             setHand(prev => prev.filter(c => c.type !== CardType.GLITCH && c.type !== CardType.TENTACLE));
             addLog(`>> 燃尽灰烬: 焚烧 ${count} 张负面牌, +${trueDmg} 伤害`);
             triggerVfx('BURN', 50, 50, `${trueDmg}`, 'text-orange-500');
         } else {
             addLog('>> 燃尽灰烬: 无负面牌可烧');
         }
    }

    if (bp.special === 'THUNDER_BURST') {
        // Prime shock +3
        const prime = 3;
        triggerVfx('THUNDER', 50, 50, `感电 +${prime}`, undefined, <LucideZap size={24}/>);
        setEnemy(prev => ({ ...prev, statuses: { ...prev.statuses, SHOCK: (prev.statuses['SHOCK'] || 0) + prime } }));
        
        // 3 Hits of 3 Damage
        addLog('>> 雷霆风暴: 3连击!');
        let totalBurst = 0;
        
        // Execute delayed hits visually
        const hitDmg = 3 + dmgBonus;
        
        setTimeout(() => {
             // Hit 1
             let e = enemyRef.current;
             const { damage: d1 } = calculateDamageInfo(hitDmg, e);
             totalBurst += d1;
             triggerVfx('THUNDER', 40, 40, `${d1}`);
        }, 100);
        setTimeout(() => {
             // Hit 2
             let e = enemyRef.current;
             const { damage: d2 } = calculateDamageInfo(hitDmg, e);
             totalBurst += d2;
             triggerVfx('THUNDER', 60, 40, `${d2}`);
        }, 250);
        setTimeout(() => {
             // Hit 3
             let e = enemyRef.current;
             const { damage: d3 } = calculateDamageInfo(hitDmg, e);
             totalBurst += d3;
             triggerVfx('THUNDER', 50, 60, `${d3}`);
             
             // Apply Total
             setEnemy(prev => ({ ...prev, currentHp: Math.max(0, prev.currentHp - totalBurst) }));
        }, 400);

        damage = 0; // Handled manually
    }
    
    if (bp.special === 'THUNDER_DETONATE') {
        addLog(`>> 雷暴引爆: 积蓄电荷中...`);
        // 1. Apply priming Shock (2 stacks)
        const primeAmount = 2;
        triggerVfx('THUNDER', 50, 50, `感电 +${primeAmount}`, undefined, <LucideZap size={24}/>);
        
        const stacks = (currentEnemy.statuses['SHOCK'] || 0) + primeAmount;
        const totalDmg = stacks * 6; // New damage formula: 6 per stack

        // 2. Detonate
        if (totalDmg > 0) {
             addLog(`>> 轰鸣! 引爆 ${stacks} 层感电: ${totalDmg} 伤害`);
             
             triggerVfx('THUNDER', 50, 20);
             setTimeout(() => triggerVfx('THUNDER', 40, 40), 100);
             setTimeout(() => triggerVfx('THUNDER', 60, 40), 200);
             
             triggerVfx('TEXT', 50, 30, `${totalDmg}`, 'text-yellow-400', <LucideZap size={28}/>);
             triggerShake('lg');

             setEnemy(prev => ({ 
                ...prev, 
                currentHp: Math.max(0, prev.currentHp - totalDmg),
                statuses: { ...prev.statuses, SHOCK: 0 } // Consume all shock
             }));
             damage = 0; // Prevent base damage logic
        } else {
             // Fallback if no shock stacks (shouldn't happen with priming)
             setEnemy(prev => ({
                 ...prev,
                 statuses: { ...prev.statuses, SHOCK: stacks }
             }));
        }
    }

    if (bp.special === 'CONVERT_POISON_TO_BURN') {
         const poison = currentEnemy.statuses['POISON'] || 0;
         if (poison > 0) {
             setEnemy(prev => ({
                 ...prev,
                 statuses: { 
                     ...prev.statuses, 
                     POISON: 0, 
                     BURN: (prev.statuses['BURN'] || 0) + poison 
                 }
             }));
             addLog(`>> 毒火相攻: 转化 ${poison} 层中毒为燃烧`);
             triggerVfx('BURN', 50, 50, `燃烧 +${poison}`);
         }
    }

    if (bp.special === 'DOUBLE_POISON') {
         const poison = currentEnemy.statuses['POISON'] || 0;
         if (poison > 0) {
             setEnemy(prev => ({
                 ...prev,
                 statuses: { ...prev.statuses, POISON: poison * 2 }
             }));
             addLog(`>> 化学催化: 中毒层数翻倍 (${poison} -> ${poison * 2})`);
             triggerVfx('POISON', 50, 50, `x2`);
         }
    }

    if (bp.special === 'WEAKEN_ATTACK') {
        const intent = currentEnemy.intents[0];
        if (intent && intent.type === 'ATTACK') {
            addLog('>> 神经毒素: 削弱敌方攻击意图');
            triggerVfx('DEBUFF', 50, 20, '削弱', 'text-stone-400');
            setEnemy(prev => {
                const newIntents = [...prev.intents];
                if (newIntents[0]) {
                    newIntents[0] = { ...newIntents[0], value: Math.floor(newIntents[0].value * 0.7) }; // Reduce by 30%
                }
                return { ...prev, intents: newIntents };
            });
        }
    }

    // --- UTILITY SPECIALS ---

    if (bp.special === 'CLEANSE') {
        addLog('>> 净化: 缓冲区污染已清除');
        triggerVfx('BUFF', 50, 80);
    }
    
    if (bp.special === 'FREEZE') {
        setEnemy(prev => ({
            ...prev,
            statuses: { ...prev.statuses, FROZEN: 1 }
        }));
        addLog('>> 极寒凝视: 敌人被冻结！');
        triggerVfx('FREEZE', 50, 30);
    }

    if (bp.special === 'ABSOLUTE_DOMAIN') {
         updatePlayer(prev => ({
             ...prev,
             statuses: { ...prev.statuses, DOMAIN: 1 }
         }));
         addLog('>> 绝对领域: 护甲展开');
         triggerVfx('BLOCK', 50, 80, '领域', 'text-blue-300');
    }

    if (bp.special === 'DOUBLE_CAST') {
        updatePlayer(prev => ({
             ...prev,
             statuses: { ...prev.statuses, ECHO: 1 }
        }));
        addLog('>> 冰霜新星: 下次基础牌双重施法');
        triggerVfx('BUFF', 50, 80, '回响', 'text-cyan-300');
    }

    if (bp.special === 'BYPASS_BUFFER') {
        updatePlayer(prev => ({
             ...prev,
             statuses: { ...prev.statuses, FLOW: 1 }
        }));
        addLog('>> 迅雷身法: 进入心流状态');
        triggerVfx('BUFF', 50, 80, '心流', 'text-yellow-300');
    }

    if (bp.special === 'HEAL') {
      triggerVfx('HEAL', 20, 80);
      updatePlayer(prev => ({ ...prev, currentHp: Math.min(prev.maxHp, prev.currentHp + 5) }));
    } 
    
    if (bp.special === 'DRAW' || (bp.id === 'brain_storm' && !bp.special) || (bp.id === 'tactical_avoid' && !bp.special)) {
      // Handle generic draw or specific ID overrides
      const amount = bp.id === 'brain_storm' ? 4 : (bp.id === 'tactical_avoid' ? 1 : 2);
      triggerVfx('BUFF', 50, 80);
      drawCards(amount); 
    }

    // Apply Standard Damage
    if (damage > 0) {
      const { damage: finalDmg, isShocked } = calculateDamageInfo(damage, currentEnemy);
      
      if (isShocked) addLog(`>> 感电易伤! 伤害 +50%`);
      if ((playerRef.current.statuses['WEAK'] || 0) > 0) addLog(`>> 虚弱: 伤害降低`);

      if (bp.id.includes('blazing')) triggerVfx('BURN', 50, 30);
      else if (bp.id.includes('thunder')) triggerVfx('THUNDER', 50, 30);
      else triggerVfx('SLASH', 50, 30); 
      
      triggerVfx('TEXT', 50, 20, `-${finalDmg}`, 'text-dungeon-red', isShocked ? <LucideZap size={20}/> : <LucideSword size={20}/>);
      
      setEnemy(prev => {
          let nextShock = prev.statuses['SHOCK'] || 0;
          if (isShocked) nextShock = Math.max(0, nextShock - 1);

          return { 
              ...prev, 
              currentHp: Math.max(0, prev.currentHp - finalDmg),
              statuses: { ...prev.statuses, SHOCK: nextShock }
          };
      });
      // TRIGGER THORNS ON DAMAGE BLUEPRINTS
      checkEnemyThorns();
    }

    if (shield > 0) {
      triggerVfx('BLOCK', 20, 75); 
      triggerVfx('TEXT', 20, 70, `+${shield}`, 'text-stone-300', <LucideShield size={20}/>);
      updatePlayer(prev => ({ ...prev, shield: prev.shield + shield }));
    }

    if (bp.statusEffect) {
        const { type, amount } = bp.statusEffect;
        
        if (type === 'DRAW_NEXT') {
             updatePlayer(prev => ({
                 ...prev,
                 statuses: { ...prev.statuses, DRAW_BONUS: (prev.statuses['DRAW_BONUS'] || 0) + amount }
             }));
             addLog(`>> 战术预备: 下回合抽牌 +${amount}`);
             triggerVfx('BUFF', 20, 75);
        } else {
             setEnemy(prev => ({
                ...prev,
                statuses: {
                    ...prev.statuses,
                    [type]: (prev.statuses[type] || 0) + amount
                }
            }));
            
            // Explicitly set Chinese Text for VFX
            if (type === 'BURN') triggerVfx('BURN', 50, 50, `燃烧 +${amount}`, undefined, <LucideFlame size={20}/>);
            else if (type === 'POISON') triggerVfx('POISON', 50, 50, `中毒 +${amount}`, undefined, <LucideBiohazard size={20}/>);
            else if (type === 'SHOCK') triggerVfx('THUNDER', 50, 50, `感电 +${amount}`, undefined, <LucideZap size={20}/>);
            else if (type === 'BLEED') triggerVfx('TEXT', 50, 50, `流血 +${amount}`, 'text-red-500', <LucideDroplets size={20}/>);
            else if (type === 'CORRUPTION') triggerVfx('TEXT', 50, 50, `腐化 +${amount}`, 'text-purple-500', <LucideSkull size={20}/>);
            else if (type === 'FROZEN') triggerVfx('FREEZE', 50, 50, `冻结 +${amount}`, undefined, <LucideSnowflake size={20}/>);
            else triggerVfx('POISON', 60, 30);
        }
    }
  };

  const playCard = (index: number, isDragPlay: boolean = false, dropPos?: {x: number, y: number}) => {
    if (!isPlayerTurn || isDiscarding || isProcessing) return;

    // LOCK INPUT to prevent double-tap or sticky hover issues on mobile
    setIsHoverDisabled(true);
    setTimeout(() => setIsHoverDisabled(false), 200); 

    const cardObj = hand[index];
    const card = cardObj.type;

    // --- Special Status Check: DOUBLE CAST (Echo) ---
    const isEcho = (playerRef.current.statuses['ECHO'] || 0) > 0;
    // Only basic cards trigger echo usually, let's allow all for fun but limit it
    const shouldEcho = isEcho && [CardType.STRIKE, CardType.BLOCK, CardType.FIRE, CardType.ICE, CardType.THUNDER, CardType.POISON].includes(card);
    
    // --- Special Status Check: BYPASS BUFFER (Flow) ---
    const isFlow = (playerRef.current.statuses['FLOW'] || 0) > 0;

    // Remove status if used
    if (shouldEcho) updatePlayer(prev => ({ ...prev, statuses: { ...prev.statuses, ECHO: 0 } }));
    if (isFlow) updatePlayer(prev => ({ ...prev, statuses: { ...prev.statuses, FLOW: 0 } }));

    // VFX Setup
    const flyId = Date.now() + Math.random();
    if (isDragPlay && dropPos) {
        setFlyingCards(prev => [...prev, { id: flyId, card: card, isDrag: true, xOffset: 0, yOffset: 0, dropX: dropPos.x, dropY: dropPos.y }]);
    } else {
        const { xOffset, yOffset, rotation } = getCardCalculations(index, hand.length);
        setFlyingCards(prev => [...prev, { id: flyId, card: card, isDrag: false, xOffset, yOffset, rotation }]);
    }
    setTimeout(() => setFlyingCards(prev => prev.filter(c => c.id !== flyId)), 500);

    let currentHand = [...hand];
    currentHand.splice(index, 1);
    setHand(currentHand); 
    
    // Function to execute single card effect
    const executeCardEffect = (c: CardType) => {
        const dmgBonus = playerRef.current.damageBonus || 0;
        const shieldBonus = playerRef.current.shieldBonus || 0;
        const currentEnemy = enemyRef.current;

        if (c === CardType.STRIKE) {
          const dmg = 2 + dmgBonus;
          const { damage: finalDmg, isShocked } = calculateDamageInfo(dmg, currentEnemy);
          
          triggerVfx('SLASH', 50, 30);
          triggerVfx('TEXT', 50, 20, `-${finalDmg}`, 'text-dungeon-red', isShocked ? <LucideZap size={20}/> : <LucideSword size={20}/>);
          if (isShocked) triggerVfx('TEXT', 50, 50, '暴击!', 'text-yellow-400');
          
          setScreenFlash('bg-red-900/20');
          setTimeout(() => setScreenFlash(null), 100);

          setEnemy(prev => {
              let nextShock = prev.statuses['SHOCK'] || 0;
              if (isShocked) nextShock = Math.max(0, nextShock - 1);
              return { 
                  ...prev, 
                  currentHp: Math.max(0, prev.currentHp - finalDmg),
                  statuses: { ...prev.statuses, SHOCK: nextShock }
          };
          });
          checkEnemyThorns();
        } 
        else if (c === CardType.BLOCK) {
          const blk = 2 + shieldBonus;
          triggerVfx('BLOCK', 20, 75);
          triggerVfx('TEXT', 20, 65, `+${blk}`, 'text-stone-300', <LucideShield size={20}/>);
          setScreenFlash('bg-stone-500/10');
          setTimeout(() => setScreenFlash(null), 100);
          updatePlayer(prev => ({ ...prev, shield: prev.shield + blk }));
        } 
        else if (c === CardType.TECH) {
           triggerVfx('BUFF', 50, 80);
           triggerVfx('TEXT', 50, 70, '战术', 'text-amber-400', <LucideBookOpen size={20}/>);
           const newCardType = generateCard(turn, [CardType.TECH]);
           setTimeout(() => setHand(h => [...h, { id: `card-${Date.now()}-extra`, type: newCardType }]), 100);
        } 
        else if (c === CardType.MOVE) {
            triggerVfx('GHOST', 20, 75);
            triggerVfx('TEXT', 20, 65, '闪避', 'text-emerald-400', <LucideGhost size={20}/>);
            setScreenFlash('bg-emerald-900/20');
            setTimeout(() => setScreenFlash(null), 100);
            updatePlayer(prev => ({
                ...prev,
                statuses: { ...prev.statuses, DODGE: (prev.statuses['DODGE'] || 0) + 1 }
            }));
            addLog('>> 准备闪避姿态');
        } 
        else if (c === CardType.FIRE) {
            triggerVfx('BURN', 50, 40);
            triggerVfx('TEXT', 50, 30, '燃烧 +2', 'text-orange-500', <LucideFlame size={20}/>);
            setScreenFlash('bg-orange-600/20');
            setTimeout(() => setScreenFlash(null), 150);
            setEnemy(prev => ({
                ...prev,
                statuses: { ...prev.statuses, BURN: (prev.statuses['BURN'] || 0) + 2 }
            }));
            addLog('>> 余烬: 燃烧 +2 回合');
        } 
        else if (c === CardType.ICE) {
            const blk = 2 + shieldBonus;
            triggerVfx('FREEZE', 20, 75);
            triggerVfx('TEXT', 20, 65, `+${blk}`, 'text-cyan-300', <LucideSnowflake size={20}/>);
            setScreenFlash('bg-cyan-600/20');
            setTimeout(() => setScreenFlash(null), 150);
            updatePlayer(prev => ({ ...prev, shield: prev.shield + blk }));
        } 
        else if (c === CardType.THUNDER) {
            const dmg = 2 + dmgBonus;
            const { damage: finalDmg, isShocked } = calculateDamageInfo(dmg, currentEnemy);
            triggerVfx('THUNDER', 50, 30);
            triggerVfx('TEXT', 50, 20, `-${finalDmg}`, 'text-yellow-400', isShocked ? <LucideZap size={20}/> : <LucideSword size={20}/>);
            setTimeout(() => {
                triggerVfx('TEXT', 60, 30, '感电 +1', 'text-yellow-300', <LucideZap size={16}/>);
            }, 100);
            setScreenFlash('bg-yellow-500/20');
            setTimeout(() => setScreenFlash(null), 100);
            setEnemy(prev => {
                 let nextShock = prev.statuses['SHOCK'] || 0;
                 if (isShocked) nextShock = Math.max(0, nextShock - 1); 
                 nextShock += 1; 
                 return { 
                    ...prev, 
                    currentHp: Math.max(0, prev.currentHp - finalDmg),
                    statuses: { ...prev.statuses, SHOCK: nextShock } 
                };
            });
            addLog('>> 雷击: 施加 1 层感电');
            checkEnemyThorns();
        } 
        else if (c === CardType.POISON) {
            triggerVfx('POISON', 50, 40);
            triggerVfx('TEXT', 50, 30, '中毒 +2', 'text-lime-500', <LucideBiohazard size={20}/>);
            setScreenFlash('bg-lime-600/20');
            setTimeout(() => setScreenFlash(null), 150);
            setEnemy(prev => ({
                ...prev,
                statuses: { ...prev.statuses, POISON: (prev.statuses['POISON'] || 0) + 2 }
            }));
            addLog('>> 毒液: 施加 2 层中毒');
        }
    };

    // Glitch Special Handling: Only apply negative effect if it DOES NOT form a blueprint
    if (card === CardType.GLITCH) {
       // Check if this glitch completes or starts a blueprint sequence
       const tempBuffer = [...buffer, card];
       const bufferStr = tempBuffer.join('-');
       
       // Does this card COMPLETE a combo?
       const completesCombo = player.blueprints.some(bp => {
          const seqStr = bp.sequence.join('-');
          return bufferStr.endsWith(seqStr);
       });

       if (completesCombo) {
           addLog('>> 精神崩坏被引导...');
           // It enters buffer below, effectively playing it "safely" via combo logic
       } else {
           // Does this card START or CONTINUE a combo?
           // We check if the current buffer + this glitch is a PREFIX of any blueprint.
           const continuesCombo = player.blueprints.some(bp => {
               const seqStr = bp.sequence.join('-');
               return seqStr.startsWith(bufferStr);
           });

           if (continuesCombo) {
               addLog('>> 精神崩坏: 强制接入序列 (-2 HP)');
               if (!isGodMode) updatePlayer(prev => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 2) }));
               triggerShake('sm');
               // Allow entry to buffer to try and finish the curse (e.g. Force Reject or Forbidden Curse)
           } else {
              addLog('>> 精神崩坏! 序列已重置');
              triggerShake('sm');
              triggerVfx('POISON', 50, 80);
              triggerVfx('TEXT', 50, 70, '错误', 'text-fuchsia-500', <LucideBrain size={24}/>);
              
              if (!isGodMode) {
                  updatePlayer(prev => ({ ...prev, currentHp: Math.max(0, prev.currentHp - 2) })); 
              } else {
                  addLog('>> [GOD MODE] 伤害已免疫');
              }
              setBuffer([]); 
              return; 
           }
       }
    }

    // Execute effect
    executeCardEffect(card);
    if (shouldEcho) {
        setTimeout(() => {
            addLog('>> 回响: 双重施法!');
            executeCardEffect(card);
        }, 300);
    }

    // Buffer Logic
    if (!isFlow) {
        const newBuffer = [...buffer, card];
        setBuffer(newBuffer);
    } else {
        addLog('>> 心流: 卡牌未进入序列');
    }
  };

  const playCardRef = useRef(playCard);
  useEffect(() => {
      playCardRef.current = playCard;
  });

  const handleCardPointerDown = (e: React.PointerEvent, index: number) => {
      if (isDiscarding || !isPlayerTurn || isProcessing) return;
      e.preventDefault();
      setDragCardIndex(index);
      setDragOffset({ x: 0, y: 0 });
      dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
      const handleGlobalPointerMove = (e: PointerEvent) => {
          if (dragCardIndex === null) return;
          const deltaX = e.clientX - dragStartPos.current.x;
          const deltaY = e.clientY - dragStartPos.current.y;
          setDragOffset({ x: deltaX, y: deltaY });
      };

      const handleGlobalPointerUp = (e: PointerEvent) => {
          if (dragCardIndex === null) return;
          const deltaY = e.clientY - dragStartPos.current.y;
          const totalDist = Math.hypot(e.clientX - dragStartPos.current.x, deltaY);
          if (deltaY < -80) {
              playCardRef.current(dragCardIndex, true, { x: e.clientX, y: e.clientY });
          } else if (totalDist < 30) { // Increased tolerance from 10 to 30 for easier tapping
              playCardRef.current(dragCardIndex, false);
          }
          setDragCardIndex(null);
          setDragOffset({ x: 0, y: 0 });
      };

      if (dragCardIndex !== null) {
          window.addEventListener('pointermove', handleGlobalPointerMove);
          window.addEventListener('pointerup', handleGlobalPointerUp);
      }
      return () => {
          window.removeEventListener('pointermove', handleGlobalPointerMove);
          window.removeEventListener('pointerup', handleGlobalPointerUp);
      };
  }, [dragCardIndex]);

  const handleDiscardCard = (index: number) => {
    if (!isDiscarding) return;
    const newHand = [...hand];
    const removedCard = newHand.splice(index, 1)[0];
    setHand(newHand);
    addLog(`>> 丢弃: ${CARD_DEFINITIONS[removedCard.type].name}`);

    if (newHand.length <= HAND_SIZE) {
        setIsDiscarding(false);
        executeEnemyTurn();
    }
  };

  const attemptEndTurn = () => {
      if (hand.length > HAND_SIZE) {
          setIsDiscarding(true);
          addLog(`>> 手牌上限! 需丢弃 ${hand.length - HAND_SIZE} 张`);
          return;
      }
      executeEnemyTurn();
  };

  const cancelDiscard = () => {
      setIsDiscarding(false);
      addLog('>> 取消结束回合，继续行动');
  };

  const decideNextIntent = (currentTurnEnemy: Enemy, currentPlayer: PlayerStats): EnemyIntent => {
     const playerHpPct = currentPlayer.currentHp / currentPlayer.maxHp;
     const enemyHpPct = currentTurnEnemy.currentHp / currentTurnEnemy.maxHp;
     const turnCount = turn;
     
     const stageBonus = Math.floor((currentStage - 1) * 0.5); 
     const turnBonus = Math.floor(turnCount / 3); 

     if (enemyHpPct < 0.25) {
         return Math.random() < 0.5 
            ? { type: 'HEAL', value: 4 + stageBonus, description: '再生', turnsRemaining: 1 } 
            : { type: 'ATTACK', value: 5 + stageBonus + turnBonus, description: '绝境反击', turnsRemaining: 1 };
     }

     if (playerHpPct < 0.20) {
         return { type: 'ATTACK', value: 6 + stageBonus, description: '处决', turnsRemaining: 1 };
     }
     
     const roll = Math.random();
     if (turnCount > 1 && roll < 0.35) { 
         const subRoll = Math.random();
         if (subRoll < 0.2) {
             return { type: 'POLLUTE', value: 0, description: '精神污染', turnsRemaining: 1 };
         } else if (subRoll < 0.5) { 
             return Math.random() > 0.5 
                ? { type: 'DEBUFF', value: 0, description: '腐蚀', turnsRemaining: 1 }
                : { type: 'DEBUFF', value: 0, description: '虚弱', turnsRemaining: 1 };
         } else if (subRoll < 0.9) { 
             return Math.random() > 0.5
                ? { type: 'BUFF', value: 2, description: '狂暴', turnsRemaining: 1 } 
                : { type: 'BUFF', value: 2, description: '硬化', turnsRemaining: 1 }; 
         } else {
             return { type: 'POLLUTE', value: 0, description: '异化', turnsRemaining: 1 };
         }
     }
     
     if (roll < 0.6) {
         return { type: 'ATTACK', value: 3 + stageBonus + turnBonus, description: '攻击', turnsRemaining: 1 };
     } else if (roll < 0.85) {
         return { type: 'ATTACK', value: 4 + stageBonus + turnBonus, description: '重击', turnsRemaining: 2 };
     } else {
         return { type: 'HEAL', value: 3 + stageBonus, description: '整顿', turnsRemaining: 1 };
     }
  };

  const finishTurn = () => {
    setTurn(t => t + 1);
    
    setTimeout(() => {
        // Status checks
        updatePlayer(prev => {
            let hp = prev.currentHp;
            let sts = { ...prev.statuses };
            
            // Check Absolute Domain (If Shield > 0, bonus draw)
            if ((sts['DOMAIN'] || 0) > 0) {
                if (prev.shield > 0) {
                    sts['DRAW_BONUS'] = (sts['DRAW_BONUS'] || 0) + 2;
                    addLog('>> 绝对领域生效: 护甲未破，下回合抽牌 +2');
                } else {
                    addLog('>> 绝对领域失效: 护甲已破');
                }
                sts['DOMAIN'] = 0; // Consumed
            }

            if ((sts['CORROSION'] || 0) > 0) {
                const dmg = isGodMode ? 0 : 2;
                addLog(`>> 腐蚀伤害: -${dmg} HP`);
                triggerVfx('TEXT', 50, 80, `-${dmg}`, 'text-lime-600', <LucideBiohazard size={20}/>);
                hp = Math.max(0, hp - dmg);
                sts['CORROSION'] -= 1;
            }
            if ((sts['WEAK'] || 0) > 0) sts['WEAK'] -= 1;

            return { ...prev, currentHp: hp, statuses: sts };
        });

        // Draw cards
        const bonusDraw = playerRef.current.statuses['DRAW_BONUS'] || 0;
        if (bonusDraw > 0) {
            addLog(`>> 战术生效: 额外抽取 ${bonusDraw} 张牌`);
            updatePlayer(prev => ({ ...prev, statuses: { ...prev.statuses, DRAW_BONUS: 0 } }));
        }

        drawCards(DRAW_AMOUNT + bonusDraw);
        setIsPlayerTurn(true);
        addLog(`>> 第 ${turn + 1} 回合`);
    }, 400);
  };

  const executeEnemyTurn = async () => {
    setIsPlayerTurn(false);
    addLog('>> ------------------');
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // DOTS Logic
    if ((enemyRef.current.statuses['BLEED'] || 0) > 0) {
        const bleedDmg = enemyRef.current.statuses['BLEED'];
        setEnemy(prev => ({
             ...prev, 
             currentHp: Math.max(0, prev.currentHp - bleedDmg),
             statuses: { ...prev.statuses, BLEED: Math.max(0, bleedDmg - 1) } 
        }));
        addLog(`>> 敌方流血: -${bleedDmg} HP`);
        triggerVfx('TEXT', 50, 30, `-${bleedDmg}`, 'text-dungeon-red', <LucideDroplets size={24} className="text-red-600"/>);
        await wait(600);
    }

    if ((enemyRef.current.statuses['BURN'] || 0) > 0) {
        const burnDmg = 2; 
        setEnemy(prev => ({
             ...prev, 
             currentHp: Math.max(0, prev.currentHp - burnDmg),
             statuses: { ...prev.statuses, BURN: Math.max(0, prev.statuses['BURN'] - 1) } 
        }));
        addLog(`>> 敌方燃烧: -${burnDmg} HP`);
        triggerVfx('BURN', 50, 30);
        triggerVfx('TEXT', 50, 40, `-${burnDmg}`, 'text-orange-500', <LucideFlame size={24} className="text-orange-500"/>);
        await wait(600);
    }
    
    if ((enemyRef.current.statuses['POISON'] || 0) > 0) {
        const poisonDmg = enemyRef.current.statuses['POISON']; 
        setEnemy(prev => ({
             ...prev, 
             currentHp: Math.max(0, prev.currentHp - poisonDmg),
             statuses: { ...prev.statuses, POISON: Math.max(0, prev.statuses['POISON'] - 1) } 
        }));
        addLog(`>> 敌方中毒: -${poisonDmg} HP`);
        triggerVfx('POISON', 50, 30);
        triggerVfx('TEXT', 50, 40, `-${poisonDmg}`, 'text-lime-500', <LucideBiohazard size={24} className="text-lime-500"/>);
        await wait(600);
    }

    // Action Logic
    if ((enemyRef.current.statuses['FROZEN'] || 0) > 0) {
        addLog('>> 敌人被冻结，无法行动！');
        triggerVfx('FREEZE', 50, 50);
        setEnemy(prev => ({
            ...prev,
            statuses: { ...prev.statuses, FROZEN: Math.max(0, (prev.statuses['FROZEN'] || 0) - 1) },
            currentIntentIndex: 0
        }));
        finishTurn();
        return;
    }

    const intent = enemyRef.current.intents[0];
    addLog(`>> 敌方行动: ${intent.description}`);
    
    let attackDamage = 0;

    if (intent.type === 'ATTACK') {
      const strength = enemyRef.current.statuses['STRENGTH'] || 0;
      attackDamage = intent.value + strength;
      if (strength > 0) {
          addLog(`>> 狂暴加成: +${strength} 伤害`);
      }
      
      setEnemyLunge(true); 
      setTimeout(() => setEnemyLunge(false), 200);
      triggerShake('lg');
    } else if (intent.type === 'HEAL') {
        setEnemy(prev => ({
            ...prev, 
            currentHp: Math.min(prev.maxHp, prev.currentHp + intent.value)
        }));
        addLog(`>> 敌方回复: +${intent.value} HP`);
        triggerVfx('HEAL', 50, 30);
        triggerVfx('TEXT', 50, 20, `+${intent.value}`, 'text-green-500', <LucideHeart size={20}/>);
    } else if (intent.type === 'BUFF') {
       if (intent.description === '狂暴') {
           setEnemy(prev => ({
               ...prev,
               statuses: { ...prev.statuses, STRENGTH: (prev.statuses['STRENGTH'] || 0) + intent.value }
           }));
           addLog(`>> 敌方狂暴: 攻击力 +${intent.value}`);
           triggerVfx('BUFF', 50, 30, '狂暴', 'text-red-500', <LucideTrendingUp size={24}/>);
       } else if (intent.description === '硬化') {
           setEnemy(prev => ({
               ...prev,
               statuses: { ...prev.statuses, THORNS: (prev.statuses['THORNS'] || 0) + intent.value }
           }));
           addLog(`>> 敌方硬化: 荆棘 +${intent.value}`);
           triggerVfx('BUFF', 50, 30, '硬化', 'text-stone-400', <LucideSprout size={24}/>);
       } else {
           setEnemy(prev => ({
               ...prev,
               statuses: { ...prev.statuses, STRENGTH: (prev.statuses['STRENGTH'] || 0) + 1 }
           }));
           addLog(`>> 敌方强化: 力量 +1`);
           triggerVfx('BUFF', 50, 30, '强化', 'text-red-400', <LucideTrendingUp size={24}/>);
       }
    } else if (intent.type === 'POLLUTE') {
        if (intent.description === '精神污染') {
             addLog('>> 警告: 精神入侵中...');
             const validIndices = hand.map((c, i) => c.type !== CardType.GLITCH ? i : -1).filter(i => i !== -1);
             const targetIdx = validIndices.length > 0 ? validIndices[Math.floor(Math.random() * validIndices.length)] : -1;
             
             if (targetIdx !== -1) {
                 setHand(prev => prev.map((c, i) => i === targetIdx ? { ...c, isPolluting: true } : c));
                 triggerVfx('POISON', 50, 80);
                 await wait(800);
                 setHand(prevHand => {
                    const newHand = [...prevHand];
                    if (newHand[targetIdx]) {
                        newHand[targetIdx] = { ...newHand[targetIdx], type: CardType.GLITCH, isPolluting: false }; 
                    }
                    return newHand;
                 });
                 addLog('>> 你的手牌被污染了!');
                 triggerShake('sm');
             } else {
                 if (hand.length < HAND_SIZE + 2) { 
                     triggerVfx('POISON', 50, 80);
                     await wait(400); 
                     setHand(prev => [...prev, { id: `glitch-${Date.now()}`, type: CardType.GLITCH }]);
                     addLog('>> 你的思维被迫接受了杂音!');
                     triggerShake('sm');
                 }
             }

        } else {
            addLog('>> 警告: 缓冲区被侵蚀中...');
            const targetIdx = buffer.length < MAX_BUFFER_SIZE ? buffer.length : Math.floor(Math.random() * buffer.length);
            setPollutedBufferIndex(targetIdx);
            triggerVfx('POISON', 50, 50);
            await wait(800);
            setBuffer(prev => {
                const newBuff = [...prev];
                if (targetIdx >= prev.length) newBuff.push(CardType.TENTACLE);
                else newBuff[targetIdx] = CardType.TENTACLE;
                return newBuff;
            });
            setPollutedBufferIndex(null); 
            addLog('>> 序列被强制修改!');
            triggerShake('sm');
        }
    } else if (intent.type === 'DEBUFF') {
        if (intent.description === '腐蚀') {
            updatePlayer(prev => ({
                ...prev,
                statuses: { ...prev.statuses, CORROSION: (prev.statuses['CORROSION'] || 0) + 3 }
            }));
            addLog('>> 受到腐蚀: 每回合损失生命');
            triggerShake('sm');
            setScreenFlash('bg-lime-900/30 animate-pulse'); 
            setTimeout(() => setScreenFlash(null), 600);
            triggerVfx('POISON', 50, 50); 
            setTimeout(() => {
                 triggerVfx('TEXT', 50, 80, '腐蚀', 'text-lime-400 font-bold', <LucideBiohazard size={32}/>);
            }, 200);

        } else {
            updatePlayer(prev => ({
                ...prev,
                statuses: { ...prev.statuses, WEAK: (prev.statuses['WEAK'] || 0) + 2 }
            }));
            addLog('>> 受到虚弱: 攻击力降低');
            triggerShake('sm');
            setScreenFlash('bg-stone-800/40');
            setTimeout(() => setScreenFlash(null), 600);
            triggerVfx('GHOST', 50, 50); 
            setTimeout(() => {
                triggerVfx('TEXT', 50, 80, '虚弱', 'text-stone-400 font-bold', <LucideHeartCrack size={32}/>);
            }, 200);
        }
    }

    updatePlayer(prevPlayer => {
        let finalHp = prevPlayer.currentHp;
        let finalShield = prevPlayer.shield;
        let newStatuses = { ...prevPlayer.statuses };

        if (attackDamage > 0) {
            if (isGodMode) {
                attackDamage = 0;
                addLog('>> [GOD MODE] 伤害已免疫');
            } else if ((newStatuses['DODGE'] || 0) > 0) {
                attackDamage = 0;
                newStatuses['DODGE'] = Math.max(0, newStatuses['DODGE'] - 1);
                addLog('>> 闪避成功! 伤害无效化');
                setScreenFlash('bg-emerald-500/20');
                triggerVfx('TEXT', 20, 70, '闪避', 'text-emerald-400', <LucideGhost size={24}/>);
                triggerVfx('GHOST', 20, 75);
            } else {
                const blocked = Math.min(finalShield, attackDamage);
                const unblocked = attackDamage - blocked;
                
                finalShield -= blocked;
                finalHp -= unblocked;

                if (unblocked > 0) {
                    setScreenFlash('bg-dungeon-blood/40'); 
                    triggerVfx('TEXT', 20, 70, `-${unblocked}`, 'text-dungeon-red', <LucideHeart size={24}/>);
                    triggerShake('sm');
                } else {
                    triggerVfx('BLOCK', 20, 75);
                    triggerVfx('TEXT', 20, 70, `格挡`, 'text-stone-300', <LucideShield size={20}/>);
                }

                if (prevPlayer.thorns > 0) {
                    const thornDmg = prevPlayer.thorns;
                    setEnemy(e => ({...e, currentHp: Math.max(0, e.currentHp - thornDmg)}));
                    addLog(`>> 荆棘反伤: 敌人受到 ${thornDmg} 点伤害`);
                    triggerVfx('TEXT', 80, 50, `-${thornDmg}`, 'text-red-500', <LucideSprout size={20}/>);
                }
            }
        }
        
        return {
            ...prevPlayer,
            currentHp: Math.max(0, finalHp),
            shield: finalShield, 
            statuses: newStatuses
        };
    });
    
    // DECAY BUFFS AT END OF TURN (Corrected Position)
    setEnemy(prev => {
        let newStatuses = { ...prev.statuses };
        
        // STRENGTH Logic: Only reduce if the enemy actually ATTACKED this turn
        if (intent.type === 'ATTACK' && (newStatuses['STRENGTH'] || 0) > 0) {
             newStatuses['STRENGTH'] -= 1;
        }

        // THORNS Logic: Decays by 1 every turn (Temporary Defense)
        if ((newStatuses['THORNS'] || 0) > 0) newStatuses['THORNS'] -= 1;
        
        const nextIntent = decideNextIntent(prev, player); 
        return { ...prev, statuses: newStatuses, intents: [nextIntent], currentIntentIndex: 0 };
    });

    finishTurn();
  };

  const getCardIcon = (type: CardType) => {
      switch(type) {
          case CardType.STRIKE: return <LucideSword size={16} className="text-dungeon-red" />;
          case CardType.BLOCK: return <LucideShield size={16} className="text-slate-400" />;
          case CardType.TECH: return <LucideBookOpen size={16} className="text-amber-500" />;
          case CardType.MOVE: return <LucideGhost size={16} className="text-emerald-500" />;
          case CardType.TENTACLE: return <LucideSprout size={16} className="text-teal-500" />;
          case CardType.GLITCH: return <LucideBrain size={16} className="text-fuchsia-400" />;
          case CardType.FIRE: return <LucideFlame size={16} className="text-orange-500" />;
          case CardType.ICE: return <LucideSnowflake size={16} className="text-cyan-400" />;
          case CardType.THUNDER: return <LucideZap size={16} className="text-yellow-400" />;
          case CardType.POISON: return <LucideBiohazard size={16} className="text-lime-500" />;
          default: return <LucideSkull size={16} className="text-stone-500" />;
      }
  };

  const renderBuffs = (statuses: Record<string, number>, extraClass: string = '', tooltipDirection: 'up' | 'down' = 'up') => {
      const buffs = [];
      const LABELS: Record<string, string> = {
          'CORROSION': '腐蚀', 'WEAK': '虚弱', 'BLEED': '流血', 'CORRUPTION': '腐败',
          'DODGE': '闪避', 'FROZEN': '冻结', 'BURN': '燃烧', 'POISON': '中毒',
          'SHOCK': '感电', 'FOCUS': '专注', 'THORNS': '荆棘', 'STRENGTH': '狂暴', 'ENRAGE': '激怒',
          'ECHO': '回响', 'FLOW': '心流', 'DOMAIN': '领域'
      };

      if ((statuses['CORROSION'] || 0) > 0) buffs.push({ type: 'CORROSION', val: statuses['CORROSION'], icon: LucideBiohazard, color: 'bg-lime-950 border-lime-600 text-lime-400 animate-pulse' });
      if ((statuses['WEAK'] || 0) > 0) buffs.push({ type: 'WEAK', val: statuses['WEAK'], icon: LucideHeartCrack, color: 'bg-stone-800 border-stone-500 text-stone-400' });
      if ((statuses['BLEED'] || 0) > 0) buffs.push({ type: 'BLEED', val: statuses['BLEED'], icon: LucideDroplets, color: 'bg-red-900/80 border-red-500 text-red-200' });
      if ((statuses['CORRUPTION'] || 0) > 0) buffs.push({ type: 'CORRUPTION', val: statuses['CORRUPTION'], icon: LucideSkull, color: 'bg-purple-900/80 border-purple-500 text-purple-200' });
      if ((statuses['DODGE'] || 0) > 0) buffs.push({ type: 'DODGE', val: statuses['DODGE'], icon: LucideGhost, color: 'bg-emerald-900/80 border-emerald-500 text-emerald-200' });
      if ((statuses['FROZEN'] || 0) > 0) buffs.push({ type: 'FROZEN', val: statuses['FROZEN'], icon: LucideSnowflake, color: 'bg-cyan-900/80 border-cyan-400 text-cyan-200 animate-pulse' });
      if ((statuses['BURN'] || 0) > 0) buffs.push({ type: 'BURN', val: statuses['BURN'], icon: LucideFlame, color: 'bg-orange-900/80 border-orange-500 text-orange-200 animate-flicker' });
      if ((statuses['POISON'] || 0) > 0) buffs.push({ type: 'POISON', val: statuses['POISON'], icon: LucideBiohazard, color: 'bg-lime-900/80 border-lime-500 text-lime-200' });
      if ((statuses['SHOCK'] || 0) > 0) buffs.push({ type: 'SHOCK', val: statuses['SHOCK'], icon: LucideZap, color: 'bg-yellow-900/80 border-yellow-500 text-yellow-200' });
      if ((statuses['DRAW_BONUS'] || 0) > 0) buffs.push({ type: 'FOCUS', val: statuses['DRAW_BONUS'], icon: LucideHourglass, color: 'bg-blue-900/80 border-blue-400 text-blue-200' });
      if ((statuses['THORNS'] || 0) > 0) buffs.push({ type: 'THORNS', val: statuses['THORNS'], icon: LucideSprout, color: 'bg-red-900/60 border-red-400 text-red-200' });
      else if (player.thorns > 0 && statuses === player.statuses) buffs.push({ type: 'THORNS', val: player.thorns, icon: LucideSprout, color: 'bg-red-900/60 border-red-400 text-red-200' });
      if ((statuses['STRENGTH'] || 0) > 0) buffs.push({ type: 'STRENGTH', val: statuses['STRENGTH'], icon: LucideBicepsFlexed, color: 'bg-red-950 border-red-500 text-red-400' });
      
      // New Special Statuses
      if ((statuses['ECHO'] || 0) > 0) buffs.push({ type: 'ECHO', val: statuses['ECHO'], icon: LucideOrbit, color: 'bg-cyan-900/80 border-cyan-400 text-cyan-100 animate-spin-slow' });
      if ((statuses['FLOW'] || 0) > 0) buffs.push({ type: 'FLOW', val: statuses['FLOW'], icon: LucideZap, color: 'bg-yellow-900/80 border-yellow-400 text-yellow-100' });
      if ((statuses['DOMAIN'] || 0) > 0) buffs.push({ type: 'DOMAIN', val: statuses['DOMAIN'], icon: LucideShield, color: 'bg-blue-900/80 border-blue-400 text-blue-100' });

      if (buffs.length === 0) return null;

      const STATUS_INFO: Record<string, string> = {
          'CORROSION': '回合开始时受 2 点伤害',
          'WEAK': '攻击伤害 -1',
          'BLEED': '回合开始受层数伤害',
          'BURN': '回合开始受 2 点伤害',
          'POISON': '回合开始受层数伤害',
          'SHOCK': '受到伤害增加 50%',
          'FROZEN': '无法行动',
          'DODGE': '免疫下一次伤害',
          'CORRUPTION': '配合卡牌触发爆发伤害',
          'FOCUS': '下回合额外抽牌',
          'THORNS': '被攻击时反弹伤害 (回合结束 -1 层)',
          'ENRAGE': '攻击力随回合提升',
          'STRENGTH': '攻击造成额外伤害 (攻击后 -1 层)',
          'ECHO': '下一张基础牌打出两次',
          'FLOW': '下一张牌不占用缓冲区',
          'DOMAIN': '若回合开始时护甲未归零，触发奖励'
      };

      return (
          <div className={`flex gap-1.5 flex-wrap px-1 ${extraClass}`}>
              {buffs.map((b, i) => {
                  // Tooltip positioning Logic
                  // Default: Center
                  let tooltipClass = "left-1/2 -translate-x-1/2";
                  
                  // If first item (likely leftmost), anchor left
                  if (i === 0) tooltipClass = "left-0";
                  // If last item and there are multiple, anchor right to be safe
                  else if (i === buffs.length - 1 && buffs.length > 2) tooltipClass = "right-0";

                  return (
                      <div 
                        key={i} 
                        className={`w-8 h-8 rounded-sm border ${b.color} shadow-md flex items-center justify-center relative animate-fade-in group cursor-help`}
                        onClick={() => addLog(`状态 [${LABELS[b.type] || b.type}]: ${STATUS_INFO[b.type] || '未知状态'}`)}
                      >
                          <div className="absolute inset-0 bg-white/5 opacity-50 mix-blend-overlay"></div>
                          <b.icon size={16} />
                          <div className="absolute -bottom-1 -right-1 bg-black text-white text-[9px] min-w-[14px] h-[14px] flex items-center justify-center rounded-tl-sm font-bold z-10 font-mono pointer-events-none">
                              {b.val}
                          </div>
                          
                          {/* Tooltip */}
                          <div className={`absolute ${tooltipDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${tooltipClass} bg-dungeon-black text-stone-300 text-[10px] w-max max-w-[150px] p-2 rounded border border-stone-600 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-xl flex flex-col gap-1`}>
                              <div className="flex justify-between items-center border-b border-stone-700 pb-1 mb-1">
                                  <span className="font-bold text-white uppercase tracking-wider">{LABELS[b.type] || b.type}</span>
                                  <span className="text-dungeon-gold font-mono">+{b.val}</span>
                              </div>
                              <div className="text-stone-400 leading-tight">
                                  {STATUS_INFO[b.type] || '未知状态'}
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  const acquireBlueprint = (bp: Blueprint) => {
    updatePlayer(prev => ({
        ...prev,
        blueprints: [...prev.blueprints, bp]
    }));
    addLog(`>> [DEBUG] 获取蓝图: ${bp.name}`);
    triggerVfx('BUFF', 50, 50, '蓝图获取', 'text-dungeon-gold', <LucideBookOpen size={24}/>);
  };

  const renderComboModal = () => {
    // 1. Get Owned Blueprints (Reverse order to show newest acquired at top)
    const ownedBlueprints = [...player.blueprints].reverse();
    const ownedIds = new Set(ownedBlueprints.map(bp => bp.id));
    
    // 2. Find all potential blueprints that we don't own
    const allPotential = [...STARTING_BLUEPRINTS, ...BLUEPRINT_POOL];
    const unownedBlueprints: Blueprint[] = [];
    const seenUnowned = new Set();

    for (const bp of allPotential) {
        if (!ownedIds.has(bp.id) && !seenUnowned.has(bp.id)) {
            unownedBlueprints.push(bp);
            seenUnowned.add(bp.id);
        }
    }

    // 3. Filter unowned based on active category
    const filteredUnowned = archiveCategory === 'ALL' 
        ? unownedBlueprints 
        : unownedBlueprints.filter(bp => getBlueprintCategory(bp) === archiveCategory);

    const categories = [
        { id: 'ALL', label: '全部', icon: <LucideFilter size={14} /> },
        { id: 'PHYSICAL', label: '物理', icon: <LucideSword size={14} /> },
        { id: 'FIRE', label: '火焰', icon: <LucideFlame size={14} /> },
        { id: 'ICE', label: '冰霜', icon: <LucideSnowflake size={14} /> },
        { id: 'THUNDER', label: '雷霆', icon: <LucideZap size={14} /> },
        { id: 'POISON', label: '剧毒', icon: <LucideBiohazard size={14} /> },
        { id: 'VOID', label: '虚空', icon: <LucideSkull size={14} /> },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowComboList(false)}>
            <div className="bg-dungeon-dark border-2 border-dungeon-border p-1 rounded-lg w-full max-w-sm h-3/4 flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <div className="h-full bg-dungeon-black/50 p-4 flex flex-col rounded-md overflow-hidden">
                    <div className="flex justify-between items-center mb-4 border-b border-dungeon-border pb-2 shrink-0">
                        <h2 className="text-xl font-display font-bold text-dungeon-flesh tracking-widest uppercase text-shadow-gold">蓝图档案</h2>
                        <button onClick={() => setShowComboList(false)}><LucideX className="text-stone-500 hover:text-dungeon-red" /></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                        
                        {/* OWNED SECTION */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <LucideBookOpen size={14} className="text-dungeon-gold"/>
                                <span className="text-xs font-bold text-dungeon-gold tracking-widest uppercase">已收录回路 ({ownedBlueprints.length})</span>
                                <div className="flex-1 h-px bg-dungeon-gold/30"></div>
                            </div>
                            <div className="space-y-3">
                                {ownedBlueprints.map((bp, idx) => (
                                    <div key={idx} className="bg-dungeon-stone p-3 border border-dungeon-border rounded-md flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:bg-stone-800">
                                        {idx === 0 && player.blueprints.length > STARTING_BLUEPRINTS.length && (
                                            <div className="absolute top-0 right-0">
                                                <div className="bg-dungeon-gold text-black text-[9px] font-bold px-2 py-0.5 rounded-bl shadow-md">NEW</div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            {bp.sequence.map((type, i) => (
                                                <div key={i} className={`w-8 h-8 rounded-sm flex items-center justify-center bg-dungeon-black border border-stone-600 shadow-inner`}>
                                                {getCardIcon(type)}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-end border-t border-stone-700 pt-2">
                                            <span className="text-sm font-display font-bold text-dungeon-gold">{bp.name}</span>
                                            <span className="text-[11px] text-stone-400 font-serif italic w-2/3 text-right leading-tight">{bp.effectDescription}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* UNOWNED SECTION */}
                        <div className="pb-4">
                            <div className="sticky top-0 bg-dungeon-dark/95 backdrop-blur z-10 py-2 border-b border-stone-800 mb-3">
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <LucideLock size={14} className="text-stone-500"/>
                                    <span className="text-xs font-bold text-stone-500 tracking-widest uppercase">未识别信号</span>
                                </div>
                                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setArchiveCategory(cat.id)}
                                            className={`
                                                flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-bold border transition-all whitespace-nowrap
                                                ${archiveCategory === cat.id 
                                                    ? 'bg-dungeon-gold text-black border-dungeon-gold shadow-md' 
                                                    : 'bg-black text-stone-500 border-stone-800 hover:border-stone-600 hover:text-stone-300'}
                                            `}
                                        >
                                            {cat.icon}
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {filteredUnowned.length === 0 ? (
                                    <div className="text-center text-xs text-stone-600 py-8 italic">暂无相关记录</div>
                                ) : (
                                    filteredUnowned.map((bp, idx) => (
                                        <div key={idx} className="bg-black/40 p-3 border border-stone-800 rounded-md flex flex-col gap-2 shadow-none relative overflow-hidden opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all group">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    acquireBlueprint(bp);
                                                }}
                                                className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 px-2 py-1 rounded border border-stone-600 hover:border-dungeon-gold hover:bg-stone-800 transition-all z-20 opacity-0 group-hover:opacity-100"
                                                title="[测试] 获取此蓝图"
                                            >
                                                <LucideDownload size={10} className="text-stone-500 group-hover:text-dungeon-gold"/>
                                                <span className="text-[9px] text-stone-500 group-hover:text-dungeon-gold font-bold uppercase tracking-wider">获取</span>
                                            </button>
                                            
                                            <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100">
                                                {bp.sequence.map((type, i) => (
                                                    <div key={i} className={`w-8 h-8 rounded-sm flex items-center justify-center bg-stone-900 border border-stone-800 shadow-inner`}>
                                                    {getCardIcon(type)}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-end border-t border-stone-800 pt-2 group-hover:border-stone-700">
                                                <span className="text-sm font-display font-bold text-stone-500 group-hover:text-stone-300">{bp.name}</span>
                                                <span className="text-[11px] text-stone-600 font-serif italic w-2/3 text-right leading-tight group-hover:text-stone-400">{bp.effectDescription}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderLogModal = () => (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center backdrop-blur-md animate-fade-in p-4" onClick={() => setShowLogModal(false)}>
        <div className="bg-dungeon-dark border-2 border-dungeon-border w-full max-w-lg h-[600px] flex flex-col shadow-2xl relative rounded-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-stone-700 bg-black/40">
                <div className="flex items-center gap-2">
                    <LucideScrollText size={18} className="text-dungeon-gold" />
                    <h3 className="text-lg font-display font-bold text-stone-200 tracking-widest">战斗记录</h3>
                </div>
                <button onClick={() => setShowLogModal(false)} className="p-1 hover:bg-stone-800 rounded group">
                    <LucideX size={20} className="text-stone-500 group-hover:text-red-500 transition-colors" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/30 font-serif custom-scrollbar relative">
                {combatLog.length === 0 && <div className="text-stone-600 italic text-center mt-20">暂无记录...</div>}
                {combatLog.map((log, i) => (
                    <div key={i} className={`text-sm p-3 rounded border-l-2 flex items-start gap-3 shadow-sm ${log.includes('>>') ? 'border-dungeon-gold bg-dungeon-gold/5 text-stone-300' : 'border-stone-700 text-stone-500'}`}>
                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0"></div>
                        <span className="leading-relaxed">{log.replace('>> ', '')}</span>
                    </div>
                ))}
            </div>
            <div className="p-2 border-t border-stone-800 bg-black/40 text-center text-[10px] text-stone-600 uppercase tracking-widest">
                系统日志 V1.0
            </div>
        </div>
    </div>
  );

  const renderEnemyVisual = () => {
     // Determine visuals based on intents and status
     const intent = enemy.intents[0];
     const isFrozen = (enemy.statuses['FROZEN'] || 0) > 0;
     
     // 1. Resolve Base Monster Visuals (Shape, Background, Default Color)
     let baseVisual = {
         icon: <LucideGhost size={160} strokeWidth={1} />, 
         secondary: null as React.ReactNode,
         bgGradient: 'from-stone-800/40 to-black',
         baseColor: 'text-stone-400'
     };

     if (enemy.name.includes('软泥')) {
         baseVisual = {
             icon: <LucideBiohazard size={160} strokeWidth={1} />,
             secondary: <LucideDroplets size={60} className="absolute top-0 right-0 animate-bounce" />,
             bgGradient: 'from-lime-900/30 to-black',
             baseColor: 'text-lime-500'
         };
     } else if (enemy.name.includes('巡逻兵')) {
         baseVisual = {
             icon: <LucideSkull size={160} strokeWidth={1} />,
             secondary: <LucideTarget size={60} className="absolute -top-4 -right-4 animate-pulse" />,
             bgGradient: 'from-stone-700/30 to-black',
             baseColor: 'text-stone-400'
         };
     } else if (enemy.name.includes('信徒')) {
         baseVisual = {
             icon: <LucideGhost size={160} strokeWidth={1} />,
             secondary: <LucideEye size={60} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping opacity-50" />,
             bgGradient: 'from-purple-900/30 to-black',
             baseColor: 'text-purple-500'
         };
     } else if (enemy.name.includes('骑士')) {
         baseVisual = {
             icon: <LucideShield size={160} strokeWidth={1} />,
             secondary: <LucideSword size={100} className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-current opacity-80" />,
             bgGradient: 'from-red-950/40 to-black',
             baseColor: 'text-red-800'
         };
     } else if (enemy.name.includes('巨像')) {
         baseVisual = {
             icon: <LucideOrbit size={180} strokeWidth={0.5} />,
             secondary: <LucideZap size={80} className="absolute bottom-0 right-0 animate-flicker" />,
             bgGradient: 'from-amber-900/30 to-black',
             baseColor: 'text-amber-500'
         };
     }

     // 2. Resolve Dynamic Intent/Status Overrides
     let dynamicColor = baseVisual.baseColor; // Default to base
     let dynamicAnimation = 'animate-float'; // Default idle
     let dynamicShadow = ''; 

     if (isFrozen) {
         dynamicColor = 'text-cyan-300';
         dynamicAnimation = 'animate-pulse grayscale brightness-150';
         dynamicShadow = 'drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]';
     } else if (intent) {
         switch (intent.type) {
             case 'ATTACK':
                 dynamicColor = 'text-red-500';
                 dynamicAnimation = 'animate-breathing'; // A heavy breathing before attack
                 dynamicShadow = 'drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]';
                 break;
             case 'POLLUTE':
                 dynamicColor = 'text-fuchsia-500';
                 dynamicAnimation = 'animate-glitch';
                 dynamicShadow = 'drop-shadow-[0_0_20px_rgba(217,70,239,0.6)]';
                 break;
             case 'BUFF':
             case 'HEAL':
                 // Keep distinct from Move/Tech cards, usually Green or Orange
                 if (intent.type === 'BUFF') dynamicColor = 'text-orange-500';
                 else dynamicColor = 'text-green-500';
                 dynamicAnimation = 'animate-bounce';
                 dynamicShadow = 'drop-shadow-[0_0_20px_rgba(234,88,12,0.5)]';
                 break;
             case 'DEBUFF':
                 dynamicColor = 'text-stone-500';
                 dynamicAnimation = 'animate-pulse';
                 break;
             case 'WAIT':
                 // Keep base color or dim it
                 dynamicAnimation = 'animate-float';
                 break;
         }
     }

     return (
        <div 
            key={`${enemy.name}-${currentStage}`} // CRITICAL: Forces React to replace the element instead of patching it, preventing style bleeding
            className={`relative w-72 h-72 flex items-center justify-center z-10 transition-transform duration-500 ${enemyLunge ? 'scale-110' : 'scale-100'}`}
        >
            {/* Background Aura (Based on Monster Type) */}
            <div className={`absolute inset-4 rounded-full border border-white/5 bg-gradient-to-b ${baseVisual.bgGradient} backdrop-blur-sm opacity-60`}></div>
            
            {/* Main Visual Container */}
            <div className={`relative z-20 ${dynamicColor} ${dynamicAnimation} transition-colors duration-700 ${dynamicShadow}`}>
                {/* Primary Icon */}
                {baseVisual.icon}
                
                {/* Secondary Decor (inherits color usually, or we can force it) */}
                <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-screen">
                    {baseVisual.secondary}
                </div>
            </div>

            {/* Frozen Overlay */}
            {isFrozen && <LucideSnowflake size={120} className="absolute z-30 text-cyan-100/50 animate-spin-slow" />}

            {/* Intent Indicator (The Tethered Omen) */}
            {enemy.intents[0] && (
                <div className="absolute -right-12 top-0 z-30 animate-float-delayed flex flex-col items-center">
                    {/* Tether Line */}
                    <svg className="absolute top-1/2 right-full w-12 h-12 pointer-events-none opacity-30" viewBox="0 0 100 100">
                        <path d="M100,50 Q50,80 0,50" fill="none" stroke="currentColor" strokeWidth="1" className="text-stone-500" />
                    </svg>

                    {/* Intent Rune Container */}
                    <div className={`
                        w-16 h-16 rounded-full border-2 bg-dungeon-black/90 flex items-center justify-center shadow-xl backdrop-blur-sm relative group
                        ${enemy.intents[0].type === 'ATTACK' ? 'border-dungeon-blood shadow-red-900/20' : 
                          enemy.intents[0].type === 'POLLUTE' ? 'border-fuchsia-800 shadow-fuchsia-900/20' : 
                          'border-stone-600 shadow-stone-900/20'}
                    `}>
                        {/* Icon */}
                        <div className="relative z-10">
                            {enemy.intents[0].type === 'ATTACK' ? <LucideSword size={28} className="text-dungeon-red animate-pulse"/> : 
                             enemy.intents[0].type === 'POLLUTE' ? (
                                enemy.intents[0].description.includes('精神') ? 
                                <LucideBrain size={28} className="text-fuchsia-500 animate-pulse"/> : 
                                <LucideSprout size={28} className="text-teal-500 animate-pulse"/>
                             ) : 
                             enemy.intents[0].type === 'HEAL' ? <LucidePlus size={28} className="text-green-600 animate-bounce"/> :
                             enemy.intents[0].type === 'BUFF' ? <LucideTrendingUp size={28} className="text-orange-600"/> :
                             enemy.intents[0].type === 'DEBUFF' ? <LucideHeartCrack size={28} className="text-stone-400"/> :
                             <LucideOrbit size={28} className="text-stone-500 animate-spin-slow"/>}
                        </div>

                        {/* Value Badge */}
                        {enemy.intents[0].value > 0 && (
                            <div className="absolute -bottom-2 bg-black border border-stone-600 text-stone-200 text-xs font-bold font-display px-1.5 py-0.5 shadow-md">
                                {enemy.intents[0].value}
                            </div>
                        )}
                        
                        {/* Tooltip */}
                        <div className="absolute top-full mt-2 w-max bg-black/90 border border-stone-800 text-stone-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <span className="font-bold text-stone-300 uppercase block text-center mb-0.5 tracking-widest">
                                {INTENT_LABELS[enemy.intents[0].type]}
                            </span>
                            {enemy.intents[0].description}
                        </div>
                    </div>
                </div>
            )}
        </div>
     );
  };

  const isAnyDragging = dragCardIndex !== null;

  return (
    <div className="w-full h-full bg-[#1c1917] text-stone-300 relative overflow-hidden font-serif select-none">
      <div className={`w-full h-full flex flex-col relative z-10 ${shake ? 'animate-shake' : ''}`}>
          {/* Global Atmosphere */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-stone-800/30 via-stone-950/80 to-black pointer-events-none z-0"></div>
          <div className="absolute inset-0 pointer-events-none z-50 bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.6)_100%)]"></div>
          <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none z-0 animate-flicker"></div>
          {/* Fog Layer */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/foggy-birds.png')] opacity-10 animate-fog pointer-events-none z-0 mix-blend-screen"></div>

          {screenFlash && <div className={`absolute inset-0 z-50 pointer-events-none transition-colors duration-300 ${screenFlash}`}></div>}

          {/* VFX Layer */}
          <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
              {vfxList.map(vfx => (
                  <div 
                    key={vfx.id}
                    className="absolute animate-fade-out-up flex flex-col items-center justify-center"
                    style={{ left: `${vfx.x}%`, top: `${vfx.y}%`, transform: 'translate(-50%, -50%)' }}
                  >
                     {vfx.type === 'SLASH' && <div className="w-48 h-1 bg-white shadow-[0_0_15px_white] rotate-45 animate-slash mix-blend-overlay"></div>}
                     {vfx.type === 'BLOCK' && <LucideShield size={48} className="text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)]" />}
                     {vfx.type === 'HEAL' && <LucideHeart size={48} className="text-green-600 drop-shadow-[0_0_20px_rgba(22,163,74,0.8)]" />}
                     {vfx.type === 'POISON' && <LucideSkull size={48} className="text-purple-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]" />}
                     {vfx.type === 'BURN' && <LucideFlame size={48} className="text-orange-600 drop-shadow-[0_0_20px_rgba(234,88,12,0.8)]" />}
                     {vfx.type === 'FREEZE' && <LucideSnowflake size={48} className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]" />}
                     {vfx.type === 'THUNDER' && <LucideZap size={48} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />}
                     {vfx.type === 'GHOST' && <LucideGhost size={48} className="text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.8)] animate-pulse" />}
                     {vfx.type === 'DEBUFF' && (
                          <div className="flex flex-col items-center justify-center">
                              <LucideHeartCrack size={48} className="text-stone-500 drop-shadow-[0_0_20px_rgba(120,113,108,0.8)] animate-pulse" />
                              {vfx.content && <span className={`text-3xl font-bold font-display tracking-widest ${vfx.color || 'text-stone-400'} text-shadow-black`}>{vfx.content}</span>}
                          </div>
                     )}
                     {vfx.type === 'TEXT' && (
                          <div className="flex items-center gap-2 scale-150">
                              {vfx.icon && <div className={`animate-pop-in ${vfx.color}`}>{vfx.icon}</div>}
                              <span className={`text-3xl font-bold font-display tracking-widest ${vfx.color || 'text-white'} text-shadow-black`}>
                                  {vfx.content}
                              </span>
                          </div>
                      )}
                  </div>
              ))}
          </div>

          {isDiscarding && (
              <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-start pt-32 pointer-events-auto animate-fade-in">
                  <div className="text-dungeon-red font-display font-bold text-4xl animate-pulse tracking-[0.2em] drop-shadow-[0_0_20px_rgba(220,38,38,0.6)] border-b border-dungeon-red pb-2 mb-2">
                      精神过载
                  </div>
                  <div className="text-stone-500 font-serif italic text-lg mb-8">
                       必须切断 <span className="text-stone-200 font-bold mx-1 text-2xl">{hand.length - HAND_SIZE}</span> 个神经链接
                  </div>
                  
                  <button 
                      onClick={cancelDiscard}
                      className="px-8 py-3 border border-stone-700 text-stone-400 hover:text-white hover:border-dungeon-gold hover:bg-stone-900 transition-all rounded-sm font-display text-xs tracking-widest uppercase flex items-center gap-2 group mb-4"
                  >
                      <LucideUndo2 size={16} className="group-hover:-translate-x-1 transition-transform" />
                      放弃行动
                  </button>
              </div>
          )}

          {/* --- TOP HUD (Immersive) --- */}
          <div className="h-32 flex flex-col z-20 shrink-0 relative w-full pt-4 px-4 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
              
              {/* Row 1: Meta Info */}
              <div className="flex items-center justify-between w-full mb-3 text-stone-400">
                  <div className="flex items-center gap-4">
                      {/* Turn Counter Rune */}
                      <div className="w-10 h-10 border border-stone-700 bg-stone-900/80 rotate-45 flex items-center justify-center shadow-lg relative group">
                           <div className="w-8 h-8 border border-stone-600 bg-stone-800 flex items-center justify-center -rotate-45">
                               <span className="font-display font-bold text-stone-200 text-lg">{String(turn).padStart(2, '0')}</span>
                           </div>
                           <div className="absolute top-12 -rotate-45 text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity bg-black px-1 border border-stone-800">当前回合</div>
                      </div>
                      
                      {/* Depth/Stage Indicator */}
                      <div className="flex gap-1.5">
                          {Array.from({length: maxStage}).map((_, i) => {
                              const num = i + 1;
                              const isCompleted = num < currentStage;
                              const isCurrent = num === currentStage;
                              return (
                                  <div key={i} className={`
                                      h-2 w-2 rotate-45 border transition-all duration-500
                                      ${isCurrent ? 'bg-dungeon-gold border-dungeon-gold scale-150 shadow-[0_0_10px_rgba(161,98,7,0.8)]' : 
                                        isCompleted ? 'bg-stone-600 border-stone-500' : 'bg-stone-900 border-stone-700'}
                                  `}></div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Tools */}
                  <div className="flex gap-2">
                       <button onClick={onOpenInventory} className="w-10 h-10 border border-stone-700 bg-stone-900/60 hover:bg-stone-800 hover:border-stone-400 flex items-center justify-center transition-all group shadow-md" title="背包">
                           <LucideBackpack size={18} className="text-stone-400 group-hover:text-stone-200 transition-colors" />
                       </button>
                       <button onClick={() => setShowComboList(true)} className="w-10 h-10 border border-stone-700 bg-stone-900/60 hover:bg-stone-800 hover:border-dungeon-gold flex items-center justify-center transition-all group shadow-md" title="蓝图档案">
                           <LucideBookOpen size={18} className="text-stone-400 group-hover:text-dungeon-gold transition-colors" />
                       </button>
                       {/* 核心优化：增加系统菜单按钮 */}
                       <button onClick={() => setShowMenu(true)} className="w-10 h-10 border border-stone-700 bg-stone-900/60 hover:bg-stone-800 hover:border-dungeon-red flex items-center justify-center transition-all group shadow-md" title="系统菜单">
                           <LucideMenu size={18} className="text-stone-400 group-hover:text-dungeon-red transition-colors" />
                       </button>
                  </div>
              </div>

              {/* Row 2: Enemy Name & HP (The Blood Vessel) */}
              <div className="w-full flex flex-col items-center">
                   <div className="flex items-end justify-between w-full max-w-sm mb-1 px-1">
                       <span className="text-sm font-display font-bold text-stone-200 tracking-[0.15em] uppercase drop-shadow-md truncate max-w-[200px]">
                           {enemy.name}
                       </span>
                       <span className="text-xs font-mono text-dungeon-red tracking-widest font-bold">
                           {enemy.currentHp} <span className="text-stone-600 text-[10px]">/ {enemy.maxHp}</span>
                       </span>
                   </div>
                   
                   {/* HP Bar Container */}
                   <div className="w-full max-w-sm h-3 bg-stone-900 border border-stone-700 relative shadow-inner overflow-hidden">
                       {/* Background Pattern */}
                       <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                       
                       {/* Damage Catch-up (White Flash) */}
                       <div 
                           className="h-full bg-stone-300 absolute top-0 left-0 transition-all duration-1000 ease-out"
                           style={{ width: `${(enemy.currentHp / enemy.maxHp) * 100}%` }} // Simplified, ideally tracks previous HP
                       ></div>
                       
                       {/* Blood Fill */}
                       <div 
                           className="h-full bg-gradient-to-r from-red-950 via-dungeon-red to-red-600 absolute top-0 left-0 transition-all duration-500 ease-out border-r border-red-400/50 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                           style={{ width: `${(enemy.currentHp / enemy.maxHp) * 100}%` }}
                       >
                           <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay"></div>
                       </div>
                   </div>

                   {/* Enemy Buffs - Tooltips point DOWN (direction="down") */}
                   <div className="mt-2 h-8 w-full max-w-sm flex justify-start">
                        {renderBuffs(enemy.statuses, '', 'down')}
                   </div>
              </div>
          </div>

          {/* --- CENTER STAGE: THE ENEMY --- */}
          <div className="flex-1 relative flex flex-col items-center justify-center min-h-0 z-10 w-full ">
               {renderEnemyVisual()}
          </div>
          
          {/* --- BOTTOM HUD (The Console) --- */}
          <div className="w-full bg-black border-t border-stone-800 z-30 shrink-0 flex flex-col relative pb-0 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,1)]">
            
            {/* Player HP Bar (Thin line at top) */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-stone-900">
                <div className="h-full bg-gradient-to-r from-red-900 to-red-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]" style={{width: `${(player.currentHp / player.maxHp) * 100}%`}}></div>
            </div>
            
            {/* Player Statuses - Tooltips point UP (default) */}
            <div className="absolute bottom-full left-4 mb-3 z-20">
                {renderBuffs(player.statuses, '', 'up')}
            </div>

            <div className="flex items-end justify-between px-3 gap-3 ">
                
                {/* Player Vitals */}
                <div className="flex flex-col gap-1 w-auto shrink-0 relative z-20">
                    <div className="flex items-center gap-3 text-stone-200">
                        <div className="relative">
                            <LucideHeart size={24} className="text-dungeon-red fill-red-950 drop-shadow-md animate-pulse-slow" />
                        </div>
                        <span className="text-3xl font-display font-bold text-shadow-blood">{player.currentHp}</span>
                    </div>
                    {player.shield > 0 && (
                        <div className="flex items-center gap-2 text-stone-400 animate-slide-in-up">
                            <LucideShield size={18} />
                            <span className="text-lg font-display font-bold">{player.shield}</span>
                        </div>
                    )}
                </div>

                {/* Buffer Sequence Display */}
                <div className="flex-1 flex flex-col items-center relative -top-1">
                    <div className={`
                        flex gap-1 px-2 py-2 bg-stone-950/80 border shadow-inner transition-colors duration-300 backdrop-blur-sm
                        ${buffer.length >= MAX_BUFFER_SIZE - 1 ? 'border-red-900/50 shadow-[0_0_20px_rgba(220,38,38,0.1)]' : 'border-stone-800'}
                    `}>
                        {Array.from({length: MAX_BUFFER_SIZE}).map((_, i) => (
                            <div key={i} className={`
                                w-8 h-8 flex shrink-0 items-center justify-center border transition-all duration-300 relative overflow-hidden
                                ${buffer[i] 
                                    ? (pollutedBufferIndex === i ? 'border-fuchsia-500/50 bg-fuchsia-900/10 animate-glitch' : 'border-dungeon-gold/30 bg-stone-900') 
                                    : (pollutedBufferIndex === i ? 'border-fuchsia-500/50 bg-fuchsia-900/10' : 'border-stone-800/50 bg-black/40')}
                            `}>
                                {buffer[i] && (
                                    <div className="animate-pop-in relative z-10 opacity-80">
                                        {getCardIcon(buffer[i])}
                                    </div>
                                )}
                                {buffer[i] && <div className="absolute inset-0 bg-dungeon-gold/5 pointer-events-none"></div>}
                            </div>
                        ))}
                    </div>
                    <div className={`text-[9px] tracking-[0.3em] uppercase font-display mt-2 font-bold truncate w-full text-center ${buffer.length >= MAX_BUFFER_SIZE - 1 ? 'text-red-500 animate-pulse' : 'text-stone-600'}`}>
                        {buffer.length >= MAX_BUFFER_SIZE - 1 ? '>> 精神过载 <<' : '序列缓冲区'}
                    </div>
                </div>

                {/* End Turn Button */}
                <div className="flex flex-col items-end gap-1 w-auto shrink-0 z-50">
                    {/* 新增：视觉化读条倒计时 */}
                    {isPlayerTurn && !isProcessing && (
                        <div className="w-16 h-1.5 bg-stone-900 border border-stone-800 rounded-sm overflow-hidden mb-0.5 relative">
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-dungeon-gold'}`}
                                style={{ width: `${(timeLeft / TURN_LIMIT) * 100}%` }}
                            ></div>
                        </div>
                    )}
                    <button 
                        onClick={attemptEndTurn}
                        disabled={!isPlayerTurn || isProcessing}
                        className={`
                            relative group overflow-hidden w-16 h-16 border transition-all duration-300 shadow-xl flex flex-col items-center justify-center gap-1
                            ${isDiscarding 
                                ? 'bg-red-950 border-red-600 text-red-100 hover:bg-red-900 hover:scale-105' 
                                : (isPlayerTurn && !isProcessing)
                                    ? 'bg-stone-900 border-stone-600 text-stone-300 hover:border-dungeon-gold hover:text-dungeon-gold hover:shadow-[0_0_20px_rgba(161,98,7,0.2)] hover:bg-stone-800' 
                                    : 'bg-black border-stone-800 text-stone-700 cursor-not-allowed opacity-50 grayscale'}
                        `}
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
                        
                        {isPlayerTurn && !isProcessing ? (
                             <>
                                <LucideZap size={20} className={`${isDiscarding ? "animate-bounce text-red-400" : "group-hover:text-dungeon-gold"}`} />
                                <span className="relative z-10 text-[9px] font-display font-bold tracking-widest uppercase">
                                    {isDiscarding ? '丢弃' : `执行 ${timeLeft}S`}
                                </span>
                             </>
                        ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-stone-800 border-t-stone-500 animate-spin"></div>
                        )}
                    </button>
                </div>
            </div>
          </div>

          {/* Combat Log Ticker */}
          <div 
              ref={logTickerRef}
              className="w-full bg-black/90 border-b border-stone-800 py-1.5 px-4 cursor-pointer z-20 flex items-center justify-between hover:bg-stone-900 transition-colors shrink-0"
              onClick={() => setShowLogModal(true)}
          >
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                   <LucideScrollText size={12} className="text-stone-600 shrink-0" />
                   <span className="text-xs text-stone-400 font-serif truncate animate-fade-in italic font-light tracking-wide">
                       {combatLog.length > 0 ? combatLog[0] : <span className="opacity-20">等待指令输入...</span>}
                   </span>
              </div>
              <LucideChevronsUp size={12} className="text-stone-700 animate-pulse ml-2" />
          </div>

          {/* Hand Area */}
          <div className={`relative h-[160px] w-full shrink-0 bg-[#0a0a0a] overflow-visible border-t border-stone-800 transition-all duration-300 ${isDiscarding ? 'z-50' : 'z-30'}`}>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
              
                {/* Deck Visual */}
              <div className="absolute bottom-8 left-6 w-16 h-24 bg-stone-900 border border-stone-700 rounded shadow-xl rotate-[-5deg] z-20 flex items-center justify-center group cursor-pointer hover:-translate-y-1 transition-transform hidden md:flex">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] opacity-20"></div>
                  {/* Stack effect */}
                  <div className="absolute -top-0.5 -right-0.5 w-full h-full bg-stone-800 border border-stone-600 rounded -z-10"></div>
                  <div className="absolute -top-1 -right-1 w-full h-full bg-stone-800 border border-stone-600 rounded -z-20"></div>
                  <LucideLayers size={20} className="text-stone-600 group-hover:text-stone-400 transition-colors" />
                  <div className="absolute -bottom-5 text-[9px] font-mono text-stone-600 font-bold tracking-widest">DECK</div>
              </div>

              {/* 测试专供：控制台 (God Mode & Kill) - 移到底层 z-10 避免挡住卡牌 */}
              <div className="absolute left-2 top-2 md:left-6 md:top-auto md:bottom-32 flex flex-col gap-2 z-10">
                  <button 
                      onClick={() => updatePlayer(prev => ({ 
                          ...prev, 
                          currentHp: 9999, 
                          maxHp: 9999, 
                          shield: 9999 
                      }))}
                      className="px-3 py-1.5 bg-red-950/80 border border-red-900 text-red-500 text-[10px] font-bold font-mono tracking-widest rounded shadow-[0_0_15px_rgba(153,27,27,0.5)] hover:bg-red-900 hover:text-white hover:border-red-500 transition-all"
                  >
                      GOD MODE
                  </button>
                  <button 
                      onClick={() => setEnemy(prev => ({ ...prev, currentHp: 0 }))}
                      className="px-3 py-1.5 bg-purple-950/80 border border-purple-900 text-purple-500 text-[10px] font-bold font-mono tracking-widest rounded shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:bg-purple-900 hover:text-white hover:border-purple-500 transition-all"
                  >
                      秒杀
                  </button>
              </div>

              <div className="absolute bottom-0 left-1/2 w-0 h-full z-20">
                {hand.map((cardObj, idx) => {
                   const card = cardObj.type;
                   const total = hand.length;
                   const style = getCardStyle(idx, total);
                   const isTargetForDiscard = isDiscarding;
                   const isComboStarter = !isDiscarding && isPlayerTurn && willCompleteCombo(card);
                   const isDraggingThis = dragCardIndex === idx;
                   const isPolluting = cardObj.isPolluting;

                   // Dynamic Class Logic for Mobile Hover Fix
                   let containerClass = "absolute origin-bottom w-28 transition-all duration-200 ease-out "; 
                   
                   if (isDraggingThis) {
                       // Dragging: Lifted, No pointer events on wrapper (handled by window), High Z
                       containerClass = "absolute origin-bottom w-28 z-[100] bottom-52 pointer-events-none";
                   } else if (isDiscarding) {
                       // Discard Mode: Interactive
                       containerClass += "bottom-40 hover:bottom-44 hover:z-50 cursor-pointer opacity-100 scale-105 z-50";
                   } else if (!isHoverDisabled && !isAnyDragging) {
                        // Standard Idle: Interactive, Hover effects enabled
                        // Note: We use !isAnyDragging to prevent neighbors from reacting while we drag one
                        containerClass += "bottom-40 hover:bottom-52 hover:z-50 hover:scale-110"; 
                   } else {
                        // Locked / Busy: Inert
                        containerClass += "bottom-40 pointer-events-none";
                   }

                   return (
                       <div 
                          key={cardObj.id} 
                          className={containerClass}
                          style={{
                              transform: getCardStyle(idx, total, isDraggingThis ? dragOffset : {x:0,y:0}).transform,
                              zIndex: isDraggingThis ? 100 : idx,
                              touchAction: 'none'
                          }}
                       >
                          <div className="w-full h-full animate-draw-card" style={{ animationFillMode: 'backwards', animationDelay: `${Math.max(0, idx - (total - lastDrawAmount)) * 0.08}s` }}>
                             {isPolluting && (
                                 <div className="absolute -inset-4 bg-fuchsia-900/40 z-[100] animate-glitch border border-fuchsia-500 pointer-events-none rounded-lg flex items-center justify-center backdrop-blur-[1px]">
                                     <LucideBrain size={40} className="text-fuchsia-300 animate-ping"/>
                                 </div>
                             )}

                             <Card 
                                 type={card} 
                                 onClick={() => isDiscarding ? handleDiscardCard(idx) : undefined} 
                                 onPointerDown={(e) => handleCardPointerDown(e, idx)}
                                 disabled={!isPlayerTurn || (isProcessing && !isDiscarding)} 
                                 isComboFinisher={isComboStarter}
                                 bonusDamage={player.damageBonus} 
                                 bonusShield={player.shieldBonus}
                                 isDragging={isDraggingThis}
                                 style={{
                                     // Removed animationDelay from card itself to avoid conflicts with draw animation wrapper
                                     ...(isDiscarding ? { borderColor: '#7f1d1d', boxShadow: '0 0 25px rgba(127, 29, 29, 0.5)' } : {})
                                 }}
                             />
                             {isDiscarding && (
                                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-red-500 text-[9px] px-2 py-0.5 border border-red-900 uppercase tracking-widest shadow-lg">丢弃</div>
                             )}
                          </div>
                       </div>
                   );
                })}

                {flyingCards.map(fc => {
                    if (fc.isDrag) return null; 
                    return (
                        <div 
                            key={fc.id} 
                            style={{
                                position: 'absolute',
                                left: '50%',
                                bottom: '40px', // Default anchor
                                width: '7rem', 
                                transform: `translateX(calc(-50% + ${fc.xOffset}px)) translateY(${fc.yOffset}px) rotate(${fc.rotation || 0}deg)`,
                                transformOrigin: 'bottom center',
                                zIndex: 60,
                                pointerEvents: 'none'
                            }}
                        >
                            {/* Card Animation Container */}
                            <div className="animate-dash-forward relative">
                                <Card type={fc.card} style={{opacity: 1}} />
                            </div>
                        </div>
                    );
                })}
              </div>
          </div>
      </div>

      {flyingCards.map(fc => {
            if (!fc.isDrag) return null; 
            
             const style: React.CSSProperties = (fc.dropX !== undefined && fc.dropY !== undefined) ? {
                position: 'fixed',
                left: fc.dropX,
                top: fc.dropY,
                transform: 'translate(-50%, -50%)',
                width: '7rem', 
                height: '11rem',
                zIndex: 100,
                pointerEvents: 'none'
            } : {
                display: 'none'
            };

            return (
                <div key={fc.id} style={style}>
                    <div className="absolute inset-0 bg-white rounded-lg animate-flash-white mix-blend-overlay z-20"></div>
                    <div className="absolute inset-0 overflow-hidden animate-shatter-tl origin-bottom-right z-10" style={{ clipPath: 'polygon(0 0, 60% 0, 40% 40%, 0 60%)' }}>
                        <Card type={fc.card} style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%', boxShadow: 'none' }} />
                    </div>
                    <div className="absolute inset-0 overflow-hidden animate-shatter-tr origin-bottom-left z-10" style={{ clipPath: 'polygon(60% 0, 100% 0, 100% 60%, 40% 40%)' }}>
                        <Card type={fc.card} style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%', boxShadow: 'none' }} />
                    </div>
                    <div className="absolute inset-0 overflow-hidden animate-shatter-bl origin-top-right z-10" style={{ clipPath: 'polygon(0 60%, 40% 40%, 40% 100%, 0 100%)' }}>
                        <Card type={fc.card} style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%', boxShadow: 'none' }} />
                    </div>
                    <div className="absolute inset-0 overflow-hidden animate-shatter-br origin-top-left z-10" style={{ clipPath: 'polygon(40% 40%, 100% 60%, 100% 100%, 40% 100%)' }}>
                        <Card type={fc.card} style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%', boxShadow: 'none' }} />
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex items-center justify-center">
                            <div className="w-24 h-24 bg-dungeon-gold/30 blur-xl rounded-full animate-ping"></div>
                    </div>
                </div>
            );
      })}

      {isGodMode && (
          <div className="absolute top-2 left-2 z-50 text-[10px] font-bold text-dungeon-gold border border-dungeon-gold bg-black/80 px-2 py-0.5 rounded animate-pulse">
              上帝模式
          </div>
      )}

     {showComboList && renderComboModal()}
      {showLogModal && renderLogModal()}

      {/* 核心优化：局内系统菜单面板 */}
      {showMenu && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setShowMenu(false)}>
              <div className="bg-dungeon-dark border border-stone-700 p-6 rounded-xl flex flex-col items-center gap-6 max-w-xs w-full shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                  <div className="text-center relative z-10">
                      <h2 className="text-2xl font-display font-bold text-stone-200 tracking-widest">系统菜单</h2>
                      <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest">System Override</p>
                  </div>
                  <div className="w-full h-px bg-stone-800 relative z-10"></div>
                  
                  <button 
                      onClick={() => { setShowMenu(false); onLose(); }} // 联动父级的死亡/失败电影级动画
                      className="w-full py-4 bg-red-950/40 hover:bg-red-900/80 text-red-500 hover:text-white border border-red-900/50 hover:border-red-500 transition-all rounded shadow-lg font-bold tracking-widest relative z-10"
                  >
                      放弃行动 (强制撤离)
                  </button>
                  <button 
                      onClick={() => setShowMenu(false)}
                      className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 hover:border-stone-500 transition-all rounded shadow-md font-bold tracking-widest relative z-10"
                  >
                      继续探索
                  </button>
                  <p className="text-[10px] text-red-600/80 font-bold text-center mt-2 relative z-10">
                      警告：强行断开链接将被视为阵亡。<br/>你将永久遗失安全区外的所有战利品！
                  </p>
              </div>
          </div>
      )}

    </div>
  );

};
