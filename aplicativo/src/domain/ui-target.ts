/** Session-only navigation hints. They never change a domain record. */
export type NavigationTarget = {
  view: string;
  birdId?: string;
  pairId?: string;
  clutchId?: string;
  eggId?: string;
  taskId?: string;
  contactId?: string;
  saleId?: string;
  attachmentId?: string;
  issuedDocumentId?: string;
  billId?: string;
  filter?: string;
  createAction?: string;
  request?: number;
};
