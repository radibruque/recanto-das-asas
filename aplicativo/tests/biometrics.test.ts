import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: 'android', isNative: true,
  biometrics: { status: vi.fn(), enroll: vi.fn(), unlock: vi.fn(), disable: vi.fn() },
  navigation: { addListener: vi.fn(), minimizeApp: vi.fn(), finishApp: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative, getPlatform: () => native.platform },
  registerPlugin: (name: string) => name === 'RecantoBiometrics' ? native.biometrics : native.navigation,
}));
import { biometricErrorMessage, biometricStatus, disableBiometrics, enableBiometrics, finishNativeApp, minimizeNativeApp, unlockWithBiometrics, watchNativeBack } from '../src/lib/biometrics';

const password = 'senha-ficticia-apenas-do-teste';
beforeEach(() => {
  native.platform = 'android'; native.isNative = true;
  for (const method of [...Object.values(native.biometrics), ...Object.values(native.navigation)]) method.mockReset();
  native.biometrics.status.mockResolvedValue({ available: true, enabled: true, reason: '' });
  native.biometrics.enroll.mockResolvedValue({ enabled: true });
  native.biometrics.unlock.mockResolvedValue({ password });
  native.biometrics.disable.mockResolvedValue({ enabled: false });
  native.navigation.minimizeApp.mockResolvedValue({ minimized: true });
  native.navigation.finishApp.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('biometria privada e opt-in no Android', () => {
  it.each(['web', 'desktop'])('keeps %s password-only and never transfers credentials to an unsupported bridge', async platform => {
    native.platform = platform; native.isNative = false;
    expect(await biometricStatus()).toMatchObject({ available: false, enabled: false });
    const validate = vi.fn(), unlock = vi.fn();
    await expect(enableBiometrics(password, validate)).rejects.toThrow(/somente.*Android/);
    await expect(unlockWithBiometrics(unlock)).rejects.toThrow(/somente.*Android/);
    await expect(disableBiometrics()).rejects.toThrow(/somente.*Android/);
    expect(validate).not.toHaveBeenCalled(); expect(unlock).not.toHaveBeenCalled();
    for (const method of Object.values(native.biometrics)) expect(method).not.toHaveBeenCalled();
  });
  it('checks the actual base password before enrollment, then waits for native biometric confirmation', async () => {
    const events: string[] = [];
    const validate = vi.fn(async (candidate: string) => { expect(candidate).toBe(password); events.push('password-verified'); });
    native.biometrics.enroll.mockImplementation(async () => { events.push('native-prompt-confirmed'); return { enabled: true }; });
    await enableBiometrics(password, validate);
    expect(native.biometrics.enroll).toHaveBeenCalledExactlyOnceWith({ password });
    expect(events).toEqual(['password-verified', 'native-prompt-confirmed']);
  });
  it('does not replace enrollment when the password belongs to a different base', async () => {
    const validate = vi.fn().mockRejectedValue(new Error('Senha incorreta ou arquivo danificado.'));
    await expect(enableBiometrics(password, validate)).rejects.toThrow(/Senha incorreta/);
    expect(native.biometrics.enroll).not.toHaveBeenCalled();
  });
  it('requires vault verification after a successful OS authentication instead of trusting native success alone', async () => {
    const unlock = vi.fn().mockRejectedValue(new Error('Senha incorreta ou arquivo danificado.'));
    await expect(unlockWithBiometrics(unlock)).rejects.toThrow(/Senha incorreta/);
    expect(unlock).toHaveBeenCalledExactlyOnceWith(password);
    expect(native.biometrics.enroll).not.toHaveBeenCalled();
  });
  it.each(['E_BIOMETRIC_CANCELLED', 'E_BIOMETRIC_KEY', 'E_BIOMETRIC_UNAVAILABLE'])('preserves password fallback after %s without passing a secret or auto-enrolling', async code => {
    native.biometrics.unlock.mockRejectedValue({ code, message: `private error ${password}` });
    const unlock = vi.fn();
    await expect(unlockWithBiometrics(unlock)).rejects.toThrow(/senha/);
    expect(unlock).not.toHaveBeenCalled(); expect(native.biometrics.enroll).not.toHaveBeenCalled();
    expect(biometricErrorMessage({ code, message: password })).not.toContain(password);
  });
  it.each([{ password: '' }, { password: 123 }, {}, { password: 'x'.repeat(1025) }])('never opens a vault for a malformed bridge credential', async result => {
    native.biometrics.unlock.mockResolvedValue(result);
    const unlock = vi.fn();
    await expect(unlockWithBiometrics(unlock)).rejects.toThrow(/senha da base/);
    expect(unlock).not.toHaveBeenCalled();
  });
  it('reports an unavailable native bridge without enabling an illustrative login control', async () => {
    native.biometrics.status.mockRejectedValue(new Error(password));
    const result = await biometricStatus();
    expect(result).toMatchObject({ available: false, enabled: false });
    expect(result.reason).not.toContain(password);
  });
  it('never considers enrollment or deletion successful unless native persistence confirms it', async () => {
    native.biometrics.enroll.mockResolvedValue({ enabled: false });
    await expect(enableBiometrics(password, async () => {})).rejects.toThrow(/Não foi possível/);
    native.biometrics.disable.mockResolvedValue({ enabled: true });
    await expect(disableBiometrics()).rejects.toThrow(/Não foi possível/);
  });
  it('does not touch web storage when unlocking, enrolling or removing a biometric credential', async () => {
    const fail = () => { throw new Error('Biometric secrets must never access web storage'); };
    vi.stubGlobal('localStorage', { getItem: fail, setItem: fail, removeItem: fail });
    vi.stubGlobal('sessionStorage', { getItem: fail, setItem: fail, removeItem: fail });
    const unlock = vi.fn().mockResolvedValue(undefined);
    await enableBiometrics(password, async () => {});
    await unlockWithBiometrics(unlock);
    await disableBiometrics();
    expect(unlock).toHaveBeenCalledExactlyOnceWith(password);
  });
});

describe('navegação nativa sem destruir a sessão ao minimizar', () => {
  it('dispatches a secret-free Back event and removes its listener on cleanup', async () => {
    const target = new EventTarget(), remove = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('window', target);
    let dispatch: () => void = () => {};
    native.navigation.addListener.mockImplementation(async (event: string, callback: () => void) => {
      expect(event).toBe('backRequested'); dispatch = callback; return { remove };
    });
    const received: Event[] = []; target.addEventListener('recanto:native-back', event => received.push(event));
    const cleanup = await watchNativeBack(); dispatch();
    expect(received).toHaveLength(1); expect(received[0].type).toBe('recanto:native-back');
    expect('detail' in received[0]).toBe(false);
    cleanup(); expect(remove).toHaveBeenCalledOnce();
  });
  it('minimizes without calling finish or any biometric method', async () => {
    await minimizeNativeApp();
    expect(native.navigation.minimizeApp).toHaveBeenCalledOnce();
    expect(native.navigation.finishApp).not.toHaveBeenCalled();
    for (const method of Object.values(native.biometrics)) expect(method).not.toHaveBeenCalled();
  });
  it('finishes only when the explicit exit method is called', async () => {
    await finishNativeApp();
    expect(native.navigation.finishApp).toHaveBeenCalledOnce();
    expect(native.navigation.minimizeApp).not.toHaveBeenCalled();
  });
  it('does not intercept browser Back', async () => {
    native.platform = 'web'; native.isNative = false;
    const cleanup = await watchNativeBack(); cleanup();
    expect(native.navigation.addListener).not.toHaveBeenCalled();
  });
});
