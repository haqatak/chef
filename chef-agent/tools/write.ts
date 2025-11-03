import type { Tool } from 'ai';
import { z } from 'zod';

const writeToolDescription = `
Create a new file or completely replace an existing file with new content.
Use this tool when you need to create a new file from scratch.

For small edits to existing files, use the \`edit\` tool instead.

IMPORTANT: This tool will overwrite the file if it already exists.
Make sure you want to replace the entire file before using this tool.
`;

export const writeToolParameters = z.object({
  path: z.string().describe('The absolute path to the file to create or overwrite.'),
  content: z.string().describe('The complete content of the file.'),
});

export const writeTool: Tool = {
  description: writeToolDescription,
  parameters: writeToolParameters,
};
