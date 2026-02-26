
import React, { useState, useEffect, useRef } from 'react';
import { GridItem, InventoryState, MetaState } from '../../types';
import { INVENTORY_WIDTH, INVENTORY_HEIGHT, SAFE_ZONE_WIDTH, LOOT_TABLE, EQUIPMENT_ROW_COUNT } from '../../constants';
import { canPlaceItem, placeItemInGrid, removeItemFromGrid, rotateMatrix, createEmptyGrid, findSmartArrangement, getPlayerZone, isPlayerCellUnlocked, getRotatedShape } from '../../utils/gridLogic';
import { LucideRotateCw, LucideTrash2, LucideBox, LucideSearch, LucideCheckCircle, LucideLoader2, LucideArchive, LucideShieldCheck, LucideLock, LucideInfo, LucideZap, LucideX, LucideScanLine, LucideGrab, LucideCoins, LucideEye, LucidePlus } from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryState;
  setInventory: React.Dispatch<React.SetStateAction<InventoryState>> | ((inv: InventoryState) => void);
  onFinish: () => void;
  isLootPhase: boolean;
  isCombat?: boolean;
  onConsume?: (item: GridItem) => void; 
  currentStage: number;
  maxStage: number;
  // New Props for Warehouse Mode
  externalInventory?: InventoryState;
  setExternalInventory?: React.Dispatch<React.SetStateAction<InventoryState>> | ((inv: any) => void);
  externalTitle?: string;
  setMetaState?: React.Dispatch<React.SetStateAction<MetaState>>;
  playerLevel?: number; // 角色素体等级
  playerClass?: string; // 修复：接收职业类型，避免 undefined
  customPlayerHeader?: React.ReactNode; 
}

const CONTAINER_WIDTH = 8;
const CONTAINER_HEIGHT = 4;
const CELL_SIZE = 36; // px (w-9 h-9 is 2.25rem = 36px)
const CELL_GAP = 4; // gap-1 is 4px

const TYPE_LABELS: Record<string, string> = {
    'CONSUMABLE': '消耗品',
    'ARTIFACT': '遗物',
    'LOOT': '战利品'
};

const STAT_LABELS: Record<string, string> = {
    'damageBonus': '攻击力',
    'shieldBonus': '护甲效能',
    'hpBonus': '生命上限',
    'shieldStart': '初始护甲',
    'thorns': '荆棘',
    'cleanse': '净化',
    'heal': '治疗'
};

// Helper to determine borders for unified shape look (Robust Version)
const getSmartBorders = (shape: number[][], r: number, c: number) => {
    if (!shape || shape.length === 0 || !shape[r]) return {};

    const h = shape.length;
    const w = shape[0]?.length || 0;
    
    // Safe check helper
    const isFilled = (y: number, x: number) => {
        if (y < 0 || y >= h || x < 0 || x >= w) return false;
        return shape[y] && shape[y][x] === 1;
    };

    const top = !isFilled(r - 1, c);
    const bottom = !isFilled(r + 1, c);
    const left = !isFilled(r, c - 1);
    const right = !isFilled(r, c + 1);

    return {
        borderTopWidth: top ? '1px' : '0',
        borderBottomWidth: bottom ? '1px' : '0',
        borderLeftWidth: left ? '1px' : '0',
        borderRightWidth: right ? '1px' : '0',
        // Add rounded corners for outer edges
        borderTopLeftRadius: (top && left) ? '4px' : '0',
        borderTopRightRadius: (top && right) ? '4px' : '0',
        borderBottomLeftRadius: (bottom && left) ? '4px' : '0',
        borderBottomRightRadius: (bottom && right) ? '4px' : '0',
    };
};

export const InventoryView: React.FC<InventoryViewProps> = ({ 
    inventory, 
    setInventory, 
    onFinish, 
    isLootPhase, 
    isCombat = false, 
    onConsume, 
    currentStage, 
    maxStage,
    externalInventory,
    setExternalInventory,
    externalTitle,
    setMetaState,
    playerLevel = 1,
    playerClass = 'OPERATOR', // 给定安全默认值
    customPlayerHeader
}) => {
  const [isBoxOpen, setIsBoxOpen] = useState(false);
  
  // If externalInventory is provided, use it. Otherwise, manage local loot state.
  const [localLootGrid, setLocalLootGrid] = useState<(string | null)[][]>(createEmptyGrid(CONTAINER_WIDTH, CONTAINER_HEIGHT));
  const [localLootItems, setLocalLootItems] = useState<GridItem[]>([]);

  // Derived State for "Loot" Grid (External)
  const lootGrid = externalInventory ? externalInventory.grid : localLootGrid;
  const lootItems = externalInventory ? externalInventory.items : localLootItems;
  
  const setLootGrid = (gridUpdater: (string | null)[][] | ((prev: (string | null)[][]) => (string | null)[][])) => {
      if (setExternalInventory) {
          setExternalInventory(prev => ({ 
              ...prev, 
              grid: typeof gridUpdater === 'function' ? gridUpdater(prev.grid) : gridUpdater 
          }));
      } else {
          setLocalLootGrid(gridUpdater);
      }
  };
  
  const setLootItems = (itemsUpdater: GridItem[] | ((prev: GridItem[]) => GridItem[])) => {
      if (setExternalInventory) {
          setExternalInventory(prev => ({ 
              ...prev, 
              items: typeof itemsUpdater === 'function' ? itemsUpdater(prev.items) : itemsUpdater 
          }));
      } else {
          setLocalLootItems(itemsUpdater);
      }
  };
  
  // Interaction State
  const [selectedItem, setSelectedItem] = useState<GridItem | null>(null);
  const [showItemDetails, setShowItemDetails] = useState<boolean>(false); // 控制详情卡片的显示与隐藏
  const [dragState, setDragState] = useState<{
      item: GridItem;
      sourceGrid: 'PLAYER' | 'LOOT';
      originalX: number;
      originalY: number;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      grabOffsetX: number;
      grabOffsetY: number;
      isDragging: boolean;
  } | null>(null);

  // Smart Arrangement Preview State
  const [smartPreview, setSmartPreview] = useState<{
      targetGrid: 'PLAYER' | 'LOOT';
      movedItems: GridItem[];
  } | null>(null);

  // Search/Identify State
  const [searchingItemId, setSearchingItemId] = useState<string | null>(null);
  const [justRevealedId, setJustRevealedId] = useState<string | null>(null); // For feedback animation
  const [rotateError, setRotateError] = useState(false); // For rotation failure feedback
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // DYNAMIC SCALE ENGINE (等比缩小核心)
  const [scale, setScale] = useState(1);
  useEffect(() => {
      const updateScale = () => {
          if (!containerRef.current) return;
          // 核心修复：必须获取当前容器的【真实可用高度】，而不是整个屏幕高度！排除外层标题栏和 Padding 的干扰
          const availableH = containerRef.current.clientHeight;
          const availableW = containerRef.current.clientWidth;
          
          // 优化：略微降低高度期望值，让整体画面更加紧凑
          const requiredH = (externalInventory || isLootPhase) ? 720 : 420; 
          const requiredW = 360;
          
          let s = Math.min(availableH / requiredH, availableW / requiredW);
          if (s > 1) s = 1;
          setScale(s);
      };
      
      // 初始化执行，并延迟 100ms 再次执行以确保 DOM 结构已经完全撑开
      updateScale();
      const timer = setTimeout(updateScale, 100);
      
      window.addEventListener('resize', updateScale);
      return () => {
          window.removeEventListener('resize', updateScale);
          clearTimeout(timer);
      };
  }, [externalInventory, isLootPhase]);

  // PAGINATION LOGIC (Warehouse Box Mode)
  const [warehousePage, setWarehousePage] = useState(0);
  const isPaginated = !!externalInventory;
  const rowsPerPage = 5; // 修改为单页5行
  const activeExternalHeight = externalInventory ? externalInventory.height : CONTAINER_HEIGHT;
  const totalPages = isPaginated ? Math.ceil(activeExternalHeight / rowsPerPage) : 1;
  const startY = isPaginated ? warehousePage * rowsPerPage : 0;
  const endY = isPaginated ? Math.min(startY + rowsPerPage, activeExternalHeight) : CONTAINER_HEIGHT;

  // Refs for Grids to calculate hover
  const playerGridRef = useRef<HTMLDivElement>(null);
  const lootGridRef = useRef<HTMLDivElement>(null);

  // Pagination Hover Timer & Validation System
  const paginationRef = useRef({ page: 0, total: 1 });
  useEffect(() => { paginationRef.current = { page: warehousePage, total: totalPages }; }, [warehousePage, totalPages]);
  const edgeScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [hoveringEdge, setHoveringEdge] = useState<'LEFT' | 'RIGHT' | null>(null);
  const hoveringEdgeRef = useRef<'LEFT' | 'RIGHT' | null>(null);

  const checkPlayerLock = (gridType: 'PLAYER' | 'LOOT', item: GridItem, cellX: number, cellY: number) => {
      if (gridType !== 'PLAYER') return true;
      for (let r = 0; r < item.shape.length; r++) {
          for (let c = 0; c < item.shape[0].length; c++) {
              if (item.shape[r][c] && !isPlayerCellUnlocked(cellX + c, cellY + r, playerLevel)) return false;
          }
      }
      return true;
  };

  // Determine Active Grid for Ghost Rendering (Prevent Double Ghost)
  let activeGhostGrid: 'PLAYER' | 'LOOT' | null = null;
  if (dragState && dragState.isDragging) {
      const pRect = playerGridRef.current?.getBoundingClientRect();
      const lRect = lootGridRef.current?.getBoundingClientRect();
      const { currentX, currentY } = dragState;

      if (pRect && 
          currentX >= pRect.left && currentX <= pRect.right && 
          currentY >= pRect.top && currentY <= pRect.bottom) {
          activeGhostGrid = 'PLAYER';
      } else if (lRect && 
          currentX >= lRect.left && currentX <= lRect.right && 
          currentY >= lRect.top && currentY <= lRect.bottom) {
          activeGhostGrid = 'LOOT';
      }
  }

  // --- LOOT GENERATION ---
  useEffect(() => {
    if (isLootPhase && lootItems.length === 0 && !isBoxOpen) {
      let currentGrid = createEmptyGrid(CONTAINER_WIDTH, CONTAINER_HEIGHT);
      const newItems: GridItem[] = [];
      const dropCount = Math.floor(Math.random() * 3) + 2; 

      for (let i = 0; i < dropCount; i++) {
        const template = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
        let placed = false;
        let attempts = 0;
        
        // Create Rectangular Mask for Unidentified State
        const rows = template.shape.length;
        const cols = template.shape[0]?.length || 0;
        const rectShape = Array.from({ length: rows }, () => Array(cols).fill(1));

        while (!placed && attempts < 20) {
           const randX = Math.floor(Math.random() * CONTAINER_WIDTH);
           const randY = Math.floor(Math.random() * CONTAINER_HEIGHT);
           
           const newItem: GridItem = {
               ...template,
               id: `loot-${Date.now()}-${i}`,
               x: randX,
               y: randY,
               rotation: 0,
               isIdentified: false,
               shape: rectShape, // Use Rectangle initially
               originalShape: template.shape, // Store real shape
               quantity: 1
           };
           
           if (canPlaceItem(currentGrid, newItem, randX, randY)) {
               currentGrid = placeItemInGrid(currentGrid, newItem, randX, randY);
               newItems.push(newItem);
               placed = true;
           }
           attempts++;
        }
      }
      setLootItems(newItems);
      setLootGrid(currentGrid);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLootPhase]);

  // --- TEST BUTTON HANDLER ---
  const handleAddTestLoot = () => {
      const template = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
      const rows = template.shape.length;
      const cols = template.shape[0]?.length || 0;
      const rectShape = Array.from({ length: rows }, () => Array(cols).fill(1));
      
      let placed = false;
      let currentGrid = [...lootGrid];
      let newItems = [...lootItems];

      // Try random positions
      for(let attempt=0; attempt<50; attempt++) {
           const randX = Math.floor(Math.random() * (externalInventory ? externalInventory.width : CONTAINER_WIDTH));
           const randY = Math.floor(Math.random() * (externalInventory ? externalInventory.height : CONTAINER_HEIGHT));
           
           const newItem: GridItem = {
               ...template,
               id: `loot-test-${Date.now()}`,
               x: randX,
               y: randY,
               rotation: 0,
               isIdentified: false,
               originalShape: template.shape,
               shape: rectShape,
               quantity: 1
           };
           
           if (canPlaceItem(currentGrid, newItem, randX, randY)) {
               currentGrid = placeItemInGrid(currentGrid, newItem, randX, randY);
               newItems.push(newItem);
               setLootItems(newItems);
               setLootGrid(currentGrid);
               placed = true;
               break;
           }
      }
      
      if (!placed) {
          console.log("Loot box full or no space for item");
      }
  };

  const handleAddTestItemToPlayer = () => {
      const template = LOOT_TABLE[Math.floor(Math.random() * LOOT_TABLE.length)];
      const rows = template.shape.length;
      const cols = template.shape[0]?.length || 0;
      const rectShape = Array.from({ length: rows }, () => Array(cols).fill(1));
      
      let placed = false;
      let currentGrid = [...inventory.grid];
      let newItems = [...inventory.items];

      // Try random positions in Backpack area (Rows >= EQUIPMENT_ROW_COUNT)
      for(let attempt=0; attempt<50; attempt++) {
           const randX = Math.floor(Math.random() * INVENTORY_WIDTH);
           const randY = Math.floor(Math.random() * (INVENTORY_HEIGHT - EQUIPMENT_ROW_COUNT)) + EQUIPMENT_ROW_COUNT;
           
           const newItem: GridItem = {
               ...template,
               id: `player-test-${Date.now()}`,
               x: randX,
               y: randY,
               rotation: 0,
               isIdentified: true, // Identify immediately for player test
               originalShape: template.shape,
               shape: rectShape,
               quantity: 1
           };
           
           if (canPlaceItem(currentGrid, newItem, randX, randY)) {
               const newGrid = placeItemInGrid(currentGrid, newItem, randX, randY);
               const newInventoryState = {
                   ...inventory,
                   items: [...newItems, newItem],
                   grid: newGrid
               };
               
               // If setMetaState is provided (Warehouse mode), use it to update roster
               // Actually, setInventory in Warehouse mode IS handleCharacterInventoryUpdate which calls setMetaState
               // So calling setInventory(newInventoryState) should work IF setInventory is correctly typed and passed.
               // The error "setMetaState is not a function" happened because setInventory called setMetaState which was undefined.
               // Now that we passed setMetaState to BaseCampView -> InventoryView, we might not even need to use it here directly if setInventory works.
               // BUT, let's look at BaseCampView again.
               // handleCharacterInventoryUpdate calls setMetaState.
               // So if setMetaState is passed to BaseCampView, it should work.
               // Wait, the error was "Uncaught TypeError: setMetaState is not a function" inside handleCharacterInventoryUpdate?
               // Yes, because BaseCampView didn't receive setMetaState from App.tsx?
               // No, App.tsx passes setMetaState to BaseCampView.
               // Wait, I checked App.tsx and it WAS NOT passing setMetaState to BaseCampView.
               // I fixed that in Step 106.
               
               // So, simply calling setInventory here should work now.
               setInventory(newInventoryState);
               
               placed = true;
               break;
           }
      }
      
      if (!placed) {
          console.log("Inventory full or no space for item");
      }
  };

  // --- IDENTIFY LOGIC ---
  const handleSearchItem = (item: GridItem) => {
      if (searchingItemId) return;
      if (item.isIdentified) return; 

      setSearchingItemId(item.id);
      
      // Dynamic Search Time based on Rarity
      let duration = 800; // Common
      if (item.rarity === 'RARE') duration = 1500;
      if (item.rarity === 'LEGENDARY') duration = 3000;
      
      timerRef.current = setTimeout(() => {
          completeSearch(item.id);
      }, duration);
  };

  const handleTakeAll = () => {
      // Move all identified items from Loot to Player
      
      let currentLootItems = [...lootItems];
      let currentLootGrid = [...lootGrid];
      let currentPlayerItems = [...inventory.items];
      let currentPlayerGrid = [...inventory.grid];
      let changed = false;

      // Identify items first? No, only take identified.
      const identifiedLoot = currentLootItems.filter(i => i.isIdentified);
      
      for (const item of identifiedLoot) {
          // Attempt simple place first
          let placed = false;
          
          // TRY STACKING FIRST
          if (item.type === 'CONSUMABLE') {
              for (const existingItem of currentPlayerItems) {
                  if (existingItem.type === 'CONSUMABLE' && existingItem.name === item.name) {
                      existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
                      currentLootGrid = removeItemFromGrid(currentLootGrid, item.id);
                      currentLootItems = currentLootItems.filter(i => i.id !== item.id);
                      placed = true;
                      changed = true;
                      break;
                  }
              }
          }

          if (!placed) {
              // Try placing in grid
              for (let y = 0; y < INVENTORY_HEIGHT; y++) {
                  if (placed) break;
                  for (let x = 0; x < INVENTORY_WIDTH; x++) {
                      if (canPlaceItem(currentPlayerGrid, item, x, y)) {
                          // Move logic
                          // 1. Add to player
                          const newItem = { ...item, x, y, rotation: 0, shape: item.originalShape, originalShape: item.originalShape };
                          currentPlayerGrid = placeItemInGrid(currentPlayerGrid, newItem, x, y);
                          currentPlayerItems.push(newItem);
                          
                          // 2. Remove from loot
                          currentLootGrid = removeItemFromGrid(currentLootGrid, item.id);
                          currentLootItems = currentLootItems.filter(i => i.id !== item.id);
                          
                          placed = true;
                          changed = true;
                          break;
                      }
                  }
              }
          }
      }

      if (changed) {
          setInventory({ ...inventory, items: currentPlayerItems, grid: currentPlayerGrid });
          setLootItems(currentLootItems);
          setLootGrid(currentLootGrid);
      }
  };

  const completeSearch = (itemId: string) => {
      // Find item in loot or player
      const updateList = (items: GridItem[]) => items.map(item => {
          if (item.id === itemId && item.originalShape) {
               // Restore Shape
               return { ...item, isIdentified: true, shape: item.originalShape };
          }
          return item;
      });

      setLootItems(prev => {
          const updated = updateList(prev);
          rebuildLootGrid(updated);
          return updated;
      });
      
      setInventory(prev => {
          const updated = updateList(prev.items);
          const newGrid = rebuildGrid(updated, prev.width, prev.height);
          return { ...prev, items: updated, grid: newGrid };
      });

      // Feedback Animation Trigger
      setSearchingItemId(null);
      setJustRevealedId(itemId);
      
      setTimeout(() => {
          setJustRevealedId(null);
      }, 800);
  };

  const rebuildGrid = (items: GridItem[], w: number, h: number) => {
      let g = createEmptyGrid(w, h);
      items.forEach(i => {
          if (canPlaceItem(g, i, i.x, i.y)) { 
              g = placeItemInGrid(g, i, i.x, i.y);
          }
      });
      return g;
  };

  const rebuildLootGrid = (items: GridItem[]) => {
      const w = externalInventory ? externalInventory.width : CONTAINER_WIDTH;
      const h = externalInventory ? externalInventory.height : CONTAINER_HEIGHT;
      const g = rebuildGrid(items, w, h);
      setLootGrid(g);
  };

  // --- DRAG & DROP LOGIC ---

  const handlePointerDown = (e: React.PointerEvent, item: GridItem, sourceGrid: 'PLAYER' | 'LOOT', cellX: number, cellY: number) => {
          // Allow scrolling for unidentified items (don't prevent default)
          if (item.isIdentified) {
              e.preventDefault();
          }

          // Lock check: In combat, we ALLOW selection (click), but we will BLOCK dragging in pointerMove
          if (searchingItemId !== null) return; // Busy
          
          setShowItemDetails(false); // 核心：每次点击或开始拖拽物品时，自动收起庞大的详情面板

          const rect = e.currentTarget.getBoundingClientRect();
      
      // Core Fix: e.currentTarget is the bounding box covering the entire item shape.
      // e.clientX - rect.left is exactly the pixel distance from pointer to the item's true top-left corner.
      // No extra math (deltaX/Y) is needed! This solves all janky snapping offsets.
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      setDragState({
          item,
          sourceGrid,
          originalX: item.x,
          originalY: item.y,
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
          grabOffsetX: offsetX,
          grabOffsetY: offsetY,
          isDragging: false
      });
  };

  // Calculate Target Cell logic extracted for reuse in Move and Preview
  const calculateTargetCell = (
      clientX: number, clientY: number, 
      grabOffsetX: number, grabOffsetY: number, 
      gridRect: DOMRect, gridW: number, gridH: number,
      itemShape?: number[][], targetUnlocked?: number,
      pageYOffset: number = 0,
      rowsPerPageLimit?: number
  ) => {
      // 核心修复：引入全局 scale 因子，并在计算中绝对对齐屏幕像素！
      const scaledStride = (CELL_SIZE + CELL_GAP) * scale;
      const scaledPadding = 8 * scale;
      
      // Calculate true visual top-left relative to grid content area in SCREEN PIXELS
      const itemLeft = clientX - grabOffsetX - gridRect.left - scaledPadding;
      const itemTop = clientY - grabOffsetY - gridRect.top - scaledPadding;
      
      // Math.round is perfectly accurate and avoids half-cell floor biases
      let cellX = Math.round(itemLeft / scaledStride);
      let cellY = Math.round(itemTop / scaledStride) + pageYOffset;
      
      const shapeW = itemShape ? (itemShape[0]?.length || 1) : 1;
      const shapeH = itemShape ? (itemShape.length || 1) : 1;
      
      cellX = Math.max(0, Math.min(cellX, gridW - shapeW));
      
      const currentGridBottom = rowsPerPageLimit ? Math.min(gridH, pageYOffset + rowsPerPageLimit) : gridH;
      cellY = Math.max(pageYOffset, Math.min(cellY, currentGridBottom - shapeH));
      
      if (targetUnlocked !== undefined) {
          cellY = Math.min(cellY, targetUnlocked - shapeH);
          cellY = Math.max(pageYOffset, cellY); 
      }
      
      return { cellX, cellY };
  };

  useEffect(() => {
      const handlePointerMove = (e: PointerEvent) => {
          if (!dragState) return;
          
          // Combat Logic: Lock movement/drag, but allow selection (click)
          if (isCombat) return;

          // Unidentified items CANNOT be dragged
          if (!dragState.item.isIdentified) return;

          const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
          const isDragging = dragState.isDragging || dist > 5;
          
          setDragState(prev => prev ? ({
              ...prev,
              currentX: e.clientX,
              currentY: e.clientY,
              isDragging
          }) : null);

          // --- SMART PREVIEW LOGIC & EDGE HOVER PAGINATION ---
          if (isDragging) {
              const playerRect = playerGridRef.current?.getBoundingClientRect();
              const lootRect = lootGridRef.current?.getBoundingClientRect();

              // EDGE HOVER PAGINATION
              let newHoverEdge: 'LEFT' | 'RIGHT' | null = null;
              if (lootRect && isPaginated) {
                  // 1. 获取物品占用的列数
                  const itemCols = dragState.item.shape[0]?.length || 1;
                  
                  // 2. 动态计算当前缩放下的物品实际视觉宽度 (36px格子 + 4px间隙)
                  const itemVisualWidth = itemCols * (36 + 4) * scale;
                  
                  // 3. 计算物品在屏幕上的视觉左边缘和中心点 X 坐标
                  const itemLeftX = e.clientX - dragState.grabOffsetX;
                  const itemCenterX = itemLeftX + itemVisualWidth / 2;

                  // 4. 核心判定：物品的中心点越过仓库左右边界 (即精确超出 50% 位置)，且垂直高度在仓库范围内
                  const isNearLeft = itemCenterX < lootRect.left && itemCenterX > lootRect.left - itemVisualWidth && e.clientY >= lootRect.top && e.clientY <= lootRect.bottom;
                  const isNearRight = itemCenterX > lootRect.right && itemCenterX < lootRect.right + itemVisualWidth && e.clientY >= lootRect.top && e.clientY <= lootRect.bottom;
                  
                  const { page, total } = paginationRef.current;
                  if (isNearLeft && page > 0) newHoverEdge = 'LEFT';
                  else if (isNearRight && page < total - 1) newHoverEdge = 'RIGHT';
              }

              if (newHoverEdge !== hoveringEdgeRef.current) {
                  hoveringEdgeRef.current = newHoverEdge;
                  setHoveringEdge(newHoverEdge);
                  
                  if (edgeScrollTimer.current) {
                      clearTimeout(edgeScrollTimer.current);
                      edgeScrollTimer.current = null;
                  }
                  
                  if (newHoverEdge === 'LEFT') {
                      edgeScrollTimer.current = setTimeout(() => {
                          setWarehousePage(p => Math.max(0, p - 1));
                      }, 600);
                  } else if (newHoverEdge === 'RIGHT') {
                      edgeScrollTimer.current = setTimeout(() => {
                          setWarehousePage(p => Math.min(paginationRef.current.total - 1, p + 1));
                      }, 600);
                  }
              }

              let targetGridType: 'PLAYER' | 'LOOT' | null = null;
              let gridRect = null;
              let gridItems: GridItem[] = [];
              let gW = 0; 
              let gH = 0;

              if (playerRect && e.clientX >= playerRect.left && e.clientX <= playerRect.right && e.clientY >= playerRect.top && e.clientY <= playerRect.bottom) {
                  targetGridType = 'PLAYER';
                  gridRect = playerRect;
                  gridItems = inventory.items;
                  // 强制覆盖缓存数据中的旧高度，使用严格常量标准
                  gW = INVENTORY_WIDTH; 
                  gH = INVENTORY_HEIGHT;
              } else if (lootRect && e.clientX >= lootRect.left && e.clientX <= lootRect.right && e.clientY >= lootRect.top && e.clientY <= lootRect.bottom) {
                  targetGridType = 'LOOT';
                  gridRect = lootRect;
                  gridItems = lootItems;
                  gW = externalInventory ? externalInventory.width : CONTAINER_WIDTH; 
                  gH = externalInventory ? externalInventory.height : CONTAINER_HEIGHT;
              }

              if (targetGridType && gridRect) {
                   const targetUnlocked = targetGridType === 'PLAYER' ? inventory.unlockedRows : externalInventory?.unlockedRows;
                   const pageYOffset = targetGridType === 'LOOT' && isPaginated ? warehousePage * rowsPerPage : 0;
                   const rowsLimit = targetGridType === 'LOOT' && isPaginated ? rowsPerPage : undefined;
                   
                   const { cellX, cellY } = calculateTargetCell(
                       e.clientX, e.clientY, 
                       dragState.grabOffsetX, dragState.grabOffsetY, 
                       gridRect, gW, gH, 
                       dragState.item.shape, targetUnlocked, pageYOffset, rowsLimit
                   );
                   
                   // Check collision with standard logic first
                   // Remove dragging item from grid simulation
                   let tempItems = gridItems;
                   if (dragState.sourceGrid === targetGridType) {
                       tempItems = gridItems.filter(i => i.id !== dragState.item.id);
                   }
                   
                   const tempGrid = rebuildGrid(tempItems, gW, gH);
                   const itemForCheck = dragState.item;
                   
                   const ctx: 'AGENT' | 'COMMANDER' | 'WAREHOUSE' | 'LOOT' = targetGridType === 'LOOT' ? 'WAREHOUSE' : (playerClass === 'COMMANDER' ? 'COMMANDER' : 'AGENT');
                   const isStandardValid = canPlaceItem(tempGrid, itemForCheck, cellX, cellY, targetUnlocked, ctx) && checkPlayerLock(targetGridType, itemForCheck, cellX, cellY);
                   
                   if (!isStandardValid) {
                        // Collision detected! Try Smart Arrange
                        const rearrangement = findSmartArrangement(tempItems, itemForCheck, cellX, cellY, gW, gH, targetUnlocked);
                        
                        if (rearrangement) {
                            // Smart Arrange Validation (Must respect Player Locks)
                            let smartValid = true;
                            if (targetGridType === 'PLAYER') {
                                if (!checkPlayerLock('PLAYER', itemForCheck, cellX, cellY)) smartValid = false;
                                for (const m of rearrangement) {
                                    if (!checkPlayerLock('PLAYER', m, m.x, m.y)) smartValid = false;
                                }
                            }
                            if (smartValid) {
                                setSmartPreview({
                                    targetGrid: targetGridType,
                                    movedItems: rearrangement
                                });
                                return;
                            }
                        }
                   }
              }
              // If no valid smart preview found (or no collision), clear it
              setSmartPreview(null);
          }
      };

      const handlePointerUp = (e: PointerEvent) => {
          if (edgeScrollTimer.current) {
              clearTimeout(edgeScrollTimer.current);
              edgeScrollTimer.current = null;
          }
          if (hoveringEdgeRef.current) {
              hoveringEdgeRef.current = null;
              setHoveringEdge(null);
          }
          if (!dragState) return;

          if (!dragState.isDragging) {
              // Click Event (works for both identified and unidentified)
              setSelectedItem(dragState.item);
              // Trigger Identity if not identified
              if (!dragState.item.isIdentified) {
                  handleSearchItem(dragState.item);
              }
          } else {
              // Drop Event
              handleDrop(e, dragState);
          }
          setDragState(null);
          setSmartPreview(null);
      };

      const handlePointerCancel = () => {
          if (edgeScrollTimer.current) {
              clearTimeout(edgeScrollTimer.current);
              edgeScrollTimer.current = null;
          }
          if (hoveringEdgeRef.current) {
              hoveringEdgeRef.current = null;
              setHoveringEdge(null);
          }
          setDragState(null);
          setSmartPreview(null);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerCancel);
      return () => {
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          window.removeEventListener('pointercancel', handlePointerCancel);
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, smartPreview]); // Added smartPreview dep to ensure updates trigger if needed, though state setter is enough

  const handleDrop = (e: PointerEvent, state: NonNullable<typeof dragState>) => {
      // Determine target grid
      const playerRect = playerGridRef.current?.getBoundingClientRect();
      const lootRect = lootGridRef.current?.getBoundingClientRect();

      let targetGridType: 'PLAYER' | 'LOOT' | null = null;
      let gridRect = null;
      let gridData = null;
      let targetItemsList: GridItem[] = [];
      let gridW = 0;
      let gridH = 0;

      if (playerRect && 
          e.clientX >= playerRect.left && e.clientX <= playerRect.right &&
          e.clientY >= playerRect.top && e.clientY <= playerRect.bottom) {
          targetGridType = 'PLAYER';
          gridRect = playerRect;
          gridData = inventory.grid;
          targetItemsList = inventory.items;
          gridW = INVENTORY_WIDTH;
          gridH = INVENTORY_HEIGHT;
      } else if (lootRect && 
          e.clientX >= lootRect.left && e.clientX <= lootRect.right &&
          e.clientY >= lootRect.top && e.clientY <= lootRect.bottom) {
          targetGridType = 'LOOT';
          gridRect = lootRect;
          gridData = lootGrid;
          targetItemsList = lootItems;
          gridW = externalInventory ? externalInventory.width : CONTAINER_WIDTH;
          gridH = externalInventory ? externalInventory.height : CONTAINER_HEIGHT;
      }

      if (targetGridType && gridRect) {
          const targetUnlocked = targetGridType === 'PLAYER' ? inventory.unlockedRows : externalInventory?.unlockedRows;
          const pageYOffset = targetGridType === 'LOOT' && isPaginated ? warehousePage * rowsPerPage : 0;
          const rowsLimit = targetGridType === 'LOOT' && isPaginated ? rowsPerPage : undefined;
          
          const { cellX, cellY } = calculateTargetCell(
              e.clientX, e.clientY, 
              state.grabOffsetX, state.grabOffsetY, 
              gridRect, gridW, gridH, 
              state.item.shape, targetUnlocked, pageYOffset, rowsLimit
          );

          // Logic
          // 1. Remove from source temporarily to check placement
          let tempTargetGrid = gridData;
          if (state.sourceGrid === targetGridType) {
              tempTargetGrid = removeItemFromGrid(gridData, state.item.id);
          }
          
          // 2. CHECK FOR STACKING (Collision with Identical Consumable)
          let collisionItem: GridItem | null = null;
          if (cellX >= 0 && cellY >= 0 && cellY < gridData.length && cellX < (gridData[0]?.length || 0)) {
              const targetId = tempTargetGrid[cellY][cellX];
              if (targetId) {
                  collisionItem = targetItemsList.find(i => i.id === targetId) || null;
              }
          }

          if (collisionItem && 
              collisionItem.type === 'CONSUMABLE' && 
              state.item.type === 'CONSUMABLE' &&
              collisionItem.name === state.item.name &&
              collisionItem.id !== state.item.id) {
              mergeItems(state.item, collisionItem, state.sourceGrid, targetGridType);
              return;
          }

          // 3. Check Placement OR Smart Arrange
          const itemForCheck = state.item;
          const ctx: 'AGENT' | 'COMMANDER' | 'WAREHOUSE' | 'LOOT' = targetGridType === 'LOOT' ? 'WAREHOUSE' : (playerClass === 'COMMANDER' ? 'COMMANDER' : 'AGENT');

          // Standard Place with Lock Validation
          if (canPlaceItem(tempTargetGrid, itemForCheck, cellX, cellY, targetUnlocked, ctx) && checkPlayerLock(targetGridType, itemForCheck, cellX, cellY)) {
               moveItem(state.item, state.sourceGrid, targetGridType, cellX, cellY);
               return;
          }

          // Smart Arrange Commit
          if (smartPreview && smartPreview.targetGrid === targetGridType) {
              // Apply the moves in smartPreview.movedItems first
              // then place the dragged item
              commitSmartArrange(state.item, state.sourceGrid, targetGridType, cellX, cellY, smartPreview.movedItems);
              return;
          }
      }
  };

  const commitSmartArrange = (
      draggedItem: GridItem, 
      sourceGrid: 'PLAYER' | 'LOOT', 
      targetGrid: 'PLAYER' | 'LOOT', 
      targetX: number, 
      targetY: number, 
      movedItems: GridItem[]
  ) => {
      // 1. Get the list of items for the target grid
      let currentItems = targetGrid === 'PLAYER' ? [...inventory.items] : [...lootItems];

      // 2. Remove dragged item from source if it was in the same grid (to avoid duplication logic issues)
      if (sourceGrid === targetGrid) {
          currentItems = currentItems.filter(i => i.id !== draggedItem.id);
      } else {
          // If cross-grid, remove from source grid now
           if (sourceGrid === 'PLAYER') {
              setInventory(prev => {
                  const items = prev.items.filter(i => i.id !== draggedItem.id);
                  return { ...prev, items, grid: rebuildGrid(items, prev.width, prev.height) };
              });
           } else {
              setLootItems(prev => {
                  const items = prev.filter(i => i.id !== draggedItem.id);
                  rebuildLootGrid(items);
                  return items;
              });
           }
      }

      // 3. Update coordinates of displaced items in the list
      const movedMap = new Map(movedItems.map(i => [i.id, i]));
      const updatedItems = currentItems.map(item => {
          if (movedMap.has(item.id)) {
              return movedMap.get(item.id)!;
          }
          return item;
      });

      // 4. Add the dragged item to the list at new pos
      const newItem = { ...draggedItem, x: targetX, y: targetY };
      updatedItems.push(newItem);

      // 5. Commit to State
      if (targetGrid === 'PLAYER') {
          setInventory(prev => ({ ...prev, items: updatedItems, grid: rebuildGrid(updatedItems, prev.width, prev.height) }));
      } else {
          setLootItems(updatedItems);
          rebuildLootGrid(updatedItems);
      }
      setSelectedItem(newItem);
  };

  const mergeItems = (sourceItem: GridItem, targetItem: GridItem, sourceGrid: 'PLAYER' | 'LOOT', targetGrid: 'PLAYER' | 'LOOT') => {
      const quantityToAdd = sourceItem.quantity || 1;
      
      // Update Target Grid (Where targetItem lives)
      const updateTargetFn = (prevItems: GridItem[]) => prevItems.map(i => {
          if (i.id === targetItem.id) {
              return { ...i, quantity: (i.quantity || 1) + quantityToAdd };
          }
          return i;
      });

      if (targetGrid === 'PLAYER') {
          setInventory(prev => ({ ...prev, items: updateTargetFn(prev.items) }));
      } else {
          setLootItems(prev => updateTargetFn(prev));
      }

      // Remove Source Item
      if (sourceGrid === 'PLAYER') {
          setInventory(prev => {
              const newItems = prev.items.filter(i => i.id !== sourceItem.id);
              const newGrid = removeItemFromGrid(prev.grid, sourceItem.id);
              return { ...prev, items: newItems, grid: newGrid };
          });
      } else {
          setLootItems(prev => {
              const newItems = prev.filter(i => i.id !== sourceItem.id);
              const newGrid = removeItemFromGrid(lootGrid, sourceItem.id);
              setLootGrid(newGrid); // Ensure grid updates
              return newItems;
          });
      }
      setSelectedItem(null);
  };

 
  const moveItem = (item: GridItem, source: 'PLAYER' | 'LOOT', target: 'PLAYER' | 'LOOT', x: number, y: number) => {
      const newItem = { ...item, x, y }; // 彻底保留其当前的所有状态（包括真实的 rotation 和 shape）
      
      // Update Source List
      if (source === 'PLAYER') {
          const newItems = inventory.items.filter(i => i.id !== item.id);
          const newGrid = removeItemFromGrid(inventory.grid, item.id);
          setInventory({ ...inventory, items: newItems, grid: newGrid });
      } else {
          const newItems = lootItems.filter(i => i.id !== item.id);
          const newGrid = removeItemFromGrid(lootGrid, item.id);
          setLootItems(newItems);
          setLootGrid(newGrid);
      }

      // Add to Target List (Logic allows cross-moving if grids update sequentially in state)
      
      if (source === target) {
          // Same Grid Move
          if (target === 'PLAYER') {
             setInventory(prev => {
                 const without = prev.items.filter(i => i.id !== item.id);
                 const gridWithout = removeItemFromGrid(prev.grid, item.id);
                 // Place
                 const gridWith = placeItemInGrid(gridWithout, newItem, x, y);
                 return { ...prev, items: [...without, newItem], grid: gridWith };
             });
          } else {
             setLootItems(prev => {
                 const without = prev.filter(i => i.id !== item.id);
                 return [...without, newItem];
             });
             setLootGrid(prev => {
                 const gridWithout = removeItemFromGrid(prev, item.id);
                 return placeItemInGrid(gridWithout, newItem, x, y);
             });
          }
      } else {
          // Cross Grid Move
          if (target === 'PLAYER') {
              setInventory(prev => {
                  const gridWith = placeItemInGrid(prev.grid, newItem, x, y);
                  return { ...prev, items: [...prev.items, newItem], grid: gridWith };
              });
          } else {
               setLootItems(prev => [...prev, newItem]);
               setLootGrid(prev => {
                   return placeItemInGrid(prev, newItem, x, y);
               });
          }
      }
      
      setSelectedItem(newItem); // Keep selection
  };

  // --- ACTIONS ---
  const handleRotate = () => {
    if (!selectedItem || isCombat) return;
    
    // 1. Calculate new rotation/shape
    const nextRot = (selectedItem.rotation + 90) % 360 as 0 | 90 | 180 | 270;
    const dummyItem = { ...selectedItem, rotation: nextRot };
    const newShape = getRotatedShape(dummyItem); 
    
    // 2. Prepare grid environment
    const isPlayerInventory = inventory.items.some(i => i.id === selectedItem.id);
    const gridData = isPlayerInventory ? inventory.grid : lootGrid;
    
    // Remove self from grid temporarily to allow rotation in place
    const tempGrid = removeItemFromGrid(gridData, selectedItem.id);
    const tempItem = { ...selectedItem, rotation: nextRot, shape: newShape };
    
    // 3. SMART ROTATION (Wall Kicks with extended range)
    // Try original position first, then try offsets (up, left, right, down, diagonals)
    const offsets = [
        [0, 0],   // Center
        [-1, 0],  // Left
        [1, 0],   // Right
        [0, -1],  // Up
        [0, 1],   // Down
        [-1, -1], // Up-Left
        [1, -1],  // Up-Right
        [-1, 1],  // Down-Left
        [1, 1],   // Down-Right
        [-2, 0], [2, 0], [0, -2], [0, 2] // Extra range
    ];

    let foundX = -1;
    let foundY = -1;
    const targetUnlocked = !isPlayerInventory ? externalInventory?.unlockedRows : undefined;
    const ctx: 'AGENT' | 'COMMANDER' | 'WAREHOUSE' | 'LOOT' = !isPlayerInventory ? 'WAREHOUSE' : (playerClass === 'COMMANDER' ? 'COMMANDER' : 'AGENT');

    for (const [dx, dy] of offsets) {
        const testX = selectedItem.x + dx;
        const testY = selectedItem.y + dy;
        
        if (canPlaceItem(tempGrid, tempItem, testX, testY, targetUnlocked, ctx) && checkPlayerLock(isPlayerInventory ? 'PLAYER' : 'LOOT', tempItem, testX, testY)) {
            foundX = testX;
            foundY = testY;
            break;
        }
    }

    if (foundX !== -1) {
        setRotateError(false);
        // Apply Rotation at found coordinates
        const updateItem = (i: GridItem) => i.id === selectedItem.id ? { ...i, rotation: nextRot, shape: newShape, x: foundX, y: foundY } : i;
        
        if (isPlayerInventory) {
             setInventory(prev => {
                 const updatedItems = prev.items.map(updateItem);
                 const updatedGrid = rebuildGrid(updatedItems, prev.width, prev.height);
                 return { ...prev, items: updatedItems, grid: updatedGrid };
             });
        } else {
             setLootItems(prev => {
                 const updatedItems = prev.map(updateItem);
                 rebuildLootGrid(updatedItems);
                 return updatedItems;
             });
        }
        // 核心修复：移除了导致程序崩溃的 newOriginalShape 变量
        setSelectedItem(prev => prev ? { ...prev, rotation: nextRot, shape: newShape, x: foundX, y: foundY } : null);
    } else {
        setRotateError(true);
        setTimeout(() => setRotateError(false), 2000);
    }
  };

  const handleTrash = () => {
     if (!selectedItem || isCombat) return;
     // Remove
     if (inventory.items.some(i => i.id === selectedItem.id)) {
         setInventory(prev => {
             const newItems = prev.items.filter(i => i.id !== selectedItem.id);
             const newGrid = removeItemFromGrid(prev.grid, selectedItem.id);
             return { ...prev, items: newItems, grid: newGrid };
         });
     } else {
         setLootItems(prev => {
             const newItems = prev.filter(i => i.id !== selectedItem.id);
             rebuildLootGrid(newItems);
             return newItems;
         });
     }
     setSelectedItem(null);
  };

  const handleUseItem = () => {
      if (selectedItem && selectedItem.type === 'CONSUMABLE' && onConsume) {
          onConsume(selectedItem);

          // Remove Logic with Stacking Support
          const removeFromList = (items: GridItem[]) => {
              return items.map(i => {
                  if (i.id === selectedItem.id) {
                      return { ...i, quantity: (i.quantity || 1) - 1 };
                  }
                  return i;
              }).filter(i => (i.quantity || 0) > 0);
          };

          if (inventory.items.some(i => i.id === selectedItem.id)) {
              setInventory(prev => {
                  const newItems = removeFromList(prev.items);
                  // Rebuild grid completely to reflect removal/update
                  const newGrid = rebuildGrid(newItems, prev.width, prev.height);
                  return { ...prev, items: newItems, grid: newGrid };
              });
              // Update selected item if it still exists (quantity > 0)
              if ((selectedItem.quantity || 1) > 1) {
                  setSelectedItem(prev => prev ? { ...prev, quantity: (prev.quantity || 1) - 1 } : null);
              } else {
                  setSelectedItem(null);
              }
          } else if (lootItems.some(i => i.id === selectedItem.id)) {
               setLootItems(prev => {
                   const newItems = removeFromList(prev);
                   rebuildLootGrid(newItems);
                   return newItems;
               });
               if ((selectedItem.quantity || 1) > 1) {
                   setSelectedItem(prev => prev ? { ...prev, quantity: (prev.quantity || 1) - 1 } : null);
               } else {
                   setSelectedItem(null);
               }
          }
      }
  };

  // --- RENDERING ---
  const renderCell = (x: number, y: number, gridType: 'PLAYER' | 'LOOT', gridData: (string|null)[][], itemsList: GridItem[]) => {
      const itemId = gridData[y][x];
      
      // Check if this item is currently being "Ghost Moved" by the smart preview
      let isGhostMoving = false;
      let displayItem = itemId ? itemsList.find(i => i.id === itemId) : null;
      
      if (smartPreview && smartPreview.targetGrid === gridType && displayItem) {
          // If this item is part of the moved set, we hide the original
          if (smartPreview.movedItems.some(i => i.id === displayItem?.id)) {
              displayItem = null; // Hide it here, we will render it as a ghost later
          }
      }

      // Check if this cell is occupied by a "Ghost Moved" item
      let ghostMovedItem = null;
      if (smartPreview && smartPreview.targetGrid === gridType) {
          // Find if any moved item occupies (x,y)
          ghostMovedItem = smartPreview.movedItems.find(i => {
              if (!i.shape || i.shape.length === 0) return false;
              const dx = x - i.x;
              const dy = y - i.y;
              if (dx >= 0 && dy >= 0 && dy < i.shape.length && dx < (i.shape[0]?.length || 0)) {
                  return i.shape[dy] && i.shape[dy][dx] === 1;
              }
              return false;
          });
      }

      const item = displayItem;
      const isDraggingThis = dragState && dragState.item.id === itemId && dragState.isDragging;
      const isSelected = selectedItem && item && selectedItem.id === item.id;
      const isTopLeft = item && item.x === x && item.y === y;
      const isGhostTopLeft = ghostMovedItem && ghostMovedItem.x === x && ghostMovedItem.y === y;

      const isLocked = (gridType === 'LOOT' && externalInventory !== undefined && externalInventory.unlockedRows !== undefined && y >= externalInventory.unlockedRows) ||
                       (gridType === 'PLAYER' && !isPlayerCellUnlocked(x, y, playerLevel));

      // 核心修复：必须把等级传给区域获取函数，以区分本体(Level 0)和素体
      const effectiveLevel = playerClass === 'COMMANDER' ? 0 : playerLevel;
      const isSafeZone = gridType === 'PLAYER' && getPlayerZone(x, y, effectiveLevel) === 'SAFE';
      const isEquipmentZone = gridType === 'PLAYER' && getPlayerZone(x, y, effectiveLevel) === 'EQUIP';

      // Drag Ghost (Where the user's cursor is trying to place)
      let isGhost = false;
      let isGhostValid = false;
      
      if (dragState && dragState.isDragging && gridType === activeGhostGrid) {
           const rect = gridType === 'PLAYER' ? playerGridRef.current?.getBoundingClientRect() : lootGridRef.current?.getBoundingClientRect();
           if (rect) {
               // 核心修复：直接复用 calculateTargetCell，保证拖拽高亮与落子判定 100% 统一，且包含动态缩放！
               const gH = gridType === 'PLAYER' ? INVENTORY_HEIGHT : (externalInventory ? externalInventory.height : CONTAINER_HEIGHT);
               const gW = gridType === 'PLAYER' ? INVENTORY_WIDTH : (externalInventory ? externalInventory.width : CONTAINER_WIDTH);
               const targetUnlocked = gridType === 'PLAYER' ? inventory.unlockedRows : externalInventory?.unlockedRows;

               const pageYOffset = gridType === 'LOOT' && isPaginated ? warehousePage * rowsPerPage : 0;
               const rowsLimit = gridType === 'LOOT' && isPaginated ? rowsPerPage : undefined;

               const { cellX, cellY } = calculateTargetCell(
                   dragState.currentX, dragState.currentY, 
                   dragState.grabOffsetX, dragState.grabOffsetY, 
                   rect, gW, gH, 
                   dragState.item.shape, targetUnlocked, pageYOffset, rowsLimit
               );
               
               // Check if this specific cell (x,y) is part of the ghost shape at (cellX, cellY)
               const dx = x - cellX;
               const dy = y - cellY;
               
               if (dragState.item.shape && dragState.item.shape.length > 0 && 
                   dx >= 0 && dy >= 0 && dy < dragState.item.shape.length && dx < (dragState.item.shape[0]?.length || 0)) {
                   if (dragState.item.shape[dy] && dragState.item.shape[dy][dx] === 1) {
                       isGhost = true;
                       
                       // Validity Logic
                       // 1. If Smart Preview Active -> Always Valid (Blue/Green)
                       // 2. Else -> Check normal valid
                       if (smartPreview && smartPreview.targetGrid === gridType) {
                           isGhostValid = true;
                       } else {
                           let tempGrid = gridData;
                           if (dragState.sourceGrid === gridType) tempGrid = removeItemFromGrid(gridData, dragState.item.id);
                           const itemForCheck = dragState.item; 
                           const targetUnlocked = gridType === 'LOOT' ? externalInventory?.unlockedRows : undefined;
                           const ctx: 'AGENT' | 'COMMANDER' | 'WAREHOUSE' | 'LOOT' = gridType === 'LOOT' ? 'WAREHOUSE' : (playerClass === 'COMMANDER' ? 'COMMANDER' : 'AGENT');
                           isGhostValid = canPlaceItem(tempGrid, itemForCheck, cellX, cellY, targetUnlocked, ctx) && checkPlayerLock(gridType, itemForCheck, cellX, cellY);

                           // Consumable Stack Check
                           if (!isGhostValid && dragState.item.type === 'CONSUMABLE') {
                                const tId = gridData[y][x];
                                if (tId && tId !== dragState.item.id) {
                                    const tItem = itemsList.find(i => i.id === tId);
                                    if (tItem && tItem.name === dragState.item.name && tItem.type === 'CONSUMABLE') {
                                        isGhostValid = true;
                                    }
                                }
                           }
                       }
                   }
               }
           }
      }

      // Visuals for Item
      let content = null;
      if (item && !isDraggingThis) {
          const isSearching = item.id === searchingItemId;
          const isPending = !item.isIdentified && !isSearching;
          const isJustRevealed = item.id === justRevealedId;
          
          let rarityFlashClass = 'bg-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.8)]'; 
          if (item.rarity === 'RARE') rarityFlashClass = 'bg-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.8)]';
          if (item.rarity === 'LEGENDARY') rarityFlashClass = 'bg-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.8)]';

          const r = y - item.y;
          const c = x - item.x;
          const borderStyle = getSmartBorders(item.shape, r, c);
          
          content = (
              <div 
                className={`
                    absolute inset-0 z-10 cursor-grab active:cursor-grabbing overflow-visible
                    ${item.isIdentified ? 'touch-none transition-transform duration-200' : ''} 
                    ${isSelected ? 'ring-1 ring-white/80 z-20' : ''} 
                    ${isPending ? 'bg-[url("https://www.transparenttextures.com/patterns/carbon-fibre.png")] bg-fixed' : ''}
                    ${item.isIdentified ? item.color.replace('border ', '') : 'bg-stone-900 border-stone-600'} 
                `}
                style={{
                    ...borderStyle,
                    borderColor: !item.isIdentified ? 'rgba(87, 83, 78, 0.6)' : undefined 
                }}
                onPointerDown={(e) => handlePointerDown(e, item, gridType, x, y)}
              >
                  {!item.isIdentified && (
                       <div className="w-full h-full relative flex items-center justify-center">
                           <div className="absolute inset-0 bg-noise opacity-20 animate-hologram"></div>
                           {isSearching && (
                               <>
                                   <div className="absolute inset-0 bg-dungeon-gold/10"></div>
                                   <div className="absolute w-full h-1 bg-dungeon-gold/80 shadow-[0_0_10px_#a16207] animate-scan-line z-20"></div>
                               </>
                           )}
                       </div>
                  )}
                  
                  {isTopLeft && !item.isIdentified && (
                        <div 
                            className="absolute z-50 flex items-center justify-center pointer-events-auto"
                            style={{
                                top: '-1px', left: '-1px',
                                width: `${(item.shape[0]?.length || 1) * CELL_SIZE + ((item.shape[0]?.length || 1) - 1) * CELL_GAP}px`,
                                height: `${item.shape.length * CELL_SIZE + (item.shape.length - 1) * CELL_GAP}px`
                            }}
                            onClick={() => handleSearchItem(item)}
                        >
                            {!isSearching && (
                                <button 
                                    className="bg-black/80 p-1.5 rounded-full border border-stone-500/50 backdrop-blur-sm shadow-xl animate-pulse z-50 hover:scale-110 hover:border-dungeon-gold transition-all"
                                    style={{ transform: (item.shape.length === 1 && (item.shape[0]?.length || 1) === 1) ? 'scale(0.85)' : 'scale(1)' }}
                                >
                                    <LucideScanLine size={18} className="text-dungeon-gold" />
                                </button>
                            )}
                            {isSearching && (
                                <div className="absolute bottom-2 text-[8px] font-mono text-dungeon-gold animate-pulse bg-black/70 px-2 py-0.5 rounded border border-dungeon-gold/30">
                                    DECODING...
                                </div>
                            )}
                        </div>
                  )}

                  {isTopLeft && item.isIdentified && (item.quantity || 1) > 1 && (
                      <div className="absolute -bottom-1 -right-1 z-30 bg-black/80 text-stone-200 text-[10px] font-bold px-1 rounded-tl-sm border-l border-t border-stone-600 font-mono shadow-md">
                          x{item.quantity}
                      </div>
                  )}

                  {isJustRevealed && isTopLeft && (
                       <div 
                            className="absolute top-0 left-0 z-[60] flex items-center justify-center pointer-events-none"
                            style={{
                                width: `${(item.shape[0]?.length || 1) * CELL_SIZE + ((item.shape[0]?.length || 1) - 1) * CELL_GAP}px`,
                                height: `${item.shape.length * CELL_SIZE + (item.shape.length - 1) * CELL_GAP}px`
                            }}
                       >
                            <div className={`absolute inset-0 ${rarityFlashClass} animate-flash-white opacity-60`}></div>
                            <div className={`absolute inset-0 border-4 ${item.rarity === 'LEGENDARY' ? 'border-yellow-200' : 'border-white/50'} animate-ping rounded-sm`}></div>
                       </div>
                  )}
                  {isCombat && gridType === 'PLAYER' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><LucideLock size={12} className="text-red-500"/></div>}
              </div>
          );
      }

      // RENDER GHOST MOVED ITEM (Blue Transparency)
      let ghostContent = null;
      if (ghostMovedItem) {
           const r = y - ghostMovedItem.y;
           const c = x - ghostMovedItem.x;
           const borderStyle = getSmartBorders(ghostMovedItem.shape, r, c);
           const colorClass = ghostMovedItem.isIdentified ? ghostMovedItem.color : 'bg-stone-900 border-stone-600';
           const baseColor = colorClass.split(' ')[0]; // Basic extraction
           
           ghostContent = (
               <div 
                  className={`absolute inset-0 z-0 opacity-40 border border-dashed border-cyan-400 bg-cyan-900/30 transition-all duration-200 pointer-events-none`}
                  style={{ ...borderStyle }}
               >
               </div>
           );
      }

      return (
          <div 
             key={`${x}-${y}`} 
             className={`
                w-9 h-9 border relative select-none
                ${isTopLeft || isGhostTopLeft ? 'z-40' : 'z-10'} 
                ${isLocked ? 'bg-[repeating-linear-gradient(45deg,rgba(153,27,27,0.2),rgba(153,27,27,0.2)_4px,rgba(0,0,0,0)_4px,rgba(0,0,0,0)_8px)] border-red-900/50 overflow-hidden' : isSafeZone ? 'bg-dungeon-gold/10 border-dungeon-gold/30' : isEquipmentZone ? 'bg-blue-900/20 border-blue-800/40' : 'bg-stone-800/60 border-stone-700'}
             `}
          >
              {isSafeZone && !item && x===0 && y===0 && <LucideShieldCheck size={16} className="absolute top-1 left-1 text-dungeon-gold/20" />}
              {isLocked && !item && <div className="absolute inset-0 flex items-center justify-center opacity-20"><LucideLock size={12} className="text-red-500"/></div>}
              {content}
              {ghostContent}
              {isGhost && (
                  <div className={`absolute inset-0 z-30 ${isGhostValid ? 'bg-emerald-500/40 border border-emerald-400' : 'bg-red-500/40 border border-red-400'}`}></div>
              )}
          </div>
      );
  };

  return (
    <div 
        ref={containerRef}
        className="w-full h-full flex flex-col items-center justify-start bg-dungeon-black text-stone-300 relative font-serif animate-fade-in touch-none overflow-hidden pt-1"
    >
      
      <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>

      {/* Main Scaled Container - "等比缩小" 核心包装器 */}
      <div 
        className="flex flex-col w-full max-w-[400px] shrink-0 origin-top relative z-10 transition-transform duration-300"
        style={{ 
            height: (externalInventory || isLootPhase) ? '720px' : '420px',
            transform: `scale(${scale})` 
        }}
      >

        {/* LOOT / EXTERNAL SECTION */}
        {(isLootPhase || externalInventory) && (
            <div className={`flex flex-col items-center justify-center p-2 relative border-b-4 border-stone-800 bg-stone-950/80 shrink-0 ${externalInventory ? 'flex-1 min-h-0 overflow-hidden' : 'min-h-[280px]'}`}>
                {isLootPhase && !isBoxOpen && !externalInventory ? (
                    <div className="flex flex-col items-center cursor-pointer group animate-float" onClick={() => setIsBoxOpen(true)}>
                        <LucideBox size={80} strokeWidth={1} className="text-stone-600 group-hover:text-dungeon-gold transition-colors fill-stone-900" />
                        <div className="mt-4 text-sm font-display font-bold text-stone-500 group-hover:text-dungeon-gold tracking-widest bg-black px-6 py-2 border border-stone-700 group-hover:border-dungeon-gold shadow-lg transition-all">
                            搜索残骸
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-[400px] h-full flex flex-col items-center">
                        <div className="flex justify-between w-full mb-2 px-1 border-b border-stone-800 pb-1 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-dungeon-gold font-display uppercase tracking-widest flex items-center gap-1">
                                    <LucideBox size={14} /> {externalTitle || '战利品箱'}
                                </span>
                                {searchingItemId && <span className="text-[10px] text-stone-500 animate-pulse">正在解码...</span>}
                            </div>
                            
                            <div className="flex gap-2">
                                {/* Test Button - Only in Loot Phase */}
                                {isLootPhase && !externalInventory && (
                                    <button 
                                        onClick={handleAddTestLoot}
                                        className="flex items-center gap-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-400 px-2 py-1 rounded border border-stone-600"
                                    >
                                        <LucidePlus size={12} /> 测试
                                    </button>
                                )}
                                {/* Take All Button - Only in Loot Phase */}
                                {isLootPhase && !externalInventory && lootItems.some(i => i.isIdentified) && (
                                    <button 
                                        onClick={handleTakeAll}
                                        className="flex items-center gap-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-dungeon-gold px-2 py-1 rounded border border-stone-600"
                                    >
                                        <LucideGrab size={12} /> 全部拾取
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="relative p-1 bg-gradient-to-b from-stone-800 to-black rounded-sm border border-stone-700 shadow-inner flex-1 overflow-hidden min-h-0 w-full flex flex-col items-center">
                            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-stone-500"></div>
                            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-stone-500"></div>
                            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-stone-500"></div>
                            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-stone-500"></div>
                            
                            <div 
                                ref={lootGridRef}
                                className="grid gap-1 bg-black/80 mx-auto mt-2 mb-2 relative"
                                style={{ 
                                    gridTemplateColumns: `repeat(${externalInventory ? externalInventory.width : CONTAINER_WIDTH}, 36px)` 
                                }}
                            >
                                {Array.from({length: endY - startY}).map((_, i) => {
                                    const y = startY + i;
                                    return Array.from({length: externalInventory ? externalInventory.width : CONTAINER_WIDTH}).map((_, x) => renderCell(x, y, 'LOOT', lootGrid, lootItems))
                                })}
                                
                                {/* Edge Hover Pagination Indicators */}
                                {isPaginated && dragState && dragState.isDragging && (
                                    <>
                                        {warehousePage > 0 && (
                                            <div className={`absolute left-0 top-0 bottom-0 w-[50px] transition-all duration-300 z-50 pointer-events-none flex flex-col items-center justify-center gap-2 ${hoveringEdge === 'LEFT' ? 'bg-dungeon-gold/30 border-r-2 border-dungeon-gold shadow-[10px_0_20px_rgba(202,138,4,0.3)]' : 'bg-gradient-to-r from-stone-500/10 to-transparent'}`}>
                                                {hoveringEdge === 'LEFT' ? (
                                                    <>
                                                        <LucideLoader2 className="animate-spin text-dungeon-gold" size={24} />
                                                        <span className="text-[10px] text-dungeon-gold font-bold tracking-widest" style={{ writingMode: 'vertical-rl' }}>翻页中</span>
                                                    </>
                                                ) : (
                                                    <span className="text-stone-500 font-bold text-xl">&lt;</span>
                                                )}
                                            </div>
                                        )}
                                        {warehousePage < totalPages - 1 && (
                                            <div className={`absolute right-0 top-0 bottom-0 w-[50px] transition-all duration-300 z-50 pointer-events-none flex flex-col items-center justify-center gap-2 ${hoveringEdge === 'RIGHT' ? 'bg-dungeon-gold/30 border-l-2 border-dungeon-gold shadow-[-10px_0_20px_rgba(202,138,4,0.3)]' : 'bg-gradient-to-l from-stone-500/10 to-transparent'}`}>
                                                {hoveringEdge === 'RIGHT' ? (
                                                    <>
                                                        <LucideLoader2 className="animate-spin text-dungeon-gold" size={24} />
                                                        <span className="text-[10px] text-dungeon-gold font-bold tracking-widest" style={{ writingMode: 'vertical-rl' }}>翻页中</span>
                                                    </>
                                                ) : (
                                                    <span className="text-stone-500 font-bold text-xl">&gt;</span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {externalInventory && externalInventory.unlockedRows !== undefined && externalInventory.unlockedRows < externalInventory.height && (
                                    (() => {
                                        const localY = externalInventory.unlockedRows - startY;
                                        if (localY >= 0 && localY < rowsPerPage) {
                                            return (
                                                <div 
                                                    className="absolute left-0 right-0 z-30 flex justify-center items-center pointer-events-none"
                                                    style={{ top: `${localY * 40}px`, height: '40px' }}
                                                >
                                                    <button 
                                                        className="pointer-events-auto bg-black/80 hover:bg-dungeon-gold/20 border border-dungeon-gold text-dungeon-gold text-xs px-4 py-1 rounded backdrop-blur-sm shadow-lg flex items-center gap-2 transition-all"
                                                        onClick={() => {
                                                            if (setExternalInventory) {
                                                                setExternalInventory(prev => ({...prev, unlockedRows: (prev.unlockedRows || 0) + 1}));
                                                            }
                                                        }}
                                                    >
                                                        <LucideLock size={12} /> 解锁扩容 (🪙 1000)
                                                    </button>
                                                </div>
                                            )
                                        }
                                        return null;
                                    })()
                                )}
                            </div>

                            {/* Pagination Controls */}
                            {isPaginated && totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-auto w-full pt-2 pb-1 border-t border-stone-800/50">
                                    <button 
                                        onClick={() => setWarehousePage(p => Math.max(0, p - 1))} 
                                        disabled={warehousePage === 0} 
                                        className="px-3 py-1 bg-stone-800 text-stone-300 disabled:opacity-30 rounded border border-stone-600 hover:bg-stone-700 font-bold transition-opacity"
                                    >
                                        &lt;
                                    </button>
                                    <span className="text-xs font-mono text-dungeon-gold tracking-widest">页码 {warehousePage + 1} / {totalPages}</span>
                                    <button 
                                        onClick={() => setWarehousePage(p => Math.min(totalPages - 1, p + 1))} 
                                        disabled={warehousePage === totalPages - 1} 
                                        className="px-3 py-1 bg-stone-800 text-stone-300 disabled:opacity-30 rounded border border-stone-600 hover:bg-stone-700 font-bold transition-opacity"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* PLAYER SECTION */}
        <div className={`w-full bg-dungeon-dark border-t-2 border-stone-800 z-30 flex flex-col shadow-[0_-10px_50px_rgba(0,0,0,0.8)] pb-4 shrink-0 ${!isLootPhase && !externalInventory ? 'h-full justify-center' : ''}`}>
            
            {/* 动态注入的素体选择器区域 */}
            {customPlayerHeader}
            
            {/* Info / Action Bar */}
            <div className="min-h-[48px] px-4 py-2 bg-black/40 border-b border-stone-800 mb-2 flex items-center justify-between">
                {selectedItem ? (
                    <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs font-bold font-display truncate ${selectedItem.rarity === 'LEGENDARY' ? 'text-dungeon-gold' : selectedItem.rarity === 'RARE' ? 'text-purple-400' : 'text-stone-300'}`}>
                                {selectedItem.isIdentified ? selectedItem.name : (searchingItemId === selectedItem.id ? '解析中...' : '未知物体')}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-stone-500 truncate">{selectedItem.isIdentified ? TYPE_LABELS[selectedItem.type] : '接触以鉴定'}</span>
                                {rotateError && <span className="text-[10px] text-red-400 font-bold animate-pulse bg-red-900/40 px-1 rounded border border-red-800">空间不足，无法旋转</span>}
                                {selectedItem.quantity && selectedItem.quantity > 1 && (
                                    <span className="text-[10px] text-stone-300 bg-stone-800 px-1 rounded">x{selectedItem.quantity}</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                            {selectedItem.isIdentified ? (
                                <>
                                    {selectedItem.type === 'CONSUMABLE' && (
                                        <button onClick={handleUseItem} className="p-2 bg-green-900/50 text-green-400 border border-green-700 rounded hover:bg-green-900"><LucideZap size={14}/></button>
                                    )}
                                    {/* 点击“信息(i)”图标时，才弹出悬浮卡片 */}
                                    <button onClick={() => setShowItemDetails(true)} className="p-2 bg-stone-800 text-stone-300 border border-stone-600 rounded hover:bg-stone-700"><LucideInfo size={14}/></button>
                                    {!isCombat && <button onClick={handleRotate} className="p-2 bg-stone-800 text-stone-300 border border-stone-600 rounded hover:bg-stone-700"><LucideRotateCw size={14}/></button>}
                                    {!isCombat && <button onClick={handleTrash} className="p-2 bg-red-950/50 text-red-400 border border-red-900 rounded hover:bg-red-900"><LucideTrash2 size={14}/></button>}
                                </>
                            ) : (
                                <div className="text-[10px] text-stone-500 animate-pulse">解析构造...</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between w-full">
                        <div className="text-[10px] text-stone-500 italic">点击物品查看详情 · 拖拽整理</div>
                        {/* Test Button for Player Inventory (Only in Base Camp / Warehouse) */}
                        {externalInventory && (
                            <button 
                                onClick={handleAddTestItemToPlayer}
                                className="flex items-center gap-1 text-[10px] bg-stone-800 hover:bg-stone-700 text-stone-400 px-2 py-1 rounded border border-stone-600"
                            >
                                <LucidePlus size={12} /> 测试物资
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden w-full flex justify-center items-center p-2 min-h-0 relative">
                <div 
                    ref={playerGridRef}
                    className="grid gap-1 bg-black p-2 border-2 border-stone-700 shadow-2xl relative m-auto transition-all"
                    style={{ gridTemplateColumns: `repeat(${playerClass === 'COMMANDER' ? 5 : INVENTORY_WIDTH}, 36px)` }}
                >
                    {/* 动态标记框 - 开启全包围线框及高亮材质 */}
                    {playerClass === 'COMMANDER' ? (
                        <>
                            <div className="absolute top-[8px] left-[8px] w-[76px] h-[36px] border-2 border-dungeon-gold/60 pointer-events-none z-20 flex items-center justify-center p-1 bg-dungeon-gold/10 shadow-[0_0_15px_rgba(202,138,4,0.1)] rounded-sm">
                                <span className="text-[10px] font-bold text-dungeon-gold/80 uppercase">安全</span>
                            </div>
                            <div className="absolute top-[8px] left-[88px] w-[116px] h-[36px] border-2 border-blue-500/60 pointer-events-none z-20 flex items-center justify-center p-1 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)] rounded-sm">
                                <span className="text-[10px] font-bold text-blue-400/80 uppercase">装备</span>
                            </div>
                            <div className="absolute top-[48px] left-[8px] w-[196px] h-[116px] border-2 border-stone-400/50 pointer-events-none z-20 flex items-end justify-end p-1 rounded-sm">
                                <span className="text-[10px] font-bold text-stone-300 uppercase bg-black/80 px-1.5 py-0.5 rounded shadow-lg border border-stone-600/50">背包区</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="absolute top-[8px] left-[8px] w-[116px] h-[116px] border-2 border-dungeon-gold/50 pointer-events-none z-20 flex items-start justify-start p-1 shadow-[0_0_15px_rgba(202,138,4,0.05)] rounded-sm">
                                <span className="text-[10px] font-bold text-dungeon-gold/80 uppercase bg-black/80 px-1 rounded border border-dungeon-gold/30">安全区</span>
                            </div>
                            <div className="absolute top-[8px] right-[8px] w-[196px] h-[76px] border-2 border-blue-500/40 pointer-events-none z-20 flex items-start justify-end p-1 shadow-[0_0_15px_rgba(59,130,246,0.05)] rounded-sm">
                                <span className="text-[10px] font-bold text-blue-400/80 uppercase bg-black/80 px-1 rounded border border-blue-500/30">装备区</span>
                            </div>
                            
                            {/* 素体的倒L型背包区补全（用两个线框拼接成完整包围） */}
                            <div className="absolute bottom-[8px] right-[8px] w-[196px] h-[116px] border-2 border-stone-400/50 pointer-events-none z-20 flex items-end justify-end p-1 rounded-sm">
                                <span className="text-[10px] font-bold text-stone-300 uppercase bg-black/80 px-1.5 py-0.5 rounded shadow-lg border border-stone-600/50">背包区</span>
                            </div>
                            <div className="absolute bottom-[8px] left-[8px] w-[116px] h-[76px] border-2 border-stone-400/50 pointer-events-none z-20 rounded-sm"></div>
                        </>
                    )}
                    
                    {/* 物理裁切：本体只渲染 5x4 以内的格子 */}
                    {Array.from({length: playerClass === 'COMMANDER' ? 4 : INVENTORY_HEIGHT}).map((_, y) =>
                        Array.from({length: playerClass === 'COMMANDER' ? 5 : INVENTORY_WIDTH}).map((_, x) => renderCell(x, y, 'PLAYER', inventory.grid, inventory.items))
                    )}
                </div>
            </div>
            
            {isLootPhase && (
                <div className="px-6 w-full max-w-[320px] mx-auto mt-4 mb-safe">
                    <button onClick={onFinish} disabled={!!searchingItemId} className="w-full flex items-center justify-center gap-2 py-3 bg-dungeon-rust text-stone-200 border border-dungeon-rust font-bold text-sm tracking-[0.2em] font-display hover:bg-dungeon-red shadow-lg disabled:opacity-50 disabled:grayscale">
                        <LucideCheckCircle size={16} /> {currentStage === maxStage ? '完成区域' : '下一层级'}
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Drag Layer - Outside scaled container to prevent clipping, scaled down to match */}
      {dragState && dragState.isDragging && (
          <div 
            className="fixed pointer-events-none z-[100] opacity-80"
            style={{ 
                // 完美贴合光标，并同步缩小，保持“指哪打哪”手感
                left: dragState.currentX - dragState.grabOffsetX, 
                top: dragState.currentY - dragState.grabOffsetY,
                transform: `scale(${scale})`,
                transformOrigin: 'top left'
            }}
          >
              <div className="grid gap-px p-1" style={{ gridTemplateColumns: `repeat(${dragState.item.shape[0]?.length || 1}, 36px)` }}>
                  {dragState.item.shape.map((row, r) => 
                     row.map((cell, c) => {
                         // Apply same smart border logic to drag preview
                         let cellStyle = {};
                         let cellClass = 'bg-transparent';
                         
                         if (cell) {
                            const borderStyles = getSmartBorders(dragState.item.shape, r, c);
                            
                            // Simplified colors for drag
                            const baseColor = dragState.item.isIdentified ? dragState.item.color.replace('border ', '') : 'bg-stone-600 border-stone-500';
                            cellClass = `w-9 h-9 ${baseColor}`;
                            cellStyle = borderStyles;
                         }

                         return (
                             <div 
                                key={`${r}-${c}`} 
                                className={cellClass}
                                style={cellStyle}
                             ></div>
                         );
                     })
                  )}
              </div>
          </div>
      )}
      
      {/* Item Details Panel (Overlay when selected) */}
      {selectedItem && showItemDetails && (
          <>
              {/* 背景透明遮罩：点击任意空白处关闭卡片 */}
              <div className="fixed inset-0 z-[90]" onClick={() => setShowItemDetails(false)}></div>
              
              <div className="absolute inset-x-2 bottom-2 z-[100] bg-stone-950/95 backdrop-blur-md border border-stone-700 p-4 rounded-xl shadow-[0_-10px_40px_rgba(0,0,0,0.9)] animate-slide-in-up">
                  <div className="max-w-md mx-auto relative w-full">
                      <button onClick={() => setShowItemDetails(false)} className="absolute -top-2 -right-2 p-1.5 text-stone-400 hover:text-stone-200 bg-black/60 rounded-full border border-stone-700 transition-colors z-10"><LucideX size={16}/></button>
                      <div className="flex gap-4">
                          {/* Icon Preview */}
                          <div className="w-16 h-16 bg-black border border-stone-700 flex items-center justify-center shrink-0 relative">
                              <div className={`w-8 h-8 ${selectedItem.isIdentified ? selectedItem.color.split(' ')[0] : 'bg-stone-600'}`}></div>
                              {(selectedItem.quantity || 1) > 1 && (
                                  <div className="absolute bottom-1 right-1 text-xs font-mono font-bold text-white bg-black/50 px-1 rounded">x{selectedItem.quantity}</div>
                              )}
                          </div>
                          <div className="flex-1">
                              <h3 className={`text-lg font-bold font-display ${selectedItem.rarity === 'LEGENDARY' ? 'text-dungeon-gold' : selectedItem.rarity === 'RARE' ? 'text-purple-400' : 'text-stone-200'}`}>
                                  {selectedItem.isIdentified ? selectedItem.name : '未知物体'}
                              </h3>
                              <div className="flex justify-between items-center mb-1">
                                  <div className="text-xs text-stone-500 uppercase tracking-widest">{selectedItem.isIdentified ? TYPE_LABELS[selectedItem.type] : selectedItem.type}</div>
                                  
                                  {/* Value Display */}
                                  {selectedItem.isIdentified && (
                                      <div className="flex items-center gap-1 text-xs font-mono font-bold text-yellow-500 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-800">
                                          <LucideCoins size={12} />
                                          <span>估值: {selectedItem.value * (selectedItem.quantity || 1)} ₮</span>
                                      </div>
                                  )}
                              </div>
                              
                              {selectedItem.isIdentified ? (
                                  <>
                                    <p className="text-xs text-stone-400 leading-relaxed">{selectedItem.description}</p>
                                    {selectedItem.stats && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(selectedItem.stats).map(([k,v]) => (
                                                <span key={k} className="text-[10px] bg-stone-800 px-1.5 py-0.5 rounded text-stone-300 border border-stone-700">{STAT_LABELS[k] || k}: +{v}</span>
                                            ))}
                                        </div>
                                    )}
                                  </>
                              ) : (
                                  <p className="text-xs text-stone-500 italic">
                                      {searchingItemId === selectedItem.id ? '正在分析物体构造...' : '这东西被灰尘和污秽覆盖，需要鉴定才能知晓其真面目。'}
                                  </p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </>
      )}

    </div>
  );
};