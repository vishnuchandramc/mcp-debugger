import React, { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from './TopBar.jsx';
import RequestPanel from './RequestPanel.jsx';
import ResponsePanel from './ResponsePanel.jsx';

const DEFAULT_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';
const DEFAULT_BODY = JSON.stringify({ title: 'foo', body: 'bar', userId: 1 }, null, 2);
const HISTORY_KEY = 'mcp_debugger_history';
const MAX_HISTORY = 5;

function extractToolExecution(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  // Claude API format: { content: [{ type: "tool_use", name, input }] }
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

  // OpenAI format: { choices: [{ message: { tool_calls: [{ function: { name, arguments } }] } }] }
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

  // OpenAI legacy function_call format: { choices: [{ message: { function_call: { name, arguments } } }] }
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

  // Generic: top-level tool/tool_name/tool_call/function_call field
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
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [method, setMethod] = useState('POST');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [response, setResponse] = useState(null);
  const [rawResponse, setRawResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [toolExecution, setToolExecution] = useState(null);
  const [history, setHistory] = useState(loadHistory);

  const [leftWidth, setLeftWidth] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef(null);

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

  function pushHistory(entry) {
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
  }

  function loadHistoryItem(item) {
    setEndpoint(item.endpoint);
    setMethod(item.method);
    setBody(item.body);
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
        headers: hasBody ? { 'Content-Type': 'application/json' } : {},
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
      pushHistory({ endpoint, method, body, timestamp: Date.now() });
    } catch (e) {
      const msg = `Network error: ${e.message}`;
      setResponse(msg);
      setRawResponse(msg);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.app} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <TopBar
        endpoint={endpoint}
        setEndpoint={setEndpoint}
        method={method}
        setMethod={setMethod}
        onRun={handleRun}
        loading={loading}
      />

      <div style={styles.body}>
        <aside style={styles.sidebar}>
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
        </aside>

        <div style={styles.panels} ref={containerRef}>
          <div style={{ ...styles.panel, width: `${leftWidth}%` }}>
            <div style={styles.panelHeader}>REQUEST</div>
            <RequestPanel body={body} setBody={setBody} />
          </div>

          <div style={styles.divider} onMouseDown={onMouseDown} title="Drag to resize" />

          <div style={{ ...styles.panel, width: `${100 - leftWidth}%` }}>
            <div style={styles.panelHeader}>RESPONSE</div>
            <ResponsePanel
              response={response}
              rawResponse={rawResponse}
              isError={isError}
              toolExecution={toolExecution}
            />
          </div>
        </div>
      </div>
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
};
