/**
 * 拖拽状态管理 — 用 mouse 事件模拟拖拽，不依赖 HTML5 DnD（兼容 iframe 沙箱）
 */
import { create } from 'zustand';

interface DragState {
  isDragging: boolean;
  nodeType: string | null;
  mouseX: number;
  mouseY: number;
  label: string;

  startDrag: (type: string, label: string) => void;
  updateMouse: (x: number, y: number) => void;
  endDrag: () => void;
}

export const useDragStore = create<DragState>((set) => ({
  isDragging: false,
  nodeType: null,
  mouseX: 0,
  mouseY: 0,
  label: '',

  startDrag: (type, label) => set({ isDragging: true, nodeType: type, label }),
  updateMouse: (x, y) => set({ mouseX: x, mouseY: y }),
  endDrag: () => set({ isDragging: false, nodeType: null, label: '' }),
}));
