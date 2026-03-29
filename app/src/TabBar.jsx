import React, { useState, useRef, useEffect } from 'react';

const METHOD_COLORS = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#9cdcfe',
  PATCH: '#c586c0',
  DELETE: '#f48771',
};

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab, onRenameTab }) {
  const [editingTabId, setEditingTabId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingTabId != null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  function startEditing(tab) {
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  }

  function commitEdit(tab) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.name) {
      onRenameTab(tab.id, trimmed);
    }
    setEditingTabId(null);
  }

  function cancelEdit() {
    setEditingTabId(null);
  }

  return (
    <div style={styles.bar}>
      <div style={styles.tabList}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
            >
              <span style={{ ...styles.methodBadge, color: METHOD_COLORS[tab.method] || '#d4d4d4' }}>
                {tab.method}
              </span>
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(tab);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onBlur={() => commitEdit(tab)}
                  onClick={(e) => e.stopPropagation()}
                  style={styles.editInput}
                />
              ) : (
                <span
                  style={styles.tabName}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(tab);
                  }}
                >
                  {tab.name}
                </span>
              )}
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={styles.closeBtn}
                  title="Close tab"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button onClick={onNewTab} style={styles.newTab} title="New tab">
        +
      </button>
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
    minHeight: '34px',
  },
  tabList: {
    display: 'flex',
    overflowX: 'auto',
    flex: 1,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    fontSize: '12px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tabActive: {
    borderBottomColor: '#0e639c',
    color: '#d4d4d4',
  },
  methodBadge: {
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  tabName: {
    fontSize: '12px',
  },
  editInput: {
    fontSize: '12px',
    fontFamily: 'monospace',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#d4d4d4',
    padding: 0,
    margin: 0,
    width: '80px',
  },
  closeBtn: {
    fontSize: '14px',
    lineHeight: 1,
    color: '#888',
    cursor: 'pointer',
    padding: '0 2px',
    marginLeft: '4px',
  },
  newTab: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '18px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    padding: '4px 12px',
    flexShrink: 0,
  },
};
