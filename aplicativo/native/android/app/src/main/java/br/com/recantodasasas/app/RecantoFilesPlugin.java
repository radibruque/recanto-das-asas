package br.com.recantodasasas.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.Arrays;
import java.util.HashSet;

/** Explicit, user-triggered exports only. Never exposes the database or arbitrary paths. */
@CapacitorPlugin(name = "RecantoFiles")
public class RecantoFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 64 * 1024 * 1024;
    private static final Set<String> TYPES = new HashSet<>(Arrays.asList(
        "application/pdf", "text/csv", "application/json", "application/zip",
        "application/octet-stream", "text/plain", "image/png", "image/jpeg", "image/svg+xml", "image/tiff", "image/vnd.microsoft.icon", "image/x-icon", "application/postscript",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ));

    private byte[] content(PluginCall call, boolean pdfOnly) {
        String encoded = call.getString("base64", "");
        String mime = call.getString("mime", pdfOnly ? "application/pdf" : "application/octet-stream");
        if (!TYPES.contains(mime) || encoded.isEmpty() || encoded.length() > ((long) MAX_BYTES * 4 / 3 + 8)) {
            throw new IllegalArgumentException("Arquivo vazio, formato não permitido ou tamanho acima de 64 MB.");
        }
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IllegalArgumentException("Tamanho de arquivo inválido.");
        if (pdfOnly && (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-"))) {
            throw new IllegalArgumentException("O conteúdo não é um PDF válido.");
        }
        return bytes;
    }

    private String filename(PluginCall call) {
        String name = call.getString("name", "Recanto-das-Asas").replaceAll("[^\\p{L}\\p{N}_. -]", "_");
        name = name.replaceFirst("^\\.+", "");
        return name.isEmpty() ? "Recanto-das-Asas" : name.substring(0, Math.min(name.length(), 140));
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        try {
            content(call, false); // Validate before opening the system chooser.
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mime", "application/octet-stream"));
            intent.putExtra(Intent.EXTRA_TITLE, filename(call));
            startActivityForResult(call, intent, "onSaveFile");
        } catch (Exception error) { call.reject("Não foi possível preparar o arquivo para salvar.", "E_EXPORT"); }
    }

    @ActivityCallback
    private void onSaveFile(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject(); cancelled.put("cancelled", true); call.resolve(cancelled); return;
        }
        try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData(), "w")) {
            if (output == null) throw new IllegalStateException("Destino indisponível.");
            output.write(content(call, false));
            JSObject success = new JSObject(); success.put("cancelled", false); call.resolve(success);
        } catch (Exception error) { call.reject("Não foi possível gravar o arquivo no destino escolhido.", "E_EXPORT_WRITE"); }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        try {
            byte[] bytes = content(call, false);
            File folder = new File(getContext().getCacheDir(), "recanto-exports");
            if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Cache indisponível.");
            File output = new File(folder, filename(call));
            try (FileOutputStream stream = new FileOutputStream(output)) { stream.write(bytes); }
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(call.getString("mime", "application/octet-stream"));
            intent.putExtra(Intent.EXTRA_STREAM, FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", output));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "Compartilhar arquivo"));
            call.resolve();
        } catch (Exception error) { call.reject("Não foi possível abrir o compartilhamento do sistema.", "E_SHARE"); }
    }

    @PluginMethod
    public void printPdf(PluginCall call) {
        try {
            byte[] bytes = content(call, true);
            File document = File.createTempFile("recanto-print-", ".pdf", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(document)) { output.write(bytes); }
            final int count;
            try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(document, ParcelFileDescriptor.MODE_READ_ONLY);
                 PdfRenderer renderer = new PdfRenderer(descriptor)) { count = renderer.getPageCount(); }
            String name = filename(call);
            getActivity().runOnUiThread(() -> {
                PrintManager manager = (PrintManager) getContext().getSystemService(android.content.Context.PRINT_SERVICE);
                if (manager == null) { document.delete(); call.reject("Serviço de impressão indisponível.", "E_PRINT"); return; }
                manager.print(name, new PrintDocumentAdapter() {
                    @Override
                    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                        if (cancellationSignal.isCanceled()) { callback.onLayoutCancelled(); return; }
                        callback.onLayoutFinished(new PrintDocumentInfo.Builder(name)
                            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(count).build(), true);
                    }
                    @Override
                    public void onWrite(PageRange[] ranges, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
                        if (cancellationSignal.isCanceled()) { callback.onWriteCancelled(); return; }
                        try (FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                            output.write(bytes);
                            callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
                        } catch (Exception error) { callback.onWriteFailed("Falha ao preparar o PDF."); }
                    }
                    @Override public void onFinish() { document.delete(); }
                }, null);
                call.resolve(); // Means the system dialog opened, never that physical printing succeeded.
            });
        } catch (Exception error) { call.reject("Não foi possível abrir o PDF para impressão.", "E_PRINT_PDF"); }
    }
}
