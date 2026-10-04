import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { getNodeConfig } from '../node-configs';
import { useFlowStore } from '../store';

const CustomNode = memo(({ id, data, selected }: NodeProps) => {
  const config = getNodeConfig(data.type);
  const breakpoints = useFlowStore((s) => s.breakpoints);
  const activeNodeId = useFlowStore((s) => s.activeNodeId);
  const toggleBreakpoint = useFlowStore((s) => s.toggleBreakpoint);

  const hasBreakpoint = breakpoints.has(id);
  const isActive = activeNodeId === id;

  const handleBreakpointClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBreakpoint(id);
  };

  // if_else 节点有两个出边 handle
  const isBranch = data.type === 'if_else';

  return (
    <div
      className={`crawl-node ${selected ? 'selected' : ''} ${isActive ? 'active' : ''} ${hasBreakpoint ? 'has-breakpoint' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="crawl-node-header" style={{ background: config?.color || '#334155' }}>
        <span>{config?.icon || '●'}</span>
        <span>{config?.label || data.type}</span>
        <span
          onClick={handleBreakpointClick}
          style={{
            marginLeft: 'auto',
            cursor: 'pointer',
            fontSize: '11px',
            color: hasBreakpoint ? '#ef4444' : '#64748b',
          }}
          title="切换断点"
        >
          ●
        </span>
      </div>
      <div className="crawl-node-body" title={data.label}>
        {data.label || id}
      </div>
      {isBranch ? (
        <>
          <Handle type="source" position={Position.Right} id="true" className="node-handle" style={{ top: '35%', background: '#10b981' }} />
          <Handle type="source" position={Position.Right} id="false" className="node-handle" style={{ top: '65%', background: '#ef4444' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="node-handle" />
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
export default CustomNode;
