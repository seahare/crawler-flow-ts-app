import React from 'react';
import { useFlowStore } from '../store';
import { getNodeConfig, type NodeField } from '../node-configs';

const PropertyPanel: React.FC = () => {
  const workflow = useFlowStore((s) => s.workflow);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const updateNodeConfig = useFlowStore((s) => s.updateNodeConfig);

  const node = workflow.nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return <div className="empty-hint">选择一个节点以编辑属性</div>;
  }

  const config = getNodeConfig(node.type);
  if (!config) {
    return <div className="empty-hint">未知节点类型: {node.type}</div>;
  }

  const currentConfig = node.data.config || {};

  const handleChange = (key: string, value: any) => {
    updateNodeConfig(node.id, { ...currentConfig, [key]: value });
  };

  const renderField = (field: NodeField) => {
    const value = currentConfig[field.key] ?? field.default ?? '';
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.key, Number(e.target.value))}
          />
        );
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
        );
      case 'select':
        return (
          <select value={value} onChange={(e) => handleChange(field.key, e.target.value)}>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                handleChange(field.key, JSON.parse(e.target.value));
              } catch {
                handleChange(field.key, e.target.value);
              }
            }}
            style={{ minHeight: '100px', fontFamily: 'monospace' }}
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(field.key, e.target.checked)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{config.label}</div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {node.id}</div>
      </div>
      {config.fields.map((field) => (
        <div className="field" key={field.key}>
          <label>{field.label}</label>
          {renderField(field)}
          {field.help && <div className="help">{field.help}</div>}
        </div>
      ))}
    </div>
  );
};

export default PropertyPanel;
