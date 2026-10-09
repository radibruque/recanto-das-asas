import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

const bridge=vi.hoisted(()=>({
  beginFile:vi.fn(),appendFile:vi.fn(),finishFile:vi.fn(),saveStaged:vi.fn(),openStaged:vi.fn(),shareStaged:vi.fn(),printStaged:vi.fn(),discardFile:vi.fn(),
}));
vi.mock('@capacitor/core',()=>({
  Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},
  registerPlugin:()=>bridge,
}));
import { androidExport } from '../src/lib/native-files';

beforeEach(()=>{
  for(const method of Object.values(bridge))method.mockReset();
  bridge.beginFile.mockResolvedValue({id:'opaque-stage-id'});
  bridge.appendFile.mockResolvedValue(undefined);
  bridge.finishFile.mockResolvedValue(undefined);
  bridge.saveStaged.mockResolvedValue({cancelled:false});
  bridge.openStaged.mockResolvedValue(undefined);
  bridge.shareStaged.mockResolvedValue(undefined);
  bridge.printStaged.mockResolvedValue(undefined);
  bridge.discardFile.mockResolvedValue(undefined);
});

describe('JS to Android bounded file transfer',()=>{
  it('transfers exact bytes in bounded sequential chunks and waits for verification before choosing a destination',async()=>{
    const bytes=randomBytes(410000),events:string[]=[];
    bridge.appendFile.mockImplementation(async()=>{events.push('append');});
    bridge.finishFile.mockImplementation(async()=>{events.push('verified');});
    bridge.saveStaged.mockImplementation(async()=>{events.push('chooser');return {cancelled:false};});
    await androidExport(bytes,'caderneta.pdf','application/pdf');
    expect(bridge.beginFile).toHaveBeenCalledWith({name:'caderneta.pdf',mime:'application/pdf',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    const chunks=bridge.appendFile.mock.calls.map(([value])=>value);
    expect(chunks.map(value=>value.index)).toEqual([0,1,2]);
    expect(chunks.every(value=>Buffer.from(value.base64,'base64').length<=192*1024)).toBe(true);
    expect(Buffer.concat(chunks.map(value=>Buffer.from(value.base64,'base64')))).toEqual(bytes);
    expect(events).toEqual(['append','append','append','verified','chooser']);
    expect(bridge.saveStaged).toHaveBeenCalledWith({id:'opaque-stage-id'});
    expect(bridge.discardFile).not.toHaveBeenCalled();
  });
  it('cleans the stage and never opens a destination when a middle chunk fails',async()=>{
    bridge.appendFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('chunk failed'));
    await expect(androidExport(randomBytes(410000),'caderneta.pdf','application/pdf')).rejects.toThrow('chunk failed');
    expect(bridge.finishFile).not.toHaveBeenCalled();
    expect(bridge.saveStaged).not.toHaveBeenCalled();
    expect(bridge.discardFile).toHaveBeenCalledWith({id:'opaque-stage-id'});
  });
  it('does not hide a checksum failure or open the document chooser',async()=>{
    bridge.finishFile.mockRejectedValue(new Error('integrity failed'));
    await expect(androidExport(randomBytes(100),'caderneta.pdf','application/pdf')).rejects.toThrow('integrity failed');
    expect(bridge.saveStaged).not.toHaveBeenCalled();
    expect(bridge.discardFile).toHaveBeenCalledOnce();
  });
  it('reports user cancellation instead of a successful download and cleans staging',async()=>{
    bridge.saveStaged.mockResolvedValue({cancelled:true});
    await expect(androidExport(randomBytes(100),'caderneta.pdf','application/pdf')).rejects.toThrow('Salvamento cancelado');
    expect(bridge.discardFile).toHaveBeenCalledOnce();
  });
  it('preserves the actual provider error even if temporary file cleanup also fails',async()=>{
    bridge.saveStaged.mockRejectedValue(new Error('provider unavailable'));
    bridge.discardFile.mockRejectedValue(new Error('cleanup unavailable'));
    await expect(androidExport(randomBytes(100),'caderneta.pdf','application/pdf')).rejects.toThrow('provider unavailable');
  });
  it.each(['view','share','print'] as const)('uses a verified staged handle for %s without resending the full base64',async action=>{
    await androidExport(randomBytes(100),'caderneta.pdf','application/pdf',action);
    const method={view:bridge.openStaged,share:bridge.shareStaged,print:bridge.printStaged}[action];
    expect(method).toHaveBeenCalledWith({id:'opaque-stage-id'});
    expect(bridge.finishFile).toHaveBeenCalledOnce();
    expect(bridge.saveStaged).not.toHaveBeenCalled();
  });
  it('rejects an empty export before creating private staging or a public destination',async()=>{
    await expect(androidExport(new Uint8Array(),'caderneta.pdf','application/pdf')).rejects.toThrow('vazio');
    expect(bridge.beginFile).not.toHaveBeenCalled();
  });
  it('enforces the native limit before sending any bridge payload',async()=>{
    await expect(androidExport(new Uint8Array(64*1024*1024+1),'large.pdf','application/pdf')).rejects.toThrow('64 MB');
    expect(bridge.beginFile).not.toHaveBeenCalled();
  });
});
