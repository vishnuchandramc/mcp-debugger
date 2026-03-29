import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import SchemaForm from './SchemaForm';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function isFormCompatibleSchema(schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) return false;
  const props = Object.entries(schema.properties);
  if (props.length === 0) return false;
  return props.every(([, prop]) =>
    ['string', 'number', 'integer', 'boolean'].includes(prop.type)
  );
}

const HTTP_TABS = ['Body', 'Headers', 'Auth'];
const MCP_TABS = ['Body', 'Headers', 'Context'];

const TEMPLATES = {
  'Basic Request': JSON.stringify(
    { title: 'foo', body: 'bar', userId: 1 },
    null,
    2
  ),
  'Tool Call Example': JSON.stringify(
    {
      prompt: "What's the weather in Bangalore?",
      tools: [
        {
          name: 'get_weather',
          description: 'Get weather by city',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
            },
            required: ['city'],
          },
        },
      ],
    },
    null,
    2
  ),
};

export default function RequestPanel({ body, setBody, headers, setHeaders, context, setContext, auth, setAuth, selectedTool, mode }) {
  const [activeTab, setActiveTab] = useState('Body');
  const [jsonError, setJsonError] = useState(null);
  const [contextError, setContextError] = useState(null);
  const [bodyCopied, setBodyCopied] = useState(false);
  const [viewMode, setViewMode] = useState('json');
  const editorRef = useRef(null);
  const contextEditorRef = useRef(null);

  const canShowForm = mode === 'mcp' && selectedTool && isFormCompatibleSchema(selectedTool.inputSchema);

  useEffect(() => {
    setViewMode(canShowForm ? 'form' : 'json');
  }, [selectedTool, canShowForm]);

  useEffect(() => {
    if (mode !== 'mcp' && activeTab === 'Context') {
      setActiveTab('Body');
    }
  }, [mode, activeTab]);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleEditorChange = useCallback((value) => {
    setBody(value ?? '');
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e.message);
    }
  }, [setBody]);

  function handleTemplate(val) {
    const tpl = TEMPLATES[val];
    if (tpl) {
      setBody(tpl);
      setJsonError(null);
      editorRef.current?.setValue(tpl);
    }
  }

  function handleFormat() {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2);
      setBody(formatted);
      setJsonError(null);
      editorRef.current?.setValue(formatted);
    } catch (e) {
      setJsonError(e.message);
    }
  }

  function handleHeaderChange(index, field, value) {
    const next = headers.map((h, i) => i === index ? { ...h, [field]: value } : h);
    setHeaders(next);
  }

  function handleAddHeader() {
    setHeaders([...headers, { key: '', value: '' }]);
  }

  function handleRemoveHeader(index) {
    if (headers.length <= 1) {
      setHeaders([{ key: '', value: '' }]);
      return;
    }
    setHeaders(headers.filter((_, i) => i !== index));
  }

  const handleContextMount = useCallback((editor) => {
    contextEditorRef.current = editor;
  }, []);

  const handleContextChange = useCallback((value) => {
    setContext(value ?? '');
    try {
      JSON.parse(value);
      setContextError(null);
    } catch (e) {
      setContextError(e.message);
    }
  }, [setContext]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      <div className="flex items-center border-b border-zinc-800 shrink-0 min-h-[28px]">
        {(mode === 'mcp' ? MCP_TABS : HTTP_TABS).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "bg-transparent border-none border-r border-zinc-800 text-zinc-500 py-[5px] px-3 w-auto h-full text-[11px] font-semibold cursor-pointer outline-none transition-colors",
              activeTab === tab && "bg-zinc-800 text-zinc-100"
            )}
          >
            {tab}
          </button>
        ))}
        {activeTab === 'Body' && (
          <div className="ml-auto mr-2 flex items-center gap-1.5">
            {canShowForm && (
              <>
                <button
                  onClick={() => setViewMode('form')}
                  className={cn(
                    "bg-transparent text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800",
                    viewMode === 'form' && "bg-zinc-800 text-zinc-100 border-zinc-700"
                  )}
                >
                  Form
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  className={cn(
                    "bg-transparent text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800",
                    viewMode === 'json' && "bg-zinc-800 text-zinc-100 border-zinc-700"
                  )}
                >
                  JSON
                </button>
                <span className="w-px h-3 bg-zinc-800 mx-1" />
              </>
            )}
            <button
              onClick={() => {
                if (!body) return;
                navigator.clipboard.writeText(body);
                setBodyCopied(true);
                setTimeout(() => setBodyCopied(false), 2000);
              }}
              className="bg-transparent text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800"
            >
              {bodyCopied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleFormat} className="bg-transparent text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800">Format</button>
            <Select onValueChange={handleTemplate}>
              <SelectTrigger className="w-[100px] h-5 min-h-5 text-[10px] bg-transparent border-zinc-800 text-zinc-400 px-2 py-0">
                <SelectValue placeholder="Templates" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(TEMPLATES).map((name) => (
                  <SelectItem key={name} value={name} className="text-[10px]">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {activeTab === 'Body' && (
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-1.5">
          {selectedTool && (
            <div className="bg-zinc-900 text-zinc-200 border border-zinc-800 border-l-[2px] border-l-blue-500 rounded p-1.5 text-[11px] shrink-0 font-mono">
              <span className="font-bold text-zinc-200">{selectedTool.name}</span>
              {selectedTool.description && (
                <span className="text-zinc-500"> — {selectedTool.description}</span>
              )}
            </div>
          )}
          {viewMode === 'form' && canShowForm ? (
            <SchemaForm
              schema={selectedTool.inputSchema}
              values={(() => { try { return JSON.parse(body) || {}; } catch { return {}; } })()}
              onChange={(newValues) => {
                const json = JSON.stringify(newValues, null, 2);
                setBody(json);
                setJsonError(null);
                editorRef.current?.setValue(json);
              }}
            />
          ) : (
            <>
              {jsonError && (
                <div className="bg-zinc-900 text-red-400 border border-red-900 rounded p-1.5 text-[11px] shrink-0 font-mono">
                  <span className="mr-1">⚠</span> {jsonError}
                </div>
              )}
              <div className="flex-1 border border-zinc-800 rounded overflow-hidden relative">
                <Editor
                  defaultValue={body}
                  language="json"
                  theme="vs-dark"
                  onMount={handleEditorMount}
                  onChange={handleEditorChange}
                  options={{
                    fontSize: 13,
                    fontFamily: 'monospace',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    tabSize: 2,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'Headers' && (
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-1.5">
          <div className="flex justify-end shrink-0">
            <button onClick={handleAddHeader} className="bg-transparent text-zinc-400 border border-zinc-800 rounded px-2 py-0.5 text-[10px] cursor-pointer hover:bg-zinc-800">+ Add Header</button>
          </div>
          <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
            {headers.map((header, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  className="flex-1 h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                />
                <Input
                  className="flex-[2] h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                />
                <button
                  onClick={() => handleRemoveHeader(i)}
                  className="bg-transparent border-none text-zinc-500 text-base cursor-pointer px-1 rounded hover:text-red-400 hover:bg-zinc-800/50"
                  title="Remove header"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Auth' && (
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
          <div className="flex gap-1.5 items-center">
            <label className="text-[11px] font-semibold text-zinc-500 min-w-[60px] shrink-0">Type</label>
            <Select
              value={auth?.type ?? 'none'}
              onValueChange={(val) => {
                setAuth({
                  type: val,
                  token: auth?.token ?? '',
                  apiKey: auth?.apiKey ?? { key: '', value: '', addTo: 'header' },
                });
              }}
            >
              <SelectTrigger className="w-[150px] h-6 text-xs bg-transparent border-zinc-800 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">None</SelectItem>
                <SelectItem value="bearer" className="text-xs">Bearer Token</SelectItem>
                <SelectItem value="apikey" className="text-xs">API Key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {auth?.type === 'bearer' && (
            <div className="flex gap-1.5 items-center">
              <label className="text-[11px] font-semibold text-zinc-500 min-w-[60px] shrink-0">Token</label>
              <Input
                className="flex-[2] h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
                placeholder="Enter bearer token"
                value={auth.token}
                onChange={(e) => setAuth({ ...auth, token: e.target.value })}
              />
            </div>
          )}

          {auth?.type === 'apikey' && auth.apiKey && (
            <>
              <div className="flex gap-1.5 items-center">
                <label className="text-[11px] font-semibold text-zinc-500 min-w-[60px] shrink-0">Key</label>
                <Input
                  className="flex-1 h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
                  placeholder="e.g. X-API-Key"
                  value={auth.apiKey.key ?? ''}
                  onChange={(e) => setAuth({ ...auth, apiKey: { ...auth.apiKey, key: e.target.value } })}
                />
              </div>
              <div className="flex gap-1.5 items-center">
                <label className="text-[11px] font-semibold text-zinc-500 min-w-[60px] shrink-0">Value</label>
                <Input
                  className="flex-[2] h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
                  placeholder="Enter API key value"
                  value={auth.apiKey.value ?? ''}
                  onChange={(e) => setAuth({ ...auth, apiKey: { ...auth.apiKey, value: e.target.value } })}
                />
              </div>
              <div className="flex gap-1.5 items-center">
                <label className="text-[11px] font-semibold text-zinc-500 min-w-[60px] shrink-0">Add to</label>
                <Select
                  value={auth.apiKey.addTo ?? 'header'}
                  onValueChange={(val) => setAuth({ ...auth, apiKey: { ...auth.apiKey, addTo: val } })}
                >
                  <SelectTrigger className="w-[150px] h-6 text-xs bg-transparent border-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header" className="text-xs">Header</SelectItem>
                    <SelectItem value="query" className="text-xs">Query Param</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {auth?.type === 'none' && (
            <p className="text-[11px] text-zinc-500 mt-2">No authentication</p>
          )}
        </div>
      )}

      {activeTab === 'Context' && (
        <div className="flex-1 flex flex-col overflow-hidden p-2 gap-1.5">
          {contextError && (
            <div className="bg-zinc-900 text-red-400 border border-red-900 rounded p-1.5 text-[11px] shrink-0 font-mono">
              <span className="mr-1">⚠</span> {contextError}
            </div>
          )}
          <div className="flex-1 border border-zinc-800 rounded overflow-hidden relative">
            <Editor
              defaultValue={context}
              language="json"
              theme="vs-dark"
              onMount={handleContextMount}
              onChange={handleContextChange}
              options={{
                fontSize: 13,
                fontFamily: 'monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
