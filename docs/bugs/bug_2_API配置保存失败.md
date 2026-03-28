# Bug #2：API配置保存失败

- **发现时间**：2026-03-28  
- **严重程度**：P0（核心功能不可用）  
- **影响范围**：开发模式下引导流程的API Key配置步骤  
- **修复时间**：2026-03-28  
- **修复提交**：待提交

---

## 一、现象描述

在开发模式（`npm run dev`）下，进入引导流程的API Key配置页面：

1. 填写API Key或自定义端点
2. 点击"下一步"按钮
3. **弹出提示"保存失败，请重试"，无法继续下一步**
4. 浏览器控制台无错误信息

---

## 二、排查过程

### 2.1 检查前端代码

检查 `Step2ApiKey.tsx` 的保存逻辑：

```ts
const handleSave = async () => {
  if (!canProceed) return
  setIsSaving(true)
  try {
    await window.electronAPI.config.saveApiKeys(apiKeys)
    navigate('/onboarding/create-agent')
  } catch (error) {
    console.error('Failed to save API keys:', error)
    alert('保存失败，请重试')
  } finally {
    setIsSaving(false)
  }
}
```

代码逻辑正确，问题应该在后端。

### 2.2 启动应用查看日志

```bash
npm run dev
```

发现错误信息：

```
Error: Cannot find module '/Users/marketing/Desktop/openkin/out/node_modules/tsx/dist/preflight.cjs'
Require stack:
- internal/preload
```

后端进程启动失败！

### 2.3 定位问题根源

检查 `electron/main/index.ts` 中的后端启动代码：

```ts
const entry = app.isPackaged
  ? join(process.resourcesPath, 'backend/index.js')
  : join(__dirname, '../../core/agent_engine/index.ts')

const isPackaged = app.isPackaged
const cmd = isPackaged ? process.execPath : 'node'
const args = isPackaged
  ? [entry]
  : [
      '--require', join(__dirname, '../../node_modules/tsx/dist/preflight.cjs'),
      '--import', `file://${join(__dirname, '../../node_modules/tsx/dist/loader.mjs')}`,
      entry,
    ]
```

**问题分析**：

- 在开发模式下，`__dirname` 是 `/Users/marketing/Desktop/openkin/out/electron/main`
- `join(__dirname, '../../node_modules/tsx/dist/preflight.cjs')` 解析为：
  - `/Users/marketing/Desktop/openkin/out/electron/main/../../node_modules/tsx/dist/preflight.cjs`
  - 即 `/Users/marketing/Desktop/openkin/out/electron/node_modules/tsx/dist/preflight.cjs`
- 但实际 `node_modules` 在项目根目录：`/Users/marketing/Desktop/openkin/node_modules/tsx/dist/preflight.cjs`
- 编译后的 `out` 目录下不存在 `node_modules`！

### 2.4 验证目录结构

```bash
ls -la /Users/marketing/Desktop/openkin/out/electron/main/
# 只包含 index.js

ls -la /Users/marketing/Desktop/openkin/out/node_modules/tsx/dist/
# ls: cannot access '/Users/marketing/Desktop/openkin/out/node_modules/tsx/dist': No such file or directory

ls -la /Users/marketing/Desktop/openkin/node_modules/tsx/dist/
# 存在该目录
```

确认路径问题。

---

## 三、根本原因

| # | 位置 | 原因 |
|---|------|------|
| 1 | `electron/main/index.ts` | 开发模式下tsx模块路径计算错误，使用相对于编译输出目录的路径，而不是相对于项目根目录的路径 |

当后端进程启动失败时，前端调用 `saveApiKeys` 时，Electron主进程的IPC handler调用后端API（`/api/config/save-keys`），但后端服务根本没有启动，导致请求失败，前端捕获到错误后弹出"保存失败"提示。

---

## 四、修复方案

修改 `electron/main/index.ts` 中的路径计算逻辑：

```ts
const entry = app.isPackaged
  ? join(process.resourcesPath, 'backend/index.js')
  : join(__dirname, '../../../core/agent_engine/index.ts')  // 修正：多一层 ../

const isPackaged = app.isPackaged
const cmd = isPackaged ? process.execPath : 'node'

// 获取项目根目录（package.json所在目录）
const projectRoot = app.isPackaged
  ? process.resourcesPath
  : join(__dirname, '../../../')  // 修正：多一层 ../

const args = isPackaged
  ? [entry]
  : [
      '--require', join(projectRoot, 'node_modules/tsx/dist/preflight.cjs'),  // 使用 projectRoot
      '--import', `file://${join(projectRoot, 'node_modules/tsx/dist/loader.mjs')}`,  // 使用 projectRoot
      entry,
    ]
```

**关键修改点**：

1. `entry` 路径从 `../../core/agent_engine/index.ts` 改为 `../../../core/agent_engine/index.ts`
2. 新增 `projectRoot` 变量，在开发模式下指向项目根目录
3. tsx 模块路径使用 `projectRoot` 而不是 `__dirname`

---

## 五、验证

修复后重新启动应用：

```bash
npm run dev
```

**启动日志**：

```
[Backend] BACKEND_READY:7788
[Main] Using backend on port 7788
```

后端成功启动！

**测试API配置保存**：

1. 进入引导流程的API Key配置页面
2. 填写自定义端点 `https://api.longcat.chat/openai`
3. 点击"下一步"
4. ✅ 成功跳转到创建Agent页面
5. ✅ 通过API验证配置已保存：

```bash
curl http://127.0.0.1:7788/api/config/keys
# 返回：
{
  "data": {
    "openai": "ak_2Av7J392D4F91HE8UC19n7rx4aZ5E",
    "anthropic": "",
    "customEndpoint": "https://api.longcat.chat/openai",
    "customModel": ""
  }
}
```

---

## 六、经验教训

1. **路径计算要考虑编译输出结构**：Electron应用在开发模式下，`__dirname` 指向编译后的 `out/electron/main`，而不是源代码目录
2. **路径相对于项目根目录**：对于 `node_modules` 等开发依赖，应该使用相对于项目根目录的路径，而不是相对于编译输出目录
3. **开发/生产环境区分**：在不同打包模式下，路径计算逻辑需要分别处理
4. **后端启动失败的沉默失败**：当后端启动失败时，前端的API调用会静默失败，应该在后端启动时提供更明显的错误提示
5. **单元测试覆盖**：应该为路径计算逻辑添加单元测试，确保在开发和生产模式下都能正确工作

---

## 七、后续改进建议

1. **添加启动检查**：在Electron主进程启动时，验证后端是否成功启动，如果失败则在前端显示明显的错误提示
2. **路径配置化**：将路径计算逻辑提取到配置文件中，避免硬编码
3. **日志改进**：增强后端启动日志，包括详细的路径信息，便于排查问题
4. **健康检查端点**：实现后端健康检查端点，前端定期检查后端状态
