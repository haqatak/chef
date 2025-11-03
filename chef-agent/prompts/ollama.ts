import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function ollama(options: SystemPromptOptions) {
  if (!options.usingOllama) {
    return '';
  }

  return stripIndents`
  <critical_instructions_for_ollama>
    IMPORTANT: You MUST use the <boltArtifact> and <boltAction> tags to write code. DO NOT use any other format.
    
    When creating files, you MUST use this EXACT format:

    <boltArtifact id="unique-id-here" title="Descriptive Title">
      <boltAction type="file" filePath="path/to/file.html">
        [FULL FILE CONTENT HERE]
      </boltAction>
      <boltAction type="file" filePath="path/to/another/file.js">
        [FULL FILE CONTENT HERE]
      </boltAction>
    </boltArtifact>

    DO NOT use <function=write> or <parameter=> tags. DO NOT use triple backticks \`\`\`.
    DO NOT describe what you're going to do - JUST DO IT using the tags above.
    
    Your response must look like this:
    1. Brief statement of what you're creating (1 sentence)
    2. The <boltArtifact>...</boltArtifact> block with all files
    3. Call the deploy tool to deploy the code
    
    Example correct response:
    "I'll create a calculator app.
    
    <boltArtifact id="calculator-app" title="Calculator Application">
      <boltAction type="file" filePath="index.html">
    <!DOCTYPE html>
    <html>
    <head><title>Calculator</title></head>
    <body><h1>Calculator</h1></body>
    </html>
      </boltAction>
    </boltArtifact>"
    
    Then immediately call the deploy tool.
  </critical_instructions_for_ollama>
  `;
}
