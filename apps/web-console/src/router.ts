import { createRouter, createWebHashHistory } from 'vue-router'

// Lazy-load all views for better initial bundle
const StatusView = () => import('./views/StatusView.vue')
const LogsView = () => import('./views/LogsView.vue')
const ToolsView = () => import('./views/ToolsView.vue')
const SessionsView = () => import('./views/SessionsView.vue')
const SessionDetailView = () => import('./views/SessionDetailView.vue')
const TracesView = () => import('./views/TracesView.vue')
const TraceDetailView = () => import('./views/TraceDetailView.vue')
const AgentsView = () => import('./views/AgentsView.vue')
const TasksView = () => import('./views/TasksView.vue')
const TaskDetailView = () => import('./views/TaskDetailView.vue')
const SettingsView = () => import('./views/SettingsView.vue')
const DatabaseView = () => import('./views/DatabaseView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/status' },
    { path: '/status', component: StatusView },
    { path: '/logs', component: LogsView },
    { path: '/tools', component: ToolsView },
    { path: '/db', component: DatabaseView },
    { path: '/sessions', component: SessionsView },
    { path: '/sessions/:id', component: SessionDetailView },
    { path: '/traces', component: TracesView },
    { path: '/traces/:traceId', component: TraceDetailView },
    { path: '/agents', component: AgentsView },
    { path: '/tasks', component: TasksView },
    { path: '/tasks/:id', component: TaskDetailView },
    { path: '/settings', component: SettingsView },
  ],
})
