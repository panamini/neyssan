export interface McpClient {
  callTool<T>(name: string, params: Record<string, unknown>): Promise<T>;
}