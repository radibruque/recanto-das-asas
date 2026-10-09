import { decodePDFRawStream, PDFArray, PDFContext, PDFDict, PDFName, PDFNumber, PDFObject, PDFObjectParser, PDFRawStream, PDFRef } from 'pdf-lib';

const prohibited=new Set(['JavaScript','JS','Launch','EmbeddedFile','EmbeddedFiles','RichMedia','Encrypt']);
const MAX_OBJECT_STREAM=4*1024*1024;

// pdf-lib decoders can inflate a whole block before getBytes returns. Cap each
// decoder's allocation, including intermediate filters, before that happens.
function boundedObjectStream(object:PDFRawStream):Uint8Array {
  type Decoder={stream?:Decoder;ensureBuffer?:(length:number)=>Uint8Array;getBytes:(length:number)=>Uint8Array;};
  const decoded=decodePDFRawStream(object) as unknown as Decoder;
  let current:Decoder|undefined=decoded,filters=0;
  while(current){
    if(++filters>9)throw new Error('PDF muito complexo para validar neste aparelho.');
    if(current.ensureBuffer){
      const original=current.ensureBuffer.bind(current);
      current.ensureBuffer=(length:number)=>{
        if(length>MAX_OBJECT_STREAM)throw new Error('PDF muito complexo para validar neste aparelho.');
        return original(length);
      };
    }
    current=current.stream;
  }
  const bytes=decoded.getBytes(MAX_OBJECT_STREAM);
  if(bytes.length>=MAX_OBJECT_STREAM)throw new Error('PDF muito complexo para validar neste aparelho.');
  return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
}

/** Inspect PDF objects, not image/font bytes that can contain incidental '/JS'. */
export function assertPassivePdf(bytes:Uint8Array):void {
  const context=PDFContext.create();
  const source=new TextDecoder('latin1').decode(bytes);
  let objects=0,decodedTotal=0;
  const inspect=(object:PDFObject,depth=0):void=>{
    if(depth>60)throw new Error('PDF muito complexo para validar neste aparelho.');
    if(object instanceof PDFName){
      if(prohibited.has(object.decodeText()))throw new Error('PDF contém ações ativas ou arquivos incorporados não permitidos.');
    }else if(object instanceof PDFRawStream){
      inspect(object.dict,depth+1);
      const type=object.dict.get(PDFName.of('Type'));
      if(type instanceof PDFName&&type.decodeText()==='ObjStm'){
        const first=object.dict.lookup(PDFName.of('First'),PDFNumber).asNumber();
        const count=object.dict.lookup(PDFName.of('N'),PDFNumber).asNumber();
        if(!Number.isSafeInteger(first)||first<0||!Number.isSafeInteger(count)||count<1||count>30000)throw new Error('Estrutura de objetos do PDF inválida.');
        const decoded=boundedObjectStream(object);
        decodedTotal+=decoded.length;
        if(decoded.length>MAX_OBJECT_STREAM||decodedTotal>8*1024*1024)throw new Error('PDF muito complexo para validar neste aparelho.');
        if(first>=decoded.length)throw new Error('PDF inválido: estrutura de objetos incompatível.');
        const header=new TextDecoder('ascii').decode(decoded.subarray(0,first)).trim().split(/\s+/);
        if(header.length!==count*2)throw new Error('Estrutura de objetos do PDF inválida.');
        for(let i=0;i<count;i++){
          const number=Number(header[i*2]),offset=Number(header[i*2+1]);
          if(!Number.isSafeInteger(number)||number<1||!Number.isSafeInteger(offset)||offset<0||first+offset>=decoded.length)throw new Error('Estrutura de objetos do PDF inválida.');
          const nested=PDFObjectParser.forBytes(decoded.subarray(first+offset),context).parseObject();
          inspect(nested,depth+1);context.assign(PDFRef.of(number),nested);
        }
      }
      // Image, page-content and font streams are data, not PDF dictionaries.
    }else if(object instanceof PDFDict){
      for(const [key,value] of object.entries()){inspect(key,depth+1);inspect(value,depth+1);}
    }else if(object instanceof PDFArray){
      for(let i=0;i<object.size();i++)inspect(object.get(i),depth+1);
    }
  };
  const headers=/(?:^|[\s])(?:(\d+)\s+(\d+)\s+obj\b|trailer\b)/g;
  let match:RegExpExecArray|null;
  try{
    while((match=headers.exec(source))){
      const start=headers.lastIndex;
      const parser=PDFObjectParser.forBytes(bytes.subarray(start),context);
      const object=parser.parseObject();inspect(object);
      if(match[1]){context.assign(PDFRef.of(Number(match[1]),Number(match[2])),object);objects++;}
      // pdf-lib 1.17.1's parser owns the byte position. Advancing past the whole
      // parsed object prevents headers inside binary streams being inspected.
      const consumed=(parser as unknown as {bytes:{offset():number}}).bytes.offset();
      headers.lastIndex=start+consumed;
      if(objects>30000)throw new Error('PDF muito complexo para validar neste aparelho.');
    }
    if(!objects){
      if(/\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/.test(source))throw new Error('PDF contém ações ativas ou arquivos incorporados não permitidos.');
      throw new Error('PDF inválido: estrutura de objetos ausente.');
    }
  }catch(error){
    if(error instanceof Error&&/PDF /.test(error.message))throw error;
    throw new Error('PDF inválido: não foi possível verificar a estrutura do arquivo.');
  }
}
