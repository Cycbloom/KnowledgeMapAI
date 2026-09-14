package com.knowledgemap.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 应用内自动更新：读取本地版本、下载新 APK 到缓存目录，并通过 FileProvider
 * 拉起系统安装器完成更新。最终安装确认仍由系统完成（Android 不允许普通应用静默安装）。
 *
 * 下载到 app 私有缓存目录（getCacheDir），无需存储权限；file_paths.xml 的
 * cache-path 已覆盖该目录，可被 FileProvider 授权给系统安装器读取。
 */
@CapacitorPlugin(name = "AutoUpdate")
public class AutoUpdatePlugin extends Plugin {

    @PluginMethod
    public void getLocalVersion(PluginCall call) {
        try {
            final var packageInfo = getContext()
                    .getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            final JSObject ret = new JSObject();
            ret.put("versionName", packageInfo.versionName);
            ret.put("versionCode", currentVersionCode(packageInfo));
            call.resolve(ret);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("Local version unavailable", e);
        }
    }

    private int currentVersionCode(android.content.pm.PackageInfo packageInfo) {
        // Android 9 (P) 及以上 versionCode 为 long，需取低 32 位；更早版本用 int versionCode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return (int) packageInfo.getLongVersionCode();
        }
        return packageInfo.versionCode;
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String fileName = call.getString("fileName", "knowledgemap-update.apk");
        if (url == null || url.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        final Context context = getContext();
        new Thread(() -> {
            try {
                final File apk = download(context, url, fileName);
                openInstaller(context, apk);
                call.resolve();
            } catch (Exception e) {
                call.reject("Update failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private File download(Context context, String url, String fileName) throws Exception {
        final File dir = context.getCacheDir();
        final File out = new File(dir, fileName);
        if (out.exists()) {
            //noinspection ResultOfMethodCallIgnored
            out.delete();
        }

        final HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(30000);
        try {
            try (InputStream in = conn.getInputStream();
                 FileOutputStream fos = new FileOutputStream(out)) {
                final byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    fos.write(buffer, 0, bytesRead);
                }
            }
        } finally {
            conn.disconnect();
        }
        return out;
    }

    private void openInstaller(Context context, File apk) {
        final Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apk);
        final Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.setClipData(ClipData.newRawUri("", apkUri));
        context.startActivity(intent);
    }
}