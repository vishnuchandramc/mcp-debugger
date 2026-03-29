import React, { useState } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';
import Editor from '@monaco-editor/react';
import { cn } from "@/lib/utils";

export default function ResponsePanel({ response, rawResponse, isError, toolExecution, requestBody, mode }) {
  const [activeTab, setActiveTab] = useState('Pretty');
  const [copied, setCopied] = useState(false);

  const hasTimeline = mode === 'mcp' && toolExecution != null;
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

  const displayValue = effectiveTab === 'Pretty' ? response : rawResponse;

  // Detect language for syntax highlighting
  function detectLanguage(text) {
    if (!text) return 'plaintext';
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('<')) return 'html';
    return 'plaintext';
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      <div className="flex items-center border-b border-zinc-800 shrink-0 min-h-[28px]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "bg-transparent border-none border-r border-zinc-800 text-zinc-500 py-[5px] px-3 text-[11px] font-semibold cursor-pointer outline-none transition-colors",
              effectiveTab === tab && "bg-zinc-800 text-zinc-100"
            )}
          >
            {tab}
          </button>
        ))}
        {(effectiveTab === 'Pretty' || effectiveTab === 'Raw') && response != null && (
          <div className="ml-auto mr-2 flex items-center">
            <button
              onClick={handleCopy}
              className="bg-transparent text-zinc-400 border border-zinc-800 rounded-none px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800 transition-colors"
              title="Copy response"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {response === null ? (
          <div className="p-2">
            <p className="text-zinc-500 text-xs m-0">Send a request to see the response.</p>
          </div>
        ) : effectiveTab === 'Timeline' ? (
          <div className="flex-1 overflow-auto p-2">
            <ExecutionTimeline
              requestBody={requestBody}
              response={response}
              toolExecution={toolExecution}
            />
          </div>
        ) : effectiveTab === 'Pretty' ? (
          <div className="flex-1 overflow-hidden border-t border-zinc-800">
            <Editor
              value={response || ''}
              language={detectLanguage(response)}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
                domReadOnly: true,
              }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3">
            <pre className="m-0 text-[13px] whitespace-pre-wrap break-words text-zinc-300 leading-relaxed font-mono">
              {rawResponse || ''}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
