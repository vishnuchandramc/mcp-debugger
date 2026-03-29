import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function BottomConsole({ logs, onClose, onClear }) {
  const scrollRef = useRef(null);
  const [height, setHeight] = useState(250);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      const next = Math.min(Math.max(startH.current + delta, 100), window.innerHeight * 0.7);
      setHeight(next);
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="shrink-0 flex flex-col bg-[#1e1e1e] border-t border-zinc-800 isolate z-20" style={{ height }}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="h-[3px] cursor-row-resize hover:bg-blue-500/50 transition-colors shrink-0"
      />
      <div className="flex items-center gap-4 px-4 h-9 border-b border-zinc-800 bg-[#18181b] shrink-0">
        <span className="text-[11px] font-bold tracking-wider text-zinc-100 uppercase select-none">
          LOGS
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={onClear}
            className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            title="Clear logs"
          >
            Clear
          </button>
          <button 
            onClick={onClose}
            className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 bg-transparent border-none cursor-pointer px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            title="Close Panel"
          >
            ✕
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-zinc-300 bg-[#1e1e1e] leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-zinc-600 italic">No output logs tracked yet.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 hover:bg-zinc-800/30 px-1 py-[1px] rounded -mx-1">
              <span className="text-zinc-600 shrink-0 select-none">[{log.time}]</span>
              <span className={`break-words flex-1 whitespace-pre-wrap ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : log.type === 'success' ? 'text-green-400' : log.type === 'info' ? 'text-blue-300' : 'text-zinc-300'}`}>
                {log.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
