import type { PartId } from './partId.js';
import type { BoltAction, BoltArtifactData, ActionType, FileAction } from './types.js';
import { createScopedLogger } from './utils/logger.js';
import { getRelativePath } from './utils/workDir.js';
import { unreachable } from './utils/unreachable.js';

const ARTIFACT_TAG_OPEN = '<boltArtifact';
const ARTIFACT_TAG_CLOSE = '</boltArtifact>';
const ARTIFACT_ACTION_TAG_OPEN = '<boltAction';
const ARTIFACT_ACTION_TAG_CLOSE = '</boltAction>';

// Support for XML function call format (e.g., from Ollama models)
const FUNCTION_TAG_OPEN = '<function=';
const FUNCTION_TAG_CLOSE = '</function_calls>';
const PARAMETER_TAG_OPEN = '<parameter=';
const PARAMETER_TAG_CLOSE = '</parameter>';

const logger = createScopedLogger('MessageParser');

export interface ArtifactCallbackData extends BoltArtifactData {
  partId: PartId;
}

export interface ActionCallbackData {
  artifactId: string;
  partId: PartId;
  actionId: string;
  action: BoltAction;
}

export type ArtifactCallback = (data: ArtifactCallbackData) => void;
export type ActionCallback = (data: ActionCallbackData) => void;

interface ParserCallbacks {
  onArtifactOpen?: ArtifactCallback;
  onArtifactClose?: ArtifactCallback;
  onActionOpen?: ActionCallback;
  onActionStream?: ActionCallback;
  onActionClose?: ActionCallback;
}

interface ElementFactoryProps {
  partId: PartId;
}

type ElementFactory = (props: ElementFactoryProps) => string;

interface StreamingMessageParserOptions {
  callbacks?: ParserCallbacks;
  artifactElement?: ElementFactory;
}

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  currentArtifact?: BoltArtifactData;
  currentAction: BoltAction | null;
  actionId: number;
  hasCreatedArtifact: boolean;
}

export class StreamingMessageParser {
  #messages = new Map<string, MessageState>();

  constructor(private _options: StreamingMessageParserOptions = {}) {}

  static stripArtifacts(content: string) {
    let i = 0;
    let output = '';

    while (i < content.length) {
      const startIndex = content.indexOf(ARTIFACT_TAG_OPEN, i);
      if (startIndex === -1) {
        output += content.slice(i);
        break;
      }
      output += content.slice(i, startIndex);
      const endIndex = content.indexOf(ARTIFACT_TAG_CLOSE, startIndex);
      if (endIndex === -1) {
        break;
      }
      i = endIndex + ARTIFACT_TAG_CLOSE.length;
    }
    return output;
  }

  // Convert XML function call format to boltArtifact format
  static convertFunctionCallsToArtifacts(content: string): string {
    // Handle complete function_calls blocks
    const completeFunctionCallRegex = /<function_calls>([\s\S]*?)<\/function_calls>/g;
    
    content = content.replace(completeFunctionCallRegex, (match, functionContent) => {
      logger.debug('Found complete function_calls block');
      
      // Extract function name and parameters
      const functionMatch = functionContent.match(/<function=([^>]+)>/)
      if (!functionMatch) {
        logger.debug('No function match found');
        return match;
      }
      
      const functionName = functionMatch[1];
      logger.debug('Function name:', functionName);
      
      // Only handle write/edit functions
      if (functionName !== 'write' && functionName !== 'edit') {
        return match;
      }
      
      // Extract path parameter
      const pathMatch = functionContent.match(/<parameter=path>([\s\S]*?)<\/parameter>/);
      const contentMatch = functionContent.match(/<parameter=content>([\s\S]*?)<\/parameter>/);
      
      if (!pathMatch || !contentMatch) {
        logger.debug('Missing path or content parameter');
        return match;
      }
      
      const filePath = pathMatch[1].trim();
      const fileContent = contentMatch[1].trim();
      
      logger.debug('Converting to boltArtifact:', filePath);
      
      // Convert to boltArtifact format
      const artifactId = filePath.replace(/[^a-zA-Z0-9]/g, '-');
      const title = `File: ${filePath}`;
      
      return `<boltArtifact id="${artifactId}" title="${title}" type="application/vnd.bolt.file">
  <boltAction type="file" filePath="${filePath}">${fileContent}</boltAction>
</boltArtifact>`;
    });
    
    // Also handle the alternative format: <function=write> directly without function_calls wrapper
    const directFunctionRegex = /<function=(write|edit)>\s*<parameter=path>([\s\S]*?)<\/parameter>\s*<parameter=content>([\s\S]*?)<\/parameter>/g;
    
    content = content.replace(directFunctionRegex, (match, functionName, filePath, fileContent) => {
      logger.debug('Found direct function call format:', functionName, filePath);
      
      const cleanPath = filePath.trim();
      const cleanContent = fileContent.trim();
      
      const artifactId = cleanPath.replace(/[^a-zA-Z0-9]/g, '-');
      const title = `File: ${cleanPath}`;
      
      return `<boltArtifact id="${artifactId}" title="${title}" type="application/vnd.bolt.file">
  <boltAction type="file" filePath="${cleanPath}">${cleanContent}</boltAction>
</boltArtifact>`;
    });
    
    return content;
  }

  parse(partId: PartId, input: string) {
    // Convert XML function calls to boltArtifact format if present
    input = StreamingMessageParser.convertFunctionCallsToArtifacts(input);
    
    let state = this.#messages.get(partId);

    if (!state) {
      state = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        currentAction: null,
        actionId: 0,
        hasCreatedArtifact: false,
      };

      this.#messages.set(partId, state);
    }

    let output = '';
    let i = state.position;
    let earlyBreak = false;

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact;

        if (currentArtifact === undefined) {
          unreachable('Artifact not initialized');
        }

        if (state.insideAction) {
          if (!state.currentAction) {
            unreachable('Action not initialized');
          }

          const closeIndex = input.indexOf(ARTIFACT_ACTION_TAG_CLOSE, i);

          const currentAction = state.currentAction;

          if (closeIndex !== -1) {
            const actionContent = input.slice(i, closeIndex);

            let content = actionContent.trim();

            if (currentAction && currentAction.type === 'file') {
              // Remove markdown code block syntax if present and file is not markdown
              if (!currentAction.filePath.endsWith('.md')) {
                content = cleanoutMarkdownSyntax(content);
                content = cleanEscapedTags(content);
              }

              content += '\n';
            }

            currentAction.content = content;

            this._options.callbacks?.onActionClose?.({
              artifactId: currentArtifact.id,
              partId,

              /**
               * We decrement the id because it's been incremented already
               * when `onActionOpen` was emitted to make sure the ids are
               * the same.
               */
              actionId: String(state.actionId - 1),

              action: currentAction as BoltAction,
            });

            state.insideAction = false;
            state.currentAction = null;

            i = closeIndex + ARTIFACT_ACTION_TAG_CLOSE.length;
          } else {
            if (currentAction && currentAction.type === 'file') {
              let content = input.slice(i);

              if (!currentAction.filePath.endsWith('.md')) {
                content = cleanoutMarkdownSyntax(content);
                content = cleanEscapedTags(content);
              }

              this._options.callbacks?.onActionStream?.({
                artifactId: currentArtifact.id,
                partId,
                actionId: String(state.actionId - 1),
                action: {
                  ...(currentAction as FileAction),
                  content,
                  filePath: currentAction.filePath,
                },
              });
            }

            break;
          }
        } else {
          const actionOpenIndex = input.indexOf(ARTIFACT_ACTION_TAG_OPEN, i);
          const artifactCloseIndex = input.indexOf(ARTIFACT_TAG_CLOSE, i);

          if (actionOpenIndex !== -1 && (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)) {
            const actionEndIndex = input.indexOf('>', actionOpenIndex);

            if (actionEndIndex !== -1) {
              state.insideAction = true;

              state.currentAction = this.#parseActionTag(input, actionOpenIndex, actionEndIndex);

              this._options.callbacks?.onActionOpen?.({
                artifactId: currentArtifact.id,
                partId,
                actionId: String(state.actionId++),
                action: state.currentAction as BoltAction,
              });

              i = actionEndIndex + 1;
            } else {
              break;
            }
          } else if (artifactCloseIndex !== -1) {
            this._options.callbacks?.onArtifactClose?.({ partId, ...currentArtifact });

            state.insideArtifact = false;
            state.currentArtifact = undefined;

            i = artifactCloseIndex + ARTIFACT_TAG_CLOSE.length;
          } else {
            break;
          }
        }
      } else if (input[i] === '<' && input[i + 1] !== '/') {
        let j = i;
        let potentialTag = '';

        while (j < input.length && potentialTag.length < ARTIFACT_TAG_OPEN.length) {
          potentialTag += input[j];

          if (potentialTag === ARTIFACT_TAG_OPEN) {
            const nextChar = input[j + 1];

            if (nextChar && nextChar !== '>' && nextChar !== ' ') {
              output += input.slice(i, j + 1);
              i = j + 1;
              break;
            }

            const openTagEnd = input.indexOf('>', j);

            if (openTagEnd !== -1) {
              const artifactTag = input.slice(i, openTagEnd + 1);

              const artifactTitle = this.#extractAttribute(artifactTag, 'title') as string;
              const type = this.#extractAttribute(artifactTag, 'type') as string;
              const artifactId = this.#extractAttribute(artifactTag, 'id') as string;

              if (!artifactTitle) {
                logger.warn('Artifact title missing');
              }

              if (!artifactId) {
                logger.warn('Artifact id missing');
              }

              state.insideArtifact = true;

              const currentArtifact = {
                id: artifactId,
                title: artifactTitle,
                type,
              } satisfies BoltArtifactData;

              state.currentArtifact = currentArtifact;

              this._options.callbacks?.onArtifactOpen?.({ partId, ...currentArtifact });

              // Sometimes the agent creates multiple artifacts in a single part,
              // which we don't want. In order to prevent these rendering multiple times,
              // we'll only add the element for the artifact once.
              if (!state.hasCreatedArtifact) {
                const artifactFactory = this._options.artifactElement ?? createArtifactElement;

                output += artifactFactory({ partId });
                state.hasCreatedArtifact = true;
              }

              i = openTagEnd + 1;
            } else {
              earlyBreak = true;
            }

            break;
          } else if (!ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
            output += input.slice(i, j + 1);
            i = j + 1;
            break;
          }

          j++;
        }

        if (j === input.length && ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
          break;
        }
      } else {
        output += input[i];
        i++;
      }

      if (earlyBreak) {
        break;
      }
    }

    state.position = i;

    return output;
  }

  reset() {
    this.#messages.clear();
  }

  #parseActionTag(input: string, actionOpenIndex: number, actionEndIndex: number) {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);

    const actionType = this.#extractAttribute(actionTag, 'type') as ActionType;

    const actionAttributes = {
      type: actionType,
      content: '',
    };

    if (actionType === 'file') {
      const filePath = this.#extractAttribute(actionTag, 'filePath') as string;

      if (!filePath) {
        logger.debug('File path not specified');
      }

      (actionAttributes as FileAction).filePath = getRelativePath(filePath);
    } else {
      logger.warn(`Unknown action type '${actionType}'`);
    }

    return actionAttributes as FileAction;
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));
    return match ? match[1] : undefined;
  }
}

const createArtifactElement: ElementFactory = (props) => {
  const elementProps = [
    'class="__boltArtifact__"',
    ...Object.entries(props).map(([key, value]) => {
      return `data-${camelToDashCase(key)}=${JSON.stringify(value)}`;
    }),
  ];

  return `<div ${elementProps.join(' ')}></div>`;
};

function camelToDashCase(input: string) {
  return input.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function cleanoutMarkdownSyntax(content: string) {
  const codeBlockRegex = /^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/;
  const match = content.match(codeBlockRegex);

  if (match) {
    return match[1]; // Remove common leading 4-space indent
  } else {
    return content;
  }
}

function cleanEscapedTags(content: string) {
  return content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
