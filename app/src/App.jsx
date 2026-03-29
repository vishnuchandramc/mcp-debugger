import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from './TopBar.jsx';
import TabBar from './TabBar.jsx';
import RequestPanel from './RequestPanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import BottomConsole from './BottomConsole.jsx';
import { createMcpClient, callMcpTool, disconnectMcpClient, generateToolTemplate } from './mcpClient.js';
import { cn } from "@/lib/utils";
import Editor from '@monaco-editor/react';

const DEFAULT_ENDPOINT = '';
const DEFAULT_BODY = '';
const DEFAULT_HEADERS = [{ key: '', value: '', enabled: true }];
const DEFAULT_CONTEXT = JSON.stringify({ system: '', messages: [] }, null, 2);
const DEFAULT_AUTH = { type: 'none', token: '', apiKey: { key: '', value: '', addTo: 'header' } };
const TABS_KEY = 'mcp_debugger_tabs';
const MAX_HISTORY = 50;

function generateCurl({ method, url, headers, body }) {
  const parts = ['curl'];
  if (method !== 'GET') parts.push(`-X ${method}`);
  parts.push(`"${url}"`);
  for (const [key, value] of Object.entries(headers)) {
    parts.push(`-H "${key}: ${value.replace(/"/g, '\\"')}"`);
  }
  if (body && method !== 'GET' && method !== 'DELETE') {
    let prettyBody = body;
    try {
      prettyBody = JSON.stringify(JSON.parse(body), null, 2);
    } catch { /* not json */ }
    parts.push(`-d '${prettyBody.replace(/'/g, "'\\''")}'`);
  }
  return parts.join(' \\\n  ');
}

function tokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    const ch = str[i];
    if (ch === '"' || ch === "'") {
      // Quoted string
      const quote = ch;
      i++;
      let token = '';
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\' && i + 1 < str.length) {
          token += str[i + 1];
          i += 2;
        } else {
          token += str[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      // Unquoted token
      let token = '';
      while (i < str.length && !/\s/.test(str[i])) {
        token += str[i];
        i++;
      }
      tokens.push(token);
    }
  }
  return tokens;
}

function parseCurl(curlStr) {
  const normalized = curlStr.replace(/\\\s*\n/g, ' ').trim();
  if (!normalized.startsWith('curl')) return null;

  let method = 'GET';
  let url = '';
  const headers = [];
  let body = null;

  const tokens = tokenize(normalized);
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      method = (tokens[++i] || 'GET').toUpperCase();
    } else if (t === '-H' || t === '--header') {
      const hdr = tokens[++i] || '';
      const colonIdx = hdr.indexOf(':');
      if (colonIdx > 0) {
        headers.push({ key: hdr.slice(0, colonIdx).trim(), value: hdr.slice(colonIdx + 1).trim() });
      }
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      body = tokens[++i] || '';
      if (method === 'GET') method = 'POST';
    } else if (!t.startsWith('-') && !url) {
      url = t;
    }
  }

  return { method, url, headers, body };
}

function applyAuth(auth, headersObj, endpoint) {
  if (!auth || auth.type === 'none') return { headers: headersObj, endpoint };
  if (auth.type === 'bearer' && auth.token.trim()) {
    headersObj['Authorization'] = 'Bearer ' + auth.token.trim();
  } else if (auth.type === 'apikey' && auth.apiKey.key.trim() && auth.apiKey.value.trim()) {
    if (auth.apiKey.addTo === 'query') {
      try {
        const url = new URL(endpoint);
        url.searchParams.set(auth.apiKey.key.trim(), auth.apiKey.value.trim());
        return { headers: headersObj, endpoint: url.toString() };
      } catch {
        // If URL is invalid, fall through without modifying
      }
    } else {
      headersObj[auth.apiKey.key.trim()] = auth.apiKey.value.trim();
    }
  }
  return { headers: headersObj, endpoint };
}

function buildHeadersObject(headerRows, includeContentType) {
  const result = {};
  if (includeContentType) {
    result['Content-Type'] = 'application/json';
  }
  for (const { key, value, enabled } of headerRows) {
    if (enabled === false) continue;
    
    const trimmed = key.trim();
    if (trimmed) {
      result[trimmed] = value;
    }
  }
  return result;
}

function extractToolExecution(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  const content = parsed.content;
  if (Array.isArray(content)) {
    const toolUse = content.find((c) => c.type === 'tool_use');
    if (toolUse) {
      return {
        name: toolUse.name,
        arguments: toolUse.input ?? null,
        output: null,
      };
    }
  }

  const choices = parsed.choices;
  if (Array.isArray(choices) && choices[0]?.message?.tool_calls?.length) {
    const tc = choices[0].message.tool_calls[0];
    let args = tc.function?.arguments;
    try { args = JSON.parse(args); } catch { /* leave as string */ }
    return {
      name: tc.function?.name,
      arguments: args,
      output: null,
    };
  }

  if (Array.isArray(choices) && choices[0]?.message?.function_call) {
    const fc = choices[0].message.function_call;
    let args = fc.arguments;
    try { args = JSON.parse(args); } catch { /* leave as string */ }
    return {
      name: fc.name,
      arguments: args ?? null,
      output: null,
    };
  }

  if (parsed.tool || parsed.tool_name || parsed.tool_call || parsed.function_call) {
    return {
      name: parsed.tool_name ?? parsed.tool ?? parsed.tool_call?.name ?? parsed.function_call?.name ?? 'unknown',
      arguments: parsed.arguments ?? parsed.input ?? parsed.tool_call?.arguments ?? parsed.function_call?.arguments ?? null,
      output: parsed.output ?? parsed.result ?? null,
    };
  }

  return null;
}

function detectApiError(parsed, status) {
  if (status >= 400) {
    if (parsed && typeof parsed === 'object') {
      return {
        message: parsed.error?.message || parsed.error || parsed.message || parsed.detail || `HTTP ${status}`,
        code: parsed.error?.code || parsed.code || parsed.status || status,
      };
    }
    return { message: `HTTP ${status}`, code: status };
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.error || (parsed.code && typeof parsed.code === 'number' && parsed.code >= 400)) {
      return {
        message: parsed.error?.message || parsed.error || parsed.message || 'Unknown error',
        code: parsed.error?.code || parsed.code || null,
      };
    }
  }
  return null;
}


const SAVEABLE_TAB_FIELDS = ['id', 'name', 'method', 'endpoint', 'body', 'headers', 'context', 'auth', 'mode', 'history'];

function loadTabs() {
  try {
    const saved = JSON.parse(localStorage.getItem(TABS_KEY));
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length > 0) {
      const tabs = saved.tabs.map(t => ({
        ...Object.fromEntries(SAVEABLE_TAB_FIELDS.map(f => [f, t[f]])),
        auth: { ...DEFAULT_AUTH, ...t.auth, apiKey: { ...DEFAULT_AUTH.apiKey, ...(t.auth?.apiKey) } },
        history: t.history ?? [],
        response: null, rawResponse: null, isError: false,
        toolExecution: null, loading: false,
      }));
      return { tabs, activeTabId: saved.activeTabId, nextId: saved.nextId, nextTabNumber: saved.nextTabNumber };
    }
  } catch { /* ignore */ }
  return null;
}

function saveTabs(tabs, activeTabId, nextId, nextTabNumber) {
  const saveable = tabs.map(t => Object.fromEntries(SAVEABLE_TAB_FIELDS.map(f => [f, t[f]])));
  localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: saveable, activeTabId, nextId, nextTabNumber }));
}

export default function App() {
  // --- Tab state ---
  const saved = useRef(loadTabs());
  const nextId = useRef(saved.current?.nextId ?? 2);
  const nextTabNumber = useRef(saved.current?.nextTabNumber ?? 2);

  const [tabs, setTabs] = useState(() => saved.current?.tabs ?? [{
    id: 1, name: 'Untitled 1',
    mode: 'http',
    method: 'POST', endpoint: DEFAULT_ENDPOINT,
    body: DEFAULT_BODY, headers: DEFAULT_HEADERS, context: DEFAULT_CONTEXT, auth: DEFAULT_AUTH,
    response: null, rawResponse: null, isError: false,
    toolExecution: null, loading: false,
  }]);
  const [activeTabId, setActiveTabId] = useState(() => saved.current?.activeTabId ?? 1);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const mode = activeTab?.mode || 'http';

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mcp_debugger_settings')) || { defaultMethod: 'POST' };
    } catch {
      return { defaultMethod: 'POST' };
    }
  });

  useEffect(() => {
    localStorage.setItem('mcp_debugger_settings', JSON.stringify(settings));
  }, [settings]);

  const activeTabIdRef = useRef(activeTabId);
  const activeTabRef = useRef(activeTab);
  const handleNewTabRef = useRef(null);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
    activeTabRef.current = activeTab;
    handleNewTabRef.current = handleNewTab;
  });

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onOpenSettings(() => setShowSettings(true));
      window.electronAPI.onNewTab(() => {
        if (handleNewTabRef.current) handleNewTabRef.current();
      });
      window.electronAPI.onImportData((parsedData) => {
        setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, ...parsedData } : t));
      });
      window.electronAPI.onTriggerExport(() => {
        const tab = activeTabRef.current;
        if (!tab) return;
        const data = {
          name: tab.name, method: tab.method, endpoint: tab.endpoint,
          headers: tab.headers, body: tab.body, context: tab.context, auth: tab.auth,
        };
        const defaultName = `${(tab.name || 'request').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        window.electronAPI.saveFile(JSON.stringify(data, null, 2), defaultName);
      });
    }
  }, []);

  function updateTab(tabId, fields) {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...fields } : t));
  }

  function updateActiveTab(fields) {
    updateTab(activeTabId, fields);
  }

  // --- Persist tabs to localStorage ---
  useEffect(() => {
    saveTabs(tabs, activeTabId, nextId.current, nextTabNumber.current);
  }, [tabs, activeTabId]);

  function handleRenameTab(id, newName) {
    updateTab(id, { name: newName, _userRenamed: true });
  }

  function getTabLabel(url) {
    if (!url || !url.trim()) return '';
    try {
      const u = new URL(url);
      const path = u.pathname === '/' ? '' : u.pathname;
      return u.host + path;
    } catch {
      // Not a valid URL yet — strip query params manually
      const clean = url.split('?')[0];
      return clean.length > 40 ? clean.slice(0, 40) + '…' : clean;
    }
  }

  // Individual setters that delegate to updateActiveTab (preserves child component interfaces)
  const setMethod = (v) => updateActiveTab({ method: v });
  const setEndpoint = (v) => {
    const tab = tabs.find(t => t.id === activeTabId);
    const updates = { endpoint: v };
    // Auto-rename only if user hasn't manually renamed
    if (tab && !tab._userRenamed) {
      const label = getTabLabel(v);
      if (label) updates.name = label;
      else updates.name = 'New Request';
    }
    updateActiveTab(updates);
  };
  const setBody = (v) => updateActiveTab({ body: v });
  const setHeaders = (v) => updateActiveTab({ headers: v });
  const setContext = (v) => updateActiveTab({ context: v });
  const setAuth = (v) => updateActiveTab({ auth: v });

  // --- Tab management ---
  function handleNewTab() {
    const id = nextId.current++;
    const tab = {
      id, name: 'New Request',
      mode: 'http',
      method: settings.defaultMethod || 'POST', endpoint: DEFAULT_ENDPOINT,
      body: DEFAULT_BODY, headers: DEFAULT_HEADERS, context: DEFAULT_CONTEXT, auth: DEFAULT_AUTH,
      response: null, rawResponse: null, isError: false,
      toolExecution: null, loading: false, history: [],
    };
    setTabs(prev => [...prev, tab]);
    setActiveTabId(id);
  }

  function handleCloseTab(id) {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (id === activeTabId) {
        const newIdx = Math.min(idx, next.length - 1);
        setActiveTabId(next[newIdx].id);
      }
      return next;
    });
  }

  function handleSelectTab(id) {
    setActiveTabId(id);
  }

  const activeHistory = tabs.find(t => t.id === activeTabId)?.history ?? [];

  // --- MCP state ---
  const [mcpUrl, setMcpUrl] = useState('http://localhost:3000/sse');
  const [mcpClient, setMcpClient] = useState(null);
  const [mcpTools, setMcpTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [mcpConnecting, setMcpConnecting] = useState(false);

  // --- Console log state ---
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(true);
  const logIdRef = useRef(0);

  function appendLog(msg, type = 'info') {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setConsoleLogs(prev => [...prev, { id: logIdRef.current++, msg, type, time }]);
  }

  // --- cURL state ---
  const [showCurl, setShowCurl] = useState(false);
  const [curlCommand, setCurlCommand] = useState('');
  const [curlCopied, setCurlCopied] = useState(false);

  // --- Layout state ---
  const [leftWidth, setLeftWidth] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef(null);
  const mcpClientRef = useRef(null);

  // Keep ref in sync for cleanup
  useEffect(() => {
    mcpClientRef.current = mcpClient;
  }, [mcpClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mcpClientRef.current) {
        disconnectMcpClient(mcpClientRef.current);
      }
    };
  }, []);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(80, Math.max(20, pct)));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // --- HTTP handlers ---
  function pushHistory(entry) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const hist = tab.history ?? [];
    const key = `${entry.method}::${entry.endpoint}`;
    const existing = hist.findIndex(h => `${h.method}::${h.endpoint}` === key);
    let next;
    if (existing !== -1) {
      const item = { ...hist[existing], ...entry, hits: (hist[existing].hits ?? 1) + 1, timestamp: Date.now() };
      next = [item, ...hist.filter((_, i) => i !== existing)];
    } else {
      next = [{ ...entry, hits: 1 }, ...hist];
    }
    next = next.slice(0, MAX_HISTORY);
    updateTab(activeTabId, { history: next });
  }

  function loadHistoryItem(item) {
    updateActiveTab({
      endpoint: item.endpoint,
      method: item.method,
      body: item.body,
      headers: item.headers ?? DEFAULT_HEADERS,
    });
  }

  async function handleRun() {
    const tabId = activeTabId;
    const tab = tabs.find(t => t.id === tabId);
    const { method: m, endpoint: ep, body: b, headers: h } = tab;
    const setTabField = (fields) => updateTab(tabId, fields);
    const hasBody = m !== 'GET' && m !== 'DELETE';

    if (hasBody) {
      try { JSON.parse(b); } catch (e) {
        setTabField({ response: `Invalid JSON: ${e.message}`, rawResponse: `Invalid JSON: ${e.message}`, isError: true });
        return;
      }
    }

    setTabField({ loading: true, isError: false, response: null, rawResponse: null, toolExecution: null, responseMeta: null });
    appendLog(`→ ${m} ${ep}`, 'info');

    try {
      const headersObj = buildHeadersObject(h, hasBody);
      const { headers: finalHeaders, endpoint: finalEndpoint } = applyAuth(tab.auth, headersObj, ep);
      const startTime = Date.now();
      const res = await fetch(finalEndpoint, {
        method: m,
        headers: finalHeaders,
        body: hasBody ? b : undefined,
      });
      const elapsed = Date.now() - startTime;

      appendLog(`← ${res.status} ${res.statusText} (${elapsed}ms)`, res.ok ? 'success' : 'warn');

      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
        setTabField({ rawResponse: text, response: JSON.stringify(parsed, null, 2) });
      } catch {
        setTabField({ rawResponse: text, response: text });
      }

      const apiError = detectApiError(parsed, res.status);
      setTabField({
        toolExecution: extractToolExecution(parsed),
        isError: !res.ok || apiError !== null,
        responseMeta: {
          status: res.status,
          statusText: res.statusText,
          time: elapsed,
          apiError,
        },
      });
      pushHistory({ endpoint: ep, method: m, body: b, headers: h, timestamp: Date.now() });
    } catch (e) {
      const msg = `Network error: ${e.message}`;
      appendLog(`✗ ${msg}`, 'error');
      setTabField({ response: msg, rawResponse: msg, isError: true, responseMeta: { status: 0, statusText: 'Network Error', time: 0, apiError: { message: e.message } } });
    } finally {
      setTabField({ loading: false });
    }
  }

  // --- MCP handlers ---
  async function handleConnect() {
    setMcpConnecting(true);
    updateActiveTab({ isError: false, response: null, rawResponse: null, toolExecution: null });
    appendLog(`→ Connecting to MCP server: ${mcpUrl}`, 'info');

    try {
      const { client, tools } = await createMcpClient(mcpUrl);
      setMcpClient(client);
      setMcpTools(tools);
      setMcpConnected(true);
      setSelectedTool(null);
      appendLog(`✓ MCP connected — ${tools.length} tools discovered`, 'success');
    } catch (e) {
      const msg = `MCP connection error: ${e.message}`;
      appendLog(`✗ ${msg}`, 'error');
      updateActiveTab({ response: msg, rawResponse: msg, isError: true });
      setMcpClient(null);
      setMcpTools([]);
      setMcpConnected(false);
    } finally {
      setMcpConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (mcpClient) {
      await disconnectMcpClient(mcpClient);
    }
    setMcpClient(null);
    setMcpTools([]);
    setSelectedTool(null);
    setMcpConnected(false);
    updateActiveTab({ response: null, rawResponse: null, toolExecution: null });
  }

  function handleToolSelect(tool) {
    setSelectedTool(tool);
    const template = generateToolTemplate(tool);
    updateActiveTab({ body: template });
  }

  async function handleMcpRun() {
    if (!mcpClient || !selectedTool) return;

    const tabId = activeTabId;
    const tab = tabs.find(t => t.id === tabId);
    const setTabField = (fields) => updateTab(tabId, fields);

    let args;
    try {
      args = JSON.parse(tab.body);
    } catch (e) {
      setTabField({ response: `Invalid JSON: ${e.message}`, rawResponse: `Invalid JSON: ${e.message}`, isError: true });
      return;
    }

    setTabField({ loading: true, isError: false, response: null, rawResponse: null, toolExecution: null });

    try {
      const result = await callMcpTool(mcpClient, selectedTool.name, args);
      const raw = JSON.stringify(result, null, 2);
      setTabField({ rawResponse: raw, response: raw });

      setTabField({
        toolExecution: {
          name: selectedTool.name,
          arguments: args,
          output: result.content ?? result,
        },
      });
    } catch (e) {
      const msg = `MCP tool error: ${e.message}`;
      setTabField({ response: msg, rawResponse: msg, isError: true });
    } finally {
      setTabField({ loading: false });
    }
  }

  // --- cURL handlers ---
  function handleGenerateCurl() {
    const hasBody = activeTab.method !== 'GET' && activeTab.method !== 'DELETE';
    const hdrs = buildHeadersObject(activeTab.headers, hasBody);
    const cmd = generateCurl({ method: activeTab.method, url: activeTab.endpoint, headers: hdrs, body: hasBody ? activeTab.body : null });
    setCurlCommand(cmd);
    setShowCurl(true);
    setCurlCopied(false);
  }

  function handleCurlImport(text) {
    const result = parseCurl(text);
    if (!result) return;
    const fields = {
      method: result.method,
      endpoint: result.url,
      headers: result.headers.length ? result.headers : [{ key: '', value: '' }],
    };
    if (result.body) {
      try {
        fields.body = JSON.stringify(JSON.parse(result.body), null, 2);
      } catch {
        fields.body = result.body;
      }
    }
    // Auto-rename tab from imported URL
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && !tab._userRenamed && result.url) {
      const label = getTabLabel(result.url);
      if (label) fields.name = label;
    }
    updateActiveTab(fields);
  }

  function handleCurlCopy() {
    navigator.clipboard.writeText(curlCommand);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  }

  // --- Mode switching ---
  function handleModeChange(newMode) {
    if (newMode === mode) return;

    updateActiveTab({
      mode: newMode,
      response: null, 
      rawResponse: null, 
      isError: false, 
      toolExecution: null,
    });
  }

  const currentOnRun = mode === 'http' ? handleRun : handleMcpRun;
  const currentOnRunRef = useRef(currentOnRun);
  currentOnRunRef.current = currentOnRun;

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        currentOnRunRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 font-mono overflow-hidden" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <TabBar
        tabs={tabs}
        mode={mode}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onRenameTab={handleRenameTab}
      />

      <TopBar
        mode={mode}
        setMode={handleModeChange}
        endpoint={activeTab.endpoint}
        setEndpoint={setEndpoint}
        method={activeTab.method}
        setMethod={setMethod}
        onRun={currentOnRun}
        loading={activeTab.loading}
        mcpUrl={mcpUrl}
        setMcpUrl={setMcpUrl}
        mcpConnected={mcpConnected}
        mcpConnecting={mcpConnecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        selectedTool={selectedTool}
        onGenerateCurl={handleGenerateCurl}
        onCurlImport={handleCurlImport}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[180px] shrink-0 bg-zinc-950 border-r border-zinc-800 p-2 overflow-y-auto">
          {mode === 'http' ? (
            <>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <p className="text-[10px] font-bold tracking-wider text-zinc-600 m-0 uppercase flex-1 shrink-0">HISTORY</p>
                {activeHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Clear history for this tab?')) {
                        updateTab(activeTabId, { history: [] });
                      }
                    }}
                    className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-red-400 bg-transparent border-none cursor-pointer p-0"
                    title="Clear history"
                  >
                    Clear
                  </button>
                )}
              </div>
              {activeHistory.length === 0 ? (
                <p className="text-[11px] text-zinc-600 m-0 ml-1">No requests yet.</p>
              ) : (
                activeHistory.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => loadHistoryItem(item)}
                    className="flex flex-col gap-0.5 w-full bg-transparent hover:bg-zinc-900 border-none rounded-none p-1.5 mb-0.5 cursor-pointer text-left outline-none transition-colors"
                    title={item.endpoint}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-bold" style={{ color: METHOD_COLORS[item.method] }}>
                        {item.method}
                      </span>
                      {(item.hits ?? 1) > 1 && (
                        <span className="text-[9px] font-bold text-zinc-500 bg-zinc-800 px-1 py-px rounded-sm">
                          ×{item.hits}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 overflow-hidden text-ellipsis whitespace-nowrap">{shortUrl(item.endpoint)}</span>
                  </button>
                ))
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 m-0 mb-1.5 ml-1 uppercase">TOOLS</p>
              {!mcpConnected ? (
                <p className="text-[11px] text-zinc-600 m-0 ml-1">Connect to discover tools.</p>
              ) : mcpTools.length === 0 ? (
                <p className="text-[11px] text-zinc-600 m-0 ml-1">No tools available.</p>
              ) : (
                mcpTools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleToolSelect(tool)}
                    className={cn(
                      "flex flex-col gap-0.5 w-full bg-transparent hover:bg-zinc-900 border-none rounded-none p-1.5 mb-0.5 cursor-pointer text-left outline-none transition-colors",
                      selectedTool?.name === tool.name && "bg-zinc-800 hover:bg-zinc-800"
                    )}
                    title={tool.description || tool.name}
                  >
                    <span className="text-[11px] font-bold text-zinc-200">{tool.name}</span>
                    {tool.description && (
                      <span className="text-[10px] text-zinc-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {tool.description.length > 40
                          ? tool.description.slice(0, 40) + '…'
                          : tool.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </>
          )}
        </aside>

        <div className="flex flex-1 overflow-hidden bg-zinc-900" ref={containerRef}>
          <div className="flex flex-col overflow-hidden" style={{ width: `${leftWidth}%` }}>
            <div className="text-[10px] font-bold text-zinc-500 bg-zinc-900 border-b border-zinc-800 py-1 px-3 tracking-wider uppercase">REQUEST</div>
            <RequestPanel
              key={`${activeTabId}-${mode}`}
              body={activeTab.body} setBody={setBody}
              headers={activeTab.headers} setHeaders={setHeaders}
              context={activeTab.context} setContext={setContext}
              auth={activeTab.auth} setAuth={setAuth}
              selectedTool={selectedTool}
              mode={mode}
            />
          </div>

          <div className="w-[1px] bg-zinc-800 cursor-col-resize relative z-10 before:absolute before:-inset-x-1 before:inset-y-0 before:cursor-col-resize hover:bg-zinc-600 transition-colors" onMouseDown={onMouseDown} title="Drag to resize" />

          <div className="flex flex-col overflow-hidden" style={{ width: `${100 - leftWidth}%` }}>
            <div className="text-[10px] font-bold text-zinc-500 bg-zinc-900 border-b border-zinc-800 py-1 px-3 tracking-wider uppercase">RESPONSE</div>
            <ResponsePanel
              key={activeTabId}
              response={activeTab.response}
              rawResponse={activeTab.rawResponse}
              isError={activeTab.isError}
              toolExecution={activeTab.toolExecution}
              requestBody={activeTab.body}
              mode={activeTab.mode}
              responseMeta={activeTab.responseMeta}
            />
          </div>
        </div>
      </div>

      {showConsole && (
        <BottomConsole
          logs={consoleLogs}
          onClose={() => setShowConsole(false)}
          onClear={() => setConsoleLogs([])}
        />
      )}

      {!showConsole && (
        <div className="flex items-center h-6 bg-zinc-950 border-t border-zinc-800 px-3 shrink-0">
          <button
            onClick={() => setShowConsole(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer uppercase tracking-wider font-bold"
          >
            ⌃ Terminal
          </button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-none p-5 w-[400px] max-w-[90vw] flex flex-col gap-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <span className="text-[14px] font-bold text-zinc-100 uppercase tracking-wider">Preferences</span>
              <button 
                onClick={() => setShowSettings(false)} 
                className="text-zinc-500 text-lg hover:text-zinc-300 leading-none p-0 outline-none bg-transparent border-none cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Default HTTP Method</label>
                <Select 
                  value={settings?.defaultMethod || 'POST'} 
                  onValueChange={(val) => setSettings({ ...settings, defaultMethod: val })}
                >
                  <SelectTrigger className="w-full h-8 text-[12px] font-bold bg-zinc-950 border-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                      <SelectItem key={m} value={m} className="text-[12px] font-bold">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Save Request History</label>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="checkbox" 
                    id="saveHistory" 
                    checked={settings?.saveHistory !== false}
                    onChange={(e) => setSettings({ ...settings, saveHistory: e.target.checked })}
                    className="accent-zinc-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <label htmlFor="saveHistory" className="text-[12px] text-zinc-300 cursor-pointer">
                    Enable automatic history tracking
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-3 pt-4 border-t border-zinc-800">
                <div 
                  onClick={() => {
                    if (confirm('Clear all workspace data and history? \n\nThis cannot be undone and will overwrite all stored tabs in localStorage.')) {
                      localStorage.removeItem('mcp_debugger_tabs');
                      localStorage.removeItem('mcp_debugger_history');
                      window.location.reload();
                    }
                  }}
                  className="w-full h-8 text-[11px] font-bold border border-red-900/50 text-red-500 hover:bg-red-950/50 hover:text-red-400 bg-transparent flex items-center justify-center cursor-pointer transition-colors"
                >
                  Clear Entire Workspace Data
                </div>
              </div>
            </div>
            
            <div className="mt-2 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-mono">MCP Debugger Frontend</span>
              <span className="text-[10px] text-zinc-500 font-mono font-bold">v0.1.0</span>
            </div>
          </div>
        </div>
      )}

      {showCurl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowCurl(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-none p-4 w-[600px] max-w-[90vw] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <span className="text-[13px] font-semibold text-zinc-200">cURL Command</span>
              <button onClick={() => setShowCurl(false)} className="text-zinc-500 text-lg hover:text-zinc-300 leading-none p-0 outline-none">
                &times;
              </button>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-none overflow-hidden h-[300px] relative">
              <Editor
                value={curlCommand}
                language="shell"
                theme="vs-dark"
                options={{
                  readOnly: true,
                  fontSize: 13,
                  fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'off',
                  renderLineHighlight: 'none',
                  tabSize: 2,
                  wordWrap: 'off',
                  padding: { top: 10, bottom: 10 },
                }}
              />
            </div>
            <button onClick={handleCurlCopy} className="self-end bg-transparent text-zinc-200 border border-zinc-700 hover:bg-zinc-800 rounded-none px-4 py-1.5 text-xs outline-none transition-colors">
              {curlCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const METHOD_COLORS = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#9cdcfe',
  PATCH: '#c586c0',
  DELETE: '#f48771',
};

function shortUrl(url) {
  try {
    const u = new URL(url);
    return (u.pathname === '/' ? u.hostname : u.hostname + u.pathname).slice(0, 22);
  } catch {
    return url.slice(0, 22);
  }
}


