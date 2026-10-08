/** Private encrypted snapshot protocol. The caller persists the outbox before upload. */
export type SyncEnvelope = {
  schemaVersion: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
};

export type SyncSnapshot = {
  workspaceId: string;
  revision: number;
  updatedAt: string | null;
  envelope: SyncEnvelope | null;
};

export type SyncOperation = {
  expectedRevision: number;
  operationId: string;
  envelope: SyncEnvelope;
};

export type SyncUploadResult = {
  workspaceId: string;
  /** Revision accepted for this operation, including on a retry. */
  revision: number;
  currentRevision: number;
  updatedAt: string;
  duplicate: boolean;
};

export class SyncHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'SyncHttpError';
  }
  get retryable(): boolean { return this.status === 408 || this.status === 429 || this.status >= 500; }
}

export class SyncConflictError extends SyncHttpError {
  constructor(public readonly snapshot: SyncSnapshot) {
    super(409, 'REVISION_CONFLICT', 'Outro aparelho alterou os registros. Revise o conflito antes de sincronizar.');
    this.name = 'SyncConflictError';
  }
}

export class SyncTransportError extends Error {
  readonly retryable = true;
  constructor(message = 'Não foi possível conectar ao servidor privado. A alteração permanece na fila local.') {
    super(message);
    this.name = 'SyncTransportError';
  }
}

const MAX_BYTES = 64 * 1024 * 1024;
const workspacePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
const operationPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{15,127}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const validBase64 = (value: unknown, minimumBytes: number, exactBytes?: number): boolean => {
  if (typeof value !== 'string' || !value.length || value.length > MAX_BYTES || value.length % 4) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const body = value.slice(0, value.length - padding);
  // Repeated regex groups overflow the JS engine stack for valid multi-megabyte attachments.
  if (!body.length || /[^A-Za-z0-9+/]/.test(body)) return false;
  const tail = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(body.at(-1)!);
  if ((padding === 2 && tail % 16 !== 0) || (padding === 1 && tail % 4 !== 0)) return false;
  const bytes = value.length / 4 * 3 - padding;
  return bytes >= minimumBytes && (exactBytes === undefined || bytes === exactBytes);
};

export function isSyncEnvelope(value: unknown): value is SyncEnvelope {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'ciphertext,iterations,iv,salt,schemaVersion') return false;
  return value.schemaVersion === 1 && validBase64(value.salt, 16) && validBase64(value.iv, 12, 12)
    && validBase64(value.ciphertext, 16) && Number.isSafeInteger(value.iterations)
    && Number(value.iterations) >= 100_000 && Number(value.iterations) <= 2_000_000;
}

function isSnapshot(value: unknown, workspaceId: string): value is SyncSnapshot {
  return isRecord(value) && value.workspaceId === workspaceId && revision(value.revision)
    && (value.updatedAt === null || (typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))))
    && (value.envelope === null ? value.revision === 0 : value.revision !== 0 && isSyncEnvelope(value.envelope));
}

export type SyncClientOptions = {
  url: string;
  token: string;
  workspaceId?: string;
  timeoutMs?: number;
};

/** One request per call. Retry the exact persisted operationId and envelope after failure. */
export class SyncClient {
  private readonly baseUrl: string;
  private readonly token: string;
  readonly workspaceId: string;
  private readonly timeoutMs: number;

  constructor(options: SyncClientOptions) {
    let url: URL;
    try { url = new URL(options.url); } catch { throw new Error('Informe uma URL válida para o servidor privado.'); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
      throw new Error('A sincronização exige HTTPS; HTTP é permitido somente no próprio computador para desenvolvimento.');
    }
    if (url.username || url.password || url.search || url.hash) throw new Error('A URL não pode conter credenciais, parâmetros ou fragmentos.');
    if (typeof options.token !== 'string' || options.token.length < 32 || /[\r\n]/.test(options.token)) throw new Error('Informe o token privado de pelo menos 32 caracteres nas configurações locais.');
    this.workspaceId = options.workspaceId ?? 'principal';
    if (!workspacePattern.test(this.workspaceId)) throw new Error('Identificação do espaço inválida: use de 3 a 64 letras, números, hífen ou sublinhado.');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000) throw new Error('Tempo limite inválido para sincronização.');
    this.baseUrl = url.href.replace(/\/+$/, '');
    this.token = options.token;
  }

  async download(): Promise<SyncSnapshot> {
    const data = await this.request('GET');
    if (!isSnapshot(data, this.workspaceId)) throw new SyncHttpError(502, 'INVALID_RESPONSE', 'O servidor retornou uma versão de dados inválida.');
    return data;
  }

  async upload(operation: SyncOperation): Promise<SyncUploadResult> {
    if (!revision(operation.expectedRevision) || !operationPattern.test(operation.operationId) || !isSyncEnvelope(operation.envelope)) {
      throw new Error('Operação inválida. Preserve a identificação, a revisão e o conteúdo criptografado da fila.');
    }
    const body = JSON.stringify(operation);
    if (new TextEncoder().encode(body).length > MAX_BYTES) throw new SyncHttpError(413, 'BODY_TOO_LARGE', 'A sincronização aceita até 64 MiB por envio.');
    const data = await this.request('PUT', body);
    if (!isRecord(data) || data.workspaceId !== this.workspaceId || !revision(data.revision) || !revision(data.currentRevision)
      || data.revision < 1 || data.currentRevision < data.revision || typeof data.duplicate !== 'boolean'
      || typeof data.updatedAt !== 'string' || Number.isNaN(Date.parse(data.updatedAt))) {
      throw new SyncHttpError(502, 'INVALID_RESPONSE', 'O servidor retornou uma confirmação inválida. Mantenha a operação na fila.');
    }
    return data as SyncUploadResult;
  }

  private async request(method: 'GET' | 'PUT', body?: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/workspace/${encodeURIComponent(this.workspaceId)}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body,
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      });
      if (Number(response.headers.get('Content-Length') ?? 0) > MAX_BYTES + 4096) {
        await response.body?.cancel();
        throw new SyncHttpError(502, 'INVALID_RESPONSE', 'A resposta do servidor ultrapassou o limite seguro.');
      }
      const reader = response.body?.getReader();
      let length = 0;
      const chunks: Uint8Array[] = [];
      if (reader) {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > MAX_BYTES + 4096) {
            await reader.cancel();
            throw new SyncHttpError(502, 'INVALID_RESPONSE', 'A resposta do servidor ultrapassou o limite seguro.');
          }
          chunks.push(chunk.value);
        }
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let data: unknown;
      try { data = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { throw new SyncHttpError(response.status || 502, 'INVALID_RESPONSE', 'O servidor privado retornou uma resposta inválida.'); }
      if (!response.ok) {
        if (response.status === 409 && isRecord(data) && data.error === 'REVISION_CONFLICT' && isSnapshot(data.snapshot, this.workspaceId)) {
          throw new SyncConflictError(data.snapshot);
        }
        const code = isRecord(data) && typeof data.error === 'string' ? data.error : 'REQUEST_FAILED';
        const message = response.status === 401 ? 'O token privado não foi aceito. Verifique as configurações locais.'
          : code === 'OPERATION_ID_REUSED' ? 'Esta identificação de operação já foi usada com outro conteúdo. A fila não foi alterada.'
          : response.status === 413 ? 'O arquivo criptografado ultrapassou o limite de 64 MiB do servidor.'
          : 'O servidor não confirmou a sincronização. Preserve a alteração local e tente novamente após verificar a configuração.';
        throw new SyncHttpError(response.status, code, message);
      }
      return data;
    } catch (error) {
      if (error instanceof SyncHttpError) throw error;
      throw new SyncTransportError(controller.signal.aborted ? 'O servidor não respondeu a tempo. A alteração permanece na fila local.' : undefined);
    } finally { clearTimeout(timer); }
  }
}
