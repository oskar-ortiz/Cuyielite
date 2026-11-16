package co.ucc.cuyielite;

import android.content.SharedPreferences;
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

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Guarda el secreto de renovación cifrado con una clave AES del Android Keystore.
 * El ciphertext vive en SharedPreferences privadas; la clave no sale del Keystore.
 */
@CapacitorPlugin(name = "SecureSession")
public class SecureSessionPlugin extends Plugin {
    private static final String PREFS = "cuyielite_secure_session";
    private static final String KEY_ALIAS = "cuyielite_session_key";
    private static final String VALUE_KEY = "session";
    private static final String IV_KEY = "session_iv";
    private static final String KEYSTORE = "AndroidKeyStore";

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                KEYSTORE
            );
            generator.init(
                new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build()
            );
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY_ALIAS, null);
    }

    @PluginMethod
    public void save(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("Valor de sesión requerido");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            preferences()
                .edit()
                .putString(VALUE_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(IV_KEY, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .commit();
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception error) {
            call.reject("No se pudo guardar la sesión", error);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        SharedPreferences prefs = preferences();
        String encoded = prefs.getString(VALUE_KEY, null);
        String iv = prefs.getString(IV_KEY, null);
        if (encoded == null || iv == null) {
            call.resolve(new JSObject().put("value", org.json.JSONObject.NULL));
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key(),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
            );
            byte[] plain = cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP));
            call.resolve(new JSObject().put("value", new String(plain, StandardCharsets.UTF_8)));
        } catch (Exception error) {
            prefs.edit().clear().commit();
            call.resolve(new JSObject().put("value", org.json.JSONObject.NULL));
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().clear().commit();
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // El ciphertext ya se borró; una clave huérfana no expone la sesión.
        }
        call.resolve(new JSObject().put("ok", true));
    }
}
