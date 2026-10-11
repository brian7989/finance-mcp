import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import { runTool } from "../result.js";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
};
export const emptyInput = z.object({});
export function createToolRegistrar(server: McpServer) {
  // One output boundary: validate and strip unknown fields BEFORE either MCP result channel.
  return function registerTypedTool<I extends z.ZodObject, O extends z.ZodType>(
    name: string,
    description: string,
    input: I,
    output: O,
    handler: (args: z.infer<I>) => Promise<z.input<O>>,
    annotations = readOnly,
  ) {
    server.registerTool<O, z.ZodObject>(
      name,
      {
        description,
        inputSchema: input,
        outputSchema: output,
        annotations,
      },
      async (args) => runTool(() => handler(input.parse(args)), output),
    );
  };
}

export type RegisterTool = ReturnType<typeof createToolRegistrar>;
