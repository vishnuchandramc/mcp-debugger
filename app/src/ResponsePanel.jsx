import React, { useState } from 'react';
import ExecutionTimeline from './ExecutionTimeline.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TABS = ['Pretty', 'Raw', 'Timeline'];

export default function ResponsePanel({ response, rawResponse, isError, toolExecution, requestBody }) {
  const [activeTab, setActiveTab] = useState('Pretty');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Pretty" className="flex-1 overflow-auto p-3 flex flex-col gap-4">
          {response === null ? (
            <p className="text-[#555] text-[13px] font-mono m-0">Send a request to see the response.</p>
          ) : (
            <>
              <pre className={`m-0 text-[13px] font-mono whitespace-pre-wrap break-words leading-relaxed ${isError ? 'text-[#f48771]' : 'text-foreground'}`}>
                {response}
              </pre>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-bold tracking-widest text-[#555] m-0 mb-2.5">TOOL EXECUTION</p>
                {toolExecution ? (
                  <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 items-start">
                    <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Tool</span>
                    <span className="text-[13px] text-[#4ec9b0] font-mono">{toolExecution.name ?? '—'}</span>

                    <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Arguments</span>
                    <pre className="m-0 text-xs font-mono whitespace-pre-wrap break-words text-[#dcdcaa] leading-relaxed bg-card border border-border rounded p-2">
                      {toolExecution.arguments != null
                        ? JSON.stringify(toolExecution.arguments, null, 2)
                        : '—'}
                    </pre>

                    {toolExecution.output != null && (
                      <>
                        <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Output</span>
                        <pre className="m-0 text-xs font-mono whitespace-pre-wrap break-words text-[#dcdcaa] leading-relaxed bg-card border border-border rounded p-2">
                          {typeof toolExecution.output === 'string'
                            ? toolExecution.output
                            : JSON.stringify(toolExecution.output, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#555] font-mono m-0 italic">No tool execution detected</p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="Raw" className="flex-1 overflow-auto p-3 flex flex-col gap-4">
          {response === null ? (
            <p className="text-[#555] text-[13px] font-mono m-0">Send a request to see the response.</p>
          ) : (
            <>
              <pre className={`m-0 text-[13px] font-mono whitespace-pre-wrap break-words leading-relaxed ${isError ? 'text-[#f48771]' : 'text-foreground'}`}>
                {rawResponse}
              </pre>
              <div className="border-t border-border pt-3">
                <p className="text-[10px] font-bold tracking-widest text-[#555] m-0 mb-2.5">TOOL EXECUTION</p>
                {toolExecution ? (
                  <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 items-start">
                    <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Tool</span>
                    <span className="text-[13px] text-[#4ec9b0] font-mono">{toolExecution.name ?? '—'}</span>

                    <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Arguments</span>
                    <pre className="m-0 text-xs font-mono whitespace-pre-wrap break-words text-[#dcdcaa] leading-relaxed bg-card border border-border rounded p-2">
                      {toolExecution.arguments != null
                        ? JSON.stringify(toolExecution.arguments, null, 2)
                        : '—'}
                    </pre>

                    {toolExecution.output != null && (
                      <>
                        <span className="text-[11px] text-muted-foreground font-mono pt-0.5">Output</span>
                        <pre className="m-0 text-xs font-mono whitespace-pre-wrap break-words text-[#dcdcaa] leading-relaxed bg-card border border-border rounded p-2">
                          {typeof toolExecution.output === 'string'
                            ? toolExecution.output
                            : JSON.stringify(toolExecution.output, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#555] font-mono m-0 italic">No tool execution detected</p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="Timeline" className="flex-1 overflow-auto p-3">
          {response === null ? (
            <p className="text-[#555] text-[13px] font-mono m-0">Send a request to see the response.</p>
          ) : (
            <ExecutionTimeline
              requestBody={requestBody}
              response={response}
              toolExecution={toolExecution}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
