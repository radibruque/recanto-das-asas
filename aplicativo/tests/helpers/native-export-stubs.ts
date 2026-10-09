/** Minimal Android/Capacitor adapters for executing the real plugin on a host JVM.
 * They deliberately do not claim to simulate Android lifecycle, permissions, or SAF providers.
 */
export const nativeExportStubs:Record<string,string> = {
  'android/net/Uri.java': `package android.net;
public class Uri { public final String path; public Uri(String value){path=value;} public static Uri parse(String value){return new Uri(value);} public String toString(){return path;} }`,
  'android/content/Intent.java': `package android.content;
import java.util.HashMap; import android.net.Uri;
public class Intent {
 public static final String ACTION_CREATE_DOCUMENT="CREATE", ACTION_SEND="SEND", ACTION_VIEW="VIEW", ACTION_INSERT="INSERT", CATEGORY_OPENABLE="OPENABLE", EXTRA_TITLE="TITLE", EXTRA_STREAM="STREAM";
 public static final int FLAG_GRANT_READ_URI_PERMISSION=1, FLAG_GRANT_WRITE_URI_PERMISSION=2;
 public String type; public Uri data; public final HashMap<String,Object> extras=new HashMap<>();
 public Intent(){} public Intent(String action){} public Intent(String action,Uri value){data=value;}
 public Intent addCategory(String category){return this;} public Intent setType(String value){type=value;return this;} public Intent setData(Uri value){data=value;return this;} public Intent setDataAndType(Uri value,String mime){data=value;type=mime;return this;}
 public Intent putExtra(String name,Object value){extras.put(name,value);return this;} public Intent addFlags(int flags){return this;} public Uri getData(){return data;} public static Intent createChooser(Intent intent,String title){return intent;}
 }`,
  'android/content/ContentResolver.java': `package android.content;
import java.io.*; import java.nio.file.*; import android.net.Uri;
public class ContentResolver {
 public int opens=0,deletes=0; public boolean deny=false,failWrites=false,failClose=false,returnNull=false; public File destination;
 public OutputStream openOutputStream(Uri uri,String mode)throws IOException {
  opens++;destination=new File(uri.path);if(deny)throw new SecurityException("Denied");if(returnNull)return null;
  FileOutputStream file=new FileOutputStream(destination);
  return new FilterOutputStream(file){public void write(int b)throws IOException{if(failWrites)throw new IOException("Provider write failed");out.write(b);}public void write(byte[] b,int off,int len)throws IOException{if(failWrites)throw new IOException("Provider write failed");out.write(b,off,len);}public void close()throws IOException{super.close();if(failClose)throw new IOException("Provider close failed");}};
 }
 public int delete(Uri uri,String selection,String[] args){deletes++;return new File(uri.path).delete()?1:0;}
 }`,
  'android/content/Context.java': `package android.content;
import java.io.File;
public class Context {public static final String PRINT_SERVICE="print"; public final File cache; public final ContentResolver resolver=new ContentResolver(); public Context(File folder){cache=folder;} public File getCacheDir(){return cache;} public ContentResolver getContentResolver(){return resolver;} public String getPackageName(){return "test.app";} public Object getSystemService(String name){return new android.print.PrintManager();}}`,
  'android/app/Activity.java': `package android.app; import android.content.Intent;
public class Activity {public static final int RESULT_OK=-1,RESULT_CANCELED=0; public void startActivity(Intent value){} public void runOnUiThread(Runnable value){value.run();}}`,
  'android/os/Bundle.java': `package android.os; public class Bundle {}`,
  'android/os/CancellationSignal.java': `package android.os; public class CancellationSignal {public boolean isCanceled(){return false;}}`,
  'android/os/ParcelFileDescriptor.java': `package android.os;
import java.io.*;
public class ParcelFileDescriptor implements AutoCloseable {public static final int MODE_READ_ONLY=1; private RandomAccessFile file; public ParcelFileDescriptor(File source)throws IOException{file=new RandomAccessFile(source,"r");} public static ParcelFileDescriptor open(File source,int mode)throws IOException{return new ParcelFileDescriptor(source);} public FileDescriptor getFileDescriptor()throws IOException{return file.getFD();} public void close()throws IOException{file.close();}}`,
  'android/util/Base64.java': `package android.util;
public class Base64 {public static final int DEFAULT=0,NO_WRAP=2; public static byte[] decode(String value,int flags){return java.util.Base64.getDecoder().decode(value);} public static String encodeToString(byte[] value,int flags){return java.util.Base64.getEncoder().encodeToString(value);}}`,
  'android/util/Log.java': `package android.util; public class Log {public static int e(String tag,String value,Throwable error){return 0;}public static int w(String tag,String value){return 0;}}`,
  'android/provider/DocumentsContract.java': `package android.provider;
import android.content.ContentResolver; import android.net.Uri;
public class DocumentsContract {public static boolean deleteDocument(ContentResolver resolver,Uri uri){return resolver.delete(uri,null,null)>0;}}`,
  'android/graphics/pdf/PdfRenderer.java': `package android.graphics.pdf;
import android.os.ParcelFileDescriptor;
public class PdfRenderer implements AutoCloseable {public PdfRenderer(ParcelFileDescriptor file){}public int getPageCount(){return 4;}public void close(){}}`,
  'android/print/PageRange.java': `package android.print;public class PageRange {public static final PageRange ALL_PAGES=new PageRange();}`,
  'android/print/PrintAttributes.java': `package android.print;public class PrintAttributes {}`,
  'android/print/PrintDocumentInfo.java': `package android.print;
public class PrintDocumentInfo {public static final int CONTENT_TYPE_DOCUMENT=1;public static class Builder {public Builder(String name){}public Builder setContentType(int value){return this;}public Builder setPageCount(int value){return this;}public PrintDocumentInfo build(){return new PrintDocumentInfo();}}}`,
  'android/print/PrintDocumentAdapter.java': `package android.print;
import android.os.*;
public class PrintDocumentAdapter {public void onLayout(PrintAttributes oldValue,PrintAttributes newValue,CancellationSignal signal,LayoutResultCallback callback,Bundle extras){}public void onWrite(PageRange[] ranges,ParcelFileDescriptor destination,CancellationSignal signal,WriteResultCallback callback){}public void onFinish(){}
 public static class LayoutResultCallback {public void onLayoutCancelled(){}public void onLayoutFinished(PrintDocumentInfo info,boolean changed){}}public static class WriteResultCallback {public void onWriteCancelled(){}public void onWriteFinished(PageRange[] ranges){}public void onWriteFailed(String error){}}}`,
  'android/print/PrintManager.java': `package android.print; public class PrintManager {public void print(String name,PrintDocumentAdapter adapter,Object attributes){}}`,
  'androidx/activity/result/ActivityResult.java': `package androidx.activity.result;
import android.content.Intent;
public class ActivityResult {private final int code;private final Intent data;public ActivityResult(int value,Intent result){code=value;data=result;}public int getResultCode(){return code;}public Intent getData(){return data;}}`,
  'androidx/core/content/FileProvider.java': `package androidx.core.content;
import android.content.Context;import android.net.Uri;import java.io.File;
public class FileProvider {public static Uri getUriForFile(Context context,String authority,File source){return new Uri(source.getAbsolutePath());}}`,
  'com/getcapacitor/JSObject.java': `package com.getcapacitor;
import java.util.HashMap;
public class JSObject extends HashMap<String,Object>{public String getString(String key){return getString(key,null);}public String getString(String key,String fallback){Object value=get(key);return value==null?fallback:String.valueOf(value);}public Integer getInteger(String key){Object value=get(key);return value instanceof Number?((Number)value).intValue():null;}public long optLong(String key,long fallback){Object value=get(key);return value instanceof Number?((Number)value).longValue():fallback;}public boolean optBoolean(String key,boolean fallback){Object value=get(key);return value instanceof Boolean?(Boolean)value:fallback;}}`,
  'com/getcapacitor/PluginCall.java': `package com.getcapacitor;
public class PluginCall {
 public final JSObject data=new JSObject();public JSObject response;public String errorCode,error;public boolean resolved=false;
 public PluginCall(Object...values){for(int i=0;i<values.length;i+=2)data.put((String)values[i],values[i+1]);}
 public String getString(String name){return data.getString(name);}public String getString(String name,String fallback){return data.getString(name,fallback);}public Integer getInt(String name){return data.getInteger(name);}public Integer getInt(String name,Integer fallback){Integer value=getInt(name);return value==null?fallback:value;}public Double getDouble(String name){Object value=data.get(name);return value instanceof Number?((Number)value).doubleValue():null;}public Double getDouble(String name,Double fallback){Double value=getDouble(name);return value==null?fallback:value;}public Boolean getBoolean(String name,Boolean fallback){return data.optBoolean(name,fallback);}public JSObject getData(){return data;}
 public void resolve(){resolved=true;}public void resolve(JSObject value){resolved=true;response=value;}public void reject(String value){error=value;errorCode="REJECT";}public void reject(String value,String code){error=value;errorCode=code;}public void reject(String value,String code,Exception exception){reject(value,code);}public String getCallbackId(){return "callback";}
 }`,
  'com/getcapacitor/Plugin.java': `package com.getcapacitor;
import android.app.Activity;import android.content.*;
public class Plugin {public Context context;public final Activity activity=new Activity();public PluginCall chooserCall;public Intent chooserIntent;public String chooserCallback;public void load(){}protected void handleOnDestroy(){}public Context getContext(){return context;}public Activity getActivity(){return activity;}public void startActivityForResult(PluginCall call,Intent intent,String callback){chooserCall=call;chooserIntent=intent;chooserCallback=callback;}}`,
  'com/getcapacitor/PluginMethod.java': `package com.getcapacitor; public @interface PluginMethod {}`,
  'com/getcapacitor/annotation/ActivityCallback.java': `package com.getcapacitor.annotation; public @interface ActivityCallback {}`,
  'com/getcapacitor/annotation/CapacitorPlugin.java': `package com.getcapacitor.annotation; public @interface CapacitorPlugin {String name();}`,
};
