/**
 * Browser / static-server fallback HTTP bridge for theworld Desktop.
 *
 * Route constants and SSE parsing are imported from @theworld/shared-contracts
 * so that this file stays aligned with the canonical server contract instead of
 * hard-coding paths. When the Electron preload bridge is available its methods
 * take precedence (see `resolveDesktopBridge`).
 *
 * Import map note: Electron's `file://` renderer cannot resolve bare specifiers,
 * so we reference the dist file via a relative path to the pnpm workspace symlink.
 */

import {
  apiPathSessions,
  apiPathSession,
  apiPathSessionMessages,
  apiPathSessionRuns,
  apiPathRuns,
  apiPathRunStream,
  apiPathRun,
  apiPathRunCancel,
  apiPathRunContext,
  apiPathApprovals,
  apiPathApprovalEvents,
  apiPathApprovalApprove,
  apiPathApprovalDeny,
  apiPathAgents,
  apiPathAgent,
  apiPathAgentEnable,
  apiPathAgentDisable,
  apiPathTasks,
  apiPathTask,
  apiPathTaskEnable,
  apiPathTaskDisable,
  apiPathTaskTrigger,
  apiPathTaskRuns,
  apiPathTaskRunDetail,
  apiPathSystemStatus,
  apiPathHealth,
  apiPathTools,
  apiPathSkills,
  apiPathLogs,
  apiPathLogStream,
  apiPathConfig,
  parseSseStreamEvents,
} from "../node_modules/@theworld/shared-contracts/dist/index.js"

// ── auth helpers (kept local – not in shared-contracts) ──────────────────

function buildHeaders(apiKey) {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`)
  }
  return headers
}

async function fetchWithOptionalAuthRetry(url, init, apiKey) {
  const first = await fetch(url, {
    method: init.method,
    headers: buildHeaders(apiKey),
    body: init.body,
  })
  if (first.status !== 401 || !apiKey) {
    return first
  }
  return fetch(url, {
    method: init.method,
    headers: buildHeaders(undefined),
    body: init.body,
  })
}

function authHeadersOnly(apiKey) {
  const headers = new Headers()
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`)
  }
  return headers
}

async function fetchGetWithOptionalAuthRetry(url, apiKey) {
  const first = await fetch(url, {
    method: "GET",
    headers: authHeadersOnly(apiKey),
  })
  if (first.status !== 401 || !apiKey) {
    return first
  }
  return fetch(url, {
    method: "GET",
    headers: authHeadersOnly(undefined),
  })
}

// ── SSE streaming (local – covers ReadableStream + async-iterable bodies) ─

async function* streamChunks(body) {
  if (body && typeof body[Symbol.asyncIterator] === "function") {
    for await (const chunk of body) {
      yield chunk
    }
    return
  }
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) yield value
      }
    } finally {
      reader.releaseLock?.()
    }
  }
}

async function parseSseStream(body, listener) {
  const decoder = new TextDecoder()
  let carry = ""

  for await (const chunk of streamChunks(body)) {
    const text = carry + decoder.decode(chunk, { stream: true })
    const lines = text.split("\n")
    carry = lines.pop() ?? ""

    let dataLine

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        dataLine = line.slice(6)
      } else if (line === "") {
        if (dataLine !== undefined) {
          try {
            listener(JSON.parse(dataLine))
          } catch {
            /* malformed chunk */
          }
          dataLine = undefined
        }
      }
    }
  }

  const tail = carry + decoder.decode()
  if (tail.trim()) {
    for (const ev of parseSseStreamEvents(tail)) {
      listener(ev)
    }
  }
}

// ── HTTP bridge ──────────────────────────────────────────────────────────

function norm(baseUrl) {
  return (baseUrl || "").replace(/\/+$/, "")
}

function createHttpDesktopBridge() {
  return {
    platform: typeof navigator !== "undefined" ? navigator.platform : "web",
    appName: "theworld Desktop (HTTP)",
    session: {
      async listSessions(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSessions()}?limit=100`,
          { method: "GET" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const sessions = json.data?.sessions ?? json.sessions ?? []
        return Array.isArray(sessions) ? sessions : []
      },

      async probeRunSurface(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return false
        try {
          const res = await fetchWithOptionalAuthRetry(
            `${base}${apiPathRuns()}`,
            { method: "POST", body: JSON.stringify({}) },
            apiKey,
          )
          return res.status !== 404
        } catch {
          return false
        }
      },

      async createSessionMessage(baseUrl, sessionId, content, role = "user", apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId || !String(content || "").trim()) {
          throw new Error("invalid_message_input")
        }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSessionMessages(sessionId)}`,
          {
            method: "POST",
            body: JSON.stringify({ role, content }),
          },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const message = json.data?.message ?? json.message
        if (!message?.id) throw new Error("missing_message_id")
        return message
      },

      async getSessionMessages(baseUrl, sessionId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId) return []
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSessionMessages(sessionId)}?limit=100`,
          { method: "GET" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const messages = json.data?.messages ?? json.messages ?? []
        return Array.isArray(messages) ? messages : []
      },

      async createSession(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) throw new Error("invalid_base_url")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSessions()}`,
          {
            method: "POST",
            body: JSON.stringify({ kind: "chat" }),
          },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const session = json.data?.session ?? json.session
        const id = session?.id
        const kind = session?.kind ?? "chat"
        if (!id) throw new Error("missing_session_id")
        return { id, kind }
      },

      async createRun(baseUrl, sessionId, text, apiKey, options) {
        const base = norm(baseUrl)
        if (!base || !sessionId || !String(text || "").trim()) {
          throw new Error("invalid_run_input")
        }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathRuns()}`,
          {
            method: "POST",
            body: JSON.stringify({
              sessionId,
              input: {
                text,
                ...(options?.attachments && options.attachments.length > 0 ? { attachments: options.attachments } : {}),
              },
              ...(options?.agentId ? { agentId: options.agentId } : {}),
              ...(options?.executionMode ? { executionMode: options.executionMode } : {}),
              ...(options?.streamAttachment ? { streamAttachment: options.streamAttachment } : {}),
            }),
          },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const traceId = json.data?.traceId ?? json.traceId
        if (!traceId) throw new Error("missing_trace_id")
        return { traceId }
      },

      async streamRunUntilTerminal(baseUrl, traceId, apiKey, onEvent) {
        const base = norm(baseUrl)
        if (!base || !traceId) return
        const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathRunStream(traceId)}`, apiKey)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const streamBody = res.body
        if (streamBody && (typeof streamBody.getReader === "function" || typeof streamBody[Symbol.asyncIterator] === "function")) {
          await parseSseStream(streamBody, onEvent)
        } else {
          const text = await res.text()
          for (const ev of parseSseStreamEvents(text)) {
            onEvent(ev)
          }
        }
      },

      async waitRunTerminal(baseUrl, traceId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !traceId) return
        const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathRunStream(traceId)}`, apiKey)
        if (!res.ok) return
        const streamBody = res.body
        if (streamBody && (typeof streamBody.getReader === "function" || typeof streamBody[Symbol.asyncIterator] === "function")) {
          await parseSseStream(streamBody, () => {})
        } else {
          await res.text()
        }
      },

      async listApprovals(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchWithOptionalAuthRetry(`${base}${apiPathApprovals()}`, { method: "GET" }, apiKey)
        if (!res.ok) return []
        const json = await res.json()
        const approvals = json.data?.approvals ?? json.approvals ?? []
        return Array.isArray(approvals) ? approvals : []
      },

      async approveApproval(baseUrl, approvalId, apiKey, body) {
        const base = norm(baseUrl)
        if (!base || !approvalId?.trim()) return { ok: false }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathApprovalApprove(approvalId)}`,
          { method: "POST", body: JSON.stringify(body ?? {}) },
          apiKey,
        )
        return { ok: res.ok }
      },

      async denyApproval(baseUrl, approvalId, apiKey, body) {
        const base = norm(baseUrl)
        if (!base || !approvalId?.trim()) return { ok: false }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathApprovalDeny(approvalId)}`,
          { method: "POST", body: JSON.stringify(body ?? {}) },
          apiKey,
        )
        return { ok: res.ok }
      },

      async getRunTrace(baseUrl, traceId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !traceId) return null
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathRun(traceId)}`,
          { method: "GET" },
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        const dto = json.data
        return dto && typeof dto === "object" ? dto : null
      },

      async cancelRun(baseUrl, traceId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !traceId) return { cancelled: false }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathRunCancel(traceId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const cancelled = json.data?.cancelled ?? json.cancelled
        return { cancelled: Boolean(cancelled) }
      },

      async getSession(baseUrl, sessionId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId) return null
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathSession(sessionId)}`,
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.data?.session ?? json.session ?? null
      },

      async patchSession(baseUrl, sessionId, patch, apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId) throw new Error("invalid_patch_session_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSession(sessionId)}`,
          { method: "PATCH", body: JSON.stringify(patch) },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return json.data?.session ?? json.session ?? null
      },

      async deleteSession(baseUrl, sessionId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId) throw new Error("invalid_delete_session_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSession(sessionId)}`,
          { method: "DELETE" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async getSessionMessagesPaged(baseUrl, sessionId, apiKey, before) {
        const base = norm(baseUrl)
        if (!base || !sessionId) return { messages: [], hasMore: false }
        let url = `${base}${apiPathSessionMessages(sessionId)}?limit=50`
        if (before) url += `&before=${before}`
        const res = await fetchGetWithOptionalAuthRetry(url, apiKey)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const messages = json.data?.messages ?? json.messages ?? []
        return { messages: Array.isArray(messages) ? messages : [], hasMore: Boolean(json.data?.hasMore ?? json.hasMore) }
      },

      async listSessionRuns(baseUrl, sessionId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !sessionId) return []
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathSessionRuns(sessionId)}`,
          apiKey,
        )
        if (!res.ok) return []
        const json = await res.json()
        const runs = json.data?.runs ?? json.runs ?? []
        return Array.isArray(runs) ? runs : []
      },

      async getRunContext(baseUrl, traceId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !traceId) return null
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathRunContext(traceId)}`,
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? null
      },
    },

    agent: {
      async listAgents(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchWithOptionalAuthRetry(`${base}${apiPathAgents()}`, { method: "GET" }, apiKey)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const agents = json.data?.agents ?? json.agents ?? []
        return Array.isArray(agents) ? agents : []
      },

      async createAgent(baseUrl, payload, apiKey) {
        const base = norm(baseUrl)
        if (!base || !payload?.name?.trim() || !payload?.systemPrompt?.trim()) {
          throw new Error("invalid_agent_input")
        }
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathAgents()}`,
          {
            method: "POST",
            body: JSON.stringify({
              ...(payload.id ? { id: payload.id.trim() } : {}),
              name: payload.name.trim(),
              ...(payload.description ? { description: payload.description.trim() } : {}),
              systemPrompt: payload.systemPrompt.trim(),
              ...(payload.model ? { model: payload.model.trim() } : {}),
            }),
          },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const agent = json.data?.agent ?? json.agent
        if (!agent?.id) throw new Error("missing_agent_id")
        return agent
      },

      async updateAgent(baseUrl, agentId, payload, apiKey) {
        const base = norm(baseUrl)
        if (!base || !agentId?.trim()) throw new Error("invalid_agent_update_input")
        const body = {}
        if (payload.name !== undefined) body.name = payload.name.trim()
        if (payload.description !== undefined) body.description = payload.description.trim()
        if (payload.systemPrompt !== undefined) body.systemPrompt = payload.systemPrompt.trim()
        if (payload.model !== undefined) body.model = payload.model.trim()
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathAgent(agentId)}`,
          {
            method: "PUT",
            body: JSON.stringify(body),
          },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const agent = json.data?.agent ?? json.agent
        if (!agent?.id) throw new Error("missing_agent_id")
        return agent
      },

      async deleteAgent(baseUrl, agentId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !agentId?.trim()) throw new Error("invalid_agent_delete_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathAgent(agentId)}`,
          { method: "DELETE" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async enableAgent(baseUrl, agentId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !agentId?.trim()) throw new Error("invalid_agent_enable_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathAgentEnable(agentId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async disableAgent(baseUrl, agentId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !agentId?.trim()) throw new Error("invalid_agent_disable_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathAgentDisable(agentId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },
    },

    task: {
      async listTasks(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathTasks()}`, apiKey)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const tasks = json.data?.tasks ?? json.tasks ?? []
        return Array.isArray(tasks) ? tasks : []
      },

      async createTask(baseUrl, payload, apiKey) {
        const base = norm(baseUrl)
        if (!base) throw new Error("invalid_base_url")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTasks()}`,
          { method: "POST", body: JSON.stringify(payload) },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const task = json.data?.task ?? json.task
        if (!task?.id) throw new Error("missing_task_id")
        return task
      },

      async updateTask(baseUrl, taskId, payload, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) throw new Error("invalid_update_task_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTask(taskId)}`,
          { method: "PUT", body: JSON.stringify(payload) },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return json.data?.task ?? json.task ?? null
      },

      async deleteTask(baseUrl, taskId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) throw new Error("invalid_delete_task_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTask(taskId)}`,
          { method: "DELETE" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async enableTask(baseUrl, taskId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) throw new Error("invalid_enable_task_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTaskEnable(taskId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async disableTask(baseUrl, taskId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) throw new Error("invalid_disable_task_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTaskDisable(taskId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      },

      async triggerTask(baseUrl, taskId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) throw new Error("invalid_trigger_task_input")
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathTaskTrigger(taskId)}`,
          { method: "POST" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return json.data ?? json
      },

      async listTaskRuns(baseUrl, taskId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId) return []
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathTaskRuns(taskId)}`,
          apiKey,
        )
        if (!res.ok) return []
        const json = await res.json()
        const runs = json.data?.runs ?? json.runs ?? []
        return Array.isArray(runs) ? runs : []
      },

      async getTaskRun(baseUrl, taskId, runId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !taskId || !runId) return null
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathTaskRunDetail(taskId, runId)}`,
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.data?.run ?? json.run ?? null
      },
    },

    system: {
      async getSystemStatus(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return {}
        const res = await fetchWithOptionalAuthRetry(
          `${base}${apiPathSystemStatus()}`,
          { method: "GET" },
          apiKey,
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return json.data ?? json
      },

      async getHealth(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return { ok: false }
        try {
          const res = await fetchGetWithOptionalAuthRetry(
            `${base}${apiPathHealth()}`,
          apiKey,
          )
          if (!res.ok) return { ok: false }
          const json = await res.json()
          return json.data ?? json
        } catch {
          return { ok: false }
        }
      },

      async listTools(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathTools()}`, apiKey)
        if (!res.ok) return []
        const json = await res.json()
        const tools = json.data?.tools ?? json.tools ?? []
        return Array.isArray(tools) ? tools : []
      },

      async listSkills(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return []
        const res = await fetchGetWithOptionalAuthRetry(`${base}${apiPathSkills()}`, apiKey)
        if (!res.ok) return []
        const json = await res.json()
        const skills = json.data?.skills ?? json.skills ?? []
        return Array.isArray(skills) ? skills : []
      },

      async getSkillContent(baseUrl, skillId, apiKey) {
        const base = norm(baseUrl)
        if (!base || !skillId) return null
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathSkills()}/${encodeURIComponent(skillId)}/content`,
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? json ?? null
      },

      async getConfig(baseUrl, apiKey) {
        const base = norm(baseUrl)
        if (!base) return null
        const res = await fetchGetWithOptionalAuthRetry(
          `${base}${apiPathConfig()}`,
          apiKey,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.data ?? json ?? null
      },
    },
  }
}

// ── Bridge resolution ────────────────────────────────────────────────────

function mergeLayer(httpLayer, nativeLayer) {
  const out = {}
  const keys = new Set([...Object.keys(httpLayer), ...Object.keys(nativeLayer || {})])
  for (const key of keys) {
    const nativeFn = nativeLayer?.[key]
    const httpFn = httpLayer[key]
    out[key] = typeof nativeFn === "function" ? nativeFn : httpFn
  }
  return out
}

/** @param {Record<string, unknown> | undefined} native Preload bridge from Electron, if any */
export function resolveDesktopBridge(native) {
  const http = createHttpDesktopBridge()
  if (!native) {
    return http
  }
  return {
    platform: native.platform ?? http.platform,
    appName: native.appName ?? http.appName,
    session: mergeLayer(http.session, native.session),
    agent: mergeLayer(http.agent, native.agent),
    task: mergeLayer(http.task, native.task),
    system: mergeLayer(http.system, native.system),
  }
}
