import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";

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
    <div className="flex items-center bg-zinc-900 border-b border-zinc-800 shrink-0 min-h-[28px]">
      <div className="flex overflow-x-auto flex-1 h-[28px]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 bg-transparent border-none border-r border-zinc-800 text-zinc-500 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 hover:bg-zinc-800/50 outline-none transition-colors",
                isActive && "bg-zinc-800 text-zinc-100 hover:bg-zinc-800"
              )}
            >
              <span className="text-[10px] font-bold" style={{ color: METHOD_COLORS[tab.method] || '#d4d4d4' }}>
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
                  className="text-[11px] bg-transparent border-none outline-none text-zinc-200 p-0 m-0 w-[80px]"
                />
              ) : (
                <span
                  className="text-[11px]"
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
                  className="text-[14px] leading-none text-zinc-500 cursor-pointer px-[2px] ml-1 hover:text-red-400"
                  title="Close tab"
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button onClick={onNewTab} className="bg-transparent border-none text-zinc-500 text-base cursor-pointer px-3 shrink-0 hover:text-zinc-300" title="New tab">
        +
      </button>
    </div>
  );
}

