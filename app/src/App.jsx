import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from './TopBar.jsx';
import RequestPanel from './RequestPanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import { createMcpClient, callMcpTool, disconnectMcpClient, generateToolTemplate } from './mcpClient.js';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    const ch = str[i];
    if (ch === '"' || ch === "'") {
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
      i++;
      tokens.push(token);
    } else {
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
    if (mode === 'mcp' && mcpConnected) {
      handleDisconnect();
    }
    setMode(newMode);
    setResponse(null);
    setRawResponse(null);
    setIsError(false);
    setToolExecution(null);
  }

  const currentOnRun = mode === 'http' ? handleRun : handleMcpRun;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-mono overflow-hidden" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[180px] shrink-0 border-r border-border p-3 overflow-y-auto">
          {mode === 'http' ? (
            <>
              <p className="text-[10px] font-bold tracking-widest text-[#555] m-0 mb-2">HISTORY</p>
              {history.length === 0 ? (
                <p className="text-xs text-[#444] m-0">No requests yet.</p>
              ) : (
                history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => loadHistoryItem(item)}
                    className="flex flex-col gap-0.5 w-full bg-transparent border border-transparent rounded p-1.5 px-2 mb-1 cursor-pointer text-left hover:border-border"
                    title={item.endpoint}
                  >
                    <span className="text-[10px] font-bold font-mono" style={{ color: METHOD_COLORS[item.method] }}>
                      {item.method}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap">{shortUrl(item.endpoint)}</span>
                  </button>
                ))
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold tracking-widest text-[#555] m-0 mb-2">TOOLS</p>
              {!mcpConnected ? (
                <p className="text-xs text-[#444] m-0">Connect to discover tools.</p>
              ) : mcpTools.length === 0 ? (
                <p className="text-xs text-[#444] m-0">No tools available.</p>
              ) : (
                mcpTools.map((tool) => (
                  <button
                    key={tool.name}
                    onClick={() => handleToolSelect(tool)}
                    className={`flex flex-col gap-0.5 w-full bg-transparent border border-transparent rounded p-1.5 px-2 mb-1 cursor-pointer text-left ${
                      selectedTool?.name === tool.name ? 'bg-[#094771] !border-primary' : 'hover:border-border'
                    }`}
                    title={tool.description || tool.name}
                  >
                    <span className="text-[11px] font-bold font-mono text-[#4ec9b0]">{tool.name}</span>
                    {tool.description && (
                      <span className="text-[10px] text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                        {tool.description.length > 40
                          ? tool.description.slice(0, 40) + '\u2026'
                          : tool.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </>
          )}
        </aside>

        <div className="flex flex-1 overflow-hidden" ref={containerRef}>
          <div className="flex flex-col overflow-hidden min-w-0" style={{ width: `${leftWidth}%` }}>
            <div className="text-[10px] font-bold tracking-widest text-[#555] px-4 pt-2 pb-1 shrink-0">REQUEST</div>
            <RequestPanel
              body={body} setBody={setBody}
              headers={headers} setHeaders={setHeaders}
              context={context} setContext={setContext}
              selectedTool={selectedTool}
              mode={mode}
            />
          </div>

          <div className="w-1 shrink-0 bg-border cursor-col-resize" onMouseDown={onMouseDown} title="Drag to resize" />

          <div className="flex flex-col overflow-hidden min-w-0" style={{ width: `${100 - leftWidth}%` }}>
            <div className="text-[10px] font-bold tracking-widest text-[#555] px-4 pt-2 pb-1 shrink-0">RESPONSE</div>
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

      <Dialog open={showCurl} onOpenChange={setShowCurl}>
        <DialogContent>
          <div className="flex justify-between items-center mb-3">
            <DialogTitle>cURL Command</DialogTitle>
            <DialogClose className="bg-transparent border-none text-muted-foreground text-xl cursor-pointer px-1">
              &times;
            </DialogClose>
          </div>
          <pre className="bg-background border border-border rounded p-3 text-foreground text-xs font-mono whitespace-pre-wrap break-all overflow-y-auto flex-1 m-0">
            {curlCommand}
          </pre>
          <Button onClick={handleCurlCopy} className="mt-3 self-end">
            {curlCopied ? 'Copied!' : 'Copy'}
          </Button>
        </DialogContent>
      </Dialog>
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
