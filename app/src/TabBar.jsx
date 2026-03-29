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
    <div 
      className="flex items-end bg-zinc-950 border-b border-zinc-800 shrink-0 min-h-[38px] pl-[80px] pt-1.5 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex overflow-hidden flex-1 h-[30px] pr-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = editingTabId === tab.id;
          const isMcp = tab.mode === 'mcp';
          
          return (
            <button
              key={tab.id}
              style={{ WebkitAppRegion: 'no-drag' }}
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                "group relative flex items-center justify-start gap-1.5 px-2 bg-transparent border-y border-x border-zinc-800 text-zinc-500 text-[11px] font-semibold cursor-pointer hover:bg-zinc-800/50 outline-none transition-colors border-t-transparent border-b-transparent rounded-t-lg -ml-px h-full flex-1 min-w-[40px] max-w-[240px] overflow-hidden whitespace-nowrap",
                isActive ? "bg-zinc-900 text-zinc-100 hover:bg-zinc-900" : "",
                isActive && !isMcp && "border-t-blue-500"
              )}
            >
              {isActive && isMcp && (
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-10" />
              )}
              {isActive && isMcp ? (
                <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 uppercase tracking-wider leading-none">
                  MCP
                </span>
              ) : isMcp ? (
                <span className="text-[10px] font-bold uppercase text-zinc-500">
                  MCP
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase" style={{ color: METHOD_COLORS[tab.method] || '#d4d4d4' }}>
                  {tab.method}
                </span>
              )}
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
                  className="text-[11px] bg-transparent border-none outline-none text-zinc-200 p-0 m-0 w-full flex-1 min-w-0"
                />
              ) : (
                <span
                  className="text-[11px] truncate flex-1 min-w-0 text-left"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(tab);
                  }}
                >
                  {tab.name}
                </span>
              )}
              {tabs.length > 1 && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="flex items-center justify-center w-4 h-4 rounded-sm text-zinc-500 hover:bg-zinc-700/50 hover:text-red-400 ml-0.5"
                  title="Close tab"
                >
                  <svg width="8" height="8" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M3 3l9 9m0-9l-9 9" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
        <button 
          onClick={onNewTab} 
          style={{ WebkitAppRegion: 'no-drag' }}
          className="bg-transparent border-none text-zinc-400 text-xl font-light leading-none cursor-pointer shrink-0 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center w-[24px] h-[24px] rounded ml-1 mb-[2px] outline-none" 
          title="New tab" 
        >
          +
        </button>
      </div>
    </div>
  );
}

