import { CalendarDays } from 'lucide-react';
import { useRef, type InputHTMLAttributes } from 'react';
import { Button } from '../ui/bits';

export default function DateInput(props:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
  const ref=useRef<HTMLInputElement>(null);
  return <span className="date-input-control"><input {...props} ref={ref} type="date"/><span className="ui"><Button type="button" variant="outline" size="sm" aria-label="Abrir calendário" disabled={props.disabled} onClick={()=>{const input=ref.current;if(!input)return;try{input.showPicker();}catch{input.focus();}}}><CalendarDays size={18}/></Button></span></span>;
}