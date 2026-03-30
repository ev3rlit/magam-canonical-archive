import { getShortcutCommand } from './commands';
import { resolveShortcutCommandId } from './keymap';
import { normalizeKeyEvent } from './normalizeKeyEvent';
import type { ShortcutDispatchResult, ShortcutKeyboardEventLike, ShortcutPhase } from './types';

export function dispatchShortcut(input: {
  event: ShortcutKeyboardEventLike;
  isTypingTarget: boolean;
  phase: ShortcutPhase;
}): ShortcutDispatchResult {
  const normalized = normalizeKeyEvent(input.event, input.phase);
  if (!normalized) {
    return {
      commandId: null,
      handled: false,
      preventDefault: false,
    };
  }

  const commandId = resolveShortcutCommandId(normalized);
  if (!commandId) {
    return {
      commandId: null,
      handled: false,
      preventDefault: false,
    };
  }

  const command = getShortcutCommand(commandId);
  if (input.isTypingTarget && !command.allowWhileTyping) {
    return {
      commandId,
      handled: false,
      preventDefault: false,
    };
  }

  command.execute(normalized);
  return {
    commandId,
    handled: true,
    preventDefault: command.preventDefault ?? true,
  };
}
