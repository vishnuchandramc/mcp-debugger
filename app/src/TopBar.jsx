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
    <div 
      className="flex items-center gap-3 py-2 px-3 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none"
    >
      <div className="flex items-center gap-1.5 flex-1">
        {/* Mode selector */}
        <Select value={mode} onValueChange={(val) => setMode(val)}>
          <SelectTrigger className="w-[85px] h-8 text-[11px] font-bold bg-zinc-900 border-zinc-700 text-zinc-200">
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
              <SelectTrigger className="w-[90px] h-8 text-[11px] font-bold bg-transparent border-zinc-800" style={{ color: METHOD_COLORS[method] }}>
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
              className="flex-1 h-8 bg-zinc-950/50 border-zinc-800 text-zinc-400 placeholder:text-zinc-600 text-xs focus-visible:ring-1 focus-visible:ring-zinc-700 font-mono shadow-sm"
              spellCheck={false}
            />
            <Button
              onClick={onRun}
              disabled={loading}
              variant="default"
              size="sm"
              className="h-8 px-4 text-xs font-semibold"
            >
              {loading ? 'Running…' : 'Run'}
            </Button>
            <Button 
              onClick={onGenerateCurl} 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-[11px] border-zinc-800 text-zinc-400 hover:text-zinc-200"
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
              className="flex-1 h-8 bg-zinc-950/50 border-zinc-800 text-zinc-400 placeholder:text-zinc-600 text-xs focus-visible:ring-1 focus-visible:ring-zinc-700 font-mono shadow-sm"
              spellCheck={false}
              disabled={mcpConnected || mcpConnecting}
            />
            {!mcpConnected ? (
              <Button
                onClick={onConnect}
                disabled={mcpConnecting}
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs font-semibold bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                {mcpConnecting ? 'Connecting…' : 'Connect'}
              </Button>
            ) : (
              <Button
                onClick={onDisconnect}
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs font-semibold bg-transparent border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300"
              >
                Disconnect
              </Button>
            )}
            <Button
              onClick={onRun}
              disabled={loading || !mcpConnected || !selectedTool}
              variant="default"
              size="sm"
              className="h-8 px-4 text-xs font-semibold disabled:opacity-50"
            >
              {loading ? 'Running…' : 'Run'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}


