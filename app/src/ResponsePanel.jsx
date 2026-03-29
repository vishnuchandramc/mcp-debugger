import React, { useState } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';

export default function ResponsePanel({ response, rawResponse, isError, toolExecution, requestBody }) {
  const [activeTab, setActiveTab] = useState('Pretty');
  const [copied, setCopied] = useState(false);

  const hasTimeline = toolExecution != null;
  const tabs = hasTimeline ? ['Pretty', 'Raw', 'Timeline'] : ['Pretty', 'Raw'];

  // Reset to Pretty if Timeline was active but no longer available
  const effectiveTab = (!hasTimeline && activeTab === 'Timeline') ? 'Pretty' : activeTab;

  function handleCopy() {
    const text = effectiveTab === 'Pretty' ? response : rawResponse;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={styles.panel}>
      <div style={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(effectiveTab === tab ? styles.tabActive : {}) }}
          >
            {tab}
          </button>
        ))}
        {(effectiveTab === 'Pretty' || effectiveTab === 'Raw') && response != null && (
          <div style={styles.tabActions}>
            <button onClick={handleCopy} style={styles.copyBtn} title="Copy response">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div style={styles.content}>
        {response === null ? (
          <p style={styles.placeholder}>Send a request to see the response.</p>
        ) : effectiveTab === 'Timeline' ? (
          <ExecutionTimeline
            requestBody={requestBody}
            response={response}
            toolExecution={toolExecution}
          />
        ) : (
          <>
            <pre style={{ ...styles.pre, ...(isError ? styles.error : {}) }}>
              {effectiveTab === 'Pretty' ? response : rawResponse}
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
    alignItems: 'center',
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
  tabActions: {
    marginLeft: 'auto',
    marginRight: '12px',
    display: 'flex',
    alignItems: 'center',
  },
  copyBtn: {
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '11px',
    fontFamily: 'monospace',
    cursor: 'pointer',
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
