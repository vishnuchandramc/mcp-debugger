import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from './TopBar.jsx';
import TabBar from './TabBar.jsx';
import RequestPanel from './RequestPanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import { createMcpClient, callMcpTool, disconnectMcpClient, generateToolTemplate } from './mcpClient.js';

const DEFAULT_ENDPOINT = '';
const DEFAULT_BODY = '';
const DEFAULT_HEADERS = [{ key: '', value: '' }];
const DEFAULT_CONTEXT = JSON.stringify({ system: '', messages: [] }, null, 2);
const HISTORY_KEY = 'mcp_debugger_history';
const TABS_KEY = 'mcp_debugger_tabs';
const MAX_HISTORY = 5;

function generateCurl({ method, url, headers, body }) {
  const parts = ['curl'];
  if (method !== 'GET') parts.push(`-X ${method}`);
  parts.push(`"${url}"`);
  for (const [key, value] of Object.entries(headers)) {
    parts.push(`-H "${key}: ${value.replace(/"/g, '\\"')}"`);
  }
  if (body && method !== 'GET' && method !== 'DELETE') {
    parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
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

function buildHeadersObject(headerRows, includeContentType) {
  const result = {};
  if (includeContentType) {
    result['Content-Type'] = 'application/json';
  }
  for (const { key, value } of headerRows) {
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

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

const SAVEABLE_TAB_FIELDS = ['id', 'name', 'method', 'endpoint', 'body', 'headers', 'context'];

function loadTabs() {
  try {
    const saved = JSON.parse(localStorage.getItem(TABS_KEY));
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length > 0) {
      const tabs = saved.tabs.map(t => ({
        ...Object.fromEntries(SAVEABLE_TAB_FIELDS.map(f => [f, t[f]])),
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
    method: 'POST', endpoint: DEFAULT_ENDPOINT,
    body: DEFAULT_BODY, headers: DEFAULT_HEADERS, context: DEFAULT_CONTEXT,
    response: null, rawResponse: null, isError: false,
    toolExecution: null, loading: false,
  }]);
  const [activeTabId, setActiveTabId] = useState(() => saved.current?.activeTabId ?? 1);

  const activeTab = tabs.find(t => t.id === activeTabId);

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
    updateTab(id, { name: newName });
  }

  // Individual setters that delegate to updateActiveTab (preserves child component interfaces)
  const setMethod = (v) => updateActiveTab({ method: v });
  const setEndpoint = (v) => updateActiveTab({ endpoint: v });
  const setBody = (v) => updateActiveTab({ body: v });
  const setHeaders = (v) => updateActiveTab({ headers: v });
  const setContext = (v) => updateActiveTab({ context: v });

  // --- Tab management ---
  function handleNewTab() {
    const id = nextId.current++;
    const num = nextTabNumber.current++;
    const tab = {
      id, name: `Untitled ${num}`,
      method: 'POST', endpoint: DEFAULT_ENDPOINT,
      body: DEFAULT_BODY, headers: DEFAULT_HEADERS, context: DEFAULT_CONTEXT,
      response: null, rawResponse: null, isError: false,
      toolExecution: null, loading: false,
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

  const [history, setHistory] = useState(loadHistory);

  // --- Mode state ---
  const [mode, setMode] = useState('http');

  // --- MCP state ---
  const [mcpUrl, setMcpUrl] = useState('http://localhost:3000/sse');
  const [mcpClient, setMcpClient] = useState(null);
  const [mcpTools, setMcpTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [mcpConnecting, setMcpConnecting] = useState(false);

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
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
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

    setTabField({ loading: true, isError: false, response: null, rawResponse: null, toolExecution: null });

    try {
      const res = await fetch(ep, {
        method: m,
        headers: buildHeadersObject(h, hasBody),
        body: hasBody ? b : undefined,
      });

      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
        setTabField({ rawResponse: text, response: JSON.stringify(parsed, null, 2) });
      } catch {
        setTabField({ rawResponse: text, response: text });
      }

      setTabField({ toolExecution: extractToolExecution(parsed) });
      pushHistory({ endpoint: ep, method: m, body: b, headers: h, timestamp: Date.now() });
    } catch (e) {
      const msg = `Network error: ${e.message}`;
      setTabField({ response: msg, rawResponse: msg, isError: true });
    } finally {
      setTabField({ loading: false });
    }
  }

  // --- MCP handlers ---
  async function handleConnect() {
    setMcpConnecting(true);
    updateActiveTab({ isError: false, response: null, rawResponse: null, toolExecution: null });

    try {
      const { client, tools } = await createMcpClient(mcpUrl);
      setMcpClient(client);
      setMcpTools(tools);
      setMcpConnected(true);
      setSelectedTool(null);
    } catch (e) {
      const msg = `MCP connection error: ${e.message}`;
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
    // Disconnect MCP when switching away
    if (mode === 'mcp' && mcpConnected) {
      handleDisconnect();
    }
    setMode(newMode);
    // Reset response display
    updateActiveTab({ response: null, rawResponse: null, isError: false, toolExecution: null });
  }

  const currentOnRun = mode === 'http' ? handleRun : handleMcpRun;

  return (
    <div style={styles.app} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
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

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
        onRenameTab={handleRenameTab}
      />

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          {mode === 'http' ? (
            <>
              <p style={styles.sidebarLabel}>HISTORY</p>
              {history.length === 0 ? (
                <p style={styles.sidebarEmpty}>No requests yet.</p>
              ) : (
                history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => loadHistoryItem(item)}
                    style={styles.historyItem}
                    title={item.endpoint}
                  >
                    <span style={{ ...styles.historyMethod, color: METHOD_COLORS[item.method] }}>
                      {item.method}
                    </span>
                    <span style={styles.historyUrl}>{shortUrl(item.endpoint)}</span>
                  </button>
                ))
              )}
            </>
          ) : (
            <>
              <p style={styles.sidebarLabel}>TOOLS</p>
              {!mcpConnected ? (
                <p style={styles.sidebarEmpty}>Connect to discover tools.</p>
              ) : mcpTools.length === 0 ? (
                <p style={styles.sidebarEmpty}>No tools available.</p>
              ) : (
                mcpTools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleToolSelect(tool)}
                    style={{
                      ...styles.toolItem,
                      ...(selectedTool?.name === tool.name ? styles.toolItemSelected : {}),
                    }}
                    title={tool.description || tool.name}
                  >
                    <span style={styles.toolName}>{tool.name}</span>
                    {tool.description && (
                      <span style={styles.toolDesc}>
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

        <div style={styles.panels} ref={containerRef}>
          <div style={{ ...styles.panel, width: `${leftWidth}%` }}>
            <div style={styles.panelHeader}>REQUEST</div>
            <RequestPanel
              key={activeTabId}
              body={activeTab.body} setBody={setBody}
              headers={activeTab.headers} setHeaders={setHeaders}
              context={activeTab.context} setContext={setContext}
              selectedTool={selectedTool}
              mode={mode}
            />
          </div>

          <div style={styles.divider} onMouseDown={onMouseDown} title="Drag to resize" />

          <div style={{ ...styles.panel, width: `${100 - leftWidth}%` }}>
            <div style={styles.panelHeader}>RESPONSE</div>
            <ResponsePanel
              key={activeTabId}
              response={activeTab.response}
              rawResponse={activeTab.rawResponse}
              isError={activeTab.isError}
              toolExecution={activeTab.toolExecution}
              requestBody={activeTab.body}
            />
          </div>
        </div>
      </div>

      {showCurl && (
        <div style={styles.modalOverlay} onClick={() => setShowCurl(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>cURL Command</span>
              <button onClick={() => setShowCurl(false)} style={styles.modalClose}>&times;</button>
            </div>
            <pre style={styles.modalPre}>{curlCommand}</pre>
            <button onClick={handleCurlCopy} style={styles.modalCopyButton}>
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

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '180px',
    flexShrink: 0,
    borderRight: '1px solid #3c3c3c',
    padding: '12px',
    overflowY: 'auto',
  },
  sidebarLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
    margin: '0 0 8px 0',
  },
  sidebarEmpty: {
    fontSize: '12px',
    color: '#444',
    margin: 0,
  },
  historyItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '6px 8px',
    marginBottom: '4px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  historyMethod: {
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  historyUrl: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '6px 8px',
    marginBottom: '4px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  toolItemSelected: {
    backgroundColor: '#094771',
    borderColor: '#0e639c',
  },
  toolName: {
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#4ec9b0',
  },
  toolDesc: {
    fontSize: '10px',
    color: '#888',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  panels: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  panelHeader: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
    padding: '8px 16px 4px',
    flexShrink: 0,
  },
  divider: {
    width: '4px',
    flexShrink: 0,
    backgroundColor: '#3c3c3c',
    cursor: 'col-resize',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#d4d4d4',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  modalPre: {
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '12px',
    color: '#d4d4d4',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowY: 'auto',
    flex: 1,
    margin: 0,
  },
  modalCopyButton: {
    marginTop: '12px',
    backgroundColor: '#0e639c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 20px',
    fontSize: '13px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
};
