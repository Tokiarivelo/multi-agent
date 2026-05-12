import { NodeTypeId } from './nodeTypes';

export interface InputField {
  name: string;
  type: string;
  note: string;
}

export interface InputContract {
  summary: string;
  fields: InputField[];
}

export const NODE_INPUT_CONTRACTS: Partial<Record<NodeTypeId, InputContract>> = {
  START: {
    summary: 'Entry point — receives the initial workflow trigger payload.',
    fields: [{ name: '(any)', type: 'any', note: 'Passed when the workflow is triggered' }],
  },
  END: {
    summary: 'Receives the full accumulated context.variables — terminates the workflow.',
    fields: [{ name: '(any)', type: 'any', note: 'All context variables collected so far' }],
  },
  AGENT: {
    summary: 'Receives context.variables serialised as the agent input message.',
    fields: [{ name: '(any)', type: 'any', note: 'All context variables forwarded to the agent as its input string' }],
  },
  ORCHESTRATOR: {
    summary: 'Receives context.variables serialised as the orchestrator agent input.',
    fields: [{ name: '(any)', type: 'any', note: 'Full context forwarded; the agent loops over it up to maxIterations times' }],
  },
  TOOL: {
    summary: 'Receives context.variables and passes them as tool arguments.',
    fields: [{ name: '(any)', type: 'any', note: 'Context variables are spread as the tool\'s input payload' }],
  },
  MCP: {
    summary: 'Receives context.variables and passes them as MCP tool arguments.',
    fields: [{ name: '(any)', type: 'any', note: 'Context variables are spread as the MCP call input' }],
  },
  CONDITIONAL: {
    summary: 'Evaluates a JS expression with context.variables in scope.',
    fields: [
      { name: 'data', type: 'any', note: 'Alias for the most recent node output' },
      { name: '$', type: 'Record<string,any>', note: 'Full context.variables object' },
    ],
  },
  TRANSFORM: {
    summary: 'Receives the previous node\'s output as `data`.',
    fields: [
      { name: 'data', type: 'any', note: 'Output of the immediately preceding node' },
      { name: '$', type: 'Record<string,any>', note: 'Full context.variables for additional lookups' },
    ],
  },
  PROMPT: {
    summary: 'Template is rendered with context.variables — use {{variable}} placeholders.',
    fields: [
      { name: '{{input}}', type: 'string', note: 'Replaced with the current input value' },
      { name: '{{context}}', type: 'any', note: 'Replaced with the full context object (JSON)' },
      { name: '{{<key>}}', type: 'any', note: 'Any key present in context.variables' },
    ],
  },
  TEXT: {
    summary: 'Static text block — no dynamic input consumed.',
    fields: [],
  },
  JSON: {
    summary: 'Injects a static JSON object — no dynamic input consumed.',
    fields: [],
  },
  FILE: {
    summary: 'Loads files from config — no dynamic input consumed.',
    fields: [],
  },
  LOOP: {
    summary: 'Iterates over an array. Each item is available as `item` inside the script.',
    fields: [
      { name: 'collection', type: 'string | array', note: 'Key in context.variables holding the array to iterate (or a literal JS expr)' },
      { name: 'item', type: 'any', note: 'Current element — injected per iteration into itemScript / filterScript' },
    ],
  },
  WHILE: {
    summary: 'Evaluates a JS condition each iteration with context.variables in scope.',
    fields: [
      { name: '$', type: 'Record<string,any>', note: 'Full context.variables — read in the condition expression' },
      { name: 'data', type: 'any', note: 'Most recent node output' },
    ],
  },
  SWITCH: {
    summary: 'Evaluates `switchOn` expression and routes to the matching case branch.',
    fields: [
      { name: '$', type: 'Record<string,any>', note: 'Full context.variables — available in the switchOn expression' },
      { name: 'data', type: 'any', note: 'Most recent node output' },
    ],
  },
  FOR_EACH: {
    summary: 'Runs downstream nodes for each item in the target array.',
    fields: [
      { name: 'collection', type: 'string | array', note: 'Key in context.variables (or dot-path) holding the array' },
      { name: '_forEachItem', type: 'any', note: 'Current element injected into context per iteration' },
      { name: '_forEachIndex', type: 'number', note: 'Zero-based index of the current element' },
      { name: '_forEachTotal', type: 'number', note: 'Total number of elements in the collection' },
    ],
  },
  GITHUB: {
    summary: 'Calls the GitHub REST API. Config fields support {{variable}} interpolation.',
    fields: [
      { name: 'token', type: 'string', note: 'GitHub personal access token (config or {{variable}})' },
      { name: 'endpoint', type: 'string', note: 'REST path, e.g. /repos/:owner/:repo/issues' },
      { name: 'method', type: 'GET|POST|PUT|PATCH|DELETE', note: 'HTTP method' },
      { name: 'body', type: 'string | object', note: 'Request body (JSON string or {{variable}})' },
    ],
  },
  SLACK: {
    summary: 'Posts a message to Slack. Config fields support {{variable}} interpolation.',
    fields: [
      { name: 'token', type: 'string', note: 'Slack bot token' },
      { name: 'channel', type: 'string', note: 'Channel ID or name' },
      { name: 'message', type: 'string', note: 'Message text — use {{variable}} for dynamic content' },
    ],
  },
  WHATSAPP: {
    summary: 'Sends a WhatsApp message via Cloud API. Fields support {{variable}}.',
    fields: [
      { name: 'token', type: 'string', note: 'WhatsApp Cloud API access token' },
      { name: 'phoneNumberId', type: 'string', note: 'Sender phone number ID' },
      { name: 'to', type: 'string', note: 'Recipient phone number' },
      { name: 'message', type: 'string', note: 'Message text — use {{variable}} for dynamic content' },
    ],
  },
  SHELL: {
    summary: 'Executes a shell command. Context variables are injected as environment variables.',
    fields: [
      { name: 'command', type: 'string', note: 'Shell command to run' },
      { name: 'cwd', type: 'string', note: 'Working directory (defaults to active workspace path)' },
      { name: 'ENV_*', type: 'string', note: 'Each context variable is exported as an env var' },
    ],
  },
  WORKSPACE_READ: {
    summary: 'Reads a file from the open local workspace.',
    fields: [
      { name: 'workspaceId', type: 'string', note: 'ID of the open workspace (set in config)' },
      { name: 'filePath', type: 'string', note: 'Path relative to workspace root' },
    ],
  },
  WORKSPACE_WRITE: {
    summary: 'Writes content to a file in the open local workspace.',
    fields: [
      { name: 'workspaceId', type: 'string', note: 'ID of the open workspace (set in config)' },
      { name: 'filePath', type: 'string', note: 'Destination path relative to workspace root' },
      { name: 'content', type: 'string', note: 'Content to write — use {{variable}} to inject context values' },
    ],
  },
  SUBWORKFLOW: {
    summary: 'Invokes another workflow. Use inputMapping to forward specific context keys.',
    fields: [
      { name: 'workflowId', type: 'string', note: 'ID of the sub-workflow to call' },
      { name: 'inputMapping', type: 'Record<string,string>', note: 'Maps sub-workflow input keys → context variable paths (e.g. $variables.myVar)' },
    ],
  },
  DOWNLOAD_FILE: {
    summary: 'Downloads a file from a URL. Config fields support {{variable}} interpolation.',
    fields: [
      { name: 'url', type: 'string', note: 'File URL to download — use {{variable}} for dynamic URLs' },
      { name: 'outputPath', type: 'string', note: 'Workspace-relative destination path' },
      { name: 'filename', type: 'string', note: 'Override file name (optional)' },
    ],
  },
  DOCUMENT: {
    summary: 'Generates, reads, writes, parses, or deletes documents. Required fields depend on the selected action.',
    fields: [
      { name: 'action', type: 'generate|read|write|parse_image|delete', note: 'Determines which fields are used' },
      { name: 'format / title / author / sections / table', type: 'string|object', note: 'Required for action=generate' },
      { name: 'path / encoding', type: 'string', note: 'Required for action=read, write, parse_image, delete' },
      { name: 'content', type: 'string', note: 'Required for action=write' },
      { name: 'outputPath', type: 'string', note: 'Optional for action=generate — saves to workspace path' },
    ],
  },
  EMAIL: {
    summary: 'Sends or manipulates emails. Required fields depend on the selected action.',
    fields: [
      { name: 'action', type: 'send|fetch|manipulate', note: 'Determines which fields are used' },
      { name: 'to / from / subject / body', type: 'string', note: 'Required for action=send' },
      { name: 'query / mailbox / limit', type: 'string|number', note: 'Required for action=fetch' },
      { name: 'uids / manipulateAction / targetMailbox', type: 'string', note: 'Required for action=manipulate' },
    ],
  },
};
