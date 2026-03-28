import { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * Browser-compatible SSE transport for MCP.
 * Uses native EventSource + fetch (no Node dependencies).
 */
class BrowserSSETransport {
  constructor(url) {
    this._url = new URL(url);
    this._endpoint = null;
    this._eventSource = null;
    this._abortController = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this._abortController = new AbortController();
      this._eventSource = new EventSource(this._url.href);

      this._eventSource.onerror = () => {
        const err = new Error(`SSE connection failed to ${this._url.href}`);
        reject(err);
        this.onerror?.(err);
      };

      this._eventSource.addEventListener('endpoint', (event) => {
        try {
          this._endpoint = new URL(event.data, this._url);
        } catch (error) {
          reject(error);
          this.onerror?.(error);
          this.close();
          return;
        }
        resolve();
      });

      this._eventSource.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          this.onerror?.(error);
          return;
        }
        this.onmessage?.(message);
      };
    });
  }

  async close() {
    this._abortController?.abort();
    this._eventSource?.close();
    this.onclose?.();
  }

  async send(message) {
    if (!this._endpoint) {
      throw new Error('Not connected');
    }
    const response = await fetch(this._endpoint.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: this._abortController?.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
    }
  }
}

/**
 * Connect to an MCP server via SSE.
 * Returns { client, tools }.
 */
export async function createMcpClient(url) {
  const client = new Client({ name: 'mcp-debugger', version: '1.0.0' });
  const transport = new BrowserSSETransport(url);
  await client.connect(transport);
  const { tools } = await client.listTools();
  return { client, tools: tools ?? [] };
}

/**
 * Call a tool on the connected MCP client.
 */
export async function callMcpTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  return result;
}

/**
 * Disconnect an MCP client.
 */
export async function disconnectMcpClient(client) {
  try {
    await client.close();
  } catch {
    // ignore close errors
  }
}

/**
 * Generate a skeleton JSON string from a tool's inputSchema.
 */
export function generateToolTemplate(tool) {
  const schema = tool.inputSchema;
  if (!schema || !schema.properties) {
    return '{}';
  }

  const obj = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    switch (prop.type) {
      case 'string':
        obj[key] = '';
        break;
      case 'number':
      case 'integer':
        obj[key] = 0;
        break;
      case 'boolean':
        obj[key] = false;
        break;
      case 'array':
        obj[key] = [];
        break;
      case 'object':
        obj[key] = {};
        break;
      default:
        obj[key] = null;
    }
  }
  return JSON.stringify(obj, null, 2);
}
