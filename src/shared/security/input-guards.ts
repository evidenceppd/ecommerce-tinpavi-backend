export function hasHtmlLikeChars(value: string): boolean {
  return /[<>]/.test(value);
}

export function isSafeTextInput(value: string): boolean {
  return !hasHtmlLikeChars(value);
}
