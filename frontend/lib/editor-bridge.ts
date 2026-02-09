const EDITOR_RESULT_KEY = 'editor_result';
const EDITOR_SOURCE_KEY = 'editor_source';

export interface EditorResult {
  url: string;
  mediaType: 'image' | 'video';
  fileName: string;
}

export interface EditorSource {
  url: string;
  serverPath: string;
  mediaType: 'image' | 'video';
}

export function setEditorSource(source: EditorSource): void {
  sessionStorage.setItem(EDITOR_SOURCE_KEY, JSON.stringify(source));
}

export function getEditorSource(): EditorSource | null {
  const raw = sessionStorage.getItem(EDITOR_SOURCE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(EDITOR_SOURCE_KEY);
  return JSON.parse(raw);
}

export function setEditorResult(result: EditorResult): void {
  sessionStorage.setItem(EDITOR_RESULT_KEY, JSON.stringify(result));
}

export function getEditorResult(): EditorResult | null {
  const raw = sessionStorage.getItem(EDITOR_RESULT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(EDITOR_RESULT_KEY);
  return JSON.parse(raw);
}
