import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Session-only presentation data. Never store domain records, files or credentials. */
export type UiContextValue = string | number | boolean | null | UiContextValue[] | { [key: string]: UiContextValue };
export type UiContext = Map<string, unknown>;

const forbiddenFields = new Set(['schemaversion', 'revision', 'scope', 'base64', 'ciphertext', 'envelope', 'password', 'token', 'state', 'props', 'pdfbytes', 'pdfurl']);
const fieldName = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

function safeValue(value: unknown, depth = 0, seen = new Set<object>()): value is UiContextValue {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 16384 && !/^(?:data:|blob:)/i.test(value);
  if (typeof value !== 'object' || depth > 6 || seen.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = Object.entries(descriptors).filter(([name]) => !(Array.isArray(value) && name === 'length'));
  const valid = entries.length <= 128 && entries.every(([name, descriptor]) => !forbiddenFields.has(fieldName(name)) && 'value' in descriptor && safeValue(descriptor.value, depth + 1, seen));
  seen.delete(value);
  return valid;
}

function copy<T extends UiContextValue>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copy(item)) as T;
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  return value;
}

export function readUiContext<T extends UiContextValue>(context: UiContext | undefined, key: string, initial: T | (() => T)): T {
  const saved = context?.get(key);
  if (context?.has(key) && safeValue(saved)) return copy(saved) as T;
  // Unexpected values cannot become a retained domain snapshot or file payload.
  if (context?.has(key)) context.delete(key);
  const fallback = typeof initial === 'function' ? initial() : initial;
  if (!safeValue(fallback)) throw new TypeError('O contexto visual aceita somente filtros, identificadores e valores simples.');
  return copy(fallback);
}

export function writeUiContext<T extends UiContextValue>(context: UiContext | undefined, key: string, value: T): void {
  if (forbiddenFields.has(fieldName(key)) || !safeValue(value)) throw new TypeError('Arquivos, registros completos e credenciais não pertencem ao contexto visual.');
  context?.set(key, copy(value));
}

export function useUiState(context: UiContext | undefined, key: string, initial: string | (() => string)): [string, Dispatch<SetStateAction<string>>];
export function useUiState(context: UiContext | undefined, key: string, initial: number | (() => number)): [number, Dispatch<SetStateAction<number>>];
export function useUiState(context: UiContext | undefined, key: string, initial: boolean | (() => boolean)): [boolean, Dispatch<SetStateAction<boolean>>];
export function useUiState<T extends UiContextValue>(context: UiContext | undefined, key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
export function useUiState<T extends UiContextValue>(context: UiContext | undefined, key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readUiContext(context, key, initial));
  useEffect(() => { writeUiContext(context, key, value); }, [context, key, value]);
  const update = useCallback<Dispatch<SetStateAction<T>>>(action => {
    setValue(previous => {
      const next = typeof action === 'function' ? action(previous) : action;
      writeUiContext(context, key, next);
      return next;
    });
  }, [context, key]);
  return [value, update];
}

type UiRoute<T extends UiContextValue> = { request: number; value: T };

/** At most forty lightweight route snapshots, matching the navigation history. */
export function rememberUiRoute<T extends UiContextValue>(context: UiContext | undefined, namespace: string, request: number | null | undefined, value: T, limit = 40): void {
  if (!context || request == null || !Number.isSafeInteger(request)) return;
  const key = 'routes:' + namespace;
  const routes = readUiContext<UiRoute<T>[]>(context, key, []).filter(route => route.request !== request);
  routes.push({ request, value });
  const retention = Number.isFinite(limit) ? Math.max(1, Math.min(40, Math.floor(limit))) : 40;
  writeUiContext(context, key, routes.slice(-retention));
}

export function recallUiRoute<T extends UiContextValue>(context: UiContext | undefined, namespace: string, request: number | null | undefined): T | undefined {
  if (!context || request == null) return undefined;
  return readUiContext<UiRoute<T>[]>(context, 'routes:' + namespace, []).find(route => route.request === request)?.value;
}
