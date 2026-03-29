import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const MODES = ['HTTP', 'MCP'];

const METHOD_COLORS = {
  GET: '#4ec9b0',
  POST: '#dcdcaa',
  PUT: '#9cdcfe',
  PATCH: '#c586c0',
  DELETE: '#f48771',
};

export default function TopBar({
  mode,
  setMode,
  endpoint,
  setEndpoint,
  method,
  setMethod,
  onRun,
  loading,
  mcpUrl,
  setMcpUrl,
  mcpConnected,
  mcpConnecting,
  onConnect,
  onDisconnect,
  selectedTool,
  onGenerateCurl,
  onCurlImport,
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 bg-zinc-950 border-b border-zinc-800 shrink-0">
      <span className="text-[11px] font-bold text-zinc-500 whitespace-nowrap tracking-wider uppercase">MCP Debugger</span>
      <div className="flex items-center gap-1.5 flex-1">
        {/* Mode selector */}
        <Select value={mode} onValueChange={(val) => setMode(val)}>
          <SelectTrigger className="w-[80px] h-6 text-[11px] font-bold bg-zinc-900 border-zinc-700 text-zinc-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.toLowerCase()} value={m.toLowerCase()} className="text-[11px] font-bold">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {mode === 'http' ? (
          <>
            <Select value={method} onValueChange={(val) => setMethod(val)}>
              <SelectTrigger className="w-[85px] h-6 text-[11px] font-bold bg-transparent border-zinc-800" style={{ color: METHOD_COLORS[method] }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="text-[11px] font-bold" style={{ color: METHOD_COLORS[m] }}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text.trimStart().startsWith('curl')) {
                  e.preventDefault();
                  onCurlImport(text);
                }
              }}
              placeholder="https://example.com/api/endpoint"
              className="flex-1 h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
              spellCheck={false}
            />
            <Button
              onClick={onRun}
              disabled={loading}
              variant="outline"
              size="sm"
              className="h-6 px-3 text-[11px] font-semibold bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              {loading ? 'Running…' : 'Run'}
            </Button>
            <Button 
              onClick={onGenerateCurl} 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-[11px] bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300"
            >
              cURL
            </Button>
          </>
        ) : (
          <>
            <Input
              type="text"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="http://localhost:3000/sse"
              className="flex-1 h-6 bg-transparent border-zinc-800 text-zinc-200 text-xs px-2 focus-visible:ring-1 focus-visible:ring-zinc-700"
              spellCheck={false}
              disabled={mcpConnected || mcpConnecting}
            />
            {!mcpConnected ? (
              <Button
                onClick={onConnect}
                disabled={mcpConnecting}
                variant="outline"
                size="sm"
                className="h-6 px-3 text-[11px] font-semibold bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                {mcpConnecting ? 'Connecting…' : 'Connect'}
              </Button>
            ) : (
              <Button
                onClick={onDisconnect}
                variant="outline"
                size="sm"
                className="h-6 px-3 text-[11px] font-semibold bg-transparent border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300"
              >
                Disconnect
              </Button>
            )}
            <Button
              onClick={onRun}
              disabled={loading || !mcpConnected || !selectedTool}
              variant="outline"
              size="sm"
              className="h-6 px-3 text-[11px] font-semibold bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}


