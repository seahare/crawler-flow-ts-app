import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './CustomNode';
import { useFlowStore } from '../store';
import { useDragStore } from '../drag-store';
import { getNodeConfig } from '../node-configs';

const nodeTypes: NodeTypes = {
  crawl: CustomNode,
};

let nodeIdCounter = 0;
const genId = () => `node_${Date.now()}_${++nodeIdCounter}`;

const FlowCanvas: React.FC = () => {
  const workflow = useFlowStore((s) => s.workflow);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const updateNode = useFlowStore((s) => s.updateNode);
  const dragType = useDragStore((s) => s.nodeType);
  const isDragging = useDragStore((s) => s.isDragging);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(
    workflow.nodes.map((n) => ({
      id: n.id,
      type: 'crawl',
      position: n.position,
      data: { label: n.data.label, type: n.type, config: n.data.config },
    })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges as Edge[]);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  // 当工作流整体变化时（如加载新工作流），同步节点和边
  const lastWfId = useRef(workflow.id);
  useEffect(() => {
    if (workflow.id !== lastWfId.current) {
      lastWfId.current = workflow.id;
      setNodes(
        workflow.nodes.map((n) => ({
          id: n.id,
          type: 'crawl',
          position: n.position,
          data: { label: n.data.label, type: n.type, config: n.data.config },
        })),
      );
      setEdges(workflow.edges as Edge[]);
    }
  }, [workflow.id, workflow.nodes, workflow.edges, setNodes, setEdges]);

  // 同步到 store
  const syncToStore = useCallback((ns: Node[], es: Edge[]) => {
    useFlowStore.setState({
      workflow: {
        ...workflow,
        nodes: ns.map((n) => ({
          id: n.id,
          type: n.data.type,
          position: n.position,
          data: { label: n.data.label, config: n.data.config },
        })),
        edges: es.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined,
        })),
      },
    });
  }, [workflow]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, id: `e_${Date.now()}` }, eds);
        syncToStore(nodes, newEdges);
        return newEdges;
      });
    },
    [nodes, setEdges, syncToStore],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onNodesChangeHandler = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // 位置变化同步
      const moved = changes.filter((c: any) => c.type === 'position' && c.position);
      if (moved.length > 0) {
        setNodes((ns) => {
          const updated = ns.map((n) => {
            const ch = moved.find((c: any) => c.id === n.id);
            return ch ? { ...n, position: ch.position } : n;
          });
          syncToStore(updated, edges);
          return updated;
        });
      }
    },
    [onNodesChange, edges, syncToStore, setNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const config = getNodeConfig(type);
      const newNode: Node = {
        id: genId(),
        type: 'crawl',
        position,
        data: {
          label: config?.label || type,
          type,
          config: {},
        },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        syncToStore(updated, edges);
        return updated;
      });
    },
    [edges, setNodes, syncToStore],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // mouseup 放置节点（替代 HTML5 DnD，兼容 iframe 沙箱）
  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragType || !rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const config = getNodeConfig(dragType);
      const newNode: Node = {
        id: genId(),
        type: 'crawl',
        position,
        data: {
          label: config?.label || dragType,
          type: dragType,
          config: {},
        },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        syncToStore(updated, edges);
        return updated;
      });

      // 拖拽结束由全局 mouseup 监听处理
    },
    [isDragging, dragType, edges, setNodes, syncToStore],
  );

  return (
    <div
      className="canvas-container"
      ref={reactFlowWrapper}
      onMouseUp={handleCanvasMouseUp}
      style={{ cursor: isDragging ? 'copy' : undefined }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(inst) => (rfInstance.current = inst)}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1e293b" gap={20} />
        <Controls style={{ background: '#1e293b' }} />
        <MiniMap
          nodeColor={(n) => getNodeConfig(n.data.type)?.color || '#334155'}
          style={{ background: '#0f172a' }}
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
};

export default FlowCanvas;
