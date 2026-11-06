package com.hassasin.padsearchingtool;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.plugin.WebView;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * In-app updates from GitHub Releases.
 *
 * Web bundles: a zip of the Vite build is downloaded into {@code filesDir/bundles/<versionCode>/},
 * verified against the SHA-256 from {@code update.json}, and served by Capacitor's local server
 * instead of the assets packaged in the APK ({@link Bridge#setServerBasePath(String)}). The
 * persisted path ({@code CapWebViewSettings.serverBasePath}) is what Capacitor restores on the
 * next launch. A bundle counts as healthy only once the web app calls {@code notifyReady()};
 * if that never happens, {@link #load()} rolls back on the next launch.
 *
 * APKs: downloaded into the cache dir and handed to the system installer through the
 * FileProvider already declared in the manifest.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "AppUpdate";
    private static final String PREFS = "AppUpdate";
    private static final String KEY_CURRENT = "currentVersionCode";
    private static final String KEY_PREVIOUS = "previousVersionCode";
    private static final String KEY_PENDING = "pendingVersionCode";
    private static final String KEY_LAST_BINARY = "lastBinaryVersionCode";
    private static final String KEY_LAST_ROLLBACK = "lastRollbackFrom";

    private static final String ALLOWED_URL_PREFIX = "https://github.com/";
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;
    private static final long MAX_DOWNLOAD_BYTES = 200L * 1024 * 1024;
    private static final long MAX_UNPACKED_BYTES = 200L * 1024 * 1024;
    private static final int MAX_ZIP_ENTRIES = 2_000;
    private static final int PROGRESS_STEP_BYTES = 256 * 1024;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        SharedPreferences prefs = prefs();
        long binary = binaryVersionCode();
        long lastBinary = prefs.getLong(KEY_LAST_BINARY, -1);
        if (lastBinary != binary) {
            // A new APK ships the newest web assets: drop every OTA bundle.
            // Capacitor's own isNewBinary() clears serverBasePath for the same reason.
            deleteRecursive(bundlesDir());
            prefs.edit().clear().putLong(KEY_LAST_BINARY, binary).apply();
            return;
        }

        long pending = prefs.getLong(KEY_PENDING, -1);
        if (pending > 0) {
            // The previous launch switched to a bundle and the web app never confirmed it.
            long current = prefs.getLong(KEY_CURRENT, -1);
            File currentDir = current > 0 ? bundleDir(current) : null;
            String restore = currentDir != null && hasIndex(currentDir) ? currentDir.getAbsolutePath() : "";
            setPersistedServerPath(restore);
            SharedPreferences.Editor editor = prefs.edit().remove(KEY_PENDING).putLong(KEY_LAST_ROLLBACK, pending);
            if (restore.isEmpty()) {
                editor.remove(KEY_CURRENT);
            }
            editor.apply();
            deleteRecursive(bundleDir(pending));
            Logger.warn(TAG, "Rolled back bundle " + pending + " (never confirmed ready)");
            return;
        }

        long current = prefs.getLong(KEY_CURRENT, -1);
        if (current > 0 && !hasIndex(bundleDir(current))) {
            // Storage was cleared or the directory vanished: fall back to the built-in assets.
            setPersistedServerPath("");
            prefs.edit().remove(KEY_CURRENT).remove(KEY_PREVIOUS).apply();
        }
    }

    @Override
    protected void handleOnResume() {
        notifyListeners("appResumed", new JSObject());
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        SharedPreferences prefs = prefs();
        JSObject ret = new JSObject();
        PackageInfo info = packageInfo();
        ret.put("versionName", info != null && info.versionName != null ? info.versionName : "");
        ret.put("versionCode", binaryVersionCode());
        ret.put("nativeApiLevel", BuildConfig.NATIVE_API_LEVEL);
        long current = prefs.getLong(KEY_CURRENT, -1);
        if (current > 0 && hasIndex(bundleDir(current))) {
            ret.put("bundleVersionCode", current);
        } else {
            ret.put("bundleVersionCode", JSObject.NULL);
        }
        long rollback = prefs.getLong(KEY_LAST_ROLLBACK, -1);
        if (rollback > 0) {
            ret.put("lastRollbackFrom", rollback);
        } else {
            ret.put("lastRollbackFrom", JSObject.NULL);
        }
        ret.put("canInstallPackages", canInstallPackages());
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadBundle(PluginCall call) {
        String url = call.getString("url");
        long versionCode = numberArg(call, "versionCode");
        String sha256 = call.getString("sha256");
        long size = numberArg(call, "size");
        if (url == null || versionCode <= 0 || sha256 == null || size <= 0) {
            call.reject("Missing url, versionCode, sha256 or size");
            return;
        }
        if (!isAllowedUrl(url)) {
            call.reject("URL not allowed");
            return;
        }
        final long version = versionCode;
        final long expectedSize = size;
        executor.execute(() -> {
            File dir = bundlesDir();
            File zip = new File(dir, "pending.zip");
            File tmpDir = new File(dir, version + ".tmp");
            File finalDir = bundleDir(version);
            try {
                if (!dir.isDirectory() && !dir.mkdirs()) {
                    throw new IOException("Cannot create bundle directory");
                }
                downloadToFile(url, zip, expectedSize, sha256);
                deleteRecursive(tmpDir);
                unzip(zip, tmpDir);
                if (!hasIndex(tmpDir)) {
                    throw new IOException("Bundle has no index.html");
                }
                deleteRecursive(finalDir);
                if (!tmpDir.renameTo(finalDir)) {
                    throw new IOException("Could not move bundle into place");
                }
                call.resolve();
            } catch (Exception e) {
                Logger.error(TAG, "Bundle download failed", e);
                deleteRecursive(tmpDir);
                call.reject("Bundle download failed: " + e.getMessage(), e);
            } finally {
                //noinspection ResultOfMethodCallIgnored
                zip.delete();
            }
        });
    }

    @PluginMethod
    public void applyBundle(PluginCall call) {
        long versionCode = numberArg(call, "versionCode");
        if (versionCode <= 0) {
            call.reject("Missing versionCode");
            return;
        }
        File dir = bundleDir(versionCode);
        if (!hasIndex(dir)) {
            call.reject("Bundle " + versionCode + " is not downloaded");
            return;
        }
        String path = dir.getAbsolutePath();
        prefs().edit().putLong(KEY_PENDING, versionCode).apply();
        setPersistedServerPath(path);
        call.resolve();
        // Hosts the new directory and reloads the WebView on the UI thread.
        bridge.setServerBasePath(path);
    }

    @PluginMethod
    public void notifyReady(PluginCall call) {
        SharedPreferences prefs = prefs();
        long pending = prefs.getLong(KEY_PENDING, -1);
        if (pending > 0) {
            long current = prefs.getLong(KEY_CURRENT, -1);
            SharedPreferences.Editor editor = prefs.edit().remove(KEY_PENDING).putLong(KEY_CURRENT, pending);
            if (current > 0) {
                editor.putLong(KEY_PREVIOUS, current);
            } else {
                editor.remove(KEY_PREVIOUS);
            }
            editor.apply();
            pruneBundles(pending, current);
        }
        call.resolve();
    }

    @PluginMethod
    public void acknowledgeRollback(PluginCall call) {
        prefs().edit().remove(KEY_LAST_ROLLBACK).apply();
        call.resolve();
    }

    @PluginMethod
    public void rollbackToBuiltin(PluginCall call) {
        setPersistedServerPath("");
        prefs().edit().remove(KEY_CURRENT).remove(KEY_PREVIOUS).remove(KEY_PENDING).apply();
        deleteRecursive(bundlesDir());
        call.resolve();
        bridge.setServerAssetPath(Bridge.DEFAULT_WEB_ASSET_DIR);
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256");
        long size = numberArg(call, "size");
        if (url == null || sha256 == null || size <= 0) {
            call.reject("Missing url, sha256 or size");
            return;
        }
        if (!isAllowedUrl(url)) {
            call.reject("URL not allowed");
            return;
        }
        final long expectedSize = size;
        executor.execute(() -> {
            File dir = apkDir();
            File apk = new File(dir, "update.apk");
            try {
                deleteRecursive(dir);
                if (!dir.mkdirs()) {
                    throw new IOException("Cannot create update directory");
                }
                downloadToFile(url, apk, expectedSize, sha256);
                JSObject ret = new JSObject();
                ret.put("path", apk.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                Logger.error(TAG, "APK download failed", e);
                deleteRecursive(dir);
                call.reject("APK download failed: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String path = call.getString("path");
        File apk = path != null ? new File(path) : null;
        try {
            String allowedRoot = apkDir().getCanonicalPath() + File.separator;
            if (apk == null || !apk.isFile() || !apk.getCanonicalPath().startsWith(allowedRoot)) {
                call.reject("Unknown APK path");
                return;
            }
        } catch (IOException e) {
            call.reject("Unknown APK path", e);
            return;
        }

        JSObject ret = new JSObject();
        if (!canInstallPackages()) {
            Intent settings = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }

        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, APK_MIME);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(intent);
        ret.put("needsPermission", false);
        call.resolve(ret);
    }

    // --- helpers -------------------------------------------------------------------------

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    private File bundlesDir() {
        return new File(getContext().getFilesDir(), "bundles");
    }

    private File bundleDir(long versionCode) {
        return new File(bundlesDir(), Long.toString(versionCode));
    }

    private File apkDir() {
        return new File(getContext().getCacheDir(), "updates");
    }

    private static boolean hasIndex(File dir) {
        return dir != null && new File(dir, "index.html").isFile();
    }

    private static boolean isAllowedUrl(String url) {
        return url.startsWith(ALLOWED_URL_PREFIX);
    }

    /**
     * Numeric option from JS. org.json parses JS integers as Integer (or Double / Long for
     * larger values), so PluginCall.getLong() would return null; accept any Number instead.
     * Returns -1 when missing or not a number.
     */
    private static long numberArg(PluginCall call, String key) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return -1;
    }

    private PackageInfo packageInfo() {
        try {
            return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException e) {
            Logger.error(TAG, "Unable to read package info", e);
            return null;
        }
    }

    private long binaryVersionCode() {
        PackageInfo info = packageInfo();
        if (info == null) {
            return 0;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return info.getLongVersionCode();
        }
        //noinspection deprecation
        return info.versionCode;
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    /** Writes the path Capacitor's Bridge restores on the next launch ("" = built-in assets). */
    private void setPersistedServerPath(String path) {
        SharedPreferences capPrefs = getContext()
            .getSharedPreferences(WebView.WEBVIEW_PREFS_NAME, android.content.Context.MODE_PRIVATE);
        capPrefs.edit().putString(WebView.CAP_SERVER_PATH, path).apply();
    }

    private void pruneBundles(long keepCurrent, long keepPrevious) {
        File[] children = bundlesDir().listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            String name = child.getName();
            if (name.equals(Long.toString(keepCurrent)) || (keepPrevious > 0 && name.equals(Long.toString(keepPrevious)))) {
                continue;
            }
            deleteRecursive(child);
        }
    }

    private void notifyProgress(long received, long total) {
        JSObject data = new JSObject();
        data.put("received", received);
        data.put("total", total);
        notifyListeners("downloadProgress", data);
    }

    private void downloadToFile(String url, File dest, long expectedSize, String expectedSha256)
        throws IOException, NoSuchAlgorithmException {
        if (expectedSize <= 0 || expectedSize > MAX_DOWNLOAD_BYTES) {
            throw new IOException("Unexpected asset size " + expectedSize);
        }
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(READ_TIMEOUT_MS);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("Accept", "application/octet-stream");
        try {
            int status = conn.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + status);
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0;
            long lastNotified = 0;
            try (
                InputStream in = new BufferedInputStream(conn.getInputStream());
                OutputStream out = new BufferedOutputStream(new FileOutputStream(dest))
            ) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    received += n;
                    if (received > expectedSize) {
                        throw new IOException("Asset larger than declared size");
                    }
                    digest.update(buf, 0, n);
                    out.write(buf, 0, n);
                    if (received - lastNotified >= PROGRESS_STEP_BYTES || received == expectedSize) {
                        lastNotified = received;
                        notifyProgress(received, expectedSize);
                    }
                }
            }
            if (received != expectedSize) {
                throw new IOException("Asset size mismatch: " + received + " of " + expectedSize);
            }
            String actual = toHex(digest.digest());
            if (!actual.equals(expectedSha256.toLowerCase(Locale.ROOT))) {
                throw new IOException("Checksum mismatch");
            }
        } finally {
            conn.disconnect();
        }
    }

    private static void unzip(File zip, File destDir) throws IOException {
        if (!destDir.mkdirs() && !destDir.isDirectory()) {
            throw new IOException("Cannot create " + destDir);
        }
        String destRoot = destDir.getCanonicalPath() + File.separator;
        int entries = 0;
        long total = 0;
        try (ZipInputStream zin = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)))) {
            byte[] buf = new byte[64 * 1024];
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                if (++entries > MAX_ZIP_ENTRIES) {
                    throw new IOException("Too many entries in bundle");
                }
                File out = new File(destDir, entry.getName());
                if (!out.getCanonicalPath().startsWith(destRoot)) {
                    throw new IOException("Illegal entry path: " + entry.getName());
                }
                if (entry.isDirectory()) {
                    if (!out.isDirectory() && !out.mkdirs()) {
                        throw new IOException("Cannot create " + out);
                    }
                    zin.closeEntry();
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
                    throw new IOException("Cannot create " + parent);
                }
                try (OutputStream os = new BufferedOutputStream(new FileOutputStream(out))) {
                    int n;
                    while ((n = zin.read(buf)) > 0) {
                        total += n;
                        if (total > MAX_UNPACKED_BYTES) {
                            throw new IOException("Bundle too large when unpacked");
                        }
                        os.write(buf, 0, n);
                    }
                }
                zin.closeEntry();
            }
        }
    }

    private static void deleteRecursive(File file) {
        if (file == null || !file.exists()) {
            return;
        }
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursive(child);
            }
        }
        if (!file.delete()) {
            Logger.warn(TAG, "Could not delete " + file);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.ROOT, "%02x", b));
        }
        return sb.toString();
    }
}
