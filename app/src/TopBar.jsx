import React from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const MODES = ['HTTP', 'MCP'];

const METHOD_COLORS = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#9cdcfe',
  PATCH: '#c586c0',
  DELETE: '#f48771',
};

export default function TopBar({
  mode,
  setMode,
  endpoint,
  setEndpoint,
  method,
  setMethod,
  onRun,
  loading,
  mcpUrl,
  setMcpUrl,
  mcpConnected,
  mcpConnecting,
  onConnect,
  onDisconnect,
  selectedTool,
}) {
  return (
    <div style={styles.bar}>
      <span style={styles.appName}>MCP Debugger</span>
      <div style={styles.requestRow}>
        {/* Mode selector */}
        <select
          value={mode.toUpperCase()}
          onChange={(e) => setMode(e.target.value.toLowerCase())}
          style={styles.modeSelect}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {mode === 'http' ? (
          <>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ ...styles.methodSelect, color: METHOD_COLORS[method] }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://example.com/api/endpoint"
              style={styles.endpointInput}
              spellCheck={false}
            />
            <button
              onClick={onRun}
              disabled={loading}
              style={{ ...styles.runButton, ...(loading ? styles.runButtonDisabled : {}) }}
            >
              {loading ? 'Running…' : 'Run'}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="http://localhost:3000/sse"
              style={styles.endpointInput}
              spellCheck={false}
              disabled={mcpConnected || mcpConnecting}
            />
            {!mcpConnected ? (
              <button
                onClick={onConnect}
                disabled={mcpConnecting}
                style={{
                  ...styles.connectButton,
                  ...(mcpConnecting ? styles.runButtonDisabled : {}),
                }}
              >
                {mcpConnecting ? 'Connecting…' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                style={styles.disconnectButton}
              >
                Disconnect
              </button>
            )}
            <button
              onClick={onRun}
              disabled={loading || !mcpConnected || !selectedTool}
              style={{
                ...styles.runButton,
                ...(loading || !mcpConnected || !selectedTool ? styles.runButtonDisabled : {}),
              }}
            >
              {loading ? 'Running…' : 'Run'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  appName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#888',
    whiteSpace: 'nowrap',
    letterSpacing: '0.05em',
  },
  requestRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  modeSelect: {
    backgroundColor: '#1a3a4a',
    color: '#569cd6',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'monospace',
    cursor: 'pointer',
    outline: 'none',
    flexShrink: 0,
  },
  methodSelect: {
    backgroundColor: '#2d2d2d',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '6px 8px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'monospace',
    cursor: 'pointer',
    outline: 'none',
    flexShrink: 0,
  },
  endpointInput: {
    flex: 1,
    backgroundColor: '#2d2d2d',
    color: '#d4d4d4',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  runButton: {
    backgroundColor: '#0e639c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 20px',
    fontSize: '13px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    flexShrink: 0,
  },
  runButtonDisabled: {
    backgroundColor: '#3c3c3c',
    cursor: 'not-allowed',
  },
  connectButton: {
    backgroundColor: '#0e639c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 16px',
    fontSize: '13px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    flexShrink: 0,
  },
  disconnectButton: {
    backgroundColor: '#6c2020',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 16px',
    fontSize: '13px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
