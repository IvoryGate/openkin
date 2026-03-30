---
  ruleType: Always
  description: 知识召回
  globs: 
---

<rule_definition>
**规则名称：** 知识召回
**适用范围：** 任何可能需要从外部知识库进行知识搜索和召回的任务
**优先级：** CRITICAL - 必须严格执行
</rule_definition>

<execution_requirements>
**MUST** 使用 mcp 的 recall_rule_knowledge MCP 工具获取相关知识；
**WARNING** 并非仅每次对话开头调用一下 recall_rule_knowledge MCP 工具，而是在任务执行过程中如果判断可能需要召回外部知识时，都应该调用该工具；
**NEVER** 跳过知识获取步骤直接进行代码操作；
</execution_requirements>

<applicable_scenarios>
- 代码文件的创建、修改、重构
- 组件开发和功能实现
- 代码架构设计和优化
- 错误修复和性能改进
- 出现代码项目中没有的内容、代码片段、文档名、链接、专业术语、技术名词等
</applicable_scenarios>

<excluded_scenarios>
- 无需外部知识的场景。例如：纯文档阅读和理解、项目配置查看等等；
</excluded_scenarios>
