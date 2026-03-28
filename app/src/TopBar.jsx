import React from 'react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#9cdcfe',
  PATCH: '#c586c0',
  DELETE: '#f48771',
};

export default function TopBar({ endpoint, setEndpoint, method, setMethod, onRun, loading }) {
  return (
    <div style={styles.bar}>
      <span style={styles.appName}>MCP Debugger</span>
      <div style={styles.requestRow}>
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
};
