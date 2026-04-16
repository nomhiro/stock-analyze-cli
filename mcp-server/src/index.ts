import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDataTools } from "./tools/data.js";

const server = new McpServer({
  name: "stock-analyzer",
  version: "0.1.0",
});

// ツール登録
registerDataTools(server);

// Stdio トランスポートで接続
const transport = new StdioServerTransport();
await server.connect(transport);
