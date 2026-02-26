
import { GridItem, GridContext } from '../types';
import { EQUIPMENT_ROW_COUNT } from '../constants';

export const rotateMatrix = (matrix: number[][]): number[][] => {
  if (!matrix || matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = Math.max(0, ...matrix.map(row => row?.length || 0));
  if (cols === 0) return matrix.map(() => []); // Return empty rows of correct height
  
  const newMatrix: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < (matrix[r]?.length || 0); c++) {
      if (matrix[r][c] === 1) {
        newMatrix[c][rows - 1 - r] = 1;
      }
    }
  }
  return newMatrix;
};

export const getRotatedShape = (item: GridItem): number[][] => {
  let shape = item.originalShape || item.shape;
  if (!shape || shape.length === 0) return [];

  // Create a deep copy to prevent mutation
  let currentShape = shape.map(row => [...(row || [])]);

  for (let i = 0; i < (item.rotation || 0) / 90; i++) {
    currentShape = rotateMatrix(currentShape);
  }
  return currentShape;
};

export const canPlaceItem = (
  grid: (string | null)[][],
  item: GridItem,
  gridX: number,
  gridY: number,
  unlockedRows?: number,
  context?: GridContext
): boolean => {
  const shape = getRotatedShape(item);
  if (shape.length === 0) return false;

  const rows = shape.length;
  const cols = shape[0]?.length || 0;
  
  if (!grid || grid.length === 0) return false;
  const gridHeight = grid.length;
  const gridWidth = grid[0]?.length || 0;

  // 智能推断：只有明确是素体/本体，或者未传参且高度正好为5才检查区域限制。仓库彻底解放！
  const isPlayerInventory = context ? (context === 'AGENT' || context === 'COMMANDER') : (gridHeight === 5);
  const isCommander = context === 'COMMANDER';
  let firstBlockZone: 'SAFE' | 'EQUIP' | 'BACKPACK' | null = null;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (shape[r]?.[c] === 1) {
        const targetX = gridX + c;
        const targetY = gridY + r;

        // 1. 边界与解锁区域检查
        if (targetX < 0 || targetX >= gridWidth || targetY < 0 || targetY >= gridHeight) {
          return false;
        }
        if (unlockedRows !== undefined && unlockedRows > 0 && targetY >= unlockedRows) {
          return false;
        }

        // 2. 仅对玩家背包进行跨区限制检查
        if (isPlayerInventory) {
            const currentCellZone = getPlayerZone(targetX, targetY, isCommander ? 0 : 1);
            if (!firstBlockZone) {
                firstBlockZone = currentCellZone;
            } else if (currentCellZone !== firstBlockZone) {
                return false; 
            }
        }

        // 3. Collision check
        const cellId = grid[targetY][targetX];
        if (cellId !== null && cellId !== item.id) {
          return false;
        }
      }
    }
  }

  return true;
};

export const placeItemInGrid = (
  grid: (string | null)[][],
  item: GridItem,
  x: number,
  y: number
): (string | null)[][] => {
  if (!grid) return [];
  const newGrid = grid.map(row => [...row]);
  
  const shape = getRotatedShape(item);
  if (shape.length === 0) return newGrid;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < (shape[r]?.length || 0); c++) {
      if (shape[r]?.[c] === 1) {
        if (newGrid[y + r] && newGrid[y + r][x + c] !== undefined) {
            newGrid[y + r][x + c] = item.id;
        }
      }
    }
  }
  return newGrid;
};

export const createEmptyGrid = (w: number, h: number) => 
  Array.from({ length: h }, () => Array(w).fill(null));

export const removeItemFromGrid = (grid: (string | null)[][], itemId: string) => {
  return grid.map(row => row.map(cell => (cell === itemId ? null : cell)));
};

export const getPlayerZone = (x: number, y: number, level: number = 1): 'SAFE' | 'EQUIP' | 'BACKPACK' => {
    // 本体 (Level 0) 的 5x4 固定布局 (安全区 1x2, 装备区 1x3, 背包区 3x5)
    if (level === 0) {
        if (y === 0) return x < 2 ? 'SAFE' : 'EQUIP';
        return 'BACKPACK';
    }
    if (x < 3 && y < 3) return 'SAFE';     // 左上 3x3
    if (x >= 3 && y < 2) return 'EQUIP';   // 右上 5x2
    return 'BACKPACK';                     // 剩下的所有格子
};

export const isPlayerCellUnlocked = (x: number, y: number, level: number = 1) => {
    const zone = getPlayerZone(x, y, level);
    
    // 本体 (Level 0) 物理限制在 5x4 以内
    if (level === 0) {
        return x < 5 && y < 4;
    }

    if (zone === 'SAFE') {
        if (level === 1) return x < 2 && y < 1; // 1级安全区 2x1 (左上角)
        if (level === 2) return x < 2 && y < 2; // 2级安全区 2x2
        return true; // 3级最大化 3x3
    }
    if (zone === 'EQUIP') {
        if (level === 1) return x >= 3 && x < 6 && y < 2; // 1级装备区 3x2
        if (level === 2) return x >= 3 && x < 7 && y < 2; // 2级装备区 4x2
        return true; // 3级最大化 5x2
    }
    if (zone === 'BACKPACK') {
        if (level === 1) return x >= 3 && x < 6 && y >= 2 && y < 5; // 1级背包区 (装备区正下方的 3x3)
        if (level === 2) return x >= 3 && x < 8 && y >= 2 && y < 5; // 2级背包区 5x3
        return true; // 3级最大化包含剩余边角
    }
    return false;
};

// --- SMART AUTO-ARRANGE LOGIC ---

/**
 * Attempts to find a valid arrangement where the `fixedItem` is placed at `fixedX, fixedY`,
 * and any overlapping items are moved to nearby open spaces, potentially rotating them.
 * 
 * Returns: An array of GridItems with updated coordinates/rotations for the moved items, 
 *          or NULL if no valid arrangement exists.
 */
export const findSmartArrangement = (
    currentGridItems: GridItem[],
    fixedItem: GridItem,
    fixedX: number,
    fixedY: number,
    gridWidth: number,
    gridHeight: number,
    unlockedRows?: number
): GridItem[] | null => {
    // 1. Identify items colliding with the dragged item at the target position
    const draggedMask = new Set<string>();
    const draggedShape = getRotatedShape(fixedItem); 
    
    const collidingIds = new Set<string>();
    let fixedItemFirstZone: 'SAFE' | 'EQUIP' | 'BACKPACK' | null = null;
    
    const getItemAt = (x: number, y: number, items: GridItem[]) => {
        return items.find(i => {
             if (i.id === fixedItem.id) return false;
             const shape = getRotatedShape(i);
             const localX = x - i.x;
             const localY = y - i.y;
             if (localX >= 0 && localY >= 0 && localY < shape.length && localX < (shape[localY]?.length || 0)) {
                 return shape[localY]?.[localX] === 1;
             }
             return false;
        });
    };

    for (let r = 0; r < draggedShape.length; r++) {
        for (let c = 0; c < (draggedShape[0]?.length || 0); c++) {
            if (draggedShape[r] && draggedShape[r][c] === 1) {
                const tx = fixedX + c;
                const ty = fixedY + r;
                
                // Bounds Check for Dragged Item
                if (tx < 0 || tx >= gridWidth || ty < 0 || ty >= gridHeight) return null; // Impossible
                if (unlockedRows !== undefined && ty >= unlockedRows) return null; // Locked zone
                
                // Zone Logic Check
                const isWarehouse = gridHeight >= 14;
                const isPlayerInventory = !isWarehouse;
                
                if (isPlayerInventory) {
                    const currentCellZone = getPlayerZone(tx, ty);
                    if (!fixedItemFirstZone) {
                        fixedItemFirstZone = currentCellZone;
                    } else if (currentCellZone !== fixedItemFirstZone) {
                        return null; // Cannot cross zone
                    }
                }

                // Identify Collision
                const hitItem = getItemAt(tx, ty, currentGridItems);
                if (hitItem) {
                    collidingIds.add(hitItem.id);
                }
            }
        }
    }

    if (collidingIds.size === 0) return null; // No need to rearrange, standard placement works

    // 2. Prepare for Rearrangement
    const itemsToMove = currentGridItems.filter(i => collidingIds.has(i.id));
    const staticItems = currentGridItems.filter(i => !collidingIds.has(i.id) && i.id !== fixedItem.id);
    
    // Build a temporary grid with STATIC items + FIXED dragged item
    let tempGrid = createEmptyGrid(gridWidth, gridHeight);
    
   // Place Statics
    for (const item of staticItems) {
        tempGrid = placeItemInGrid(tempGrid, item, item.x, item.y);
    }
    // Place Fixed Dragged Item
    const fixedItemObj = { ...fixedItem, x: fixedX, y: fixedY }; 
    tempGrid = placeItemInGrid(tempGrid, fixedItemObj, fixedX, fixedY);

    // 3. Try to place displaced items with Rotation
    const newPositions: GridItem[] = [];

    itemsToMove.sort((a, b) => (b.shape.length * (b.shape[0]?.length || 0)) - (a.shape.length * (a.shape[0]?.length || 0)));

    for (const item of itemsToMove) {
        let placed = false;
        
        // Search Radius Strategy: Use Euclidean distance for smoother circular spread
        const candidates: {x: number, y: number, dist: number}[] = [];
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const dist = Math.hypot(x - item.x, y - item.y); 
                candidates.push({ x, y, dist });
            }
        }
        candidates.sort((a, b) => a.dist - b.dist);

        for (const pos of candidates) {
            if (placed) break;

            const startRot = item.rotation || 0;
            for (let r = 0; r < 4; r++) {
                 const testRotation = (startRot + r * 90) % 360 as 0 | 90 | 180 | 270;
                 
                 const tempDummy = { ...item, rotation: testRotation };
                 const rotatedShapeMatrix = getRotatedShape(tempDummy);
                 
                 const testItem = { 
                     ...item, 
                     x: pos.x, 
                     y: pos.y, 
                     shape: rotatedShapeMatrix,
                     rotation: testRotation,
                     originalShape: item.originalShape || item.shape
                 };
                 
                 if (canPlaceItem(tempGrid, testItem, pos.x, pos.y, unlockedRows)) {
                     tempGrid = placeItemInGrid(tempGrid, testItem, pos.x, pos.y);
                     newPositions.push(testItem);
                     placed = true;
                     break;
                 }
            }
        }

        if (!placed) return null;
    }

    return newPositions;
};
