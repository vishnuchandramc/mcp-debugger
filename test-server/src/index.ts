#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";

type Note = { title: string; content: string };

const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" },
};

// Track transports by session ID so multiple connections work
const transports = new Map<string, SSEServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  // CORS headers for browser access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);

  if (url.pathname === "/sse" && req.method === "GET") {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);

    // Clean up on close
    res.on("close", () => {
      transports.delete(transport.sessionId);
    });

    // Each SSE connection gets its own Server instance
    const sessionServer = new Server(
      { name: "test-server", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    sessionServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "create_note",
          description: "Create a new note",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Title of the note" },
              content: { type: "string", description: "Text content of the note" },
            },
            required: ["title", "content"],
          },
        },
        {
          name: "list_notes",
          description: "List all existing notes",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));
    sessionServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "create_note": {
          const title = String(request.params.arguments?.title);
          const content = String(request.params.arguments?.content);
          if (!title || !content) throw new Error("Title and content are required");
          const id = String(Object.keys(notes).length + 1);
          notes[id] = { title, content };
          return { content: [{ type: "text", text: `Created note ${id}: ${title}` }] };
        }
        case "list_notes": {
          const list = Object.entries(notes)
            .map(([id, n]) => `${id}: ${n.title} - ${n.content}`)
            .join("\n");
          return { content: [{ type: "text", text: list || "No notes found." }] };
        }
        default:
          throw new Error("Unknown tool");
      }
    });

    await sessionServer.connect(transport);
    return;
  }

  if (url.pathname === "/messages" && req.method === "POST") {
    const sessionId = url.searchParams.get("sessionId");
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.writeHead(400);
      res.end("Unknown or missing session");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`MCP test server running on http://localhost:${PORT}/sse`);
});
