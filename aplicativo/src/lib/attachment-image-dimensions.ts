export function imageDimensions(bytes:Uint8Array,mime:string):{width:number;height:number}|null {
  if (mime==='image/png' && bytes.length>=24) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    return {width:view.getUint32(16),height:view.getUint32(20)};
  }
  if (mime==='image/jpeg') {
    let offset=2,orientation=1;
    while (offset+4<bytes.length) {
      if (bytes[offset]!==255) return null;
      while (bytes[offset]===255) offset++;
      const marker=bytes[offset++];
      if (marker===0xd9 || marker===0xda) break;
      if (marker===0x01 || (marker>=0xd0&&marker<=0xd7)) continue;
      const length=(bytes[offset]<<8)|bytes[offset+1];
      if (length<2 || offset+length>bytes.length) return null;
      if(marker===0xe1&&length>=16&&bytes[offset+2]===69&&bytes[offset+3]===120&&bytes[offset+4]===105&&bytes[offset+5]===102&&bytes[offset+6]===0&&bytes[offset+7]===0){
        const start=offset+8,end=offset+length,view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
        const little=bytes[start]===73&&bytes[start+1]===73,big=bytes[start]===77&&bytes[start+1]===77;
        if((little||big)&&start+8<=end&&view.getUint16(start+2,little)===42){
          const directory=start+view.getUint32(start+4,little);
          if(directory>=start+8&&directory+2<=end){
            const count=view.getUint16(directory,little);
            for(let index=0;index<count&&directory+2+(index+1)*12<=end;index++){
              const entry=directory+2+index*12;
              if(view.getUint16(entry,little)===0x112&&view.getUint16(entry+2,little)===3&&view.getUint32(entry+4,little)===1){const value=view.getUint16(entry+8,little);if(value>=1&&value<=8)orientation=value;break;}
            }
          }
        }
      }
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length>=7) {
        const width=(bytes[offset+5]<<8)|bytes[offset+6],height=(bytes[offset+3]<<8)|bytes[offset+4];
        return orientation>=5 ? {width:height,height:width} : {width,height};
      }
      offset+=length;
    }
  }
  return null;
}
