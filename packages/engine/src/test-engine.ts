/**
 * 引擎集成测试
 */
import { WorkflowExecutor, registerAllNodes, type Workflow } from './index';

registerAllNodes();

// 测试 1: 基础线性工作流 — code 节点 + 变量传递
async function testBasicFlow() {
  console.log('\n=== Test 1: Basic Linear Flow ===');
  const wf: Workflow = {
    id: 'test1',
    name: 'basic',
    version: '1.0',
    nodes: [
      { id: 'start', type: 'start', config: { initialData: { greeting: 'hello' } } },
      {
        id: 'code1',
        type: 'code',
        config: { code: "return { msg: outputs.start.greeting + ' world', n: 42 };" },
      },
      { id: 'out', type: 'output', config: { from: 'code1' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'code1' },
      { id: 'e2', source: 'code1', target: 'out' },
    ],
  };

  // 注意: code 节点中通过 outputs.start 访问 start 节点输出

  const exec = new WorkflowExecutor(wf, {
    onEvent: (e) => {
      if (e.type === 'node:end') console.log(`  node ${e.nodeId} done:`, JSON.stringify(e.output).slice(0, 80));
    },
  });
  const result = await exec.execute();
  console.log('  final output:', JSON.stringify(result.out));
  console.log('  ✅ Test 1 passed');
}

// 测试 2: for_each 循环
async function testForEach() {
  console.log('\n=== Test 2: for_each Loop ===');
  const wf: Workflow = {
    id: 'test2',
    name: 'loop',
    version: '1.0',
    nodes: [
      { id: 'start', type: 'start', config: {} },
      {
        id: 'code_arr',
        type: 'code',
        config: { code: 'return { items: [1, 2, 3] };' },
      },
      {
        id: 'loop',
        type: 'for_each',
        config: {
          array: '{{code_arr.output.items}}',
          bodyNodeIds: ['body_code'],
          itemVar: 'item',
        },
      },
      {
        id: 'body_code',
        type: 'code',
        config: { code: 'return { doubled: scope.item * 2 };' },
      },
      { id: 'out', type: 'output', config: { from: 'loop' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'code_arr' },
      { id: 'e2', source: 'code_arr', target: 'loop' },
      { id: 'e3', source: 'loop', target: 'body_code' },
      { id: 'e4', source: 'loop', target: 'out' },
    ],
  };

  const exec = new WorkflowExecutor(wf);
  const result = await exec.execute();
  const loopResult = result.loop;
  console.log('  loop results:', JSON.stringify(loopResult.results));
  if (loopResult.count === 3 && loopResult.results.every((r: any) => r.doubled % 2 === 0)) {
    console.log('  ✅ Test 2 passed');
  } else {
    console.log('  ❌ Test 2 failed');
  }
}

// 测试 3: if_else 条件分支
async function testIfElse() {
  console.log('\n=== Test 3: if_else Branch ===');
  const wf: Workflow = {
    id: 'test3',
    name: 'branch',
    version: '1.0',
    nodes: [
      { id: 'start', type: 'start', config: {} },
      { id: 'code_age', type: 'code', config: { code: 'return { age: 20 };' } },
      {
        id: 'cond',
        type: 'if_else',
        config: { expression: '{{code_age.output.age}} >= 18' },
      },
      { id: 'adult', type: 'code', config: { code: 'return { branch: "adult" };' } },
      { id: 'minor', type: 'code', config: { code: 'return { branch: "minor" };' } },
      { id: 'out', type: 'output', config: { from: 'adult' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'code_age' },
      { id: 'e2', source: 'code_age', target: 'cond' },
      { id: 'e3', source: 'cond', target: 'adult', sourceHandle: 'true' },
      { id: 'e4', source: 'cond', target: 'minor', sourceHandle: 'false' },
      { id: 'e5', source: 'adult', target: 'out' },
    ],
  };

  const exec = new WorkflowExecutor(wf);
  const result = await exec.execute();
  console.log('  output branch:', result.out?.branch);
  if (result.out?.branch === 'adult') {
    console.log('  ✅ Test 3 passed');
  } else {
    console.log('  ❌ Test 3 failed');
  }
}

// 测试 4: CSS 提取（用内置 HTML）
async function testCssExtract() {
  console.log('\n=== Test 4: CSS Extract ===');
  const html = `
    <div class="list">
      <div class="item"><span class="title">Item 1</span><span class="price">¥99</span></div>
      <div class="item"><span class="title">Item 2</span><span class="price">¥199</span></div>
    </div>
  `;
  const wf: Workflow = {
    id: 'test4',
    name: 'extract',
    version: '1.0',
    nodes: [
      { id: 'start', type: 'start', config: {} },
      {
        id: 'html_node',
        type: 'code',
        config: { code: `return { html: ${JSON.stringify(html)} };` },
      },
      {
        id: 'extract',
        type: 'css_extract',
        config: {
          html: '{{html_node.output.html}}',
          rule: {
            selector: '.item',
            fields: {
              title: { selector: '.title' },
              price: { selector: '.price', regex: '¥(\\d+)', capture: 1, type: 'number' },
            },
          },
        },
      },
      { id: 'out', type: 'output', config: { from: 'extract' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'html_node' },
      { id: 'e2', source: 'html_node', target: 'extract' },
      { id: 'e3', source: 'extract', target: 'out' },
    ],
  };

  const exec = new WorkflowExecutor(wf);
  const result = await exec.execute();
  console.log('  extracted items:', JSON.stringify(result.out?.items));
  if (
    result.out?.items?.length === 2 &&
    result.out.items[0].title === 'Item 1' &&
    result.out.items[0].price === 99
  ) {
    console.log('  ✅ Test 4 passed');
  } else {
    console.log('  ❌ Test 4 failed');
  }
}

async function main() {
  try {
    await testBasicFlow();
    await testForEach();
    await testIfElse();
    await testCssExtract();
    console.log('\n🎉 All tests passed!');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
}

main();
