import React, { useState } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';
import Editor from '@monaco-editor/react';
import { cn } from "@/lib/utils";

function StatusBadge({ status }) {
  if (!status) return null;
  const isSuccess = status >= 200 && status < 300;
  const isRedirect = status >= 300 && status < 400;
  const isClientError = status >= 400 && status < 500;
  const isServerError = status >= 500;
  const color = isSuccess ? 'text-green-400' : isRedirect ? 'text-blue-400' : isClientError ? 'text-yellow-400' : isServerError ? 'text-red-400' : 'text-zinc-400';
  const bg = isSuccess ? 'bg-green-500/10' : isRedirect ? 'bg-blue-500/10' : isClientError ? 'bg-yellow-500/10' : isServerError ? 'bg-red-500/10' : 'bg-zinc-500/10';
  return <span className={`${color} ${bg} px-1.5 py-0.5 text-[11px] font-bold rounded-sm`}>{status}</span>;
}

export default function ResponsePanel({ response, rawResponse, isError, toolExecution, requestBody, mode, responseMeta }) {
  const [activeTab, setActiveTab] = useState('Pretty');
  const [copied, setCopied] = useState(false);

  const hasTimeline = mode === 'mcp' && toolExecution != null;
  const tabs = hasTimeline ? ['Pretty', 'Raw', 'Timeline'] : ['Pretty', 'Raw'];
  const effectiveTab = (!hasTimeline && activeTab === 'Timeline') ? 'Pretty' : activeTab;

  function handleCopy() {
    const text = effectiveTab === 'Pretty' ? response : rawResponse;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function detectLanguage(text) {
    if (!text) return 'plaintext';
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.startsWith('<')) return 'html';
    return 'plaintext';
  }

  const hasResponse = response !== null;
  const hasMeta = responseMeta != null;
  const isSuccess = hasMeta && responseMeta.status >= 200 && responseMeta.status < 400;
  const hasApiError = hasMeta && responseMeta.apiError;

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Tab bar */}
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
        {(effectiveTab === 'Pretty' || effectiveTab === 'Raw') && hasResponse && (
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

      {/* Status bar */}
      {hasMeta && (
        <div className={cn(
          "flex items-center gap-3 px-3 py-1.5 border-b shrink-0 text-[11px] font-mono",
          isSuccess ? "bg-green-500/5 border-green-900/30" : "bg-red-500/5 border-red-900/30"
        )}>
          <div className="flex items-center gap-2">
            <span className={isSuccess ? "text-green-400" : "text-red-400"}>
              {isSuccess ? '●' : '●'}
            </span>
            <span className="text-zinc-400">Status:</span>
            <StatusBadge status={responseMeta.status} />
            <span className={cn("font-semibold", isSuccess ? "text-green-400" : "text-red-400")}>
              {responseMeta.statusText}
            </span>
          </div>
          {responseMeta.time > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Time:</span>
              <span className={cn("font-semibold", responseMeta.time < 200 ? "text-green-400" : responseMeta.time < 1000 ? "text-yellow-400" : "text-red-400")}>
                {responseMeta.time}ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {hasApiError && (
        <div className="bg-red-500/10 border-b border-red-900/30 px-3 py-2 shrink-0">
          <div className="flex items-start gap-2">
            <span className="text-red-400 text-[12px] shrink-0 mt-[1px]">❌</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-red-400">API Error{responseMeta.apiError.code ? ` (${responseMeta.apiError.code})` : ''}</span>
              <span className="text-[11px] text-red-300/80">
                {typeof responseMeta.apiError.message === 'string'
                  ? responseMeta.apiError.message
                  : JSON.stringify(responseMeta.apiError.message)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Success indicator (only if no error and has response) */}
      {hasMeta && isSuccess && !hasApiError && (
        <div className="bg-green-500/5 border-b border-green-900/20 px-3 py-1 shrink-0">
          <span className="text-[11px] text-green-400 font-semibold">✓ Request successful</span>
        </div>
      )}

      {/* Response content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!hasResponse ? (
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
          <div className="flex-1 overflow-hidden">
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
