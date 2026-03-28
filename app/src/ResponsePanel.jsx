import React, { useState } from 'react';

const TABS = ['Pretty', 'Raw'];

export default function ResponsePanel({ response, rawResponse, isError, toolExecution }) {
  const [activeTab, setActiveTab] = useState('Pretty');

  return (
    <div style={styles.panel}>
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {response === null ? (
          <p style={styles.placeholder}>Send a request to see the response.</p>
        ) : (
          <>
            <pre style={{ ...styles.pre, ...(isError ? styles.error : {}) }}>
              {activeTab === 'Pretty' ? response : rawResponse}
            </pre>

            <div style={styles.toolSection}>
              <p style={styles.toolHeader}>TOOL EXECUTION</p>
              {toolExecution ? (
                <div style={styles.toolGrid}>
                  <span style={styles.toolKey}>Tool</span>
                  <span style={styles.toolValue}>{toolExecution.name ?? '—'}</span>

                  <span style={styles.toolKey}>Arguments</span>
                  <pre style={styles.toolPre}>
                    {toolExecution.arguments != null
                      ? JSON.stringify(toolExecution.arguments, null, 2)
                      : '—'}
                  </pre>

                  {toolExecution.output != null && (
                    <>
                      <span style={styles.toolKey}>Output</span>
                      <pre style={styles.toolPre}>
                        {typeof toolExecution.output === 'string'
                          ? toolExecution.output
                          : JSON.stringify(toolExecution.output, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              ) : (
                <p style={styles.noTool}>No tool execution detected</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    padding: '8px 16px',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    marginBottom: '-1px',
  },
  tabActive: {
    color: '#d4d4d4',
    borderBottomColor: '#0e639c',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  pre: {
    margin: 0,
    fontSize: '13px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#d4d4d4',
    lineHeight: '1.5',
  },
  error: {
    color: '#f48771',
  },
  placeholder: {
    color: '#555',
    fontSize: '13px',
    fontFamily: 'monospace',
    margin: 0,
  },
  toolSection: {
    borderTop: '1px solid #3c3c3c',
    paddingTop: '12px',
  },
  toolHeader: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
    margin: '0 0 10px 0',
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr',
    gap: '6px 12px',
    alignItems: 'start',
  },
  toolKey: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace',
    paddingTop: '2px',
  },
  toolValue: {
    fontSize: '13px',
    color: '#4ec9b0',
    fontFamily: 'monospace',
  },
  noTool: {
    fontSize: '12px',
    color: '#555',
    fontFamily: 'monospace',
    margin: 0,
    fontStyle: 'italic',
  },
  toolPre: {
    margin: 0,
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#dcdcaa',
    lineHeight: '1.5',
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '8px',
  },
};
