import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TtlCache } from "./cache/lru.js";
import { CircuitBreaker, RateLimiter } from "./resilience/index.js";
import { DdbClient } from "./api/client.js";
import { registerAllPrompts } from "./prompts/index.js";
import { registerCharacterResources } from "./resources/character.js";
import { registerCampaignResources } from "./resources/campaign.js";
import { registerAllTools } from "./tools/register.js";

export async function startServer(): Promise<void> {
  // Initialize cache instance
  const cache = new TtlCache<unknown>(60_000); // 60s TTL

  // Initialize resilience components
  const circuitBreaker = new CircuitBreaker(5, 30_000); // 5 failures, 30s cooldown
  const rateLimiter = new RateLimiter(2, 1000); // 2 req/sec

  // Initialize D&D Beyond API client
  const client = new DdbClient(cache, circuitBreaker, rateLimiter);

  // Create MCP server
  const server = new McpServer({
    name: "dndbeyond-mcp",
    version: "0.1.0",
  });

  // Register all prompts
  registerAllPrompts(server);

  // Register all resources
  registerCharacterResources(server, client);
  registerCampaignResources(server, client);

  registerAllTools(server, client);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error("dndbeyond-mcp: shutting down...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error("dndbeyond-mcp: server running");
}
