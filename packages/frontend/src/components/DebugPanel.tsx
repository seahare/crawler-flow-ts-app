import React, { useEffect, useRef } from 'react';
import { useFlowStore } from '../store';

const DebugPanel: React.FC = () => {
  const events = useFlowStore((s) => s.events);
  const executionStatus = useFlowStore((s) => s.executionStatus);
  const result = useFlowStore((s) => s.result);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const formatEvent = (ev: any): { text: string; level: string } => {
    const ts = new Date(ev.timestamp).toLocaleTimeString();
    switch (ev.type) {
      case 'status':
        return { text: `[status] ${ev.status}`, level: 'info' };
      case 'node:start':
        return { text: `▶ 开始执行: ${ev.nodeId}`, level: 'info' };
      case 'node:end':
        return { text: `✓ 完成: ${ev.nodeId} → ${JSON.stringify(ev.output).slice(0, 60)}`, level: 'success' };
      case 'node:error':
        return { text: `✗ 错误: ${ev.nodeId} → ${ev.error}`, level: 'error' };
      case 'node:breakpoint':
        return { text: `⏸ 断点: ${ev.nodeId}`, level: 'warn' };
      case 'done':
        return { text: `✅ 工作流完成`, level: 'success' };
      default:
        return { text: JSON.stringify(ev).slice(0, 80), level: 'info' };
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '8px', fontSize: '12px' }}>
        状态: <span style={{ color: executionStatus === 'completed' ? '#10b981' : executionStatus === 'failed' ? '#ef4444' : '#38bdf8' }}>{executionStatus}</span>
      </div>

      {events.length > 0 ? (
        <div className="debug-log" ref={logRef} style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {events.map((ev, i) => {
            const { text, level } = formatEvent(ev);
            return (
              <div key={i} className={`log-entry ${level}`}>
                <span className="ts">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                {text}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-hint">尚未执行</div>
      )}

      {result && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', marginBottom: '4px', color: '#94a3b8' }}>执行结果:</div>
          <pre className="result-preview">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
