package br.com.recantodasasas.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.DocumentsContract;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded transfers into private staging. A destination is opened only after size/hash validation. */
@CapacitorPlugin(name = "RecantoFiles")
public class RecantoFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 64 * 1024 * 1024;
    private static final int CHUNK_BYTES = 192 * 1024;
    private static final long CACHE_AGE = 2 * 60 * 60 * 1000L;
    private static final Set<String> TYPES = new HashSet<>(Arrays.asList(
        "application/pdf", "text/csv", "text/calendar", "application/json", "application/zip",
        "application/octet-stream", "text/plain", "image/png", "image/jpeg", "image/svg+xml", "image/tiff", "image/vnd.microsoft.icon", "image/x-icon", "application/postscript",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ));
    private static final class Staged {
        final File file; final String name, mime, sha256; final int size;
        final MessageDigest digest; int written, nextIndex; boolean ready;
        Staged(File file, String name, String mime, int size, String sha256) throws Exception {
            this.file=file;this.name=name;this.mime=mime;this.size=size;this.sha256=sha256;
            this.digest=MessageDigest.getInstance("SHA-256");
        }
    }
    private final Map<String, Staged> staged = new ConcurrentHashMap<>();
    private File folder() {
        File folder=new File(getContext().getCacheDir(), "recanto-exports");
        if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Cache indisponível.");
        return folder;
    }
    private String filename(PluginCall call) {
        String name=call.getString("name", "Recanto-das-Asas").replaceAll("[^\\p{L}\\p{N}_. -]", "_").replaceFirst("^\\.+", "");
        return name.isEmpty()?"Recanto-das-Asas":name.substring(0,Math.min(name.length(),140));
    }
    private String begin(String name, String mime, int size, String sha) throws Exception {
        if (!TYPES.contains(mime) || size < 1 || size > MAX_BYTES || sha == null || !sha.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Arquivo vazio, tamanho ou formato inválido.");
        File folder=folder();long before=System.currentTimeMillis()-CACHE_AGE;
        for(Map.Entry<String,Staged> entry:staged.entrySet())if(entry.getValue().file.lastModified()<before)discard(entry.getKey());
        File[] old=folder.listFiles();if(old!=null)for(File file:old)if(file.lastModified()<before)file.delete();
        if(staged.size()>=8)throw new IllegalStateException("Conclua ou cancele os arquivos pendentes antes de exportar novamente.");
        String id=UUID.randomUUID().toString();File file=new File(folder,id+".stage");
        if(!file.createNewFile())throw new IllegalStateException("Não foi possível preparar o arquivo.");
        staged.put(id,new Staged(file,name,mime,size,sha));return id;
    }
    private Staged get(String id, boolean ready) {
        if(id==null || !id.matches("[a-f0-9-]{36}"))throw new IllegalArgumentException("Identificação de arquivo inválida.");
        Staged value=staged.get(id);
        if(value==null || !value.file.isFile() || (ready && (!value.ready || value.file.length()!=value.size)))throw new IllegalStateException("Arquivo temporário indisponível. Gere o documento novamente.");
        return value;
    }
    private void discard(String id) {if(id==null)return;Staged value=staged.remove(id);if(value!=null)value.file.delete();}
    private static String hex(byte[] digest) {StringBuilder out=new StringBuilder();for(byte v:digest)out.append(String.format("%02x",v&255));return out.toString();}
    private void append(String id, int index, String encoded) throws Exception {
        Staged value=get(id,false);
        if(value.ready || index!=value.nextIndex || encoded==null || encoded.isEmpty() || encoded.length()>CHUNK_BYTES*4/3+4 || !encoded.matches("[A-Za-z0-9+/]*={0,2}") || encoded.length()%4!=0)throw new IllegalArgumentException("Parte de arquivo inválida ou fora de sequência.");
        byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);
        if(bytes.length<1 || bytes.length>CHUNK_BYTES || value.written+bytes.length>value.size)throw new IllegalArgumentException("Tamanho de parte inválido.");
        try(FileOutputStream stream=new FileOutputStream(value.file,true)){stream.write(bytes);}
        value.digest.update(bytes);value.written+=bytes.length;value.nextIndex++;
    }
    private void finish(String id) throws Exception {
        Staged value=get(id,false);
        if(value.ready)return;
        if(value.written!=value.size || value.file.length()!=value.size || !hex(value.digest.digest()).equals(value.sha256))throw new IllegalArgumentException("Falha de integridade. Nenhum destino foi aberto.");
        if(value.mime.equals("application/pdf"))try(FileInputStream in=new FileInputStream(value.file)){
            byte[] head=new byte[5];if(in.read(head)!=5 || !new String(head,StandardCharsets.US_ASCII).equals("%PDF-"))throw new IllegalArgumentException("O conteúdo não é um PDF.");
        }
        value.ready=true;
    }
    @PluginMethod public void beginFile(PluginCall call) {
        try {String id=begin(filename(call),call.getString("mime",""),call.getInt("size",0),call.getString("sha256",""));JSObject result=new JSObject();result.put("id",id);call.resolve(result);}
        catch(Exception error){call.reject(error.getMessage(),"E_EXPORT_PREPARE");}
    }
    @PluginMethod public void appendFile(PluginCall call) {
        String id=call.getString("id","");
        try{append(id,call.getInt("index",-1),call.getString("base64",""));call.resolve();}
        catch(Exception error){discard(id);call.reject(error.getMessage(),"E_EXPORT_CHUNK");}
    }
    @PluginMethod public void finishFile(PluginCall call) {
        String id=call.getString("id","");
        try{finish(id);call.resolve();}catch(Exception error){discard(id);call.reject(error.getMessage(),"E_EXPORT_INTEGRITY");}
    }
    @PluginMethod public void discardFile(PluginCall call){discard(call.getString("id",""));call.resolve();}
    @PluginMethod public void saveStaged(PluginCall call) {
        String id=call.getString("id","");
        try{
            Staged value=get(id,true);
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(value.mime);intent.putExtra(Intent.EXTRA_TITLE,value.name);
            startActivityForResult(call,intent,"onSaveFile");
        }catch(Exception error){discard(id);call.reject(error.getMessage(),"E_EXPORT");}
    }
    private void deleteDestination(Uri uri) {
        if(uri!=null)try{DocumentsContract.deleteDocument(getContext().getContentResolver(),uri);}catch(Exception ignored){/* Provider may refuse cleanup; report write failure. */}
    }
    private static void copy(File file, OutputStream output, CancellationSignal cancel) throws Exception {
        try(InputStream input=new FileInputStream(file)){
            byte[] block=new byte[32768];int count;
            while((count=input.read(block))!=-1){if(cancel!=null && cancel.isCanceled())throw new java.io.InterruptedIOException("Operação cancelada.");output.write(block,0,count);}
            output.flush();
        }
    }
    @ActivityCallback private void onSaveFile(PluginCall call, ActivityResult result) {
        Uri uri=result.getData()==null?null:result.getData().getData();
        if(call==null){deleteDestination(uri);return;}
        String id=call.getString("id","");
        if(result.getResultCode()!=Activity.RESULT_OK || uri==null){discard(id);JSObject out=new JSObject();out.put("cancelled",true);call.resolve(out);return;}
        try{
            Staged value=get(id,true);
            // Validate before truncating destination, then close/flush before resolving the JS request.
            try(OutputStream output=getContext().getContentResolver().openOutputStream(uri,"w")){
                if(output==null)throw new IllegalStateException("Destino indisponível.");copy(value.file,output,null);
            }
            JSObject out=new JSObject();out.put("cancelled",false);call.resolve(out);
        }catch(Exception error){deleteDestination(uri);call.reject("Não foi possível gravar o arquivo. O destino incompleto foi solicitado para remoção; tente outra pasta.","E_EXPORT_WRITE");}
        finally{discard(id);}
    }
    private Uri contentUri(Staged value) {
        return FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",value.file);
    }
    @PluginMethod public void openStaged(PluginCall call) {
        String id=call.getString("id","");
        try{Staged value=get(id,true);Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(contentUri(value),value.mime);intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(Intent.createChooser(intent,"Visualizar arquivo"));staged.remove(id);call.resolve();}
        catch(Exception error){discard(id);call.reject("Não foi possível abrir o arquivo. Instale um leitor para este formato ou use Baixar.","E_VIEW");}
    }
    @PluginMethod public void shareStaged(PluginCall call) {
        String id=call.getString("id","");
        try{Staged value=get(id,true);Intent intent=new Intent(Intent.ACTION_SEND);intent.setType(value.mime);intent.putExtra(Intent.EXTRA_STREAM,contentUri(value));intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(Intent.createChooser(intent,"Compartilhar arquivo"));staged.remove(id);call.resolve();}
        catch(Exception error){discard(id);call.reject("Não foi possível abrir o compartilhamento.","E_SHARE");}
    }
    // Compatibility for older callers; new web code sends small chunks and never retains a large bridge payload.
    private String legacy(PluginCall call, boolean pdfOnly) throws Exception {
        String encoded=call.getString("base64","");String mime=call.getString("mime",pdfOnly?"application/pdf":"application/octet-stream");
        if(encoded.isEmpty() || encoded.length()>((long)MAX_BYTES*4/3+8) || (pdfOnly&&!mime.equals("application/pdf")))throw new IllegalArgumentException("Arquivo inválido.");
        byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);
        String id=begin(filename(call),mime,bytes.length,hex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        try{for(int offset=0,index=0;offset<bytes.length;offset+=CHUNK_BYTES,index++)append(id,index,Base64.encodeToString(Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+CHUNK_BYTES)),Base64.NO_WRAP));finish(id);}
        catch(Exception error){discard(id);throw error;}
        call.getData().remove("base64");call.getData().put("id",id);return id;
    }
    @PluginMethod public void saveFile(PluginCall call){try{legacy(call,false);saveStaged(call);}catch(Exception error){call.reject(error.getMessage(),"E_EXPORT");}}
    @PluginMethod public void shareFile(PluginCall call){try{legacy(call,false);shareStaged(call);}catch(Exception error){call.reject(error.getMessage(),"E_SHARE");}}
    @PluginMethod public void printPdf(PluginCall call){try{legacy(call,true);printStaged(call);}catch(Exception error){call.reject(error.getMessage(),"E_PRINT_PDF");}}
    @PluginMethod public void printStaged(PluginCall call) {
        String id=call.getString("id","");
        try{
            Staged value=get(id,true);if(!value.mime.equals("application/pdf"))throw new IllegalArgumentException("Escolha um PDF.");
            final int count;
            try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(value.file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer renderer=new PdfRenderer(fd)){count=renderer.getPageCount();}
            getActivity().runOnUiThread(()->{
                PrintManager manager=(PrintManager)getContext().getSystemService(android.content.Context.PRINT_SERVICE);
                if(manager==null){discard(id);call.reject("Serviço de impressão indisponível.","E_PRINT");return;}
                try{
                    manager.print(value.name,new PrintDocumentAdapter(){
                        @Override public void onLayout(PrintAttributes old,PrintAttributes now,CancellationSignal cancel,LayoutResultCallback callback,Bundle extras){if(cancel.isCanceled()){callback.onLayoutCancelled();return;}callback.onLayoutFinished(new PrintDocumentInfo.Builder(value.name).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(count).build(),true);}
                        @Override public void onWrite(PageRange[] ranges,ParcelFileDescriptor destination,CancellationSignal cancel,WriteResultCallback callback){
                            if(cancel.isCanceled()){callback.onWriteCancelled();return;}
                            try{try(FileOutputStream out=new FileOutputStream(destination.getFileDescriptor())){copy(value.file,out,cancel);}callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});}
                            catch(Exception error){if(cancel.isCanceled())callback.onWriteCancelled();else callback.onWriteFailed("Falha ao preparar PDF.");}
                        }
                        @Override public void onFinish(){discard(id);}
                    },null);call.resolve();
                }catch(Exception error){discard(id);call.reject("Não foi possível abrir impressão.","E_PRINT");}
            });
        }catch(Exception error){discard(id);call.reject("Não foi possível abrir o PDF para impressão.","E_PRINT_PDF");}
    }
}
