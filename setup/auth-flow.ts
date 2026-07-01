import { runAuthFlow } from "../src/api/auth-flow.js";

export { runAuthFlow };

if (process.argv[1]?.endsWith("auth-flow.js")) {
  runAuthFlow().catch((err) => {
    console.error("Auth failed:", err.message);
    process.exit(1);
  });
}
