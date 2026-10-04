import React, { useEffect, useState } from 'react';
import { listWorkflows, getWorkflow, saveWorkflow, executeWorkflow, getExecution } from '../api';
import { useFlowStore } from '../store';
import type { Workflow } from '../types';

const Dashboard: React.FC = () => {
  const setWorkflow = useFlowStore((s) => s.setWorkflow);
  const setView = useFlowStore((s) => s.setView);
  const setCurrentTaskId = useFlowStore((s) => s.setCurrentTaskId);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);

  const [tasks, setTasks] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await listWorkflows();
      setTasks(list);
    } catch {
      showToast('加载任务列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleNewTask = () => {
    const newWf: Workflow = {
      id: `wf_${Date.now()}`,
      name: '新爬虫任务',
      version: '1.0',
      nodes: [],
      edges: [],
      resultColumns: [],
    };
    setWorkflow(newWf);
    setCurrentTaskId(newWf.id);
    setSelectedNode(null);
    setView('editor');
  };

  const handleEdit = async (wf: Workflow) => {
    try {
      const full = await getWorkflow(wf.id);
      setWorkflow(full);
      setCurrentTaskId(wf.id);
      setSelectedNode(full.nodes[0]?.id || null);
      setView('editor');
    } catch {
      showToast('加载任务失败', 'error');
    }
  };

  const handleRun = async (wf: Workflow) => {
    try {
      const { executionId } = await executeWorkflow(wf.id);
      showToast('任务已启动执行...', 'info');
      // 轮询结果
      const poll = async (count = 0) => {
        try {
          const status = await getExecution(executionId);
          if (status.status === 'completed' || status.status === 'failed') {
            // 保存结果到任务
            const full = await getWorkflow(wf.id);
            full.lastResult = status.result;
            full.lastStatus = status.status;
            full.lastRunAt = Date.now();
            await saveWorkflow(full);
            showToast(
              status.status === 'completed' ? '执行成功' : `执行失败: ${status.error || ''}`,
              status.status === 'completed' ? 'success' : 'error',
            );
            refresh();
          } else if (count < 60) {
            setTimeout(() => poll(count + 1), 500);
          }
        } catch {}
      };
      poll();
    } catch {
      showToast('启动任务失败', 'error');
    }
  };

  const handleViewResults = async (wf: Workflow) => {
    try {
      const full = await getWorkflow(wf.id);
      setWorkflow(full);
      setCurrentTaskId(wf.id);
      setView('results');
    } catch {
      showToast('加载任务结果失败', 'error');
    }
  };

  const handleDelete = async (wf: Workflow) => {
    if (!confirm(`确认删除任务「${wf.name}」？`)) return;
    try {
      await fetch(`/api/workflows/${wf.id}`, { method: 'DELETE' });
      showToast('已删除', 'success');
      refresh();
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const statusColor = (s?: string) => {
    switch (s) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'running': return '#3b82f6';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#fff', padding: '10px 20px', borderRadius: '6px', zIndex: 10000,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#e2e8f0' }}>🕷 爬虫任务管理</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '14px' }}>
            管理所有爬虫任务（工作流），查看执行结果
          </p>
        </div>
        <button
          onClick={handleNewTask}
          style={{
            background: '#10b981', color: '#fff', border: 'none', padding: '12px 24px',
            borderRadius: '8px', fontSize: '15px', cursor: 'pointer', fontWeight: 600,
          }}
        >
          ➕ 新建任务
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>加载中...</div>
      ) : tasks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px', background: '#1e293b',
          borderRadius: '12px', border: '2px dashed #334155',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🕸️</div>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>暂无爬虫任务</p>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '8px' }}>点击「新建任务」创建你的第一个爬虫工作流</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {tasks.map((wf) => (
            <div key={wf.id} style={{
              background: '#1e293b', borderRadius: '12px', padding: '20px',
              border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '17px' }}>{wf.name}</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{wf.id}</span>
                </div>
                {wf.lastStatus && (
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                    background: statusColor(wf.lastStatus) + '22', color: statusColor(wf.lastStatus),
                  }}>
                    {wf.lastStatus}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                <span>📦 节点: {wf.nodes.length}</span>
                <span>🔗 连线: {wf.edges.length}</span>
                {wf.resultColumns && wf.resultColumns.length > 0 && (
                  <span>📊 列: {wf.resultColumns.length}</span>
                )}
              </div>

              {wf.lastRunAt && (
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  最近执行: {new Date(wf.lastRunAt).toLocaleString()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleEdit(wf)}
                  style={{
                    flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
                    padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  ✏️ 编辑
                </button>
                <button
                  onClick={() => handleRun(wf)}
                  style={{
                    flex: 1, background: '#10b981', color: '#fff', border: 'none',
                    padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  ▶ 执行
                </button>
                <button
                  onClick={() => handleViewResults(wf)}
                  style={{
                    flex: 1, background: '#7c3aed', color: '#fff', border: 'none',
                    padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  📊 结果
                </button>
                <button
                  onClick={() => handleDelete(wf)}
                  style={{
                    background: '#ef4444', color: '#fff', border: 'none',
                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
