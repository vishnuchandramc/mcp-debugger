import React, { useState } from 'react';

const TABS = ['Body', 'Headers', 'Context'];

export default function RequestPanel({ body, setBody }) {
  const [activeTab, setActiveTab] = useState('Body');

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
        {activeTab === 'Body' && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={styles.textarea}
            spellCheck={false}
            placeholder="{}"
          />
        )}
        {activeTab === 'Headers' && (
          <p style={styles.placeholder}>Headers editor coming soon.</p>
        )}
        {activeTab === 'Context' && (
          <p style={styles.placeholder}>AI context configuration coming soon.</p>
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
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '12px',
  },
  textarea: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    padding: '12px',
    fontSize: '13px',
    fontFamily: 'monospace',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.5',
  },
  placeholder: {
    color: '#555',
    fontSize: '13px',
    fontFamily: 'monospace',
    margin: 0,
  },
};
