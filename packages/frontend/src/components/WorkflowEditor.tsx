import React, { useState, useEffect, useRef } from 'react';
import FlowCanvas from './FlowCanvas';
import NodePalette from './NodePalette';
import PropertyPanel from './PropertyPanel';
import DebugPanel from './DebugPanel';
import { useFlowStore } from '../store';
import { useDragStore } from '../drag-store';
import { saveWorkflow, executeWorkflow, getExecution, stepExecution, resumeExecution, cancelExecution, getWorkflow, listWorkflows } from '../api';

const WorkflowEditor: React.FC = () => {
  const workflow = useFlowStore((s) => s.workflow);
  const setWorkflow = useFlowStore((s) => s.setWorkflow);
  const breakpoints = useFlowStore((s) => s.breakpoints);
  const executionId = useFlowStore((s) => s.executionId);
  const executionStatus = useFlowStore((s) => s.executionStatus);
  const setExecution = useFlowStore((s) => s.setExecution);
  const setExecutionStatus = useFlowStore((s) => s.setExecutionStatus);
  const addEvent = useFlowStore((s) => s.addEvent);
  const setActiveNode = useFlowStore((s) => s.setActiveNode);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const setResult = useFlowStore((s) => s.setResult);
  const clearEvents = useFlowStore((s) => s.clearEvents);
  const setView = useFlowStore((s) => s.setView);

  const [tab, setTab] = useState<'props' | 'debug'>('props');
  const [name, setName] = useState(workflow.name);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [wfList, setWfList] = useState<any[]>([]);
  const [showWfList, setShowWfList] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const dragIsDragging = useDragStore((s) => s.isDragging);
  const dragLabel = useDragStore((s) => s.label);
  const dragX = useDragStore((s) => s.mouseX);
  const dragY = useDragStore((s) => s.mouseY);

  const showToast = (msg: string, type: string = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    setName(workflow.name);
  }, [workflow.id]);

  const refreshWfList = async () => {
    try {
      const list = await listWorkflows();
      setWfList(list);
    } catch {}
  };

  useEffect(() => {
    refreshWfList();
  }, []);

  const handleSave = async () => {
    const wf = { ...workflow, name };
    setWorkflow(wf);
    await saveWorkflow(wf);
    await refreshWfList();
    showToast('工作流已保存', 'success');
  };

  const handleExecute = async () => {
    clearEvents();
    setActiveNode(null);
    setTab('debug');
    const wf = { ...workflow, name };
    setWorkflow(wf);
    const saved = await saveWorkflow(wf);
    const { executionId: execId } = await executeWorkflow(saved.id, {
      breakpoints: Array.from(breakpoints),
    });
    setExecution(execId);
    setExecutionStatus('running');
    connectWebSocket(execId);
  };

  const handleStep = async () => {
    if (executionId) await stepExecution(executionId);
  };

  const handleResume = async () => {
    if (executionId) await resumeExecution(executionId);
  };

  const handleCancel = async () => {
    if (executionId) await cancelExecution(executionId);
  };

  const handleSwitchWf = async (id: string) => {
    try {
      const wf = await getWorkflow(id);
      setWorkflow(wf);
      setName(wf.name);
      setSelectedNode(wf.nodes[0]?.id || null);
      clearEvents();
      setExecution(null);
      setShowWfList(false);
    } catch {
      showToast('加载工作流失败', 'error');
    }
  };

  const connectWebSocket = (execId: string) => {
    if (wsRef.current) wsRef.current.close();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/executions/${execId}`);
    wsRef.current = ws;
    let wsOk = false;

    ws.onopen = () => { wsOk = true; };
    ws.onmessage = (event) => {
      const ev = JSON.parse(event.data);
      addEvent(ev);
      if (ev.type === 'status') setExecutionStatus(ev.status);
      if (ev.type === 'node:start') setActiveNode(ev.nodeId);
      if (ev.type === 'done') setResult(ev.output);
    };

    ws.onclose = async () => {
      try {
        const status = await getExecution(execId);
        setExecutionStatus(status.status);
        if (status.result) setResult(status.result);
      } catch {}
    };

    ws.onerror = () => {
      if (wsOk) return;
      wsRef.current = null;
      let lastEventCount = 0;
      const poll = async () => {
        try {
          const status = await getExecution(execId);
          setExecutionStatus(status.status);
          if (status.events && status.events.length > lastEventCount) {
            const newEvents = status.events.slice(lastEventCount);
            newEvents.forEach((ev: any) => {
              addEvent(ev);
              if (ev.type === 'node:start') setActiveNode(ev.nodeId);
              if (ev.type === 'done') setResult(ev.output);
            });
            lastEventCount = status.events.length;
          }
          if (status.result) setResult(status.result);
          if (status.status === 'running' || status.status === 'paused') {
            setTimeout(poll, 500);
          }
        } catch {
          setTimeout(poll, 1000);
        }
      };
      poll();
    };
  };

  const handleExport = () => {
    const json = JSON.stringify({ ...workflow, name }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wf = JSON.parse(reader.result as string);
        if (!wf.id) wf.id = `wf_${Date.now()}`;
        setWorkflow(wf);
        setName(wf.name);
        setSelectedNode(wf.nodes[0]?.id || null);
        showToast('导入成功', 'success');
      } catch {
        showToast('无效的 JSON 文件', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app" style={{ height: '100vh' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#fff', padding: '10px 20px', borderRadius: '6px', zIndex: 10000,
        }}>
          {toast.msg}
        </div>
      )}

      <div className="toolbar">
        <button className="btn" onClick={() => setView('dashboard')} style={{ background: '#475569' }}>← 任务列表</button>
        <h1>🕷 工作流编辑器</h1>
        <button className="btn mobile-only" onClick={() => setLeftOpen(!leftOpen)}>📂 节点</button>
        <button className="btn mobile-only" onClick={() => setRightOpen(!rightOpen)}>📋 面板</button>
        <div style={{ position: 'relative' }}>
          <button className="btn" onClick={() => setShowWfList(!showWfList)} style={{ background: '#475569' }}>
            📂 工作流 ({wfList.length})
          </button>
          {showWfList && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px',
              background: '#1e293b', border: '1px solid #334155', borderRadius: '6px',
              minWidth: '200px', maxHeight: '300px', overflowY: 'auto', zIndex: 300,
            }}>
              {wfList.length === 0 ? (
                <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>暂无</div>
              ) : wfList.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => handleSwitchWf(wf.id)}
                  style={{
                    padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #334155',
                    fontSize: '13px', color: workflow.id === wf.id ? '#38bdf8' : '#e2e8f0',
                    background: workflow.id === wf.id ? '#1e3a5f' : 'transparent',
                  }}
                >
                  📄 {wf.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '200px' }} placeholder="工作流名称" />
        <div className="spacer" />
        <label className="btn" style={{ cursor: 'pointer' }}>
          导入
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
        <button className="btn" onClick={handleExport}>导出 JSON</button>
        <button className="btn" onClick={handleSave}>💾 保存</button>
        <button className="btn success" onClick={handleExecute} disabled={executionStatus === 'running'}>▶ 执行</button>
        <button className="btn" onClick={handleStep} disabled={!executionId}>单步</button>
        <button className="btn" onClick={handleResume} disabled={!executionId}>恢复</button>
        <button className="btn danger" onClick={handleCancel} disabled={!executionId}>取消</button>
      </div>

      <div className="main">
        <div className={`palette-wrapper ${leftOpen ? 'open' : ''}`}>
          <NodePalette />
        </div>
        <FlowCanvas />
        <div className={`side-panel ${rightOpen ? 'open' : ''}`}>
          <div className="panel-tabs">
            <div className={`panel-tab ${tab === 'props' ? 'active' : ''}`} onClick={() => setTab('props')}>属性</div>
            <div className={`panel-tab ${tab === 'debug' ? 'active' : ''}`} onClick={() => setTab('debug')}>
              调试{executionStatus === 'running' ? ' ●' : ''}
            </div>
          </div>
          <div className="panel-content">
            {tab === 'props' ? <PropertyPanel /> : <DebugPanel />}
          </div>
        </div>
      </div>

      {(leftOpen || rightOpen) && (
        <div className="mobile-overlay" onClick={() => { setLeftOpen(false); setRightOpen(false); setShowWfList(false); }} />
      )}

      {dragIsDragging && (
        <div style={{
          position: 'fixed', left: dragX + 12, top: dragY + 12, pointerEvents: 'none', zIndex: 9999,
          background: '#1e293b', border: '2px solid #38bdf8', borderRadius: '6px', padding: '6px 12px',
          fontSize: '12px', color: '#e2e8f0', whiteSpace: 'nowrap',
        }}>
          {dragLabel}
        </div>
      )}
    </div>
  );
};

export default WorkflowEditor;
