/**
 * Fastify 服务器 — HTTP API + WebSocket
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { WorkflowStore } from './store';
import { ExecutionManager } from './execution-manager';
import type { Workflow } from '@crawl/engine';

const store = new WorkflowStore();
const execManager = new ExecutionManager();

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(websocket);

// —— HTTP API ——

// 列出所有工作流
app.get('/api/workflows', async () => {
  return store.list();
});

// 获取工作流
app.get('/api/workflows/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const wf = store.get(id);
  if (!wf) return reply.code(404).send({ error: 'Workflow not found' });
  return wf;
});

// 保存工作流
app.post('/api/workflows', async (req) => {
  const wf = req.body as Workflow;
  if (!wf.id) wf.id = `wf_${Date.now()}`;
  return store.save(wf);
});

// 删除工作流
app.delete('/api/workflows/:id', async (req) => {
  const { id } = req.params as { id: string };
  store.delete(id);
  return { ok: true };
});

// 执行工作流
app.post('/api/workflows/:id/execute', async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { breakpoints?: string[]; step?: boolean; input?: any };
  const wf = store.get(id);
  if (!wf) return reply.code(404).send({ error: 'Workflow not found' });

  const inst = execManager.create(wf, {
    breakpoints: body?.breakpoints,
    step: body?.step,
    input: body?.input,
  });

  // 异步执行，完成后把结果回写到工作流
  execManager.start(inst.id).then((result) => {
    const saved = store.get(id);
    if (saved) {
      saved.lastResult = result;
      saved.lastStatus = 'completed';
      saved.lastRunAt = Date.now();
      store.save(saved);
    }
  }).catch((err) => {
    app.log.error(`Execution ${inst.id} failed:`, err?.message || err?.stack || String(err));
    const saved = store.get(id);
    if (saved) {
      saved.lastStatus = 'failed';
      saved.lastRunAt = Date.now();
      store.save(saved);
    }
  });

  return { executionId: inst.id };
});

// 获取执行状态
app.get('/api/executions/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  const inst = execManager.get(id);
  if (!inst) return reply.code(404).send({ error: 'Execution not found' });
  return {
    id: inst.id,
    status: inst.status,
    events: inst.events.slice(-200),
    result: inst.result,
    error: inst.error,
  };
});

// 单步执行
app.post('/api/executions/:id/step', async (req, reply) => {
  const { id } = req.params as { id: string };
  const inst = execManager.get(id);
  if (!inst) return reply.code(404).send({ error: 'Execution not found' });
  execManager.step(id);
  return { ok: true };
});

// 恢复执行
app.post('/api/executions/:id/resume', async (req, reply) => {
  const { id } = req.params as { id: string };
  const inst = execManager.get(id);
  if (!inst) return reply.code(404).send({ error: 'Execution not found' });
  execManager.resume(id);
  return { ok: true };
});

// 取消执行
app.post('/api/executions/:id/cancel', async (req, reply) => {
  const { id } = req.params as { id: string };
  const inst = execManager.get(id);
  if (!inst) return reply.code(404).send({ error: 'Execution not found' });
  execManager.cancel(id);
  return { ok: true };
});

// 获取执行上下文（变量快照）
app.get('/api/executions/:id/context', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    return execManager.getContext(id);
  } catch (e: any) {
    return reply.code(404).send({ error: e.message });
  }
});

// —— WebSocket: 实时事件流 ——
app.get('/ws/executions/:id', { websocket: true }, (conn, req) => {
  // 兼容不同版本的 @fastify/websocket 参数获取方式
  const id = (req.params as any)?.id || conn.request?.params?.id;
  const inst = execManager.get(id);
  if (!inst) {
    conn.socket.send(JSON.stringify({ type: 'error', message: 'Execution not found' }));
    conn.socket.close();
    return;
  }

  // 发送已有事件
  for (const ev of inst.events) {
    conn.socket.send(JSON.stringify(ev));
  }

  // 轮询新事件（简化实现，实际可用事件订阅）
  let lastIdx = inst.events.length;
  const interval = setInterval(() => {
    const current = execManager.get(id);
    if (!current) {
      clearInterval(interval);
      conn.socket.close();
      return;
    }
    while (lastIdx < current.events.length) {
      conn.socket.send(JSON.stringify(current.events[lastIdx]));
      lastIdx++;
    }
    if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
      clearInterval(interval);
      conn.socket.close();
    }
  }, 100);

  conn.socket.on('close', () => clearInterval(interval));
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// 初始化演示工作流
function initDemoWorkflows() {
  const visualDemo: Workflow = {
    id: 'visual_demo',
    name: '可视化演示',
    version: '1.0',
    nodes: [
      { id: 'n1', type: 'start', config: { input: { arr: [10, 20, 30] } }, position: { x: 100, y: 200 }, data: { label: '开始' } },
      { id: 'n2', type: 'code', config: { code: 'return { items: input.arr };' }, position: { x: 320, y: 200 }, data: { label: '自定义代码' } },
      { id: 'n3', type: 'for_each', config: { array: '{{n2.output.items}}', bodyNodeIds: ['n4'] }, position: { x: 540, y: 200 }, data: { label: '循环' } },
      { id: 'n4', type: 'code', config: { code: 'return { doubled: input.item * 2 };' }, position: { x: 760, y: 320 }, data: { label: '循环体' } },
      { id: 'n5', type: 'output', config: {}, position: { x: 980, y: 200 }, data: { label: '输出' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'body' },
      { id: 'e4', source: 'n3', target: 'n5' },
    ],
    resultColumns: [
      { key: 'doubled', label: '翻倍结果', type: 'number' },
    ],
  };
  store.save(visualDemo);
  console.log('✅ 演示工作流已初始化');
}

initDemoWorkflows();

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Crawler Orchestrator server running on http://localhost:${PORT}`);
});
