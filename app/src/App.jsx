import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from './TopBar.jsx';
import RequestPanel from './RequestPanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import { createMcpClient, callMcpTool, disconnectMcpClient, generateToolTemplate } from './mcpClient.js';

const DEFAULT_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';
const DEFAULT_BODY = JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }, null, 2);
const DEFAULT_HEADERS = [{ key: '', value: '' }];
const DEFAULT_CONTEXT = JSON.stringify({ system: '', messages: [] }, null, 2);
const HISTORY_KEY = 'mcp_debugger_history';
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

export default function App() {
  // --- Shared state ---
  const [body, setBody] = useState(DEFAULT_BODY);
  const [response, setResponse] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [toolExecution, setToolExecution] = useState(null);

  // --- HTTP state ---
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [method, setMethod] = useState('POST');
  const [headers, setHeaders] = useState(DEFAULT_HEADERS);
  const [context, setContext] = useState(DEFAULT_CONTEXT);
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
    setEndpoint(item.endpoint);
    setMethod(item.method);
    setBody(item.body);
    setHeaders(item.headers ?? DEFAULT_HEADERS);
  }

  async function handleRun() {
    const hasBody = method !== 'GET' && method !== 'DELETE';

    if (hasBody) {
      try { JSON.parse(body); } catch (e) {
        setResponse(`Invalid JSON: ${e.message}`);
        setRawResponse(`Invalid JSON: ${e.message}`);
        setIsError(true);
        return;
      }
    }

    setLoading(true);
    setIsError(false);
    setResponse(null);
    setRawResponse(null);
    setToolExecution(null);

    try {
      const res = await fetch(endpoint, {
        method,
        headers: buildHeadersObject(headers, hasBody),
        body: hasBody ? body : undefined,
      });

      const text = await res.text();
      setRawResponse(text);

      let parsed = null;
      try {
        parsed = JSON.parse(text);
        setResponse(JSON.stringify(parsed, null, 2));
      } catch {
        setResponse(text);
      }

      setToolExecution(extractToolExecution(parsed));
      pushHistory({ endpoint, method, body, headers, timestamp: Date.now() });
    } catch (e) {
      const msg = `Network error: ${e.message}`;
      setResponse(msg);
      setRawResponse(msg);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  // --- MCP handlers ---
  async function handleConnect() {
    setMcpConnecting(true);
    setIsError(false);
    setResponse(null);
    setRawResponse(null);
    setToolExecution(null);

    try {
      const { client, tools } = await createMcpClient(mcpUrl);
      setMcpClient(client);
      setMcpTools(tools);
      setMcpConnected(true);
      setSelectedTool(null);
    } catch (e) {
      const msg = `MCP connection error: ${e.message}`;
      setResponse(msg);
      setRawResponse(msg);
      setIsError(true);
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
    setResponse(null);
    setRawResponse(null);
    setToolExecution(null);
  }

  function handleToolSelect(tool) {
    setSelectedTool(tool);
    const template = generateToolTemplate(tool);
    setBody(template);
  }

  async function handleMcpRun() {
    if (!mcpClient || !selectedTool) return;

    let args;
    try {
      args = JSON.parse(body);
    } catch (e) {
      setResponse(`Invalid JSON: ${e.message}`);
      setRawResponse(`Invalid JSON: ${e.message}`);
      setIsError(true);
      return;
    }

    setLoading(true);
    setIsError(false);
    setResponse(null);
    setRawResponse(null);
    setToolExecution(null);

    try {
      const result = await callMcpTool(mcpClient, selectedTool.name, args);
      const raw = JSON.stringify(result, null, 2);
      setRawResponse(raw);
      setResponse(raw);

      setToolExecution({
        name: selectedTool.name,
        arguments: args,
        output: result.content ?? result,
      });
    } catch (e) {
      const msg = `MCP tool error: ${e.message}`;
      setResponse(msg);
      setRawResponse(msg);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  // --- cURL handlers ---
  function handleGenerateCurl() {
    const hasBody = method !== 'GET' && method !== 'DELETE';
    const hdrs = buildHeadersObject(headers, hasBody);
    const cmd = generateCurl({ method, url: endpoint, headers: hdrs, body: hasBody ? body : null });
    setCurlCommand(cmd);
    setShowCurl(true);
    setCurlCopied(false);
  }

  function handleCurlImport(text) {
    const result = parseCurl(text);
    if (!result) return;
    setMethod(result.method);
    setEndpoint(result.url);
    setHeaders(result.headers.length ? result.headers : [{ key: '', value: '' }]);
    if (result.body) {
      try {
        setBody(JSON.stringify(JSON.parse(result.body), null, 2));
      } catch {
        setBody(result.body);
      }
    }
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
    setResponse(null);
    setRawResponse(null);
    setIsError(false);
    setToolExecution(null);
  }

  const currentOnRun = mode === 'http' ? handleRun : handleMcpRun;

  return (
    <div style={styles.app} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <TopBar
        mode={mode}
        setMode={handleModeChange}
        endpoint={endpoint}
        setEndpoint={setEndpoint}
        method={method}
        setMethod={setMethod}
        onRun={currentOnRun}
        loading={loading}
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
              body={body} setBody={setBody}
              headers={headers} setHeaders={setHeaders}
              context={context} setContext={setContext}
              selectedTool={selectedTool}
              mode={mode}
            />
          </div>

          <div style={styles.divider} onMouseDown={onMouseDown} title="Drag to resize" />

          <div style={{ ...styles.panel, width: `${100 - leftWidth}%` }}>
            <div style={styles.panelHeader}>RESPONSE</div>
            <ResponsePanel
              response={response}
              rawResponse={rawResponse}
              isError={isError}
              toolExecution={toolExecution}
              requestBody={body}
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
