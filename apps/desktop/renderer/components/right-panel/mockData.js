/** @type {import("./types").CandidateItem[]} */
export const rightPanelMockCandidates = [
  {
    id: "cand-001",
    status: "pending",
    source: "Agent",
    title: "重构右栏信息架构",
    summary: "将上下文/工具碎片聚合为候选卡片流，减少面板切换。",
  },
  {
    id: "cand-002",
    status: "accepted",
    source: "System",
    title: "统一候选卡片视觉规范",
    summary: "定义状态色与卡片操作区，确保 pending/accepted/frozen 一致可读。",
  },
  {
    id: "cand-003",
    status: "pending",
    source: "User",
    title: "增加输入捕捉区",
    summary: "在右栏顶部加入轻量输入，支持随手记录下一步动作。",
  },
  {
    id: "cand-004",
    status: "frozen",
    source: "Agent",
    title: "归档长周期优化项",
    summary: "将未进入当前冲刺的改进项冻结，避免干扰主流程。",
  },
  {
    id: "cand-005",
    status: "accepted",
    source: "System",
    title: "补充底部摘要",
    summary: "展示待确认/已采纳数量与最近 heartbeat 时间，强化态势感知。",
  },
  {
    id: "cand-006",
    status: "pending",
    source: "User",
    title: "设计空状态文案",
    summary: "当筛选后无数据时展示“暂无候选内容，记录点什么吧。”",
  },
  {
    id: "cand-007",
    status: "frozen",
    source: "Agent",
    title: "动画细节二期优化",
    summary: "卡片浮起、筛选淡入、折叠平滑过渡放入后续迭代。",
  },
  {
    id: "cand-008",
    status: "accepted",
    source: "System",
    title: "右栏固定宽度 360px",
    summary: "保持信息区稳定，避免随布局变化导致阅读跳动。",
  },
]

export const rightPanelMockHeartbeatAt = "3s 前"

