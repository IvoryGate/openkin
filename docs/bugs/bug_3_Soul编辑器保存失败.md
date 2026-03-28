# Bug #3：Soul 编辑器无法保存内容

|- **所属迭代**：第二轮迭代（iter_2）  
|- **发现时间**：2026-03-28  
|- **严重程度**：P1（核心功能不可用）  
|- **影响范围**：开发模式下 Agent 设置页面的 Soul 编辑器  
|- **修复时间**：2026-03-28  
|- **修复提交**：待提交

---

## 一、现象描述

在开发模式（`http://localhost:5173`）下，进入 Agent 设置页面的 Soul 编辑器：

1. 进入 Agent 设置页面，点击"Soul 编辑器"标签
2. 修改 Soul 内容（添加或修改文本）
3. 点击"保存"按钮
4. **保存按钮短暂显示"保存中..."后立即恢复为"保存"状态**
5. **文本框中的内容恢复到原始内容，未显示修改后的内容**
6. 无任何错误提示或警告

刷新页面后，修改的内容确实没有被保存，仍然显示原始内容。

---

## 二、排查过程

### 2.1 检查前端保存逻辑

检查 `ui/agent_editor/SoulEditor.tsx` 的保存函数：

```ts
const handleSave = async () => {
  setIsSaving(true)
  try {
    const markdown = viewMode === 'raw' ? rawMarkdown : toMarkdown(content)
    await window.electronAPI.agent.saveSoul(agentId, markdown)
    alert('保存成功！')
    
    // 重新加载
    const soulText = await window.electronAPI.agent.getSoul(agentId)
    setRawMarkdown(soulText)
    const parsed = parseMarkdown(soulText)
    setContent(parsed)
  } catch (error) {
    console.error('Failed to save soul:', error)
    alert('保存失败，请重试')
  } finally {
    setIsSaving(false)
  }
}
```

代码逻辑看起来正确，使用 `await` 等待保存操作完成。

### 2.2 检查浏览器控制台

打开浏览器开发者工具，查看网络请求：

```bash
# 在开发者工具 Network 标签中观察到：
# PUT /api/agents/agt_ibfCyjd0/soul
# Status: 200 OK
# Response: {"data":{"ok":true}}
```

**HTTP 请求成功！后端返回成功响应。**

### 2.3 直接调用后端 API

使用 curl 直接测试后端 API：

```bash
curl -X PUT http://127.0.0.1:7788/api/agents/agt_ibfCyjd0/soul \
  -H "Content-Type: application/json" \
  -d '{"content":"测试内容：这是直接API调用的验证"}'
  
# 响应：{"data":{"ok":true}}
```

```bash
cat ~/.openkin/agents/agt_ibfCyjd0/soul.md
# 文件内容已更新为："测试内容：这是直接API调用的验证"
```

**后端 API 工作完全正常！问题在前端。**

### 2.4 检查 Mock 实现

检查 `ui/main.tsx` 中的 `saveSoul` mock 实现：

```ts
// 修复前：
saveSoul: (agentId: string, content: string) =>
  apiFetch(`/api/agents/${agentId}/soul`, { 
    method: 'PUT', 
    body: JSON.stringify({ content }) 
  }),
```

```ts
// apiFetch 实现：
const apiFetch = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ? init.headers as Record<string, string> : {}),
    },
  })
  const json = await res.json()
  return json.data ?? json
}
```

**发现问题**：

1. `saveSoul` 没有显式返回 Promise，而是直接返回 `apiFetch` 的结果
2. 虽然 `apiFetch` 返回 Promise，但在某些情况下可能导致 `await` 提前解析
3. `apiFetch` 中的 headers 合并方式可能不正确

### 2.5 验证 headers 问题

在浏览器中检查请求头：

```bash
# 实际发送的请求头：
# Content-Type: application/json, application/json
```

发现 `Content-Type` 被重复设置了！这是因为 `apiFetch` 中的 headers 合并逻辑有问题。

---

## 三、根本原因

| # | 位置 | 原因 |
|---|------|------|
| 1 | `ui/main.tsx` | `saveSoul` mock 函数没有显式返回 Promise，使用 `.then(() => undefined)` 确保正确返回 |
| 2 | `ui/main.tsx` | `apiFetch` 函数的 headers 合并逻辑错误，导致 `Content-Type` 被重复设置 |

---

## 四、修复方案

### Fix 1：修正 `saveSoul` 返回值

确保 `saveSoul` 返回一个 Promise，使 `await` 能正确等待：

```ts
// ui/main.tsx
saveSoul: (agentId: string, content: string) =>
  apiFetch(`/api/agents/${agentId}/soul`, { 
    method: 'PUT', 
    body: JSON.stringify({ content }) 
  }).then(() => undefined),  // 显式返回 Promise 并解析为 undefined
```

### Fix 2：修正 `apiFetch` headers 合并

使用 `new Headers()` 正确合并 headers：

```ts
// ui/main.tsx
const apiFetch = async (path: string, init?: RequestInit) => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(init?.headers ? init.headers as Record<string, string> : {}),
  })
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers,  // 使用 Headers 对象而不是对象字面量
  })
  const json = await res.json()
  return json.data ?? json
}
```

---

## 五、验证

### 5.1 测试保存功能

修复后重新启动开发服务器：

```bash
npm run dev
```

1. 进入 Agent 设置页面，点击"Soul 编辑器"标签
2. 在文本框末尾添加测试内容："修复后的测试内容：这是保存功能的验证"
3. 点击"保存"按钮
4. ✅ 按钮显示"保存中..."约 2 秒
5. ✅ 按钮恢复为"保存"状态
6. ✅ 文本框中的内容保持为修改后的内容
7. ✅ 弹出"保存成功！"提示

### 5.2 验证文件保存

检查实际保存的文件：

```bash
cat ~/.openkin/agents/agt_ibfCyjd0/soul.md
```

输出：

```
# Soul

## 身份

你是我的情感助手

## 知识



## 行为准则

修复后的测试内容：这是保存功能的验证

## 对话风格

你应该表现出知心大姐姐的语气

## 示例对话%
```

✅ **文件内容已成功保存！**

### 5.3 测试持久化

刷新页面（`Cmd+R` 或 F5），重新进入 Soul 编辑器：

1. 文本框中仍然显示修改后的内容
2. ✅ 修改的内容被正确持久化

---

## 六、经验教训

1. **Mock 实现必须精确**：在开发模式下，mock 函数的行为必须与真实实现完全一致，尤其是异步操作
2. **显式返回 Promise**：即使函数返回的值已经是 Promise，也应该显式添加 `.then()` 来确保正确的 Promise 链
3. **Headers 对象的正确使用**：使用 `new Headers()` 构造函数来正确合并 headers，避免重复或覆盖
4. **调试策略**：
   - 从后端 API 开始验证，确认后端正常
   - 检查网络请求，确认请求是否发送
   - 检查请求头和响应，确认数据格式正确
   - 检查 mock 实现，确认行为与预期一致
5. **HTTP Headers 处理**：在构建请求时，要特别注意 headers 的合并逻辑，避免重复设置或意外的覆盖

---

## 七、后续改进建议

1. **统一 API 调用封装**：将 `apiFetch` 封装为单独的模块，确保所有 API 调用使用相同的 headers 处理逻辑
2. **添加 TypeScript 类型**：为 `apiFetch` 和 mock 函数添加严格的类型定义，减少运行时错误
3. **添加单元测试**：为 `apiFetch` 和 mock 实现添加单元测试，覆盖各种边界情况
4. **错误提示改进**：在 `SoulEditor` 中添加更详细的错误信息，包括网络错误、超时等情况
5. **添加保存状态指示器**：除了按钮文本变化，还可以添加进度条或加载动画，提供更好的用户体验
