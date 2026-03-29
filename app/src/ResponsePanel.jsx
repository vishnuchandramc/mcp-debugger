import React, { useState } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';
import { cn } from "@/lib/utils";

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

      <div className="flex-1 overflow-auto p-2 flex flex-col gap-3">
        {response === null ? (
          <p className="text-zinc-500 text-xs m-0">Send a request to see the response.</p>
        ) : effectiveTab === 'Timeline' ? (
          <ExecutionTimeline
            requestBody={requestBody}
            response={response}
            toolExecution={toolExecution}
          />
        ) : (
          <>
            <pre className={cn("m-0 text-xs whitespace-pre-wrap break-words text-zinc-200 leading-relaxed font-mono", isError && "text-red-400")}>
              {effectiveTab === 'Pretty' ? response : rawResponse}
            </pre>

            <div className="border-t border-zinc-800 pt-2">
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 m-0 mb-2 uppercase">TOOL EXECUTION</p>
              {toolExecution ? (
                <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 items-start">
                  <span className="text-[11px] text-zinc-500 pt-1 font-semibold text-right">Tool</span>
                  <span className="text-xs text-zinc-200 pt-[3px] font-semibold">{toolExecution.name ?? '—'}</span>

                  <span className="text-[11px] text-zinc-500 pt-1 font-semibold text-right">Arguments</span>
                  <pre className="m-0 mb-1 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-950 border border-zinc-800 rounded p-1.5 font-mono">
                    {toolExecution.arguments != null
                      ? JSON.stringify(toolExecution.arguments, null, 2)
                      : '—'}
                  </pre>

                  {toolExecution.output != null && (
                    <>
                      <span className="text-[11px] text-zinc-500 pt-1 font-semibold text-right">Output</span>
                      <pre className="m-0 mb-1 text-[11px] whitespace-pre-wrap break-words text-zinc-400 leading-relaxed bg-zinc-950 border border-zinc-800 rounded p-1.5 font-mono">
                        {typeof toolExecution.output === 'string'
                          ? toolExecution.output
                          : JSON.stringify(toolExecution.output, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600 m-0 italic">No tool execution detected</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


