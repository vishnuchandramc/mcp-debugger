import React, { useState } from 'react';

const TABS = ['Pretty', 'Raw'];

export default function ResponsePanel({ response, rawResponse, isError }) {
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
          <pre style={{ ...styles.pre, ...(isError ? styles.error : {}) }}>
            {activeTab === 'Pretty' ? response : rawResponse}
          </pre>
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
};
