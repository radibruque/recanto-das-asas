package br.com.recantodasasas.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device-local, opt-in unlock. Only authenticated Keystore ciphertext is persisted. */
@CapacitorPlugin(name = "RecantoBiometrics")
public class RecantoBiometricsPlugin extends Plugin {
    private static final String PREFERENCES = "recanto_biometric_access_v1";
    private static final String ALIAS_PREFIX = "recanto.biometric.login.v1.";
    private CancellationSignal cancellation;
    private PluginCall activeCall;
    private String pendingAlias;
    private byte[] activeSensitive;

    @Override
    public void load() {
        // A process can be killed during opt-in. Remove only unfinished keys from this plugin.
        try {
            String retained = preferences().getString("alias", "");
            KeyStore store = keyStore();
            Enumeration<String> aliases = store.aliases();
            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();
                if (alias.startsWith(ALIAS_PREFIX) && !alias.equals(retained)) store.deleteEntry(alias);
            }
        } catch (Exception ignored) { /* Password login does not depend on biometric storage. */ }
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        return store;
    }

    private int availability() {
        BiometricManager manager = getContext().getSystemService(BiometricManager.class);
        if (manager == null) return BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        }
        // On Android 10, CryptoObject authentication also requires a strong biometric.
        return manager.canAuthenticate();
    }

    private boolean enabled() throws Exception {
        SharedPreferences prefs = preferences();
        String alias = prefs.getString("alias", "");
        return alias.startsWith(ALIAS_PREFIX) && keyStore().containsAlias(alias)
            && !prefs.getString("ciphertext", "").isEmpty() && !prefs.getString("iv", "").isEmpty();
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            int status = availability();
            JSObject result = new JSObject();
            result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
            result.put("enabled", enabled());
            result.put("reason", status == BiometricManager.BIOMETRIC_SUCCESS ? "" :
                status == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ? "Cadastre uma biometria nas configurações do telefone." :
                "A biometria segura não está disponível neste telefone agora. Use a senha da base.");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Não foi possível consultar a biometria. Use a senha da base.", "E_BIOMETRIC_STATUS");
        }
    }

    private SecretKey createKey(String alias) throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder specification = new KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            specification.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            specification.setUserAuthenticationValidityDurationSeconds(-1);
        }
        generator.init(specification.build());
        return generator.generateKey();
    }

    @PluginMethod
    public void enroll(PluginCall call) {
        String password = call.getString("password", "");
        if (password.isEmpty() || password.length() > 1024) {
            call.reject("Informe e confira a senha atual da base.", "E_BIOMETRIC_DATA");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (!begin(call)) return;
            byte[] secret = password.getBytes(StandardCharsets.UTF_8);
            try {
                String alias = ALIAS_PREFIX + UUID.randomUUID();
                pendingAlias = alias;
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, createKey(alias));
                prompt(call, cipher, "Ativar biometria", authenticated -> {
                    byte[] encrypted = authenticated.doFinal(secret);
                    String oldAlias = preferences().getString("alias", "");
                    // Commit the authenticated blob together; cancellation preserves the old enrollment.
                    boolean written = preferences().edit()
                        .putString("alias", alias)
                        .putString("iv", Base64.encodeToString(authenticated.getIV(), Base64.NO_WRAP))
                        .putString("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                        .commit();
                    if (!written) throw new IllegalStateException("Enrollment was not stored");
                    pendingAlias = null;
                    deleteAlias(oldAlias);
                    Arrays.fill(encrypted, (byte) 0);
                    JSObject result = new JSObject();
                    result.put("enabled", true);
                    call.resolve(result);
                }, secret);
            } catch (Exception error) {
                Arrays.fill(secret, (byte) 0);
                rejectActive("Não foi possível ativar a biometria. A senha da base continua disponível.", "E_BIOMETRIC_ENROLL");
            }
        });
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!begin(call)) return;
            try {
                if (!enabled()) throw new IllegalStateException("Not enrolled");
                SharedPreferences prefs = preferences();
                String alias = prefs.getString("alias", "");
                byte[] iv = Base64.decode(prefs.getString("iv", ""), Base64.NO_WRAP);
                byte[] encrypted = Base64.decode(prefs.getString("ciphertext", ""), Base64.NO_WRAP);
                if (iv.length != 12 || encrypted.length < 17 || encrypted.length > 4112) {
                    throw new IllegalStateException("Invalid biometric record");
                }
                SecretKey key = (SecretKey) keyStore().getKey(alias, null);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
                prompt(call, cipher, "Abrir seus registros", authenticated -> {
                    byte[] secret = authenticated.doFinal(encrypted);
                    try {
                        // The existing vault needs the same credential in memory; never write it to disk.
                        JSObject result = new JSObject();
                        result.put("password", new String(secret, StandardCharsets.UTF_8));
                        call.resolve(result);
                    } finally {
                        Arrays.fill(secret, (byte) 0);
                    }
                }, encrypted);
            } catch (Exception error) {
                rejectActive("A biometria precisa ser reativada. Abra com a senha da base e confira Configurações.", "E_BIOMETRIC_KEY");
            }
        });
    }

    private boolean begin(PluginCall call) {
        if (activeCall != null) {
            call.reject("Conclua ou cancele a confirmação de biometria que já está aberta.", "E_BIOMETRIC_BUSY");
            return false;
        }
        try {
            if (availability() != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("A biometria segura não está disponível agora. Use a senha da base.", "E_BIOMETRIC_UNAVAILABLE");
                return false;
            }
        } catch (Exception error) {
            call.reject("A biometria segura não está disponível agora. Use a senha da base.", "E_BIOMETRIC_UNAVAILABLE");
            return false;
        }
        activeCall = call;
        return true;
    }

    private interface AuthenticatedAction { void run(Cipher cipher) throws Exception; }

    private void prompt(PluginCall call, Cipher cipher, String title, AuthenticatedAction action, byte[] sensitive) {
        activeSensitive = sensitive;
        cancellation = new CancellationSignal();
        BiometricPrompt.Builder builder = new BiometricPrompt.Builder(getActivity())
            .setTitle(title)
            .setSubtitle("Recanto das Asas · acesso privado neste telefone")
            .setNegativeButton("Usar senha", getContext().getMainExecutor(), (dialog, which) -> {
                Arrays.fill(sensitive, (byte) 0);
                if (activeCall != call) return;
                rejectActive("Biometria cancelada. Use a senha da base.", "E_BIOMETRIC_CANCELLED");
            });
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        }
        builder.build().authenticate(new BiometricPrompt.CryptoObject(cipher), cancellation,
            getContext().getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    if (activeCall != call) { Arrays.fill(sensitive, (byte) 0); return; }
                    try {
                        BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                        if (crypto == null || crypto.getCipher() == null) throw new IllegalStateException("No authenticated cipher");
                        action.run(crypto.getCipher());
                        finishActive();
                    } catch (Exception error) {
                        rejectActive("Não foi possível confirmar a biometria. Use a senha da base.", "E_BIOMETRIC_CRYPTO");
                    } finally {
                        Arrays.fill(sensitive, (byte) 0);
                    }
                }
                @Override public void onAuthenticationError(int code, CharSequence message) {
                    Arrays.fill(sensitive, (byte) 0);
                    if (activeCall != call) return;
                    boolean cancelled = code == BiometricPrompt.BIOMETRIC_ERROR_CANCELED
                        || code == BiometricPrompt.BIOMETRIC_ERROR_USER_CANCELED;
                    rejectActive(cancelled ? "Biometria cancelada. Use a senha da base." :
                        "Não foi possível autenticar pela biometria. Use a senha da base.",
                        cancelled ? "E_BIOMETRIC_CANCELLED" : "E_BIOMETRIC_AUTH");
                }
                // A failed scan keeps the OS prompt open; only OS success authenticates a cipher.
            });
    }

    private void deleteAlias(String alias) {
        if (!alias.startsWith(ALIAS_PREFIX)) return;
        try { keyStore().deleteEntry(alias); } catch (Exception ignored) { /* Orphaned ciphertext has no public access. */ }
    }

    private void finishActive() {
        if (activeSensitive != null) Arrays.fill(activeSensitive, (byte) 0);
        activeSensitive = null;
        deleteAlias(pendingAlias == null ? "" : pendingAlias);
        pendingAlias = null;
        activeCall = null;
        cancellation = null;
    }

    private void rejectActive(String message, String code) {
        PluginCall call = activeCall;
        finishActive();
        if (call != null) call.reject(message, code);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (activeCall != null) {
                call.reject("Cancele a confirmação aberta antes de remover a biometria.", "E_BIOMETRIC_BUSY");
                return;
            }
            String alias = preferences().getString("alias", "");
            if (!preferences().edit().clear().commit()) {
                call.reject("Não foi possível remover o acesso biométrico. Tente novamente.", "E_BIOMETRIC_REMOVE");
                return;
            }
            deleteAlias(alias);
            JSObject result = new JSObject();
            result.put("enabled", false);
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (cancellation != null) cancellation.cancel();
        rejectActive("A confirmação foi encerrada. Abra novamente com sua senha.", "E_BIOMETRIC_CANCELLED");
    }
}
