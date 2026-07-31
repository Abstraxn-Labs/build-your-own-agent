import type { UIMessage } from 'ai';

export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function toolNames(message: UIMessage): string[] {
  return message.parts
    .filter((part) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
    .map((part) => ('toolName' in part ? String(part.toolName) : part.type));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

export interface AgentMeta {
  title: string;
  subtitle: string;
  capabilities: readonly string[];
  docsUrl: string;
}

export { parseTableRow, isTableSeparator };
