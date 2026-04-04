# 017 Sandbox

## 目标

为 `run_script` 提供真正的**进程级隔离沙箱**，替代 `015` 的弱边界（路径白名单 + 超时），并在此基础上启用 `inline` 代码执行模式。

核心方案：**Deno 子进程 + 细粒度权限白名单**，让每个 Skill 脚本在受控环境中运行，无法越权访问文件系统、网络和敏感环境变量。

本计划建立在 [`015`](./015_skill_framework.md) 和 [`016`](./016_agent_self_management.md) 已完成的前提上。

---

## 背景

### 015/016 的安全边界不足

| 威胁 | 015/016 的防御 | 是否充分 |
|---|---|---|
| 脚本读取 `OPENAI_API_KEY` | 环境变量白名单 | 部分（Node 子进程泄漏路径多） |
| 脚本读取 skills 目录之外的文件 | 路径校验（启动前） | 不足（脚本运行时仍可任意 `fs.readFile`） |
| 脚本建立任意网络连接 | 无 | 完全没有 |
| `inline` 执行任意代码 | 禁用 | 规避而非解决 |

### 为什么选 Deno 而不是其他方案

| 方案 | 文件系统隔离 | 网络隔离 | 跨平台 | 复杂度 |
|---|---|---|---|---|
| `vm2` | 弱（已有逃逸 CVE） | 无 | ✓ | 低 |
| `isolated-vm` | 无（不提供 I/O API） | 无 | ✓（需 native addon） | 中 |
| Docker | 强 | 强 | 需 Docker 守护进程 | 高 |
| **Deno 子进程** | **强（`--allow-read`）** | **强（`--allow-net`）** | **✓（单二进制）** | **低** |

Deno 的 `--allow-read=<path>` `--allow-net=<hosts>` `--allow-env=<keys>` 是原生权限模型，无需自己实现隔离逻辑，且脚本仍用 TypeScript 编写，不需要换语言。

---

## 已冻结决策

### 沙箱执行模型

```
run_script(skillId, script, args)
  └─▶ 读取 workspace/skills/<skillId>/SKILL.md
  └─▶ 解析 frontmatter 中的 permissions 字段
  └─▶ 构造 Deno 子进程命令：
        deno run
          --no-prompt                              ← 禁止运行时交互式提权
          --allow-read=<skill目录绝对路径>          ← 只读本 Skill 目录
          --allow-env=SKILL_ARGS,SKILL_ID,NODE_ENV ← 只能读这三个环境变量
          [--allow-net=<SKILL.md 声明的域名>]      ← 按需，默认不开放
          [--allow-write=<skill目录绝对路径>]      ← 按需，默认不开放
          <script绝对路径>
  └─▶ 传入环境变量：SKILL_ARGS=<JSON>, SKILL_ID=<id>
  └─▶ 超时 30s 强杀（SIGKILL）
  └─▶ stdout/stderr 各限 64KB
  └─▶ 返回 { stdout, stderr, exitCode }
```

### `SKILL.md` 权限声明（新增 frontmatter 字段）

```yaml
---
skill-id: weather
description: |
  查询城市天气预报。
permissions:
  read: ["."]                     # 允许读取的路径，"." 表示本 Skill 目录，默认值
  net: []                         # 允许的网络目标，默认空（不允许网络），格式：["api.weather.com:443"]
  write: []                       # 允许写入的路径，默认空
  env: ["SKILL_ARGS", "SKILL_ID"] # 允许读取的环境变量，默认只允许这两个
---
```

路径含义：
- `"."` = 本 Skill 目录绝对路径（由框架展开）
- `"workspace"` = `$OPENKIN_WORKSPACE_DIR`（特殊关键字，由框架展开）
- 其他任意绝对路径：直接使用（框架校验不得指向 `packages/` 等源码目录）

### `inline` 模式（017 启用）

`run_script` 的 `inline` 参数在 015 中被禁用。017 后：
- 把内联代码写入系统临时目录（`os.tmpdir()`）的随机文件名 `.ts` 文件
- 用 Deno 子进程执行，权限为**最严格默认**：
  - `--allow-env=SKILL_ARGS,SKILL_ID`
  - 无 `--allow-read`（不能读任何文件）
  - 无 `--allow-net`（不能网络）
  - 无 `--allow-write`
- 执行完毕后立即删除临时文件（成功或失败均删除）

`inline` 模式的 `skillId` 字段设为 `"__inline__"`，日志中明确标注。

### Deno 可用性检测

启动时检测 `deno --version` 是否可用：
- 可用：`run_script` 切换到 Deno 模式
- 不可用：保留 015 的 `tsx` 模式（降级），在工具 description 中标注"沙箱不可用，运行在非隔离模式"

降级时 `inline` 模式不可用（返回明确错误："需要安装 Deno 以使用 inline 执行模式"）。

### 权限字段校验规则

| 字段 | 允许值 | 禁止值 |
|---|---|---|
| `read` | `"."`, `"workspace"`, 绝对路径（在 workspace 内） | 指向 `packages/`、`node_modules/`、系统目录 |
| `net` | 域名或 `host:port` 格式 | `*`（通配符，禁止） |
| `write` | `"."`, `"workspace"`，workspace 内绝对路径 | workspace 外的任何路径 |
| `env` | 任意字符串（额外添加到默认白名单） | 不做限制（Agent 写 Skill 时需注意） |

框架在构造 Deno 命令前校验所有 `permissions` 字段，违规时拒绝执行并返回错误。

### 与 016 `write_skill` 的配合

`write_skill` 写入的 `SKILL.md` 中 `permissions` 字段由 Agent 自己填写。如果 Agent 不填，框架使用最小默认权限：

```yaml
permissions:
  read: ["."]
  net: []
  write: []
  env: ["SKILL_ARGS", "SKILL_ID"]
```

这是最小权限原则：新 Skill 默认只能读自己目录。

---

## 影响范围

| 层级 | 影响 |
|---|---|
| `packages/core/src/tools/run-script.ts` | 核心改造：检测 Deno → 解析 permissions → 构造 Deno 命令；启用 `inline` 模式 |
| `packages/core/src/tools/run-script.ts` | 新增 Deno 可用性检测缓存（避免每次调用都 `deno --version`）|
| `workspace/skills/*/SKILL.md` | 按需添加 `permissions` frontmatter 字段（向后兼容：不填则用默认）|
| `scripts/test-sandbox.mjs` | 新增 smoke 脚本 |
| `package.json`（根） | 新增 `test:sandbox`，纳入 `verify` |
| `docs/architecture/ARCHITECTURE.md` | 更新安全边界说明 |

---

## 允许修改的目录

- `packages/core/src/tools/run-script.ts`
- `workspace/skills/`（现有 Skill 的 `SKILL.md` 添加 `permissions` 字段）
- `scripts/`
- `docs/architecture/ARCHITECTURE.md`
- `docs/exec-plans/active/`
- `package.json`（根，仅 `scripts` 字段）

## 禁止修改的目录

- `packages/core/src/tool-runtime.ts`（接口不变）
- `packages/core/src/run-engine.ts`
- `packages/core/src/types.ts`
- `packages/shared/contracts/`
- `packages/server/src/http-server.ts`
- `packages/sdk/client/`
- `packages/channel-core/`
- `apps/dev-console/`

---

## 本轮范围

1. **修改** `packages/core/src/tools/run-script.ts`
   - 新增 Deno 可用性检测（`deno --version`，结果缓存）
   - 新增 `permissions` frontmatter 解析（从 `SKILL.md` 读取）
   - 新增 Deno 子进程命令构造（`--allow-read`、`--allow-net`、`--allow-env`、`--allow-write`）
   - 权限字段校验（禁止写 workspace 外路径、禁止 `net: ["*"]` 等）
   - 启用 `inline` 模式（写临时文件 → Deno 最严格权限执行 → 删除临时文件）
   - 降级处理：Deno 不可用时保留 `tsx` 模式

2. **更新** `workspace/skills/weather/SKILL.md`
   - 添加 `permissions` frontmatter 字段（默认值）

3. **更新** `workspace/skills/manage-mcp/SKILL.md`
   - 添加 `permissions` 字段（需要 `write: ["workspace"]` 以写 `mcp-registry.json`，需要 `net: ["127.0.0.1"]` 以调内部 API）

4. **新增** `scripts/test-sandbox.mjs`
   - 场景 A：执行正常 Skill 脚本，验证结果正确
   - 场景 B：执行尝试读取 `skills/` 外文件的脚本，验证被 Deno 拒绝（exitCode 非 0）
   - 场景 C：执行尝试发起未声明网络请求的脚本，验证被 Deno 拒绝
   - 场景 D：执行 `inline` 代码块（合法逻辑），验证结果正确
   - 场景 E：执行 `inline` 代码块，尝试读取文件，验证被拒绝
   - **前置条件**：需要本机安装 Deno；脚本开头检测 Deno 可用性，不可用时跳过并打印提示

5. **更新** 根 `package.json`：`"test:sandbox": "node scripts/test-sandbox.mjs"` 纳入 `verify`（带 Deno 可用性前置检查，不可用时 skip 而非 fail）

---

## 本轮不做

- 不实现内存限制（Deno 暂不提供细粒度 heap 配额 API）
- 不实现 CPU 时间配额（只有超时强杀）
- 不实现 Docker 容器隔离（运维复杂度过高，Deno 已满足首期需求）
- 不实现多租户 Skill 隔离（不同用户的 Skill 互相隔离）
- 不实现 Skill 脚本的静态安全分析（AST 扫描）
- 不改变 `run_script` 的对外接口（inputSchema 和 outputSchema 保持兼容）

---

## 验收标准

1. Deno 可用时，`run_script` 使用 Deno 子进程执行脚本，正常 Skill 执行结果不变。
2. Deno 不可用时，`run_script` 降级到 `tsx` 模式，返回结果中标注"非沙箱模式"。
3. 脚本尝试读取 `skills/` 目录外的文件 → Deno 拒绝，`exitCode` 非 0，`stderr` 包含权限错误信息。
4. 脚本尝试建立未在 `permissions.net` 中声明的网络连接 → Deno 拒绝。
5. `inline` 模式可正常执行合法内联代码，尝试读文件/网络被拒绝。
6. `inline` 临时文件在执行后被删除（无论成功或失败）。
7. `permissions` 字段缺失的 `SKILL.md` 使用最小默认权限，执行不受影响。
8. `permissions.net: ["*"]` 被框架拒绝，返回配置错误而非执行失败。
9. `scripts/test-sandbox.mjs` 所有场景通过（Deno 可用环境）。
10. `pnpm verify` 通过（`test:sandbox` 在 Deno 不可用时 skip，不导致 verify 失败）。

---

## 必跑命令

1. `pnpm verify`
2. `pnpm test:sandbox`（需要 Deno）

---

## 升级条件

命中以下任一情况时，弱模型必须立即停止并升级到 high-capability mode 或人工：

- Deno 子进程的 `--allow-read` 在某些 macOS/Linux 路径下无法可靠限制
- `inline` 临时文件删除失败（无法在所有情况下保证清理）
- 权限字段校验出现无法用简单规则覆盖的绕过场景
- 连续两轮无法让 `pnpm verify` 与 `test:sandbox`（Deno 可用环境）同时通过

---

## 依赖与顺序

- **前置**：[`015`](./015_skill_framework.md)（`run_script` 基础实现）
- **前置**：[`016`](./016_agent_self_management.md)（`write_skill` 写入的脚本需要被 017 沙箱保护）
- **后续候选**：
  - Skill 脚本 AST 静态安全扫描
  - 内存 / CPU 配额（等待 Deno 支持）
  - 多租户 Skill 隔离

---

## 决策记录

| 决策点 | 选择 | 原因 |
|---|---|---|
| 沙箱技术选型 | Deno 子进程 | 原生权限模型；跨平台单二进制；TypeScript 原生支持；无 native addon；比 Docker 轻 |
| 权限声明位置 | `SKILL.md` frontmatter | Skill 的权限和文档放在一起，用户可以审计；不需要额外配置文件 |
| 默认权限 | 最小（只读本目录，无网络，无写权限） | 最小权限原则；不声明就不开放 |
| `net: ["*"]` | 禁止 | 通配符等同于无限制，违背沙箱目的 |
| Deno 不可用时 | 降级到 tsx，`test:sandbox` skip | 不强制要求 CI 安装 Deno；保证 `pnpm verify` 在无 Deno 环境也能通过 |
| `inline` 权限 | 最严格（无 read/net/write） | inline 代码来自 Agent 生成，风险最高；只允许纯计算逻辑 |
| 临时文件位置 | `os.tmpdir()` + 随机名 | 系统临时目录；不在 workspace 内避免污染；随机名防冲突 |
