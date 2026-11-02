export interface HistoryItem {
  id: string;
  date: string;
  text: string;
  type: "note" | "status_change" | "payment" | "contract";
}

export interface Payment {
  id: string;
  type: "configuration" | "monthly";
  dueDate: string;
  paidDate?: string;
  amount: number;
  status: "pending" | "paid";
  monthReference?: string;
  installmentNumber?: number; // 1, 2, 3...
  totalInstallments?: number; // 3
  description?: string;
  invoiceUrl?: string;
  
  // Commission Repasse EGN fields
  commissionPaidToEgn?: boolean;
  egnCommissionAmount?: number; // Exact commission amount allocated for this payment
  egnRepassePaidDate?: string; // YYYY-MM-DD date of transfer to EGN
  egnRepasseProofUrl?: string; // Base64 or URL of payment proof/receipt
  egnRepasseProofName?: string; // Name of uploaded file
  egnRepasseNotes?: string; // Additional payment notes
  egnRepasseBatchId?: string; // ID of consolidated batch repasse
  
  // Asaas integrations fields
  asaasPaymentId?: string;
  asaasPaymentLink?: string;
  asaasSubscriptionId?: string;
}

export interface EgnRepasseBatch {
  id: string;
  date: string;
  totalAmount: number;
  grossCollectedAmount?: number;
  proofUrl?: string;
  proofName?: string;
  notes?: string;
  items: {
    clientLeadId: string;
    clientName: string;
    company: string;
    paymentId: string;
    paymentType: "configuration" | "monthly";
    paymentAmount: number;
    commissionAmount: number;
    paidDate?: string;
    monthReference?: string;
    installmentNumber?: number;
  }[];
  createdAt: string;
}

export interface ContractData {
  fullName: string;
  document: string; // CPF or CNPJ
  representative: string;
  address: string;
  phone: string;
  email: string;
  signedAt: string;
  signature: string; // Canvas base64 string or typed signature
  ipAddress: string;
  clientCompany?: string;
  clientBirthDate?: string;
}

export interface ContractConfig {
  contratadaName: string;
  contratadaBrand: string;
  contratadaAddress: string;

  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientDoc: string;
  clientBirthDate: string;
  clientPhone: string;
  clientAddress: string;

  serviceTitle: string;
  frequency: "MENSAL" | "ANUAL";
  installmentValue: number | "";
  monthlyFeeDueDay?: number;
  firstMonthlyDueDate?: string; // YYYY-MM-DD
  monthlyDueDateOption?: "signing_date" | "custom_date";
  totalAnnualValue?: number | "";
  setupFee: number | "";
  setupInstallments?: number;
  setupDueDate?: string; // YYYY-MM-DD
  setupDueDateOption?: "signing_date" | "custom_date";

  zelleKey: string;
  venmoKey: string;
  pixKey: string;
  paymentLink: string;

  activationInstructions: string;
  clause1Title: string;
  clause1Body: string;
  clause2Title: string;
  clause2Body: string;
  clause3Title: string;
  clause3Body: string;
  clause4Title: string;
  clause4Body: string;
  clause5Title: string;
  clause5Body: string;
  clause6Title: string;
  clause6Body: string;
  clause7Title: string;
  clause7Body: string;
  clause8Title: string;
  clause8Body: string;
  clause9Title: string;
  clause9Body: string;
  clause10Title?: string;
  clause10Body?: string;
  additionalClauses?: Array<{ id: string; title: string; body: string }>;
}

export type FilterStatus = "new" | "contacted" | "negotiation" | "closed_won" | "lost" | "lead" | "client";
export type UserRole = "admin" | "viewer";

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: FilterStatus;
  createdAt: string;
  updatedAt: string;
  history: HistoryItem[];
  
  instagram?: string;
  site?: string;
  googleStudioAppAccount?: string; // Conta google studio app
  firebaseAppAccount?: string;     // Conta firebase app
  
  // Client details & Asaas Links
  configurationFee?: number;
  configurationFeePaid?: boolean;
  monthlyFee?: number;
  monthlyFeeDueDay?: number;
  firstMonthlyDueDate?: string; // YYYY-MM-DD
  monthlyDueDateOption?: "signing_date" | "custom_date";
  setupDueDate?: string; // YYYY-MM-DD
  setupDueDateOption?: "signing_date" | "custom_date";
  payments?: Payment[];
  setupInstallments?: number;
  
  /**
   * Link gerado manualmente no Asaas para pagamento da Taxa de Configuração / Setup (em até 3 parcelas).
   * Recebe: URL de pagamento/cobrança gerada no Asaas (Ex: https://www.asaas.com/c/...)
   * Função: Permite copiar/enviar o link de setup ao cliente e associar à baixa financeira.
   */
  setupPaymentLink?: string;
  
  /**
   * Link gerado manualmente no Asaas para pagamento contínuo da Mensalidade Recorrente (Assinatura).
   * Recebe: URL da assinatura/carnê gerado no Asaas (Ex: https://www.asaas.com/c/...)
   * Função: Permite copiar/enviar o link de mensalidade ao cliente e receber confirmação automática.
   */
  monthlyPaymentLink?: string;
  
  /**
   * Status do pagamento da taxa de setup (Pendente, Parcial ou Pago).
   * Atualizado manualmente ou automaticamente quando o Webhook do Asaas identifica a quitação total ou parcial.
   */
  setupPaymentStatus?: "pending" | "partial" | "paid";

  /**
   * Status do pagamento da mensalidade (Pendente ou Pago).
   * Atualizado automaticamente via Webhook do Asaas quando a mensalidade é confirmada.
   */
  monthlyPaymentStatus?: "pending" | "paid";

  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  financialStatus?: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO";
  document?: string;
  cpf?: string;
  cnpj?: string;
  whatsapp?: string;
  logs?: { date: string; action: string; user?: string }[];
  
  // Status de Ativação / Inativação de App & Contrato
  isActive?: boolean;
  
  // Contract details
  contractSlug?: string;
  contractStatus?: "none" | "pending" | "signed";
  contractData?: ContractData;
  contractConfig?: ContractConfig;
}
