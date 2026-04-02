import type { NormalizedShortcutInput, ShortcutBinding, ShortcutCommandId, ShortcutPhase } from './types';

export const defaultEditorKeymap: ShortcutBinding[] = [
  { phase: 'down', commandId: 'editor.clear-selection-context', chords: ['Escape'] },
  { phase: 'down', commandId: 'editor.undo', chords: ['Mod+Z'] },
  { phase: 'down', commandId: 'editor.redo', chords: ['Mod+Shift+Z'] },
  { phase: 'down', commandId: 'canvas.pan-temporary.start', chords: ['Space'] },
  { phase: 'down', commandId: 'selection.copy', chords: ['Mod+C'] },
  { phase: 'down', commandId: 'selection.paste', chords: ['Mod+V'] },
  { phase: 'down', commandId: 'selection.delete', chords: ['Delete', 'Backspace'] },
  { phase: 'down', commandId: 'selection.duplicate', chords: ['Mod+D'] },
  { phase: 'down', commandId: 'selection.group', chords: ['Mod+G'] },
  { phase: 'down', commandId: 'selection.ungroup', chords: ['Mod+Shift+G'] },
  { phase: 'down', commandId: 'viewport.zoom.in', chords: ['Mod+=', 'Mod++', 'Mod+NumpadAdd'] },
  { phase: 'down', commandId: 'viewport.zoom.out', chords: ['Mod+-', 'Mod+NumpadSubtract'] },
  { phase: 'up', commandId: 'canvas.pan-temporary.end', chords: ['Space'] },
];

const shortcutLookup = defaultEditorKeymap.reduce((lookup, binding) => {
  binding.chords.forEach((chord) => {
    lookup.set(`${binding.phase}:${chord}`, binding.commandId);
  });
  return lookup;
}, new Map<string, ShortcutCommandId>());

export function resolveShortcutCommandId(input: NormalizedShortcutInput) {
  return shortcutLookup.get(`${input.phase}:${input.chord}`) ?? null;
}
