package ir.javanrood.ngo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 7010;
    private static final int PERMISSION_REQUEST = 7011;
    private static final int CREATE_DOCUMENT_REQUEST = 7012;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraImageUri;
    private String pendingSaveFileName;
    private String pendingSaveMimeType;
    private String pendingSaveBase64;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#061A2F"));
            getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#061A2F"));
        }
        requestBasicPermissions();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }

        webView.addJavascriptInterface(new NativeBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent cameraIntent = buildCameraIntent();
                boolean captureOnly = params != null && params.isCaptureEnabled();
                if (captureOnly && cameraIntent != null && hasCameraPermission()) {
                    try {
                        startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                        return true;
                    } catch (ActivityNotFoundException ignored) {
                        // fallback to normal chooser
                    }
                }

                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("*/*");
                contentIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/json",
                        "text/plain",
                        "text/csv",
                        "application/csv",
                        "application/pdf",
                        "image/*",
                        "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.ms-excel",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/vnd.ms-excel.sheet.macroEnabled.12",
                        "application/octet-stream"
                });

                Intent chooser = new Intent(Intent.ACTION_CHOOSER);
                chooser.putExtra(Intent.EXTRA_INTENT, contentIntent);
                chooser.putExtra(Intent.EXTRA_TITLE, "انتخاب فایل یا گرفتن عکس");
                if (cameraIntent != null && hasCameraPermission()) {
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                try {
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "انتخاب‌گر فایل در دستگاه پیدا نشد.", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        webView.clearCache(true);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestBasicPermissions() {
        ArrayList<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST);
        }
    }

    private Intent buildCameraIntent() {
        try {
            Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            if (cameraIntent.resolveActivity(getPackageManager()) == null) {
                return null;
            }
            File photoFile = createImageFile();
            cameraImageUri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    photoFile
            );
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return cameraIntent;
        } catch (Exception ignored) {
            return null;
        }
    }

    private File createImageFile() throws IOException {
        File dir = new File(getExternalCacheDir(), "camera");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return File.createTempFile("scan_", ".jpg", dir);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data == null || data.getData() == null) {
                    if (cameraImageUri != null) {
                        results = new Uri[]{cameraImageUri};
                    }
                } else {
                    results = new Uri[]{data.getData()};
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            cameraImageUri = null;
            return;
        }
        if (requestCode == CREATE_DOCUMENT_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri targetUri = data.getData();
                try {
                    writeBase64ToUri(targetUri, pendingSaveBase64);
                    Toast.makeText(MainActivity.this, "فایل با موفقیت ذخیره شد.", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "خطا در ذخیره فایل: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            } else {
                Toast.makeText(MainActivity.this, "ذخیره فایل لغو شد.", Toast.LENGTH_SHORT).show();
            }
            pendingSaveFileName = null;
            pendingSaveMimeType = null;
            pendingSaveBase64 = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    public class NativeBridge {
        @JavascriptInterface
        public String saveBase64File(String fileName, String mimeType, String base64Data) {
            try {
                File outFile = writeBase64ToFile(fileName, mimeType, base64Data, false);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "فایل ذخیره شد: " + outFile.getAbsolutePath(), Toast.LENGTH_LONG).show());
                return outFile.getAbsolutePath();
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "خطا در ذخیره فایل: " + e.getMessage(), Toast.LENGTH_LONG).show());
                return "";
            }
        }

        @JavascriptInterface
        public boolean openBase64File(String fileName, String mimeType, String base64Data) {
            try {
                File outFile = writeBase64ToFile(fileName, mimeType, base64Data, true);
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", outFile);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, mimeType == null || mimeType.isEmpty() ? "application/octet-stream" : mimeType);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(intent);
                    return true;
                } catch (ActivityNotFoundException e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "برنامه‌ای برای نمایش این فایل پیدا نشد. از گزینه ذخیره استفاده کنید.", Toast.LENGTH_LONG).show());
                    return false;
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "خطا در نمایش فایل: " + e.getMessage(), Toast.LENGTH_LONG).show());
                return false;
            }
        }

        @JavascriptInterface
        public void saveBase64FileWithPicker(String fileName, String mimeType, String base64Data) {
            runOnUiThread(() -> {
                try {
                    pendingSaveFileName = fileName == null ? "export.bin" : fileName.replaceAll("[\\/:*?\"<>|]+", "_");
                    pendingSaveMimeType = (mimeType == null || mimeType.trim().isEmpty()) ? "application/octet-stream" : mimeType;
                    pendingSaveBase64 = base64Data;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingSaveMimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingSaveFileName);
                    startActivityForResult(intent, CREATE_DOCUMENT_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "باز کردن انتخاب‌گر ذخیره فایل ممکن نشد: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public String appVersion() {
            return "Javanrood Android Client V34";
        }
    }

    private File writeBase64ToFile(String fileName, String mimeType, String base64Data, boolean cache) throws IOException {
        String safeName = fileName == null ? "attachment" : fileName.replaceAll("[\\\\/:*?\"<>|]+", "_");
        File dir = cache
                ? new File(getExternalCacheDir(), "JavanroodPreview")
                : new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "JavanroodExports");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        File outFile = new File(dir, safeName);
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        FileOutputStream fos = new FileOutputStream(outFile);
        fos.write(bytes);
        fos.flush();
        fos.close();
        return outFile;
    }
    private void writeBase64ToUri(Uri uri, String base64Data) throws IOException {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        try (java.io.OutputStream os = getContentResolver().openOutputStream(uri, "w")) {
            if (os == null) throw new IOException("مسیر ذخیره‌سازی در دسترس نیست.");
            os.write(bytes);
            os.flush();
        }
    }

}
