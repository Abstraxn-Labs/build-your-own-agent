'use client';

import type { ReactNode } from 'react';
import { isTableSeparator, parseTableRow } from './chat-utils.js';

/** Render plain text plus simple markdown pipe tables from the model reply. */
export function MessageBody({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const lines = text.split('\n');
  let textBuffer: string[] = [];
  let index = 0;

  const flushText = () => {
    if (!textBuffer.length) return;
    nodes.push(
      <span key={`text-${index}`} style={{ whiteSpace: 'pre-wrap' }}>
        {textBuffer.join('\n')}
      </span>,
    );
    textBuffer = [];
    index += 1;
  };

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    if (!line) {
      lineIndex += 1;
      continue;
    }
    const nextLine = lines[lineIndex + 1];

    if (line.trim().startsWith('|') && nextLine && isTableSeparator(nextLine)) {
      flushText();
      const headers = parseTableRow(line);
      lineIndex += 2;
      const rows: string[][] = [];

      while (lineIndex < lines.length) {
        const rowLine = lines[lineIndex];
        if (!rowLine?.trim().startsWith('|')) break;
        rows.push(parseTableRow(rowLine));
        lineIndex += 1;
      }

      nodes.push(
        <div key={`table-${index}`} className="msg-table-wrap">
          <table className="msg-table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index += 1;
      continue;
    }

    textBuffer.push(line);
    lineIndex += 1;
  }

  flushText();
  return <>{nodes}</>;
}
