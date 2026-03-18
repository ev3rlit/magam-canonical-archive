import type { CanvasKeyboardFeedback } from './types';

export type CanvasKeyboardFeedbackMessageKey =
  | 'selection.focus-next-washi.success'
  | 'selection.focus-next-washi.empty'
  | 'selection.select-all-washi.success'
  | 'selection.select-all-washi.empty'
  | 'clipboard.copy.success'
  | 'clipboard.copy.failure'
  | 'clipboard.paste.invalid'
  | 'clipboard.paste.failure'
  | 'history.undo.success'
  | 'history.undo.failure'
  | 'history.redo.success'
  | 'history.redo.failure';

export interface CanvasKeyboardResolvedFeedback extends CanvasKeyboardFeedback {
  defaultMessage: string;
}

type FeedbackTemplateResolver = (
  params: CanvasKeyboardFeedback['params'],
) => string;

const FEEDBACK_TEMPLATE_BY_KEY: Record<
  CanvasKeyboardFeedbackMessageKey,
  FeedbackTemplateResolver
> = {
  'selection.focus-next-washi.success': () => 'Moved focus to the next washi node.',
  'selection.focus-next-washi.empty': () => 'No washi nodes are available.',
  'selection.select-all-washi.success': (params) => {
    const count = typeof params?.count === 'number' ? params.count : 0;
    return `Selected ${count} washi node${count === 1 ? '' : 's'}.`;
  },
  'selection.select-all-washi.empty': () => 'No washi nodes are available.',
  'clipboard.copy.success': () => 'Copied the current selection to the clipboard.',
  'clipboard.copy.failure': () => 'Failed to copy the current selection.',
  'clipboard.paste.invalid': () => 'Skipped paste because the clipboard payload is invalid.',
  'clipboard.paste.failure': () => 'Failed to paste the current clipboard payload.',
  'history.undo.success': () => 'Undid the latest edit step.',
  'history.undo.failure': () => 'Failed to undo the latest edit step.',
  'history.redo.success': () => 'Redid the latest edit step.',
  'history.redo.failure': () => 'Failed to redo the latest edit step.',
};

export function resolveCanvasKeyboardFeedback(
  feedback: CanvasKeyboardFeedback,
): CanvasKeyboardResolvedFeedback {
  if (typeof feedback.defaultMessage === 'string' && feedback.defaultMessage.length > 0) {
    return {
      ...feedback,
      defaultMessage: feedback.defaultMessage,
    };
  }

  const template = FEEDBACK_TEMPLATE_BY_KEY[
    feedback.messageKey as CanvasKeyboardFeedbackMessageKey
  ];

  return {
    ...feedback,
    defaultMessage: template
      ? template(feedback.params)
      : feedback.messageKey,
  };
}
