import { FATAL_PREFIX, SYS_PREFIX } from './gameEngine';

export type TerminalMessageKind = 'command' | 'system' | 'fatal' | 'narrative';

export interface TerminalMessage {
  kind: TerminalMessageKind;
  text: string;
  raw: string;
}

export function classifyTerminalMessage(raw: string): TerminalMessage {
  if (raw.startsWith('>')) {
    return { kind: 'command', text: raw, raw };
  }
  if (raw.startsWith(SYS_PREFIX)) {
    return { kind: 'system', text: raw.slice(SYS_PREFIX.length), raw };
  }
  if (raw.startsWith(FATAL_PREFIX)) {
    return { kind: 'fatal', text: raw.slice(FATAL_PREFIX.length), raw };
  }
  return { kind: 'narrative', text: raw, raw };
}
