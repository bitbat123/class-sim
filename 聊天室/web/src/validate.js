// Client-side mirrors of the server rules. The server remains the authority.
export const MAX_NAME_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 2000;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

export function validateName(raw) {
  if (CONTROL_CHARS.test(raw)) return '昵称不能包含控制字符。';
  const name = raw.trim();
  const len = [...name].length;
  if (len < 1 || len > MAX_NAME_LENGTH) return `昵称长度必须为 1-${MAX_NAME_LENGTH} 个字符。`;
  return null;
}

export function validateText(raw) {
  if (raw.trim().length === 0) return '消息不能为空。';
  if ([...raw].length > MAX_MESSAGE_LENGTH) return `消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符。`;
  return null;
}

/**
 * Keyboard policy for the message box:
 * - Enter (without Ctrl) is never a send; the browser inserts a newline.
 * - Ctrl+Enter sends.
 * Returns true only for Ctrl+Enter that is not part of IME composition.
 */
export function isSendShortcut(event) {
  if (event.nativeEvent && event.nativeEvent.isComposing) return false;
  return event.key === 'Enter' && event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
}
