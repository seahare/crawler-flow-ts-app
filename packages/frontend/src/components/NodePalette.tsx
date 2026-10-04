import React, { useEffect } from 'react';
import { NODE_CONFIGS } from '../node-configs';
import { useDragStore } from '../drag-store';

const categories = [
  { key: 'input', label: '输入' },
  { key: 'fetch', label: '抓取' },
  { key: 'extract', label: '提取' },
  { key: 'control', label: '控制流' },
  { key: 'download', label: '下载' },
  { key: 'util', label: '工具' },
  { key: 'output', label: '输出' },
];

const NodePalette: React.FC = () => {
  const startDrag = useDragStore((s) => s.startDrag);
  const updateMouse = useDragStore((s) => s.updateMouse);
  const endDrag = useDragStore((s) => s.endDrag);

  // 全局监听 mousemove / mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);
    const onUp = () => endDrag();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [updateMouse, endDrag]);

  const handleMouseDown = (e: React.MouseEvent, type: string, label: string) => {
    e.preventDefault();
    updateMouse(e.clientX, e.clientY);
    startDrag(type, label);
  };

  return (
    <div className="palette">
      {categories.map((cat) => {
        const items = NODE_CONFIGS.filter((c) => c.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key}>
            <h3>{cat.label}</h3>
            {items.map((item) => (
              <div
                key={item.type}
                className="palette-item"
                onMouseDown={(e) => handleMouseDown(e, item.type, item.label)}
                title={`${item.label}（按住拖到画布）`}
                style={{ cursor: 'grab' }}
              >
                <span className="icon" style={{ color: item.color }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default NodePalette;
