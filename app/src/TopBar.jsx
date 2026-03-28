import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
    <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border shrink-0">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap tracking-wide">MCP Debugger</span>
      <div className="flex items-center gap-2 flex-1">
        {/* Mode selector */}
        <Select
          value={mode.toUpperCase()}
          onChange={(e) => setMode(e.target.value.toLowerCase())}
          className="bg-[#1a3a4a] text-[#569cd6]"
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        {mode === 'http' ? (
          <>
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ color: METHOD_COLORS[method] }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
                  {m}
                </option>
              ))}
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
              className="flex-1"
              spellCheck={false}
            />
            <Button onClick={onRun} disabled={loading}>
              {loading ? 'Running\u2026' : 'Run'}
            </Button>
            <Button variant="outline" onClick={onGenerateCurl}>
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
              className="flex-1"
              spellCheck={false}
              disabled={mcpConnected || mcpConnecting}
            />
            {!mcpConnected ? (
              <Button onClick={onConnect} disabled={mcpConnecting}>
                {mcpConnecting ? 'Connecting\u2026' : 'Connect'}
              </Button>
            ) : (
              <Button variant="destructive" onClick={onDisconnect}>
                Disconnect
              </Button>
            )}
            <Button
              onClick={onRun}
              disabled={loading || !mcpConnected || !selectedTool}
            >
              {loading ? 'Running\u2026' : 'Run'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
