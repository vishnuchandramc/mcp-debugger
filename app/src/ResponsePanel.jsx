import React, { useState, useEffect, useRef } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';
import Editor from '@monaco-editor/react';
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

const markdownComponents = {
  code({ node, className, children, ...props }) {
    const isBlock = className || String(children).includes('\n');
    if (isBlock) {
      return (
        <pre className="bg-zinc-950 border border-zinc-800 rounded p-3 overflow-x-auto text-[12px] my-1">
          <code className={cn("font-mono", className)} {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-zinc-800 px-1 py-0.5 rounded text-[12px] font-mono" {...props}>
        {children}
      </code>
    );
  },
  a({ node, children, ...props }) {
    return <a className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  },
  p({ node, children, ...props }) {
    return <p className="text-[13px] text-zinc-200 leading-relaxed my-1" {...props}>{children}</p>;
  },
  h1({ node, children, ...props }) {
    return <h1 className="text-[15px] font-semibold text-zinc-100 mt-3 mb-1" {...props}>{children}</h1>;
  },
  h2({ node, children, ...props }) {
    return <h2 className="text-[14px] font-semibold text-zinc-100 mt-2 mb-1" {...props}>{children}</h2>;
  },
  h3({ node, children, ...props }) {
    return <h3 className="text-[13px] font-semibold text-zinc-100 mt-2 mb-1" {...props}>{children}</h3>;
  },
  h4({ node, children, ...props }) {
    return <h4 className="text-[13px] font-semibold text-zinc-100 mt-1 mb-0.5" {...props}>{children}</h4>;
  },
  h5({ node, children, ...props }) {
    return <h5 className="text-[13px] font-semibold text-zinc-100 mt-1 mb-0.5" {...props}>{children}</h5>;
  },
  h6({ node, children, ...props }) {
    return <h6 className="text-[13px] font-semibold text-zinc-100 mt-1 mb-0.5" {...props}>{children}</h6>;
  },
  ul({ node, children, ...props }) {
    return <ul className="text-[13px] text-zinc-300 pl-5 my-1 list-disc" {...props}>{children}</ul>;
  },
  ol({ node, children, ...props }) {
    return <ol className="text-[13px] text-zinc-300 pl-5 my-1 list-decimal" {...props}>{children}</ol>;
  },
  li({ node, children, ...props }) {
    return <li className="my-0.5" {...props}>{children}</li>;
  },
  table({ node, children, ...props }) {
    return <table className="text-[12px] border-collapse my-2 w-full" {...props}>{children}</table>;
  },
  th({ node, children, ...props }) {
    return <th className="border border-zinc-700 px-2 py-1 text-left text-zinc-200 bg-zinc-800 font-semibold" {...props}>{children}</th>;
  },
  td({ node, children, ...props }) {
    return <td className="border border-zinc-700 px-2 py-1 text-zinc-300" {...props}>{children}</td>;
  },
  blockquote({ node, children, ...props }) {
    return <blockquote className="border-l-2 border-zinc-600 pl-3 text-zinc-400 my-1" {...props}>{children}</blockquote>;
  },
};

function detectAIResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  // OpenAI format
  if (Array.isArray(parsed.choices) && parsed.choices[0]?.message?.content) {
    return { type: 'openai', content: parsed.choices[0].message.content };
  }
  // Claude format
  if (Array.isArray(parsed.content)) {
    const textBlock = parsed.content.find(c => c.type === 'text' && typeof c.text === 'string');
    if (textBlock) return { type: 'claude', content: textBlock.text };
  }
  // Generic: has text/output/result alongside model or usage
  if (parsed.model || parsed.usage) {
    const text = parsed.text ?? parsed.output ?? parsed.result;
    if (typeof text === 'string') return { type: 'generic', content: text };
  }
  return null;
}

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
  const prevAIRef = useRef(false);

  // Parse response once for AI detection
  let parsedResponse = null;
  try { parsedResponse = response ? JSON.parse(response) : null; } catch {}

  const aiResponse = detectAIResponse(parsedResponse);
  const hasToolCall = toolExecution != null;
  const isAI = aiResponse != null;

  // Build tabs conditionally
  const tabs = (() => {
    const t = ['Pretty', 'Raw'];
    if (isAI) t.splice(1, 0, 'Assistant');
    if (hasToolCall) t.push('Timeline');
    return t;
  })();

  // Auto-switch to Assistant tab when AI is first detected
  useEffect(() => {
    if (isAI && !prevAIRef.current) {
      setActiveTab('Assistant');
    }
    prevAIRef.current = isAI;
  }, [isAI]);

  const effectiveTab = tabs.includes(activeTab) ? activeTab : 'Pretty';

  function handleCopy() {
    const text = effectiveTab === 'Assistant' ? (aiResponse?.content ?? '') : effectiveTab === 'Pretty' ? response : rawResponse;
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
        {(effectiveTab === 'Pretty' || effectiveTab === 'Raw' || effectiveTab === 'Assistant') && hasResponse && (
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

      {/* AI detection badges */}
      {isAI && hasResponse && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-zinc-800 shrink-0">
          <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-sm">
            AI Response
          </span>
          {hasToolCall && (
            <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-sm">
              Tool Call
            </span>
          )}
          {parsedResponse?.model && (
            <span className="text-[10px] text-zinc-500">{parsedResponse.model}</span>
          )}
        </div>
      )}

      {/* Response content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!hasResponse ? (
          <div className="p-2">
            <p className="text-zinc-500 text-xs m-0">Send a request to see the response.</p>
          </div>
        ) : effectiveTab === 'Assistant' ? (
          <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
            {parsedResponse?.model || parsedResponse?.usage ? (
              <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono pb-1 border-b border-zinc-800">
                {parsedResponse.model && <span>Model: {parsedResponse.model}</span>}
                {parsedResponse.usage && (
                  <span>
                    Tokens: {parsedResponse.usage.prompt_tokens ?? parsedResponse.usage.input_tokens ?? '?'} in / {parsedResponse.usage.completion_tokens ?? parsedResponse.usage.output_tokens ?? '?'} out
                  </span>
                )}
              </div>
            ) : null}
            <div className="text-[13px] text-zinc-200 leading-relaxed prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={markdownComponents}
              >
                {aiResponse?.content ?? ''}
              </ReactMarkdown>
            </div>
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
