import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { nativeExportStubs } from './helpers/native-export-stubs';

const javaHome=process.env.JAVA_HOME || (existsSync('/workspace/tools/java') ? readdirSync('/workspace/tools/java').map(name=>join('/workspace/tools/java',name)).find(path=>existsSync(join(path,'bin','javac'))) : undefined);
const javac=javaHome?join(javaHome,'bin','javac'):'javac', java=javaHome?join(javaHome,'bin','java'):'java';
let available=true;try{execFileSync(javac,['-version'],{stdio:'ignore'});}catch{available=false;}
let directory='';

const harness = `package br.com.recantodasasas.app;
import android.app.Activity;import android.content.*;import android.net.Uri;import androidx.activity.result.ActivityResult;import com.getcapacitor.*;
import java.io.*;import java.lang.reflect.*;import java.nio.file.*;import java.security.MessageDigest;import java.util.*;
public class NativeExportHarness {
 private static File root;private static RecantoFilesPlugin plugin;
 private static void require(boolean condition,String message){if(!condition)throw new AssertionError(message);}
 private static String hash(byte[] bytes)throws Exception{StringBuilder result=new StringBuilder();for(byte value:MessageDigest.getInstance("SHA-256").digest(bytes))result.append(String.format("%02x",value));return result.toString();}
 private static byte[] sample(int length){byte[] bytes=new byte[length];byte[] prefix="%PDF-1.7\\n".getBytes(java.nio.charset.StandardCharsets.US_ASCII);System.arraycopy(prefix,0,bytes,0,prefix.length);for(int index=prefix.length;index<bytes.length;index++)bytes[index]=(byte)(index%251);return bytes;}
 private static PluginCall call(String method,Object...args)throws Exception{PluginCall value=new PluginCall(args);Method methodHandle=RecantoFilesPlugin.class.getMethod(method,PluginCall.class);methodHandle.invoke(plugin,value);return value;}
 private static void good(PluginCall call){require(call.errorCode==null,"Unexpected error: "+call.error+" / "+call.errorCode);require(call.resolved,"Call was not resolved");}
 private static void bad(PluginCall call){require(call.errorCode!=null,"Expected rejection");require(!call.resolved,"Rejected operation must not resolve success");}
 private static String begin(byte[] bytes,String digest)throws Exception{PluginCall value=call("beginFile","name","caderneta.pdf","mime","application/pdf","size",bytes.length,"sha256",digest);good(value);String id=value.response.getString("id");require(id!=null&&!id.isEmpty(),"Missing opaque stage id");return id;}
 private static String prepared(byte[] bytes)throws Exception{String id=begin(bytes,hash(bytes));for(int offset=0,index=0;offset<bytes.length;offset+=192*1024,index++){byte[] chunk=Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+192*1024));good(call("appendFile","id",id,"index",index,"base64",Base64.getEncoder().encodeToString(chunk)));}good(call("finishFile","id",id));return id;}
 private static void callback(PluginCall call,int result,File destination)throws Exception{Intent intent=destination==null?null:new Intent().setData(new Uri(destination.getAbsolutePath()));Method method=RecantoFilesPlugin.class.getDeclaredMethod(plugin.chooserCallback,PluginCall.class,ActivityResult.class);method.setAccessible(true);method.invoke(plugin,call,new ActivityResult(result,intent));}
 private static long cacheFiles()throws Exception{try(java.util.stream.Stream<Path> files=Files.walk(plugin.getContext().getCacheDir().toPath())){return files.filter(Files::isRegularFile).count();}}
 private static PluginCall chooser(String id)throws Exception{PluginCall result=call("saveStaged","id",id);require(result.errorCode==null,"Chooser rejected "+result.error);require(plugin.chooserCall==result,"No system chooser");require(result.data.size()==1&&result.data.getString("base64")==null,"Chooser must retain only an opaque id, not the encoded PDF");return result;}
 public static void main(String[] args)throws Exception{
  root=Files.createTempDirectory("recanto-native-").toFile();File cache=new File(root,"cache");cache.mkdir();plugin=new RecantoFilesPlugin();plugin.context=new Context(cache);plugin.load();
  String scenario=args[0];byte[] bytes=sample(scenario.equals("bounded-memory")?8*1024*1024:410000);File destination=new File(root,"saved.pdf");
  try{
   if(scenario.equals("complete")||scenario.equals("bounded-memory")){String id=prepared(bytes);PluginCall saved=chooser(id);callback(saved,Activity.RESULT_OK,destination);good(saved);require(Boolean.FALSE.equals(saved.response.get("cancelled")),"Incorrect cancellation");require(Arrays.equals(bytes,Files.readAllBytes(destination.toPath())),"Saved bytes differ or file is empty");require(cacheFiles()==0,"Stage leaked after success");}
   else if(scenario.equals("cancel")){String id=prepared(bytes);PluginCall saved=chooser(id);callback(saved,Activity.RESULT_CANCELED,null);good(saved);require(Boolean.TRUE.equals(saved.response.get("cancelled")),"Cancellation must be explicit");require(plugin.getContext().resolver.opens==0,"Cancellation opened a destination");require(cacheFiles()==0,"Cancelled stage leaked");}
   else if(scenario.equals("checksum")){String id=begin(bytes,"0".repeat(64));for(int offset=0,index=0;offset<bytes.length;offset+=192*1024,index++)good(call("appendFile","id",id,"index",index,"base64",Base64.getEncoder().encodeToString(Arrays.copyOfRange(bytes,offset,Math.min(bytes.length,offset+192*1024)))));bad(call("finishFile","id",id));bad(call("saveStaged","id",id));require(plugin.chooserCall==null,"Checksum failure reached system chooser");require(plugin.getContext().resolver.opens==0,"Checksum failure opened destination");}
   else if(scenario.equals("truncated")){String id=begin(bytes,hash(bytes));good(call("appendFile","id",id,"index",0,"base64",Base64.getEncoder().encodeToString(Arrays.copyOf(bytes,100))));bad(call("finishFile","id",id));bad(call("saveStaged","id",id));require(plugin.chooserCall==null,"Incomplete file reached system chooser");}
   else if(scenario.equals("sequence")){String id=begin(bytes,hash(bytes));bad(call("appendFile","id",id,"index",1,"base64",Base64.getEncoder().encodeToString(Arrays.copyOf(bytes,100))));bad(call("finishFile","id",id));require(plugin.chooserCall==null,"Out-of-order transfer reached chooser");}
   else if(scenario.equals("write-failure")||scenario.equals("close-failure")){String id=prepared(bytes);PluginCall saved=chooser(id);plugin.getContext().resolver.failWrites=scenario.equals("write-failure");plugin.getContext().resolver.failClose=scenario.equals("close-failure");callback(saved,Activity.RESULT_OK,destination);bad(saved);require(!destination.exists(),"Provider failure left an empty/partial PDF behind");require(plugin.getContext().resolver.deletes>0,"Failed destination was not removed");require(cacheFiles()==0,"Failed export leaked private stage");}
   else if(scenario.equals("permission")){String id=prepared(bytes);PluginCall saved=chooser(id);plugin.getContext().resolver.deny=true;callback(saved,Activity.RESULT_OK,destination);bad(saved);require(!destination.exists(),"Permission failure created output");require(cacheFiles()==0,"Permission failure leaked stage");}
   else if(scenario.equals("opaque-id")){for(String id:List.of("../../../outside.pdf","nonexistent","")){bad(call("saveStaged","id",id));bad(call("finishFile","id",id));}require(plugin.chooserCall==null,"Invalid ID opened chooser");require(plugin.getContext().resolver.opens==0,"Invalid ID opened destination");}
   else if(scenario.equals("missing-call")){String id=prepared(bytes);chooser(id);Files.write(destination.toPath(),new byte[0]);callback(null,Activity.RESULT_OK,destination);require(!destination.exists(),"Lost activity callback left a 0B document");}
   else if(scenario.equals("missing-stage")){String id=prepared(bytes);PluginCall saved=chooser(id);good(call("discardFile","id",id));Files.write(destination.toPath(),new byte[0]);callback(saved,Activity.RESULT_OK,destination);bad(saved);require(plugin.getContext().resolver.opens==0,"Lost stage truncated destination before verification");require(!destination.exists(),"Lost stage left an empty document");}
   else if(scenario.equals("legacy-call")){PluginCall saved=call("saveFile","name","caderneta.pdf","mime","application/pdf","base64",Base64.getEncoder().encodeToString(bytes));require(saved.errorCode==null&&plugin.chooserCall==saved,"Legacy compatibility did not reach chooser");require(!saved.data.containsKey("base64")&&saved.data.getString("id")!=null,"Legacy activity call retained the full base64 payload");callback(saved,Activity.RESULT_OK,destination);good(saved);require(Arrays.equals(bytes,Files.readAllBytes(destination.toPath())),"Legacy save changed bytes");require(cacheFiles()==0,"Legacy export leaked stage");}
   else if(scenario.equals("session-limit")){for(int count=0;count<8;count++)begin(bytes,hash(bytes));bad(call("beginFile","name","ninth.pdf","mime","application/pdf","size",bytes.length,"sha256",hash(bytes)));require(cacheFiles()<=8,"Session cap leaked files");}
   else throw new AssertionError("Unknown scenario");
   System.out.println("PASS "+scenario);
  }finally{try(java.util.stream.Stream<Path> paths=Files.walk(root.toPath())){paths.sorted(Comparator.reverseOrder()).forEach(path->{try{Files.deleteIfExists(path);}catch(IOException error){}});}}
 }
}`;

describe.skipIf(!available)('Android export plugin executed on host JVM with controlled system adapters', () => {
  beforeAll(() => {
    directory=mkdtempSync(join(tmpdir(),'recanto-plugin-test-'));
    const sources={...nativeExportStubs,
      'br/com/recantodasasas/app/RecantoFilesPlugin.java':readFileSync(new URL('../native/android/app/src/main/java/br/com/recantodasasas/app/RecantoFilesPlugin.java',import.meta.url),'utf8'),
      'br/com/recantodasasas/app/NativeExportHarness.java':harness};
    for(const [name,source] of Object.entries(sources)){const path=join(directory,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source);}
    execFileSync(javac,['-encoding','UTF-8','-d',join(directory,'classes'),...Object.keys(sources).map(name=>join(directory,name))],{encoding:'utf8',timeout:30000});
  },40000);
  afterAll(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});
  for(const [scenario,description] of Object.entries({
    complete:'streams all chunks and saves exact nonzero bytes before resolving success',
    'bounded-memory':'streams and saves an 8 MiB document under a 48 MiB JVM heap',
    cancel:'reports user cancellation and clears the staged PDF without opening a destination',
    checksum:'rejects corrupted bytes before opening the system document chooser',
    truncated:'rejects a partially transferred PDF before any public file is created',
    sequence:'rejects out-of-order chunks rather than publishing a corrupt PDF',
    'write-failure':'removes a partially created provider document when writing fails',
    'close-failure':'removes the output and reports failure if the destination fails on close',
    permission:'handles denied provider access without leaking the staged private document',
    'opaque-id':'does not accept paths or unknown stage handles from the JS bridge',
    'missing-call':'removes a 0B destination when the activity result has lost its callback',
    'missing-stage':'validates the staged file before opening the destination after the system chooser',
    'legacy-call':'removes the large base64 payload before retaining an older export call for the system chooser',
    'session-limit':'bounds concurrent private staged exports',
  }))it(description,()=>{
    const result=execFileSync(java,['-Xmx48m','-cp',join(directory,'classes'),'br.com.recantodasasas.app.NativeExportHarness',scenario],{encoding:'utf8',timeout:15000});
    expect(result.trim()).toBe('PASS '+scenario);
  });
});
