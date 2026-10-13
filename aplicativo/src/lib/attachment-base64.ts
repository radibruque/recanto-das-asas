/** Shared attachment limit and linear decoder; no UI or document-parser imports. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export function decodeAttachmentBase64(value: string): Uint8Array {
  if (value.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) throw new Error('O arquivo excede 10 MB.');
  let valid = value.length > 0 && value.length % 4 === 0;
  if (valid) {
    const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
    for (let index = 0; index < value.length - padding; index++) {
      const code = value.charCodeAt(index);
      if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 43 || code === 47)) {
        valid = false; break;
      }
    }
  }
  if (!valid) throw new Error('Conteúdo do arquivo inválido.');
  const binary = atob(value), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
