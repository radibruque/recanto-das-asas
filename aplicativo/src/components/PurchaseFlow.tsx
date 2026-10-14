import { useRef, useState, type FormEvent } from 'react';
import type { Bill, ModuleProps, Purchase } from '../domain/types';
import { billOutstanding, billPaid } from '../domain/commercial';
import { dateLabel, id, money, moneyInput, parseMoney, today } from '../domain/shared';
import { AttachmentPicker, AttachmentPreview, type PendingAttachment } from './DirectAttachments';

const quantityInput = (value: number) => String(value).replace('.', ',');
const quantity = (value: string) => {
  if (!/^\d+(,\d{1,3})?$/.test(value.trim())) throw new Error('Informe uma quantidade positiva, com até três casas decimais e vírgula.');
  const result = Number(value.replace(',', '.'));
  if (result <= 0) throw new Error('A quantidade precisa ser maior que zero.');
  return result;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível salvar. Os campos foram mantidos.';
type FormProps = ModuleProps & { purchase?: Purchase; productId?: string; close: (recordId?: string) => void; onBusyChange: (busy: boolean) => void };

/** A single command commits product, stock, obligation and an optional real payment. */
export function PurchaseForm({ state, scope, command, notify, purchase, productId: initialProductId, close, onBusyChange }: FormProps) {
  const products = state.products.filter(record => record.scope === scope);
  const contacts = state.contacts.filter(record => record.scope === scope && record.kind === 'fornecedor');
  const accounts = state.accounts.filter(record => record.scope === scope);
  const [productId, setProductId] = useState(purchase?.productId ?? initialProductId ?? (products.length ? '' : '__new__'));
  const initialProduct = products.find(record => record.id === productId);
  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? initialProduct?.supplierId ?? '');
  const [date, setDate] = useState(purchase?.date ?? today());
  const [dueDate, setDueDate] = useState(purchase?.dueDate ?? today());
  const [amount, setAmount] = useState(purchase ? moneyInput(purchase.totalCents) : '');
  const [count, setCount] = useState(purchase ? quantityInput(purchase.quantity) : '');
  const [paymentMode, setPaymentMode] = useState<'later' | 'now'>('later');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operationKey = useRef(id());
  const openingRevision = useRef(purchase?.revision);
  const paid = purchase ? billPaid(state, scope, purchase.billId) : 0;
  const hasRemainingAmount = (() => { try { return parseMoney(amount) > paid; } catch { return false; } })();
  const currentProduct = products.find(record => record.id === productId);
  const bill = purchase ? state.bills.find(record => record.scope === scope && record.id === purchase.billId) : undefined;
  const changeFileBusy = (value: boolean) => { setFileBusy(value); onBusyChange(value || busy); };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || fileBusy) return;
    setError('');
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    setBusy(true); onBusyChange(true);
    try {
      const totalCents = parseMoney(amount);
      const payload = {
        id: purchase?.id, revision: openingRevision.current, idempotencyKey: operationKey.current,
        ...(productId === '__new__' ? { product: { name: text('productName'), unit: text('unit'), lot: text('lot'), expiryDate: text('expiryDate'), minimum: Number(text('minimum').replace(',', '.')) } } : { productId }),
        supplierId: supplierId || null, date, dueDate, quantity: quantity(count), totalCents,
        notes: text('notes'), reason: text('reason'),
        ...(paymentMode === 'now' ? { payment: { accountId: text('accountId'), date: text('paymentDate'), method: text('method'), amountCents: purchase ? parseMoney(paymentAmount) : totalCents } } : {}),
      };
      const savedId = await command(attachments.length ? 'save.withAttachments' : 'purchase.save', attachments.length ? { action: 'purchase.save', data: payload, attachments } : payload);
      notify(purchase ? 'Compra corrigida. Estoque, conta e histórico preservados.' : 'Compra registrada com estoque e financeiro vinculados.');
      close(savedId);
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); onBusyChange(fileBusy); }
  }
  return <form className="record-form purchase-form" onSubmit={save}>
    {purchase && <p className="notice">Correção da compra · revisão {purchase.revision}. Já pago: <strong>{money(paid)}</strong>. O histórico e os pagamentos originais permanecem registrados.</p>}
    <div className="grid form-fields">
      <label className="field"><span>Material / produto</span><select required value={productId} onChange={event => { const selected = event.target.value; setProductId(selected); setSupplierId(products.find(record => record.id === selected)?.supplierId ?? ''); }}><option value="">Selecione</option><option value="__new__">Cadastrar material nesta compra</option>{products.map(record => <option key={record.id} value={record.id}>{record.name} · lote {record.lot || 'não informado'} · {record.unit}</option>)}</select></label>
      <label className="field"><span>Fornecedor (opcional)</span><select value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">Não informado</option>{contacts.map(record => <option key={record.id} value={record.id}>{record.name} · {record.kind}</option>)}</select></label>
    </div>
    {productId === '__new__' && <fieldset className="card record-form-section"><legend>Novo material / lote</legend><div className="grid form-fields">
      <label className="field"><span>Nome do material</span><input name="productName" required maxLength={150}/></label>
      <label className="field"><span>Unidade</span><input name="unit" required defaultValue="un" maxLength={150} placeholder="kg, g, un, L"/></label>
      <label className="field"><span>Lote (opcional)</span><input name="lot" maxLength={150}/></label>
      <label className="field"><span>Validade (opcional)</span><input name="expiryDate" type="date"/></label>
      <label className="field"><span>Estoque mínimo</span><input name="minimum" inputMode="decimal" defaultValue="0" required/></label>
    </div></fieldset>}
    <div className="grid form-fields">
      <label className="field"><span>Data da compra</span><input type="date" required max={today()} value={date} onChange={event => setDate(event.target.value)}/></label>
      <label className="field"><span>Quantidade{currentProduct ? ` (${currentProduct.unit})` : ''}</span><input inputMode="decimal" required value={count} onChange={event => setCount(event.target.value)}/></label>
      <label className="field"><span>Valor total da compra (R$)</span><input inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)}/></label>
      <label className="field"><span>Vencimento</span><input type="date" required min={date} value={dueDate} onChange={event => setDueDate(event.target.value)}/></label>
      <label className="field"><span>{purchase ? 'Pagamento adicional nesta correção' : 'Pagamento da compra'}</span><select value={paymentMode} onChange={event => { setPaymentMode(event.target.value as 'later' | 'now'); if (purchase && !paymentAmount) { try { setPaymentAmount(moneyInput(Math.max(0, parseMoney(amount) - paid))); } catch { /* Retain the user's amount until it is valid. */ } } }}><option value="later">{purchase ? 'Sem novo pagamento' : 'A prazo / ainda não pago'}</option><option value="now" disabled={!!purchase && !hasRemainingAmount}>{purchase ? 'Registrar dinheiro pago agora' : 'Pago agora — valor total'}</option></select></label>
    </div>
    {paymentMode === 'now' && <fieldset className="card record-form-section"><legend>Pagamento confirmado manualmente</legend><div className="grid form-fields">
      <label className="field"><span>Conta do pagamento</span><select name="accountId" required defaultValue=""><option value="">Selecione a conta de saída</option>{accounts.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
      <label className="field"><span>Data do pagamento</span><input name="paymentDate" type="date" required min={date} max={today()} defaultValue={today()}/></label>
      <label className="field"><span>Forma de pagamento</span><select name="method"><option>Pix manual</option><option>Dinheiro</option><option>Cartão manual</option><option>Transferência manual</option><option>Outro manual</option></select></label>
      {purchase && <label className="field"><span>Valor pago adicional (R$)</span><input inputMode="decimal" required value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)}/></label>}
    </div>{!accounts.length && <p className="error" role="alert">Cadastre uma conta financeira antes de confirmar um pagamento. Você pode salvar esta compra a prazo.</p>}<p className="muted">Confirme somente o dinheiro que efetivamente saiu da conta. A compra, a entrada e o pagamento são salvos juntos.</p></fieldset>}
    {purchase && bill && <p>Conta vinculada: {bill.description} · saldo atual {money(billOutstanding(state, scope, bill))}.</p>}
    <label className="field"><span>Observações internas</span><textarea name="notes" maxLength={2000} defaultValue={purchase?.notes}/></label>
    {purchase && <label className="field"><span>Motivo da correção</span><textarea name="reason" required maxLength={2000}/></label>}
    <AttachmentPicker value={attachments} onChange={setAttachments} category="Compra / material" disabled={busy} onBusyChange={changeFileBusy}/>
    <p className="muted">Saldo inicial, consumo e ajuste continuam em Registrar movimentação. Movimentos antigos não recebem despesas retroativas.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row modal-actions"><button className="button primary" disabled={busy || fileBusy || paymentMode === 'now' && !accounts.length}>{busy ? 'Salvando…' : purchase ? 'Confirmar correção' : 'Registrar compra'}</button><button type="button" className="button" disabled={busy || fileBusy} onClick={() => close()}>Cancelar</button></div>
  </form>;
}

export function CancelPurchaseForm({ state, scope, command, notify, purchase, close, onBusyChange }: Omit<FormProps, 'purchase'> & { purchase: Purchase }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const operationKey = useRef(id());
  const openingRevision = useRef(purchase.revision);
  const paid = billPaid(state, scope, purchase.billId);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); onBusyChange(true); setError('');
    try {
      await command('purchase.cancel', { id: purchase.id, revision: openingRevision.current, idempotencyKey: operationKey.current, date: String(form.get('date')), reason: String(form.get('reason')) });
      notify(paid ? 'Compra cancelada. A restituição do fornecedor está a receber; o pagamento original foi preservado.' : 'Compra cancelada com estoque compensado e histórico preservado.'); close(purchase.id);
    } catch (error) { setError(message(error)); } finally { setBusy(false); onBusyChange(false); }
  }
  return <form className="record-form" onSubmit={save}><p>O cancelamento compensa a entrada de material e encerra a obrigação. Se parte do material já saiu, revise as movimentações antes de cancelar.</p><p>{paid ? `Já pago: ${money(paid)}. Este valor ficará a receber como restituição do fornecedor. O dinheiro só retorna ao caixa depois de um recebimento real confirmado por você.` : 'Nenhum pagamento confirmado. Não será gerado recebimento nem estorno automático.'}</p><label className="field"><span>Data do cancelamento</span><input name="date" type="date" required min={purchase.date} max={today()} defaultValue={today()}/></label><label className="field"><span>Motivo do cancelamento</span><textarea name="reason" required maxLength={2000}/></label>{error && <p className="error" role="alert">{error}</p>}<div className="row modal-actions"><button className="button primary" disabled={busy}>{busy ? 'Cancelando…' : 'Confirmar cancelamento'}</button><button type="button" className="button" disabled={busy} onClick={() => close()}>Voltar sem cancelar</button></div></form>;
}

export function PurchaseDetails({ state, scope, purchase, onEdit, onCancel, onBill }: Pick<ModuleProps, 'state' | 'scope'> & { purchase: Purchase; onEdit: () => void; onCancel: () => void; onBill: (bill: Bill) => void }) {
  const [attachmentId, setAttachmentId] = useState('');
  const product = state.products.find(record => record.id === purchase.productId && record.scope === scope);
  const bill = state.bills.find(record => record.id === purchase.billId && record.scope === scope);
  const refund = state.bills.find(record => record.id === purchase.refundBillId && record.scope === scope);
  const supplier = state.contacts.find(record => record.id === purchase.supplierId && record.scope === scope);
  const attachments = state.attachments.filter(record => record.scope === scope && record.sourceType === 'purchase' && record.sourceId === purchase.id);
  const attachment = attachments.find(record => record.id === attachmentId);
  return <div className="purchase-details">
    <p>{product?.name ?? 'Material'} · lote {product?.lot || 'não informado'} · <span className="status-badge">{purchase.status === 'ativa' ? 'Compra ativa' : 'Compra cancelada'}</span></p>
    <p>{dateLabel(purchase.date)} · {purchase.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {product?.unit} · total <strong>{money(purchase.totalCents)}</strong></p>
    <p>Fornecedor: {supplier?.name ?? 'Não informado'} · vencimento {dateLabel(purchase.dueDate)}</p>
    <p>Pago confirmado: <strong>{money(billPaid(state, scope, purchase.billId))}</strong> · em aberto: <strong>{money(bill ? billOutstanding(state, scope, bill) : 0)}</strong></p>
    {purchase.notes && <p>Observações internas: {purchase.notes}</p>}
    <div className="row action-row">
      {bill && <button className="button" onClick={() => onBill(bill)}>Ver conta e pagamentos da compra</button>}
      {purchase.status === 'ativa' && <><button className="button" onClick={onEdit}>Corrigir compra</button><button className="button" onClick={onCancel}>Cancelar compra com histórico</button></>}
    </div>
    {refund && <section className="card record-form-section"><h3>Restituição do fornecedor</h3><p>Total a devolver {money(refund.amountCents)} · ainda a receber {money(billOutstanding(state, scope, refund))}.</p><p>O pagamento original não foi apagado. Confirme o recebimento somente quando o dinheiro retornar.</p><button className="button" onClick={() => onBill(refund)}>Ver restituição e registrar recebimento</button></section>}
    <h3>Histórico da compra</h3>
    {purchase.history.slice().reverse().map((entry, index) => <article className="ledger-entry" key={`${entry.revision}-${index}`}>
      <strong>{entry.action === 'criada' ? 'Registrada' : entry.action === 'corrigida' ? 'Corrigida' : 'Cancelada'} · revisão {entry.revision}</strong>
      <p>Registro em {new Date(entry.at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{entry.action === 'cancelada' && purchase.cancelledDate ? ` · cancelamento em ${dateLabel(purchase.cancelledDate)}` : ''}.</p>
      <p>Compra de {dateLabel(entry.date)} · {state.products.find(record => record.scope === scope && record.id === entry.productId)?.name ?? 'Material'} · {entry.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} · {money(entry.totalCents)} · vencimento {dateLabel(entry.dueDate)}</p>
      {entry.reason && <p>{entry.reason}</p>}{entry.notes && <p>Observações registradas: {entry.notes}</p>}
    </article>)}
    <details><summary>Entradas e compensações vinculadas</summary>{state.stock.filter(record => record.scope === scope && record.purchaseId === purchase.id).map(record => <p className="ledger-entry" key={record.id}>{dateLabel(record.date)} · {record.kind} · {record.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} · {record.reason}</p>)}</details>
    {!!attachments.length && <section className="record-form-section"><h3>Arquivos da compra</h3><div className="row action-row">{attachments.map(record => <button key={record.id} className="button" onClick={() => setAttachmentId(record.id)} aria-label={`Ver arquivo · ${record.title}`}>{record.title}</button>)}</div>{attachment && <AttachmentPreview attachment={attachment}/>}</section>}
  </div>;
}
