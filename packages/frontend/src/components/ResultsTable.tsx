import React, { useState, useEffect } from 'react';
import { useFlowStore } from '../store';
import type { ResultColumn } from '../types';
import { getWorkflow, saveWorkflow } from '../api';

const ResultsTable: React.FC = () => {
  const workflow = useFlowStore((s) => s.workflow);
  const setView = useFlowStore((s) => s.setView);
  const [columns, setColumns] = useState<ResultColumn[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // 从工作流结果中提取表格行数据
  const extractRows = (result: any): any[] => {
    if (!result) return [];
    // 如果 result 是数组，直接用
    if (Array.isArray(result)) return result;
    // 如果是对象，查找第一个数组字段
    if (typeof result === 'object') {
      for (const v of Object.values(result)) {
        if (Array.isArray(v)) return v;
      }
      // 没有数组，把对象包装成单行
      return [result];
    }
    return [];
  };

  // 从数据中自动推断列
  const inferColumns = (rows: any[]): ResultColumn[] => {
    if (rows.length === 0) return [];
    const sample = rows[0];
    if (typeof sample !== 'object' || sample === null) return [];
    return Object.keys(sample).map((key) => ({
      key,
      label: key,
      type: typeof sample[key] === 'number' ? 'number' : 'text',
    }));
  };

  useEffect(() => {
    const cols = workflow.resultColumns && workflow.resultColumns.length > 0
      ? workflow.resultColumns
      : inferColumns(extractRows(workflow.lastResult));
    setColumns(cols);
    setData(extractRows(workflow.lastResult));
  }, [workflow.id, workflow.lastResult, workflow.resultColumns]);

  // 按路径取值
  const getByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  };

  const saveColumns = async () => {
    try {
      const wf = await getWorkflow(workflow.id);
      wf.resultColumns = columns;
      await saveWorkflow(wf);
      showToast('列配置已保存', 'success');
      setShowConfig(false);
    } catch {
      showToast('保存失败', 'error');
    }
  };

  const renderCell = (row: any, col: ResultColumn) => {
    const value = getByPath(row, col.key);
    if (value === undefined || value === null) return <span style={{ color: '#475569' }}>—</span>;
    switch (col.type) {
      case 'image':
        return <img src={String(value)} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />;
      case 'link':
        return <a href={String(value)} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{String(value)}</a>;
      default:
        return String(value).length > 100 ? String(value).slice(0, 100) + '...' : String(value);
    }
  };

  const addColumn = () => {
    setColumns([...columns, { key: '', label: '', type: 'text' }]);
  };

  const updateColumn = (idx: number, patch: Partial<ResultColumn>) => {
    setColumns(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const autoDetectColumns = () => {
    setColumns(inferColumns(data));
    showToast('已自动识别列', 'success');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6',
          color: '#fff', padding: '10px 20px', borderRadius: '6px', zIndex: 10000,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <button
            onClick={() => setView('dashboard')}
            style={{
              background: '#334155', color: '#e2e8f0', border: 'none', padding: '8px 16px',
              borderRadius: '6px', cursor: 'pointer', marginBottom: '12px',
            }}
          >
            ← 返回任务列表
          </button>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#e2e8f0' }}>📊 {workflow.name} — 执行结果</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={autoDetectColumns}
            style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            🔍 自动识别列
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            ⚙️ 配置列
          </button>
        </div>
      </div>

      {showConfig && (
        <div style={{
          background: '#1e293b', borderRadius: '8px', padding: '16px', marginBottom: '20px',
          border: '1px solid #334155',
        }}>
          <h3 style={{ margin: '0 0 12px', color: '#e2e8f0', fontSize: '15px' }}>列配置</h3>
          {columns.map((col, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input
                value={col.key}
                onChange={(e) => updateColumn(idx, { key: e.target.value })}
                placeholder="字段路径 (如 title)"
                style={{ flex: 2, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0' }}
              />
              <input
                value={col.label}
                onChange={(e) => updateColumn(idx, { label: e.target.value })}
                placeholder="列标题"
                style={{ flex: 2, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0' }}
              />
              <select
                value={col.type || 'text'}
                onChange={(e) => updateColumn(idx, { type: e.target.value as any })}
                style={{ flex: 1, padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0' }}
              >
                <option value="text">文本</option>
                <option value="number">数字</option>
                <option value="link">链接</option>
                <option value="image">图片</option>
              </select>
              <button
                onClick={() => removeColumn(idx)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
              >
                删除
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={addColumn} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              ➕ 添加列
            </button>
            <button onClick={saveColumns} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              💾 保存配置
            </button>
          </div>
        </div>
      )}

      {!workflow.lastResult ? (
        <div style={{
          textAlign: 'center', padding: '80px', background: '#1e293b',
          borderRadius: '12px', border: '2px dashed #334155',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <p style={{ color: '#94a3b8' }}>该任务暂无执行结果</p>
          <button
            onClick={() => setView('dashboard')}
            style={{ marginTop: '16px', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
          >
            返回执行任务
          </button>
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>结果数据为空</div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: 500, borderBottom: '1px solid #334155', minWidth: '50px' }}>#</th>
                {columns.map((col, idx) => (
                  <th key={idx} style={{
                    padding: '12px', textAlign: 'left', color: '#e2e8f0', fontWeight: 600,
                    borderBottom: '1px solid #334155', minWidth: col.width || '120px',
                  }}>
                    {col.label || col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{rowIdx + 1}</td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} style={{ padding: '10px 12px', color: '#cbd5e1', verticalAlign: 'middle' }}>
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
        共 {data.length} 条记录
      </div>
    </div>
  );
};

export default ResultsTable;
