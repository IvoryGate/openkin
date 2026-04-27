<template>
  <section class="client-shell-page">
    <header class="client-top-nav">
      <div class="top-nav-left">
        <div class="brand-block">
          <BookOpen class="brand-mark" theme="outline" size="18" />
          <span class="brand-title">theworld</span>
          <span class="brand-subtitle">Desktop Client</span>
        </div>
        <nav class="main-tabs">
          <button v-for="tab in tabs" :key="tab" type="button" class="main-tab" :class="{ 'is-active': tab === activeTab }">
            {{ tab }}
          </button>
        </nav>
      </div>
      <div class="top-nav-right">
        <Monitor class="top-action-icon" theme="outline" size="16" />
        <More class="top-action-icon" theme="outline" size="16" />
      </div>
    </header>

    <div class="client-desktop-shell">
      <aside class="shell-pane shell-pane-left">
        <div class="left-rail-icons">
          <button type="button" class="rail-icon-btn is-active"><Message class="rail-icon" theme="outline" size="16" /></button>
          <button type="button" class="rail-icon-btn"><Inbox class="rail-icon" theme="outline" size="16" /></button>
          <button type="button" class="rail-icon-btn"><History class="rail-icon" theme="outline" size="16" /></button>
          <button type="button" class="rail-icon-btn"><Setting class="rail-icon" theme="outline" size="16" /></button>
        </div>
        <div class="left-rail-content">
          <h2 class="pane-title">会话</h2>
          <p class="pane-caption">WO-2 将接入真实 session 数据。</p>
        </div>
      </aside>

      <main class="shell-pane shell-pane-center">
        <div class="center-empty-state">
          <div class="empty-hero-icon">
            <Edit class="hero-icon" theme="outline" size="26" />
          </div>
          <h1 class="empty-title">宁静之地</h1>
          <p class="empty-subtitle">我是 theworld，今天我们从哪一个任务开始？</p>
        </div>
        <div class="center-composer-shell">
          <div class="composer-input">与你的项目继续对话...</div>
          <button type="button" class="composer-send-btn">发送</button>
        </div>
      </main>

      <aside class="shell-pane shell-pane-right">
        <section class="inspector-card">
          <div class="card-title-row">
            <h3>技能包</h3>
            <Plus class="card-title-icon" theme="outline" size="14" />
          </div>
          <p class="card-caption">WO-4 将接入 skills surface。</p>
        </section>
        <section class="inspector-card">
          <div class="card-title-row">
            <h3>工具包</h3>
            <Search class="card-title-icon" theme="outline" size="14" />
          </div>
          <p class="card-caption">WO-4 将接入 tools/status surface。</p>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { BookOpen, Edit, History, Inbox, Message, Monitor, More, Plus, Search, Setting } from '@icon-park/vue-next'

const tabs = ['聊天', '频道', '工作台', '知识库', '社群']
const activeTab = '聊天'
</script>

<style scoped>
.client-shell-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f7f4;
}

.client-top-nav {
  height: 56px;
  border-bottom: 1px solid #d8d5cd;
  background: #f3f2ee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.top-nav-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-mark {
  color: #6e6b64;
}

.brand-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: #2d2c29;
}

.brand-subtitle {
  font-size: 12px;
  color: #a8a59d;
}

.main-tabs {
  display: flex;
  gap: 4px;
}

.main-tab {
  border: none;
  background: transparent;
  color: #6e6b64;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
}

.main-tab:hover {
  background: #eeede8;
}

.main-tab.is-active {
  background: #eceae3;
  color: #2d2c29;
  font-weight: 600;
}

.top-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-action-icon {
  color: #6e6b64;
}

.client-desktop-shell {
  flex: 1;
  display: grid;
  grid-template-columns: 260px 1fr 320px;
  min-height: 0;
}

.shell-pane {
  min-height: 0;
}

.shell-pane-left {
  border-right: 1px solid #d8d5cd;
  background: #f3f2ee;
  display: grid;
  grid-template-columns: 52px 1fr;
}

.left-rail-icons {
  border-right: 1px solid #e7e5df;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.rail-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.rail-icon-btn:hover {
  background: #eeede8;
}

.rail-icon-btn.is-active {
  background: #eceae3;
}

.rail-icon {
  color: #6e6b64;
}

.left-rail-content {
  padding: 14px 12px;
}

.pane-title {
  font-size: 15px;
  color: #2d2c29;
  margin-bottom: 6px;
}

.pane-caption {
  font-size: 12px;
  line-height: 18px;
  color: #a8a59d;
}

.shell-pane-center {
  background: #f8f7f4;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

.center-empty-state {
  text-align: center;
}

.empty-hero-icon {
  width: 78px;
  height: 78px;
  margin: 0 auto 14px;
  border-radius: 20px;
  border: 1px solid #d8d5cd;
  background: #f3f2ee;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-icon {
  color: #6e6b64;
}

.empty-title {
  font-size: 30px;
  font-weight: 600;
  color: #2d2c29;
  line-height: 1.3;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 14px;
  color: #6e6b64;
}

.center-composer-shell {
  width: min(780px, 100%);
  border: 1px solid #d8d5cd;
  background: #ffffff;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.composer-input {
  flex: 1;
  min-height: 36px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: #a8a59d;
  font-size: 14px;
}

.composer-send-btn {
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  background: #4a4a4a;
  color: #f5f5f2;
}

.composer-send-btn:hover {
  background: #3f3f3f;
}

.shell-pane-right {
  border-left: 1px solid #d8d5cd;
  background: #f3f2ee;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspector-card {
  border: 1px solid #e7e5df;
  border-radius: 10px;
  background: #ffffff;
  padding: 10px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-title-row h3 {
  font-size: 13px;
  color: #2d2c29;
}

.card-title-icon {
  color: #6e6b64;
}

.card-caption {
  font-size: 12px;
  color: #a8a59d;
  line-height: 18px;
}
</style>
