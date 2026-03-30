import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import WebSocket from "ws";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
let backendProcess = null;
let backendPort = 7788;
let backendWs = null;
function initDataDir() {
  const base = join(homedir(), ".openkin");
  const dirs = [base, join(base, "agents"), join(base, "sessions")];
  for (const d of dirs) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
  const cfg = join(base, "config.json");
  if (!existsSync(cfg)) {
    writeFileSync(cfg, JSON.stringify({
      version: "1.0",
      initialized: false,
      active_agent_id: null,
      api_keys: { openai: "", anthropic: "", custom_endpoint: "" },
      ui: { theme: "dark", language: "zh-CN" }
    }, null, 2));
  }
}
async function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = new (require2("net")).Socket();
    socket.setTimeout(500);
    socket.connect(port, "127.0.0.1", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function findFreePort(start = 7788) {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(start, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => resolve(addr.port));
    });
    s.on("error", () => findFreePort(start + 1).then(resolve).catch(reject));
  });
}
function readBackendPortFile() {
  const portFile = join(homedir(), ".openkin", ".backend_port");
  if (!existsSync(portFile)) return null;
  try {
    const port = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}
async function startBackend() {
  const savedPort = readBackendPortFile();
  if (savedPort) {
    const alive = await isPortListening(savedPort);
    if (alive) {
      console.log(`[Main] Reusing existing backend on port ${savedPort}`);
      return savedPort;
    }
  }
  backendPort = await findFreePort();
  const entry = app.isPackaged ? join(process.resourcesPath, "backend/index.js") : join(__dirname, "../../src/backend/index.ts");
  const isPackaged = app.isPackaged;
  const cmd = isPackaged ? process.execPath : "node";
  const args = isPackaged ? [entry] : [
    "--require",
    join(__dirname, "../../node_modules/tsx/dist/preflight.cjs"),
    "--import",
    `file://${join(__dirname, "../../node_modules/tsx/dist/loader.mjs")}`,
    entry
  ];
  backendProcess = spawn(cmd, args, {
    env: { ...process.env, BACKEND_PORT: String(backendPort) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  backendProcess.stderr?.on("data", (d) => {
    console.error("[Backend]", d.toString().trim());
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Backend start timeout")), 2e4);
    backendProcess.stdout?.on("data", (d) => {
      const line = d.toString();
      console.log("[Backend]", line.trim());
      if (line.includes("BACKEND_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    backendProcess.on("error", reject);
    backendProcess.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Backend exited with code ${code}`));
    });
  });
  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Backend] crashed (${code}), restarting in 1s...`);
      setTimeout(() => startBackend(), 1e3);
    }
  });
  return backendPort;
}
function getOrCreateWs() {
  if (backendWs?.readyState === WebSocket.OPEN) return backendWs;
  backendWs = new WebSocket(`ws://127.0.0.1:${getBackendPort()}/ws/chat`);
  backendWs.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    switch (msg.type) {
      case "token":
        win.webContents.send("chat:token", { messageId: msg.messageId, content: msg.content });
        break;
      case "done":
        win.webContents.send("chat:done", { messageId: msg.messageId });
        break;
      case "error":
        win.webContents.send("chat:error", { code: msg.code, message: msg.message });
        break;
    }
  });
  backendWs.on("close", () => {
    backendWs = null;
    setTimeout(() => getOrCreateWs(), 1e3);
  });
  backendWs.on("error", (e) => console.error("[WS proxy]", e.message));
  return backendWs;
}
function getBackendPort() {
  const filePort = readBackendPortFile();
  if (filePort) return filePort;
  return backendPort;
}
async function backendFetch(path, init) {
  const port = getBackendPort();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init
  });
  return res.json();
}
function registerIpc() {
  ipcMain.handle("config:getInitialized", () => backendFetch("/api/config/initialized").then((r) => r.data?.initialized ?? false));
  ipcMain.handle("config:getApiKeys", () => backendFetch("/api/config/keys").then((r) => r.data));
  ipcMain.handle("config:saveApiKeys", (_e, keys) => backendFetch("/api/config/save-keys", { method: "POST", body: JSON.stringify(keys) }).then((r) => r.data));
  ipcMain.handle("api:validate", (_e, params) => backendFetch("/api/config/validate-key", { method: "POST", body: JSON.stringify(params) }).then((r) => r.data));
  ipcMain.handle("agent:list", () => backendFetch("/api/agents").then((r) => r.data));
  ipcMain.handle("agent:create", (_e, params) => backendFetch("/api/agents", { method: "POST", body: JSON.stringify(params) }).then((r) => r.data));
  ipcMain.handle("agent:getSoul", (_e, agentId) => backendFetch(`/api/agents/${agentId}/soul`).then((r) => r.data?.content));
  ipcMain.handle("agent:saveSoul", (_e, agentId, content) => backendFetch(`/api/agents/${agentId}/soul`, { method: "PUT", body: JSON.stringify({ content }) }).then((r) => r.data));
  ipcMain.handle("agent:delete", (_e, agentId) => backendFetch(`/api/agents/${agentId}`, { method: "DELETE" }).then((r) => r.data));
  ipcMain.handle("chat:send", (_e, params) => {
    const ws = getOrCreateWs();
    ws.send(JSON.stringify({ type: "chat", ...params, history: [] }));
  });
}
function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0F172A",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}
app.whenReady().then(async () => {
  initDataDir();
  try {
    backendPort = await startBackend();
    console.log(`[Main] Using backend on port ${backendPort}`);
  } catch (e) {
    console.error("[Main] Failed to start backend:", e);
  }
  registerIpc();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  backendWs?.close();
  backendProcess?.kill();
});
