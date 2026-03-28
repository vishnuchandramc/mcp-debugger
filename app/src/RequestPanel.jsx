import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const HTTP_TABS = ['Body', 'Headers'];
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

export default function RequestPanel({ body, setBody, headers, setHeaders, context, setContext, selectedTool, mode }) {
  const [activeTab, setActiveTab] = useState('Body');
  const [jsonError, setJsonError] = useState(null);
  const [contextError, setContextError] = useState(null);
  const editorRef = useRef(null);
  const contextEditorRef = useRef(null);

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

  function handleTemplate(e) {
    const tpl = TEMPLATES[e.target.value];
    if (tpl) {
      setBody(tpl);
      setJsonError(null);
      editorRef.current?.setValue(tpl);
    }
    e.target.value = '';
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

  const tabs = mode === 'mcp' ? MCP_TABS : HTTP_TABS;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center border-b border-border shrink-0">
          <TabsList className="border-none">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
            ))}
          </TabsList>
          {activeTab === 'Body' && (
            <div className="ml-auto mr-3 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleFormat}>Format</Button>
              <Select onChange={handleTemplate} defaultValue="">
                <option value="" disabled>Templates</option>
                {Object.keys(TEMPLATES).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <TabsContent value="Body" className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          {selectedTool && (
            <div className="bg-[#1a2a3a] text-foreground border border-[#264f78] rounded px-2.5 py-1.5 text-xs font-mono shrink-0">
              <span className="text-[#4ec9b0] font-bold">{selectedTool.name}</span>
              {selectedTool.description && (
                <span className="text-muted-foreground"> — {selectedTool.description}</span>
              )}
            </div>
          )}
          {jsonError && (
            <div className="bg-[#3a1a1a] text-[#f48771] border border-[#5a2a2a] rounded px-2.5 py-1.5 text-xs font-mono shrink-0">
              <span className="mr-1">⚠</span> {jsonError}
            </div>
          )}
          <div className="flex-1 border border-border rounded overflow-hidden">
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
        </TabsContent>

        <TabsContent value="Headers" className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          <div className="flex justify-end shrink-0">
            <Button variant="outline" size="sm" onClick={handleAddHeader}>+ Add Header</Button>
          </div>
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
            {headers.map((header, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="flex-1"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                />
                <Input
                  className="flex-[2]"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveHeader(i)}
                  title="Remove header"
                  className="text-[#666]"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="Context" className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          {contextError && (
            <div className="bg-[#3a1a1a] text-[#f48771] border border-[#5a2a2a] rounded px-2.5 py-1.5 text-xs font-mono shrink-0">
              <span className="mr-1">⚠</span> {contextError}
            </div>
          )}
          <div className="flex-1 border border-border rounded overflow-hidden">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
