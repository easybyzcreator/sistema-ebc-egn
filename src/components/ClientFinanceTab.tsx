import React, { useState, useEffect, useMemo } from "react";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, Payment, HistoryItem } from "../types";
import DatePickerBR from "./DatePickerBR";
import DashboardKPIs from "./DashboardKPIs";
import { calcEgnCommissionSingle } from "../lib/masks";
import { 
  Landmark, 
  Check, 
  Calendar, 
  BadgePercent, 
  Copy, 
  ExternalLink, 
  Upload, 
  FileText, 
  Paperclip, 
  Eye, 
  Download, 
  X, 
  FileCheck, 
  History, 
  Clock, 
  FileUp, 
  CheckCircle2, 
  Search, 
  Users, 
  ArrowLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  CalendarRange,
  RefreshCw,
  AlertCircle,
  Plus,
  CreditCard,
  DollarSign,
  CheckCheck,
  Activity,
  ShieldCheck,
  Info,
  Lock,
  ShieldAlert,
  Trash2,
  Loader2,
  AlertTriangle
} from "lucide-react";

// Função utilitária para garantir que nenhum campo 'undefined' seja enviado ao Firestore
function cleanForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as unknown as T;
  }
  if (data !== null && typeof data === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

interface ClientFinanceTabProps {
  leads: Lead[];
  isReadOnly: boolean;
}

interface RepasseItem {
  clientLeadId: string;
  clientName: string;
  company: string;
  payment: Payment;
  commissionAmount: number;
}

function BrDateInput({
  value,
  onChange,
  required,
  className
}: {
  value: string;
  onChange: (isoValue: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <DatePickerBR
      value={value}
      onChange={onChange}
      required={required}
      className={className || "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]"}
    />
  );
}

export default function ClientFinanceTab({ leads, isReadOnly }: ClientFinanceTabProps) {
  // In the unified dashboard, all active entities (isActive !== false) are trackable clients
  const clients = leads.filter(l => l.isActive !== false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  const selectedClient = selectedClientId 
    ? (leads.find(l => l.id === selectedClientId) || null) 
    : null;

  // Repasse state
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [repasseFilterTab, setRepasseFilterTab] = useState<"pendentes" | "historico">("pendentes");
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "confirmados" | "parcial" | "pendentes" | "atrasados">("todos");
  
  // Batch Repasse modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const getSuggested25thDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-25`;
  };

  const [repasseDate, setRepasseDate] = useState<string>(getSuggested25thDate());
  const [repasseNotes, setRepasseNotes] = useState<string>("");
  const [repasseProofFile, setRepasseProofFile] = useState<string | null>(null);
  const [repasseProofFileName, setRepasseProofFileName] = useState<string | null>(null);
  const [savingRepasse, setSavingRepasse] = useState(false);

  // Proof Viewer Modal
  const [proofViewerModal, setProofViewerModal] = useState<{
    url: string;
    name: string;
    date?: string;
    clientName?: string;
    amount?: number;
  } | null>(null);

  // Modal para Anexar / Atualizar Comprovante de Repasse (Ciclo ou Itens Selecionados)
  const [attachProofModal, setAttachProofModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    totalAmount: number;
    paidDate: string;
    notes: string;
    proofUrl: string | null;
    proofName: string | null;
    targetItems: Array<{ clientLeadId: string; paymentId: string; clientName: string; amount: number; comm: number }>;
  } | null>(null);
  const [savingAttachProof, setSavingAttachProof] = useState(false);

  const [syncingStatus, setSyncingStatus] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ type: string; id: string | number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Copied link state feedback
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);

  // New manual payment state inside selected client modal
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [newPaymentType, setNewPaymentType] = useState<"configuration" | "monthly">("monthly");
  const [newPaymentAmount, setNewPaymentAmount] = useState<number>(0);
  const [newPaymentDueDate, setNewPaymentDueDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const handleCopyLink = (url: string, type: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2500);
  };

  const handleAddManualPayment = async () => {
    if (isReadOnly || !selectedClient) return;
    if (!newPaymentAmount || newPaymentAmount <= 0) {
      alert("Por favor, informe um valor válido para a cobrança.");
      return;
    }
    try {
      const currentPayments: Payment[] = [...(selectedClient.payments || [])];
      const newPayment: Payment = {
        id: `${newPaymentType}_${Date.now()}`,
        type: newPaymentType,
        amount: newPaymentAmount,
        dueDate: newPaymentDueDate || new Date().toISOString().split("T")[0],
        status: "pending"
      };
      currentPayments.push(newPayment);

      const clientRef = doc(db, "leads", selectedClient.id);
      await updateDoc(clientRef, cleanForFirestore({
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      }));

      setShowAddPaymentForm(false);
      setNewPaymentAmount(0);
    } catch (err: any) {
      alert("Erro ao adicionar cobrança: " + err.message);
    }
  };

  const formatDateBr = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return "0,00";
    return (Math.round(val * 100) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Filtro de período personalizado de recebimentos
  const [periodStartDate, setPeriodStartDate] = useState<string>("");
  const [periodEndDate, setPeriodEndDate] = useState<string>("");
  const [showPeriodFilter, setShowPeriodFilter] = useState<boolean>(true);
  const [showPeriodTable, setShowPeriodTable] = useState<boolean>(true);

  const handleManualSyncAll = async () => {
    if (isReadOnly || isSyncingAll) return;
    setIsSyncingAll(true);
    setSyncFeedback("Sincronizando com Asaas...");
    try {
      const res = await fetch("/api/asaas/sync-all-pending", { method: "POST" });
      const data = await res.json();
      setSyncFeedback(data.updatedCount ? `${data.updatedCount} cliente(s) atualizados com sucesso!` : "Todos os clientes já estão sincronizados!");
    } catch {
      setSyncFeedback("Erro ao conectar com Asaas.");
    } finally {
      setIsSyncingAll(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  // Sincronização inicial única sem looping/interval periódico para evitar oscilações na interface
  useEffect(() => {
    if (isReadOnly) return;
    const runInitialSync = async () => {
      try {
        await fetch("/api/asaas/sync-all-pending", { method: "POST" });
      } catch {}
    };
    runInitialSync();
  }, [isReadOnly]);

  // Auto-sync when a specific client modal is opened
  useEffect(() => {
    if (!selectedClientId || isReadOnly) return;
    const syncCurrent = async () => {
      try {
        await fetch("/api/asaas/sync-client-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: selectedClientId })
        });
      } catch {}
    };
    syncCurrent();
  }, [selectedClientId, isReadOnly]);

  // Toggle item payment status
  const handleTogglePaymentItemStatus = async (paymentId: string, currentStatus?: string, targetPaidDate?: string) => {
    if (isReadOnly || !selectedClient) return;
    setActionLoading({ type: "payment", id: paymentId });
    setActionFeedback(null);
    try {
      const nextStatus = currentStatus === "paid" ? "pending" : "paid";
      const todayStr = new Date().toISOString().split("T")[0];
      const effectivePaidDate = targetPaidDate || (nextStatus === "paid" ? todayStr : undefined);

      const setupFee = Number(selectedClient.configurationFee || 0);
      const totalSetupInst = Number(selectedClient.setupInstallments || selectedClient.contractConfig?.setupInstallments || (setupFee > 0 ? 3 : 1));
      const expectedInstAmount = totalSetupInst > 0 ? Math.round((setupFee / totalSetupInst) * 100) / 100 : setupFee;

      let currentPayments: Payment[] = (selectedClient.payments && selectedClient.payments.length > 0)
        ? [...selectedClient.payments]
        : [];

      if (currentPayments.length === 0) {
        if (setupFee > 0) {
          for (let i = 1; i <= totalSetupInst; i++) {
            currentPayments.push({
              id: `setup_inst_${i}_${selectedClient.id}`,
              type: "configuration",
              dueDate: new Date().toISOString().split("T")[0],
              amount: expectedInstAmount,
              status: selectedClient.setupPaymentStatus === "paid" ? "paid" : "pending",
              installmentNumber: i,
              totalInstallments: totalSetupInst
            });
          }
        }
        if (selectedClient.monthlyFee) {
          currentPayments.push({
            id: `monthly_${selectedClient.id}`,
            type: "monthly",
            dueDate: new Date().toISOString().split("T")[0],
            amount: selectedClient.monthlyFee,
            status: selectedClient.monthlyPaymentStatus === "paid" ? "paid" : "pending"
          });
        }
      }

      let matched = false;
      let updatedPayments = currentPayments.map(p => {
        if (p.id === paymentId || (p as any).asaasPaymentId === paymentId) {
          matched = true;
          const { paidDate, ...rest } = p;
          const updated: Payment = {
            ...rest,
            status: nextStatus as "paid" | "pending"
          };
          if (nextStatus === "paid") {
            updated.paidDate = effectivePaidDate;
          }
          return updated;
        }
        return p;
      });

      if (!matched) {
        const isSetupId = paymentId.includes("setup");
        const instMatch = paymentId.match(/setup_inst_(\d+)/);
        const instNum = instMatch ? parseInt(instMatch[1], 10) : undefined;
        
        let monthRef: string | undefined = undefined;
        const monthRefMatch = paymentId.match(/monthly_.*?_(\d{2})_(\d{4})/);
        if (monthRefMatch) {
          monthRef = `${monthRefMatch[1]}/${monthRefMatch[2]}`;
        } else if (!isSetupId) {
          const now = new Date();
          monthRef = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
        }

        const newPayment: Payment = {
          id: paymentId,
          type: isSetupId ? "configuration" : "monthly",
          dueDate: todayStr,
          amount: isSetupId ? expectedInstAmount : (selectedClient.monthlyFee || 0),
          status: nextStatus as "paid" | "pending",
          ...(isSetupId && {
            installmentNumber: instNum,
            totalInstallments: totalSetupInst
          }),
          ...(monthRef && {
            monthReference: monthRef
          })
        };
        if (nextStatus === "paid") {
          newPayment.paidDate = effectivePaidDate;
        }
        updatedPayments.push(newPayment);
      }

      const allSetupAfter = updatedPayments.filter(p => p.type === "configuration");
      const paidSetupCount = allSetupAfter.filter(p => p.status === "paid").length;
      
      let newSetupStatus: "paid" | "partial" | "pending" = "pending";
      let newConfigFeePaid = false;
      if (allSetupAfter.length > 0) {
        if (paidSetupCount === allSetupAfter.length) {
          newSetupStatus = "paid";
          newConfigFeePaid = true;
        } else if (paidSetupCount > 0) {
          newSetupStatus = "partial";
          newConfigFeePaid = false;
        } else {
          newSetupStatus = "pending";
          newConfigFeePaid = false;
        }
      } else {
        newSetupStatus = selectedClient.setupPaymentStatus || "pending";
        newConfigFeePaid = selectedClient.configurationFeePaid || false;
      }

      const now = new Date();
      const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
      const allMonthlyAfter = updatedPayments.filter(p => p.type === "monthly");
      const currentMonthPayment = allMonthlyAfter.find(p => {
        if (p.monthReference === currentMonthYear) return true;
        const pDate = p.dueDate || p.paidDate;
        if (pDate && pDate.includes("-")) {
          const parts = pDate.split("-");
          return `${parts[1]}/${parts[0]}` === currentMonthYear;
        }
        return false;
      });

      const newMonthlyStatus: "paid" | "pending" = currentMonthPayment
        ? (currentMonthPayment.status === "paid" ? "paid" : "pending")
        : (allMonthlyAfter.some(p => p.status === "pending") ? "pending" : (allMonthlyAfter.some(p => p.status === "paid") ? "paid" : "pending"));

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (allSetupAfter.length > 0) {
        if (newSetupStatus === "paid" && newMonthlyStatus === "paid") newFinStatus = "CONFIRMADO";
        else if (paidSetupCount > 0 || newMonthlyStatus === "paid" || allMonthlyAfter.some(p => p.status === "paid")) newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = newMonthlyStatus === "paid" ? "CONFIRMADO" : "PENDENTE";
      }

      let historyText = "";
      if (paymentId.includes("setup")) {
        historyText = nextStatus === "paid"
          ? `Parcela de Setup marcada como PAGA manualmente em ${formatDateBr(todayStr)}.`
          : `Quitação de parcela de Setup foi desfeita.`;
      } else {
        const refMatch = paymentId.match(/monthly_.*?_(\d{2})_(\d{4})/);
        const refText = refMatch ? ` (Ref: ${refMatch[1]}/${refMatch[2]})` : "";
        historyText = nextStatus === "paid"
          ? `Mensalidade${refText} de R$ ${(selectedClient.monthlyFee || 0).toFixed(2)} marcada como PAGA manualmente em ${formatDateBr(todayStr)}.`
          : `Quitação de mensalidade${refText} foi desfeita.`;
      }

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: historyText,
        type: "payment"
      };

      const clientRef = doc(db, "leads", selectedClient.id);
      const updateData = cleanForFirestore({
        payments: updatedPayments,
        setupPaymentStatus: newSetupStatus,
        configurationFeePaid: newConfigFeePaid,
        monthlyPaymentStatus: newMonthlyStatus,
        financialStatus: newFinStatus,
        history: [...(selectedClient.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      await updateDoc(clientRef, updateData);
      setActionFeedback({
        type: "success",
        text: nextStatus === "paid" ? "Baixa realizada com sucesso!" : "Quitação desfeita com sucesso!"
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      console.error("Erro ao alterar pagamento:", err);
      setActionFeedback({
        type: "error",
        text: "Erro ao alterar pagamento: " + (err.message || "Tente novamente")
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Dar baixa ou desfazer em UMA parcela individual de setup
  const handleToggleInstallment = async (installmentNumber: number, targetStatus?: "paid" | "pending", paymentId?: string) => {
    if (isReadOnly || !selectedClient) return;
    setActionLoading({ type: "installment", id: installmentNumber });
    setActionFeedback(null);
    try {
      const cfgFee = Number(selectedClient.configurationFee || 0);
      const totalInst = Number(selectedClient.setupInstallments || (selectedClient.contractConfig?.setupInstallments) || (cfgFee > 0 ? 3 : 1));
      const expectedInstAmount = totalInst > 0 ? Math.round((cfgFee / totalInst) * 100) / 100 : cfgFee;

      let currentPayments = [...(selectedClient.payments || [])];
      const baseDueDateStr = selectedClient.setupDueDate || selectedClient.contractConfig?.setupDueDate;
      const todayStr = new Date().toISOString().split("T")[0];

      // Se não há as parcelas de setup estruturadas no array, inicializa todas
      const existingSetup = currentPayments.filter(p => p.type === "configuration");
      if (existingSetup.length < totalInst) {
        const generatedSetup: Payment[] = [];
        for (let i = 1; i <= totalInst; i++) {
          const found = existingSetup.find(p => p.installmentNumber === i) || existingSetup[i - 1];
          if (found) {
            generatedSetup.push({
              ...found,
              installmentNumber: i,
              totalInstallments: totalInst
            });
          } else {
            let dueDateObj: Date;
            if (baseDueDateStr) {
              const parts = baseDueDateStr.split("-");
              const bYear = parseInt(parts[0], 10);
              const bMonth = parseInt(parts[1], 10) - 1;
              const bDay = parseInt(parts[2], 10);
              dueDateObj = new Date(bYear, bMonth + (i - 1), bDay);
            } else {
              const today = new Date();
              dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
            }

            generatedSetup.push({
              id: `setup_inst_${i}_${selectedClient.id}`,
              type: "configuration",
              dueDate: dueDateObj.toISOString().split("T")[0],
              amount: expectedInstAmount,
              status: "pending",
              installmentNumber: i,
              totalInstallments: totalInst
            });
          }
        }
        currentPayments = [
          ...generatedSetup,
          ...currentPayments.filter(p => p.type !== "configuration")
        ];
      }

      // Procurar parcela para atualizar
      let instIdx = -1;
      if (paymentId) {
        instIdx = currentPayments.findIndex(p => p.id === paymentId || (p as any).asaasPaymentId === paymentId);
      }
      if (instIdx === -1) {
        instIdx = currentPayments.findIndex(p => p.type === "configuration" && p.installmentNumber === installmentNumber);
      }
      if (instIdx === -1) {
        const setupSublist = currentPayments.filter(p => p.type === "configuration");
        if (setupSublist[installmentNumber - 1]) {
          instIdx = currentPayments.indexOf(setupSublist[installmentNumber - 1]);
        }
      }

      let nextStatus: "paid" | "pending" = targetStatus || "paid";

      if (instIdx !== -1) {
        const cur = currentPayments[instIdx];
        nextStatus = targetStatus || (cur.status === "paid" ? "pending" : "paid");
        const { paidDate, ...rest } = cur;
        const updatedInst: Payment = {
          ...rest,
          type: "configuration",
          installmentNumber: installmentNumber,
          totalInstallments: totalInst,
          status: nextStatus
        };
        if (nextStatus === "paid") {
          updatedInst.paidDate = cur.paidDate || todayStr;
        }
        currentPayments[instIdx] = updatedInst;
      } else {
        // Se ainda assim não encontrou, insere no array
        let dueDateStr = todayStr;
        if (baseDueDateStr) {
          const parts = baseDueDateStr.split("-");
          const bYear = parseInt(parts[0], 10);
          const bMonth = parseInt(parts[1], 10) - 1;
          const bDay = parseInt(parts[2], 10);
          dueDateStr = new Date(bYear, bMonth + (installmentNumber - 1), bDay).toISOString().split("T")[0];
        }
        const newInst: Payment = {
          id: paymentId || `setup_inst_${installmentNumber}_${selectedClient.id}`,
          type: "configuration",
          dueDate: dueDateStr,
          amount: expectedInstAmount,
          status: nextStatus,
          installmentNumber: installmentNumber,
          totalInstallments: totalInst
        };
        if (nextStatus === "paid") {
          newInst.paidDate = todayStr;
        }
        currentPayments.push(newInst);
      }

      const allSetupAfter = currentPayments.filter(p => p.type === "configuration");
      const paidSetupCount = allSetupAfter.filter(p => p.status === "paid").length;

      let nextSetupStatus: "paid" | "partial" | "pending" = "pending";
      let nextConfigFeePaid = false;
      if (paidSetupCount >= totalInst && totalInst > 0) {
        nextSetupStatus = "paid";
        nextConfigFeePaid = true;
      } else if (paidSetupCount > 0) {
        nextSetupStatus = "partial";
        nextConfigFeePaid = false;
      } else {
        nextSetupStatus = "pending";
        nextConfigFeePaid = false;
      }

      const isMonthlyPaid = selectedClient.monthlyPaymentStatus === "paid" || currentPayments.some(p => p.type === "monthly" && p.status === "paid");
      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (nextSetupStatus === "paid" && isMonthlyPaid) {
        newFinStatus = "CONFIRMADO";
      } else if (paidSetupCount > 0 || isMonthlyPaid) {
        newFinStatus = "PAGO PARCIAL";
      }

      const historyText = nextStatus === "pending"
        ? `Pagamento da Parcela ${installmentNumber} de ${totalInst} da Taxa de Setup desfeito.`
        : `Parcela ${installmentNumber} de ${totalInst} da Taxa de Setup (R$ ${formatMoney(expectedInstAmount)}) marcada como PAGA manualmente em ${formatDateBr(todayStr)}.`;

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: historyText,
        type: "payment"
      };

      const clientRef = doc(db, "leads", selectedClient.id);
      const updateData = cleanForFirestore({
        setupPaymentStatus: nextSetupStatus,
        configurationFeePaid: nextConfigFeePaid,
        financialStatus: newFinStatus,
        payments: currentPayments,
        history: [...(selectedClient.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      await updateDoc(clientRef, updateData);
      setActionFeedback({
        type: "success",
        text: nextStatus === "paid" ? `Parcela ${installmentNumber} baixada como Paga!` : `Parcela ${installmentNumber} desfeita!`
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      console.error("Erro ao alterar parcela:", err);
      setActionFeedback({
        type: "error",
        text: "Erro ao alterar parcela: " + (err.message || "Tente novamente")
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Excluir fatura ou parcela individual do cliente
  const handleDeletePaymentItem = async (paymentId: string) => {
    if (isReadOnly || !selectedClient) return;
    if (!window.confirm("Deseja realmente remover este registro de fatura/parcela deste cliente?")) return;
    try {
      const currentPayments = (selectedClient.payments || []).filter(p => p.id !== paymentId && (p as any).asaasPaymentId !== paymentId);

      const allSetupAfter = currentPayments.filter(p => p.type === "configuration");
      const paidSetupCount = allSetupAfter.filter(p => p.status === "paid").length;
      const isMonthlyPaid = currentPayments.filter(p => p.type === "monthly").some(p => p.status === "paid");

      let newSetupStatus: "paid" | "partial" | "pending" = "pending";
      if (allSetupAfter.length > 0) {
        if (paidSetupCount === allSetupAfter.length) newSetupStatus = "paid";
        else if (paidSetupCount > 0) newSetupStatus = "partial";
        else newSetupStatus = "pending";
      } else {
        newSetupStatus = selectedClient.setupPaymentStatus || "pending";
      }

      const newMonthlyStatus = isMonthlyPaid ? "paid" : "pending";

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (allSetupAfter.length > 0) {
        if (newSetupStatus === "paid" && newMonthlyStatus === "paid") newFinStatus = "CONFIRMADO";
        else if (paidSetupCount > 0 || newMonthlyStatus === "paid") newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = newMonthlyStatus === "paid" ? "CONFIRMADO" : "PENDENTE";
      }

      const clientRef = doc(db, "leads", selectedClient.id);
      const updateData = cleanForFirestore({
        payments: currentPayments,
        setupPaymentStatus: newSetupStatus,
        configurationFeePaid: newSetupStatus === "paid",
        monthlyPaymentStatus: newMonthlyStatus,
        financialStatus: newFinStatus,
        updatedAt: new Date().toISOString()
      });

      await updateDoc(clientRef, updateData);
    } catch (err: any) {
      console.error("Erro ao remover registro:", err);
      setActionFeedback({
        type: "error",
        text: "Erro ao remover registro: " + (err.message || "Tente novamente")
      });
    }
  };

  const handleToggleSetupStatus = async () => {
    if (isReadOnly || !selectedClient) return;
    setActionLoading({ type: "setup_all", id: "all" });
    setActionFeedback(null);
    try {
      const cfgFee = Number(selectedClient.configurationFee || 0);
      const totalInst = Number(selectedClient.setupInstallments || (selectedClient.contractConfig?.setupInstallments) || (cfgFee > 0 ? 3 : 1));
      const expectedInstAmount = totalInst > 0 ? Math.round((cfgFee / totalInst) * 100) / 100 : cfgFee;

      const overview = getClientFinanceOverview(selectedClient);
      const isCurrentlyPaid = overview.setupStatusBadge === "paid";
      const nextPaid = !isCurrentlyPaid;
      const nextStatus: "paid" | "pending" = nextPaid ? "paid" : "pending";
      const todayStr = new Date().toISOString().split("T")[0];

      let currentPayments = [...(selectedClient.payments || [])];
      const existingSetup = currentPayments.filter(p => p.type === "configuration");

      if (existingSetup.length < totalInst) {
        const generatedSetup: Payment[] = [];
        const baseDueDateStr = selectedClient.setupDueDate || selectedClient.contractConfig?.setupDueDate;
        for (let i = 1; i <= totalInst; i++) {
          const found = existingSetup.find(p => p.installmentNumber === i) || existingSetup[i - 1];
          if (found) {
            const { paidDate, ...rest } = found;
            const item: Payment = {
              ...rest,
              installmentNumber: i,
              totalInstallments: totalInst,
              status: nextStatus
            };
            if (nextStatus === "paid") item.paidDate = found.paidDate || todayStr;
            generatedSetup.push(item);
          } else {
            let dueDateObj: Date;
            if (baseDueDateStr) {
              const parts = baseDueDateStr.split("-");
              const bYear = parseInt(parts[0], 10);
              const bMonth = parseInt(parts[1], 10) - 1;
              const bDay = parseInt(parts[2], 10);
              dueDateObj = new Date(bYear, bMonth + (i - 1), bDay);
            } else {
              const today = new Date();
              dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
            }
            const item: Payment = {
              id: `setup_inst_${i}_${selectedClient.id}`,
              type: "configuration",
              dueDate: dueDateObj.toISOString().split("T")[0],
              amount: expectedInstAmount,
              status: nextStatus,
              installmentNumber: i,
              totalInstallments: totalInst
            };
            if (nextStatus === "paid") item.paidDate = todayStr;
            generatedSetup.push(item);
          }
        }
        currentPayments = [
          ...generatedSetup,
          ...currentPayments.filter(p => p.type !== "configuration")
        ];
      } else {
        currentPayments = currentPayments.map(p => {
          if (p.type === "configuration") {
            const { paidDate, ...rest } = p;
            const updated: Payment = {
              ...rest,
              status: nextStatus
            };
            if (nextStatus === "paid") updated.paidDate = p.paidDate || todayStr;
            return updated;
          }
          return p;
        });
      }

      const isMonthlyPaid = selectedClient.monthlyPaymentStatus === "paid" || currentPayments.some(p => p.type === "monthly" && p.status === "paid");
      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (nextStatus === "paid" && isMonthlyPaid) newFinStatus = "CONFIRMADO";
      else if (nextStatus === "paid" || isMonthlyPaid) newFinStatus = "PAGO PARCIAL";

      const clientRef = doc(db, "leads", selectedClient.id);
      const updateData = cleanForFirestore({
        setupPaymentStatus: nextStatus,
        configurationFeePaid: nextPaid,
        financialStatus: newFinStatus,
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      });

      await updateDoc(clientRef, updateData);
      setActionFeedback({
        type: "success",
        text: nextPaid ? "Todas as parcelas do Setup marcadas como PAGAS!" : "Quitação do Setup desfeita com sucesso!"
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      console.error("Erro ao atualizar status do Setup:", err);
      setActionFeedback({
        type: "error",
        text: "Erro ao atualizar status do Setup: " + (err.message || "Tente novamente")
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleMonthlyStatus = async () => {
    if (isReadOnly || !selectedClient) return;
    setActionLoading({ type: "monthly_all", id: "all" });
    setActionFeedback(null);
    try {
      const current = selectedClient.monthlyPaymentStatus === "paid";
      const nextPaid = !current;
      const nextStatus = nextPaid ? "paid" : "pending";
      const todayStr = new Date().toISOString().split("T")[0];

      const currentPayments = [...(selectedClient.payments || [])];
      const monthlyIdx = currentPayments.findIndex(p => p.type === "monthly");
      if (monthlyIdx !== -1) {
        const { paidDate, ...rest } = currentPayments[monthlyIdx];
        const updated: Payment = {
          ...rest,
          status: nextStatus
        };
        if (nextPaid) updated.paidDate = paidDate || todayStr;
        currentPayments[monthlyIdx] = updated;
      } else {
        const item: Payment = {
          id: `monthly_${Date.now()}`,
          type: "monthly",
          dueDate: todayStr,
          amount: selectedClient.monthlyFee || 1548.58,
          status: nextStatus
        };
        if (nextPaid) item.paidDate = todayStr;
        currentPayments.push(item);
      }

      const isSetupPaid = selectedClient.setupPaymentStatus === "paid" || selectedClient.configurationFeePaid;
      const hasSetup = Boolean(selectedClient.configurationFee && selectedClient.configurationFee > 0);

      let newFinStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
      if (hasSetup) {
        if (isSetupPaid && nextPaid) newFinStatus = "CONFIRMADO";
        else if (isSetupPaid || nextPaid) newFinStatus = "PAGO PARCIAL";
      } else {
        newFinStatus = nextPaid ? "CONFIRMADO" : "PENDENTE";
      }

      const clientRef = doc(db, "leads", selectedClient.id);
      const updateData = cleanForFirestore({
        monthlyPaymentStatus: nextStatus,
        financialStatus: newFinStatus,
        payments: currentPayments,
        updatedAt: new Date().toISOString()
      });

      await updateDoc(clientRef, updateData);
      setActionFeedback({
        type: "success",
        text: nextPaid ? "Mensalidade marcada como PAGA!" : "Quitação de mensalidade desfeita!"
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      console.error("Erro ao atualizar status da Mensalidade:", err);
      setActionFeedback({
        type: "error",
        text: "Erro ao atualizar status da Mensalidade: " + (err.message || "Tente novamente")
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualSyncStatus = async () => {
    if (!selectedClient) return;
    try {
      setSyncingStatus(true);
      const res = await fetch("/api/asaas/sync-client-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedClient.id,
          customerId: (selectedClient as any).asaasCustomerId,
          subscriptionId: (selectedClient as any).asaasSubscriptionId,
          email: selectedClient.email,
          setupPaymentLink: selectedClient.setupPaymentLink,
          monthlyPaymentLink: selectedClient.monthlyPaymentLink
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.found || (data.details && data.details.length > 0)) {
          const detailMsg = data.details?.length > 0 ? `\n\nDetalhes:\n• ${data.details.join("\n• ")}` : "";
          alert(`✅ Sincronização concluída com sucesso!${detailMsg}\n\nStatus Atual:\n• Setup: ${data.setupPaymentStatus === "paid" ? "PAGO" : "PENDENTE"}\n• Assinatura/Mensalidade: ${data.monthlyPaymentStatus === "paid" ? "PAGA" : "PENDENTE"}`);
        } else {
          alert(`ℹ️ Consulta ao Asaas realizada.\n\nStatus retornado:\n• Setup: ${data.setupPaymentStatus === "paid" ? "PAGO" : "PENDENTE"}\n• Mensalidade: ${data.monthlyPaymentStatus === "paid" ? "PAGA" : "PENDENTE"}\n\nCaso o pagamento tenha sido feito recentemente, você também pode usar os botões "Marcar como Pago" diretamente nos cards.`);
        }
      } else {
        alert("Erro na sincronização: " + (data.error || "Não foi possível sincronizar com o Asaas."));
      }
    } catch (e: any) {
      alert("Erro ao consultar status no Asaas: " + e.message);
    } finally {
      setSyncingStatus(false);
    }
  };

  const handleProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("O arquivo selecionado excede o limite de 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setRepasseProofFile(reader.result as string);
      setRepasseProofFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const normalizeClientPayments = (client: Lead) => {
    const setupFee = Number(client.configurationFee || 0);
    const monthlyFee = Number(client.monthlyFee || 0);
    const totalSetupInst = Number(client.setupInstallments || client.contractConfig?.setupInstallments || (setupFee > 0 ? 3 : 1));
    const expectedSetupInstAmount = totalSetupInst > 0 ? Math.round((setupFee / totalSetupInst) * 100) / 100 : setupFee;

    const rawList: Payment[] = (client.payments || []).filter(p => {
      const pDate = p.paidDate || p.dueDate || "";
      const isOld = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
      if (isOld) return false;
      return true;
    });
    const setupList: Payment[] = [];
    const monthlyList: Payment[] = [];

    const extractCode = (link?: string) => {
      if (!link) return "";
      const match = link.match(/\/(?:c|i)\/([a-zA-Z0-9_-]+)/);
      return match ? match[1].toLowerCase() : link.replace(/https?:\/\/[^\/]+\/(c|i)\//g, "").trim().toLowerCase();
    };

    const setupCode = extractCode(client.setupPaymentLink);
    const monthlyCode = extractCode(client.monthlyPaymentLink);

    rawList.forEach((p) => {
      const pAmount = Number(p.amount || (p as any).value || 0);
      const pId = String(p.id || (p as any).asaasPaymentId || "").toLowerCase();
      const invoiceUrl = String((p as any).invoiceUrl || "").toLowerCase();
      const desc = String((p as any).description || "").toLowerCase();
      const subId = (p as any).subscription || (p as any).asaasSubscriptionId;
      const isInst = Boolean((p as any).installment || p.installmentNumber);

      let isSetup = false;

      // 1. PRIORIDADE: Se o tipo já veio explicitamente gravado no objeto de pagamento
      if (p.type === "configuration") {
        isSetup = true;
      } else if (p.type === "monthly") {
        isSetup = false;
      }
      // 2. Se tem vínculo explícito de assinatura ou código de link mensal
      else if (subId || (monthlyCode && (pId.includes(monthlyCode) || invoiceUrl.includes(monthlyCode)))) {
        isSetup = false;
      }
      // 3. Se tem vínculo com o link de setup ou carnê de parcelamento
      else if (isInst || (setupCode && (pId.includes(setupCode) || invoiceUrl.includes(setupCode)))) {
        isSetup = true;
      }
      // 4. Descrição
      else if (desc.includes("setup") || desc.includes("config") || desc.includes("implan") || desc.includes("taxa") || /parcela\s*(\d+)/i.test(desc)) {
        isSetup = true;
      } else if (desc.includes("mensal") || desc.includes("assinatura") || desc.includes("recorren")) {
        isSetup = false;
      }
      // 5. Comparação com a Taxa de Setup (com margem para juros/descontos)
      else if (setupFee > 0 && !subId && setupList.length < totalSetupInst && (Math.abs(expectedSetupInstAmount - pAmount) < (expectedSetupInstAmount * 0.25 + 5) || Math.abs(setupFee - pAmount) < (setupFee * 0.25 + 5))) {
        isSetup = true;
      } else if (monthlyFee > 0 && Math.abs(monthlyFee - pAmount) < (monthlyFee * 0.25 + 5)) {
        isSetup = false;
      } else {
        isSetup = setupFee > 0 && setupList.length < totalSetupInst;
      }

      if (isSetup) {
        setupList.push({
          ...p,
          type: "configuration",
          installmentNumber: p.installmentNumber || (setupList.length + 1),
          totalInstallments: p.totalInstallments || totalSetupInst
        });
      } else {
        // Identificação precisa da competência (Mês de Referência)
        let resolvedMonthRef = "";
        const descMatch = (desc || "").match(/(\d{2}\/\d{4})/);
        if (descMatch) {
          resolvedMonthRef = descMatch[1];
        } else if (p.monthReference) {
          resolvedMonthRef = p.monthReference;
        } else if (p.dueDate && p.dueDate.includes("-")) {
          const parts = p.dueDate.split("-");
          resolvedMonthRef = `${parts[1]}/${parts[0]}`;
        } else if (p.status === "paid" && p.paidDate && p.paidDate.includes("-")) {
          const parts = p.paidDate.split("-");
          resolvedMonthRef = `${parts[1]}/${parts[0]}`;
        }

        monthlyList.push({
          ...p,
          type: "monthly",
          amount: (p.status !== "paid" && !(p as any).asaasPaymentId && monthlyFee > 0) ? monthlyFee : Number(p.amount || (p as any).value || 0),
          monthReference: resolvedMonthRef
        });
      }
    });

    // Deduplicar e filtrar rigorosamente faturas mensais por Mês de Referência / ID
    const uniqueMonthlyByRef = new Map<string, Payment>();
    const now = new Date();
    const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    // Verificar se existe alguma mensalidade paga
    const hasPaidMonthly = monthlyList.some(m => m.status === "paid");

    monthlyList.forEach((m) => {
      // Se a fatura está PENDENTE e pertence a um mês futuro (> mês atual) enquanto o cliente já está em dia, não polui
      if (m.status !== "paid") {
        if (m.monthReference && m.monthReference > currentMonthYear && hasPaidMonthly) {
          return;
        }
        if (m.dueDate) {
          const dueTime = new Date(m.dueDate).getTime();
          const diffDays = (dueTime - now.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 30 && hasPaidMonthly) {
            return;
          }
        }
      }

      const key = m.monthReference || (m.dueDate && m.dueDate.includes("-") ? `${m.dueDate.split("-")[1]}/${m.dueDate.split("-")[0]}` : (m as any).asaasPaymentId || m.id || "atual");
      const existing = uniqueMonthlyByRef.get(key);
      if (!existing) {
        uniqueMonthlyByRef.set(key, m);
      } else {
        const repassePaid = existing.commissionPaidToEgn || m.commissionPaidToEgn;
        const repasseDate = existing.egnRepassePaidDate || m.egnRepassePaidDate;
        const repasseProof = existing.egnRepasseProofUrl || m.egnRepasseProofUrl;
        const repasseProofName = existing.egnRepasseProofName || m.egnRepasseProofName;
        const repasseNotes = existing.egnRepasseNotes || m.egnRepasseNotes;
        const repasseBatch = existing.egnRepasseBatchId || m.egnRepasseBatchId;

        let chosen = existing;
        if (m.status === "paid" && existing.status !== "paid") {
          chosen = m;
        } else if (!(existing as any).invoiceUrl && (m as any).invoiceUrl) {
          chosen = m;
        }

        uniqueMonthlyByRef.set(key, {
          ...chosen,
          commissionPaidToEgn: repassePaid,
          egnRepassePaidDate: repasseDate,
          egnRepasseProofUrl: repasseProof,
          egnRepasseProofName: repasseProofName,
          egnRepasseNotes: repasseNotes,
          egnRepasseBatchId: repasseBatch
        });
      }
    });

    const deduplicatedMonthlyList = Array.from(uniqueMonthlyByRef.values());

    // Limpar IDs falsos do Asaas em parcelas de setup que ainda não foram pagas ou geradas
    const cleanedSetupList = setupList.map((s, idx) => {
      const instNum = s.installmentNumber || (idx + 1);
      if (s.status !== "paid" && !(s as any).installment) {
        const { asaasPaymentId, ...rest } = s as any;
        return {
          ...rest,
          installmentNumber: instNum
        };
      }
      return {
        ...s,
        installmentNumber: instNum
      };
    });

    let finalSetupList: Payment[] = [];
    if (setupFee > 0) {
      const isGlobalSetupPaid = client.setupPaymentStatus === "paid" || client.configurationFeePaid === true;
      const isGlobalSetupPartial = client.setupPaymentStatus === "partial";
      const baseDueDateStr = client.setupDueDate || client.contractConfig?.setupDueDate;

      for (let i = 1; i <= totalSetupInst; i++) {
        const found = cleanedSetupList.find(s => s.installmentNumber === i) || 
                      (cleanedSetupList[i - 1] && (!cleanedSetupList[i - 1].installmentNumber || cleanedSetupList[i - 1].installmentNumber === i) ? cleanedSetupList[i - 1] : undefined);
        
        if (found) {
          finalSetupList.push({
            ...found,
            installmentNumber: i,
            totalInstallments: totalSetupInst
          });
        } else {
          const isPaid = isGlobalSetupPaid || (isGlobalSetupPartial && i === 1);
          let dueDateObj: Date;
          if (baseDueDateStr) {
            const parts = baseDueDateStr.split("-");
            const bYear = parseInt(parts[0], 10);
            const bMonth = parseInt(parts[1], 10) - 1;
            const bDay = parseInt(parts[2], 10);
            dueDateObj = new Date(bYear, bMonth + (i - 1), bDay);
          } else {
            const today = new Date();
            dueDateObj = new Date(today.getFullYear(), today.getMonth() + (i - 1), today.getDate());
          }

          finalSetupList.push({
            id: `setup_inst_${i}_${client.id}`,
            type: "configuration",
            dueDate: dueDateObj.toISOString().split("T")[0],
            amount: expectedSetupInstAmount,
            status: isPaid ? "paid" : "pending",
            installmentNumber: i,
            totalInstallments: totalSetupInst,
            paidDate: isPaid ? (client.updatedAt ? client.updatedAt.split("T")[0] : new Date().toISOString().split("T")[0]) : undefined
          });
        }
      }

      const extras = cleanedSetupList.filter(s => s.installmentNumber && s.installmentNumber > totalSetupInst);
      if (extras.length > 0) {
        finalSetupList.push(...extras);
      }
    } else {
      finalSetupList = [...cleanedSetupList];
    }

    deduplicatedMonthlyList.sort((a, b) => {
      const tA = new Date(a.dueDate || a.paidDate || 0).getTime();
      const tB = new Date(b.dueDate || b.paidDate || 0).getTime();
      return tB - tA;
    });

    let finalMonthlyList = [...deduplicatedMonthlyList];

    const hasCurrentMonthMonthly = finalMonthlyList.some(m => {
      if (m.monthReference && m.monthReference === currentMonthYear) return true;
      if (m.dueDate && m.dueDate.includes("-")) {
        const parts = m.dueDate.split("-");
        if (`${parts[1]}/${parts[0]}` === currentMonthYear) return true;
      }
      if (m.paidDate && m.paidDate.includes("-")) {
        const parts = m.paidDate.split("-");
        if (`${parts[1]}/${parts[0]}` === currentMonthYear) return true;
      }
      return false;
    });

    if (!hasCurrentMonthMonthly && monthlyFee > 0) {
      let dueDay = 10;
      if (client.firstMonthlyDueDate && client.firstMonthlyDueDate.includes("-")) {
        dueDay = parseInt(client.firstMonthlyDueDate.split("-")[2], 10) || 10;
      } else if (client.contractConfig?.firstMonthlyDueDate && client.contractConfig.firstMonthlyDueDate.includes("-")) {
        dueDay = parseInt(client.contractConfig.firstMonthlyDueDate.split("-")[2], 10) || 10;
      } else {
        const pastMonthly = finalMonthlyList.find(m => m.dueDate || m.paidDate);
        if (pastMonthly) {
          const refDate = pastMonthly.dueDate || pastMonthly.paidDate;
          if (refDate && refDate.includes("-")) {
            dueDay = parseInt(refDate.split("-")[2], 10) || 10;
          }
        } else if (client.contractData?.signedAt) {
          dueDay = new Date(client.contractData.signedAt).getDate();
        } else if (client.createdAt) {
          dueDay = new Date(client.createdAt).getDate();
        }
      }
      const safeDay = Math.min(28, Math.max(1, dueDay));
      const curM = String(now.getMonth() + 1).padStart(2, "0");
      const curY = now.getFullYear();
      const calculatedDueDate = `${curY}-${curM}-${String(safeDay).padStart(2, "0")}`;

      finalMonthlyList.push({
        id: `monthly_${client.id}_${currentMonthYear.replace("/", "_")}`,
        type: "monthly",
        dueDate: calculatedDueDate,
        amount: monthlyFee,
        status: "pending",
        monthReference: currentMonthYear
      });
    }

    finalMonthlyList.sort((a, b) => {
      const tA = new Date(a.dueDate || a.paidDate || 0).getTime();
      const tB = new Date(b.dueDate || b.paidDate || 0).getTime();
      return tB - tA;
    });

    return { setupList: finalSetupList, monthlyList: finalMonthlyList, totalSetupInst, expectedSetupInstAmount };
  };

  const handleSaveBatchMonthlyRepasse = async () => {
    if (isReadOnly) return;
    if (!repasseDate) {
      alert("Por favor, selecione a data do repasse.");
      return;
    }

    let itemsToProcess = [...allPendingRepasses];
    if (itemsToProcess.length === 0) {
      alert("Não há repasses pendentes de pagamentos efetivamente recebidos para dar baixa.");
      return;
    }

    try {
      setSavingRepasse(true);
      const batchId = `repasse_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const itemsByClient: { [clientId: string]: RepasseItem[] } = {};
      itemsToProcess.forEach(item => {
        if (!itemsByClient[item.clientLeadId]) itemsByClient[item.clientLeadId] = [];
        itemsByClient[item.clientLeadId].push(item);
      });

      let totalBatchAmountRepassed = 0;

      for (const clientId of Object.keys(itemsByClient)) {
        const targetLead = leads.find(l => l.id === clientId);
        if (!targetLead) continue;

        const clientItems = itemsByClient[clientId];
        const existingPayments = [...(targetLead.payments || [])];

        clientItems.forEach(item => {
          const idx = existingPayments.findIndex(p => 
            p.id === item.payment.id || 
            ((p as any).asaasPaymentId && (p as any).asaasPaymentId === item.payment.id) ||
            (p.type === item.payment.type && item.payment.monthReference && p.monthReference === item.payment.monthReference) ||
            (p.type === "configuration" && item.payment.installmentNumber && p.installmentNumber === item.payment.installmentNumber)
          );

          if (idx !== -1) {
            existingPayments[idx] = {
              ...existingPayments[idx],
              status: "paid",
              paidDate: existingPayments[idx].paidDate || item.payment.paidDate || repasseDate,
              commissionPaidToEgn: true,
              egnRepassePaidDate: repasseDate,
              egnRepasseProofUrl: repasseProofFile || undefined,
              egnRepasseProofName: repasseProofFileName || undefined,
              egnRepasseNotes: repasseNotes.trim() ? repasseNotes.trim() : "Repasse 10% EGN",
              egnRepasseBatchId: batchId
            };
          } else {
            existingPayments.push({
              id: item.payment.id,
              type: item.payment.type,
              dueDate: item.payment.dueDate || repasseDate,
              amount: item.payment.amount,
              status: "paid",
              paidDate: item.payment.paidDate || repasseDate,
              monthReference: item.payment.monthReference,
              installmentNumber: item.payment.installmentNumber,
              totalInstallments: item.payment.totalInstallments,
              commissionPaidToEgn: true,
              egnRepassePaidDate: repasseDate,
              egnRepasseProofUrl: repasseProofFile || undefined,
              egnRepasseProofName: repasseProofFileName || undefined,
              egnRepasseNotes: repasseNotes.trim() ? repasseNotes.trim() : "Repasse 10% EGN",
              egnRepasseBatchId: batchId
            });
          }
        });

        const clientBatchTotal = clientItems.reduce((acc, curr) => acc + curr.commissionAmount, 0);
        totalBatchAmountRepassed += clientBatchTotal;

        const newHistoryItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          text: `Repasse EGN de 10% (R$ ${formatMoney(clientBatchTotal)}) quitado e registrado com sucesso em ${formatDateBr(repasseDate)}.`,
          type: "payment"
        };

        const clientRef = doc(db, "leads", targetLead.id);
        await updateDoc(clientRef, cleanForFirestore({
          payments: existingPayments,
          history: [...(targetLead.history || []), newHistoryItem],
          updatedAt: new Date().toISOString()
        }));
      }

      // Salva o registro consolidado do lote de repasse na coleção egn_repasses
      try {
        const batchDocRef = doc(db, "egn_repasses", batchId);
        await setDoc(batchDocRef, cleanForFirestore({
          id: batchId,
          date: repasseDate,
          totalAmount: totalBatchAmountRepassed,
          proofUrl: repasseProofFile || null,
          proofName: repasseProofFileName || null,
          notes: repasseNotes.trim() || null,
          items: itemsToProcess.map(it => ({
            clientLeadId: it.clientLeadId,
            clientName: it.clientName,
            company: it.company,
            paymentId: it.payment.id,
            paymentType: it.payment.type,
            paymentAmount: it.payment.amount,
            commissionAmount: it.commissionAmount,
            paidDate: it.payment.paidDate,
            monthReference: it.payment.monthReference,
            installmentNumber: it.payment.installmentNumber
          })),
          createdAt: new Date().toISOString()
        }));
      } catch (errBatch) {
        console.warn("Aviso ao salvar lote egn_repasses:", errBatch);
      }

      setShowBatchModal(false);
      setRepasseProofFile(null);
      setRepasseProofFileName(null);
      setRepasseNotes("");
      setSavingRepasse(false);
      alert(`Fechamento concluído com sucesso! Repasse de R$ ${formatMoney(totalBatchAmountRepassed)} registrado e saldo zerado.`);
    } catch (err) {
      console.error(err);
      alert("Erro ao processar o repasse.");
      setSavingRepasse(false);
    }
  };

  const handleSettleSingleRepasse = async (item: RepasseItem) => {
    if (isReadOnly) return;
    const confirmDate = prompt("Informe a data da quitação deste repasse (AAAA-MM-DD):", repasseDate || new Date().toISOString().split("T")[0]);
    if (!confirmDate) return;

    try {
      setSavingRepasse(true);
      const targetLead = leads.find(l => l.id === item.clientLeadId);
      if (!targetLead) return;

      const existingPayments = [...(targetLead.payments || [])];
      const idx = existingPayments.findIndex(p => 
        p.id === item.payment.id || 
        ((p as any).asaasPaymentId && (p as any).asaasPaymentId === item.payment.id) ||
        (p.type === item.payment.type && item.payment.monthReference && p.monthReference === item.payment.monthReference)
      );

      if (idx !== -1) {
        existingPayments[idx] = {
          ...existingPayments[idx],
          status: "paid",
          commissionPaidToEgn: true,
          egnRepassePaidDate: confirmDate,
          egnRepasseNotes: "Repasse individual 10% EGN"
        };
      } else {
        existingPayments.push({
          ...item.payment,
          status: "paid",
          commissionPaidToEgn: true,
          egnRepassePaidDate: confirmDate,
          egnRepasseNotes: "Repasse individual 10% EGN"
        });
      }

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Repasse individual EGN de 10% (R$ ${formatMoney(item.commissionAmount)}) quitado em ${formatDateBr(confirmDate)}.`,
        type: "payment"
      };

      const clientRef = doc(db, "leads", targetLead.id);
      await updateDoc(clientRef, cleanForFirestore({
        payments: existingPayments,
        history: [...(targetLead.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      }));

      alert(`Repasse de R$ ${formatMoney(item.commissionAmount)} para ${item.clientName} quitado com sucesso.`);
      setSavingRepasse(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao quitar repasse individual.");
      setSavingRepasse(false);
    }
  };

  const handleRevertRepasse = async (clientLeadId: string, paymentId: string) => {
    if (isReadOnly) return;
    if (!window.confirm("Deseja desfazer a baixa deste repasse de 10%? O valor retornará para 'Pendente Repasse EGN'.")) return;
    try {
      const targetLead = leads.find(l => l.id === clientLeadId);
      if (!targetLead) return;

      const updatedPayments = (targetLead.payments || []).map(p => {
        if (p.id === paymentId || (p as any).asaasPaymentId === paymentId) {
          const { commissionPaidToEgn, egnRepassePaidDate, egnRepasseProofUrl, egnRepasseProofName, egnRepasseNotes, egnRepasseBatchId, ...rest } = p;
          return { ...rest, commissionPaidToEgn: false };
        }
        return p;
      });

      const clientRef = doc(db, "leads", targetLead.id);
      await updateDoc(clientRef, cleanForFirestore({
        payments: updatedPayments,
        updatedAt: new Date().toISOString()
      }));
      alert("Repasse desfeito com sucesso! O valor retornou para pendente.");
    } catch (err) {
      alert("Erro ao desfazer repasse.");
    }
  };

  // Tallies
  let totalSetupReceived = 0;
  let totalSetupPending = 0;
  let totalMonthlyReceived = 0;
  let totalMonthlyPending = 0;
  let totalReceived = 0;
  let totalPending = 0;
  let totalEgnCommissionPaid = 0;
  let totalEgnCommissionPending = 0;

  const allPendingRepasses: RepasseItem[] = [];
  const allPaidRepasses: RepasseItem[] = [];

  clients.forEach(c => {
    const { setupList, monthlyList } = normalizeClientPayments(c);
    const combinedPayments = [...setupList, ...monthlyList];

    combinedPayments.forEach(p => {
      const isPaid = p.status === "paid";
      if (isPaid) {
        totalReceived += p.amount;
        if (p.type === "configuration") {
          totalSetupReceived += p.amount;
        } else {
          totalMonthlyReceived += p.amount;
        }
        const comm = (p as any).egnCommissionAmount !== undefined && (p as any).egnCommissionAmount !== null
          ? Number((p as any).egnCommissionAmount)
          : calcEgnCommissionSingle(p.amount);
        const item: RepasseItem = {
          clientLeadId: c.id,
          clientName: c.name,
          company: c.company || "Empresa Individual",
          payment: p,
          commissionAmount: comm
        };

        if (p.commissionPaidToEgn === true) {
          totalEgnCommissionPaid += comm;
          allPaidRepasses.push(item);
        } else {
          totalEgnCommissionPending += comm;
          allPendingRepasses.push(item);
        }
      } else {
        totalPending += p.amount;
        if (p.type === "configuration") {
          totalSetupPending += p.amount;
        } else {
          totalMonthlyPending += p.amount;
        }
      }
    });
  });

  // Arredondamento dos totais
  totalReceived = Math.round(totalReceived * 100) / 100;
  totalSetupReceived = Math.round(totalSetupReceived * 100) / 100;
  totalMonthlyReceived = Math.round(totalMonthlyReceived * 100) / 100;
  totalPending = Math.round(totalPending * 100) / 100;
  totalSetupPending = Math.round(totalSetupPending * 100) / 100;
  totalMonthlyPending = Math.round(totalMonthlyPending * 100) / 100;
  totalEgnCommissionPaid = Math.round(totalEgnCommissionPaid * 100) / 100;
  totalEgnCommissionPending = Math.round(totalEgnCommissionPending * 100) / 100;

  // Recebimentos filtrados por período personalizado
  const isPeriodFilterActive = Boolean(periodStartDate || periodEndDate);
  const periodFilteredPayments = useMemo(() => {
    if (!periodStartDate && !periodEndDate) return [];

    const list: RepasseItem[] = [];
    clients.forEach(c => {
      const { setupList, monthlyList } = normalizeClientPayments(c);
      const combined = [...setupList, ...monthlyList];
      combined.forEach(p => {
        if (p.status === "paid" && p.amount > 0) {
          const payDate = (p.paidDate || p.dueDate || "").split("T")[0];
          if (!payDate) return;
          if (periodStartDate && payDate < periodStartDate) return;
          if (periodEndDate && payDate > periodEndDate) return;

          const comm = (p as any).egnCommissionAmount !== undefined && (p as any).egnCommissionAmount !== null
            ? Number((p as any).egnCommissionAmount)
            : calcEgnCommissionSingle(p.amount);

          list.push({
            clientLeadId: c.id,
            clientName: c.name,
            company: c.company || "Empresa Individual",
            payment: p,
            commissionAmount: comm
          });
        }
      });
    });

    list.sort((a, b) => {
      const tA = new Date(a.payment.paidDate || a.payment.dueDate || 0).getTime();
      const tB = new Date(b.payment.paidDate || b.payment.dueDate || 0).getTime();
      return tB - tA;
    });

    return list;
  }, [clients, periodStartDate, periodEndDate]);

  const periodTotalReceived = useMemo(() => {
    const sum = periodFilteredPayments.reduce((acc, it) => acc + it.payment.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodSetupReceived = useMemo(() => {
    const sum = periodFilteredPayments
      .filter(it => it.payment.type === "configuration")
      .reduce((acc, it) => acc + it.payment.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodMonthlyReceived = useMemo(() => {
    const sum = periodFilteredPayments
      .filter(it => it.payment.type === "monthly")
      .reduce((acc, it) => acc + it.payment.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodEgnCommission = useMemo(() => {
    const sum = periodFilteredPayments.reduce((acc, it) => acc + it.commissionAmount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodEgnPaid = useMemo(() => {
    const sum = periodFilteredPayments
      .filter(it => it.payment.commissionPaidToEgn === true)
      .reduce((acc, it) => acc + it.commissionAmount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodEgnPending = useMemo(() => {
    const sum = periodFilteredPayments
      .filter(it => it.payment.commissionPaidToEgn !== true)
      .reduce((acc, it) => acc + it.commissionAmount, 0);
    return Math.round(sum * 100) / 100;
  }, [periodFilteredPayments]);

  const periodRepassedItems = useMemo(() => {
    return periodFilteredPayments.filter(it => it.payment.commissionPaidToEgn === true);
  }, [periodFilteredPayments]);

  const periodProofItem = useMemo(() => {
    return periodRepassedItems.find(it => it.payment.egnRepasseProofUrl);
  }, [periodRepassedItems]);

  const periodHasProof = Boolean(periodProofItem);

  const unattachedRepasses = useMemo(() => {
    return allPaidRepasses.filter(it => !it.payment.egnRepasseProofUrl);
  }, [allPaidRepasses]);

  const handleOpenAttachProofForItems = (items: RepasseItem[], customTitle?: string) => {
    if (items.length === 0) {
      alert("Nenhum pagamento repassado encontrado para anexar comprovante.");
      return;
    }
    const totalComm = items.reduce((acc, it) => acc + it.commissionAmount, 0);
    const existingProof = items.find(it => it.payment.egnRepasseProofUrl);
    const repasseDateFound = items[0]?.payment?.egnRepassePaidDate || new Date().toISOString().split("T")[0];
    const notesFound = items[0]?.payment?.egnRepasseNotes || `Repasse EGN - ${items.length} pagamento(s)`;

    setAttachProofModal({
      isOpen: true,
      title: customTitle || "Anexar Comprovante PIX de Repasse EGN",
      description: `Vincular comprovante de transferência PIX a ${items.length} pagamento(s) quitado(s)`,
      totalAmount: Math.round(totalComm * 100) / 100,
      paidDate: repasseDateFound,
      notes: notesFound,
      proofUrl: existingProof?.payment?.egnRepasseProofUrl || null,
      proofName: existingProof?.payment?.egnRepasseProofName || null,
      targetItems: items.map(it => ({
        clientLeadId: it.clientLeadId,
        paymentId: it.payment.id,
        clientName: it.clientName,
        amount: it.payment.amount,
        comm: it.commissionAmount
      }))
    });
  };

  const handleOpenAttachProofForPeriod = () => {
    const repassedItems = periodFilteredPayments.filter(it => it.payment.commissionPaidToEgn === true);
    if (repassedItems.length === 0) {
      alert("Nenhum repasse quitado encontrado no período selecionado.");
      return;
    }
    const pStartStr = periodStartDate ? formatDateBr(periodStartDate) : "Início";
    const pEndStr = periodEndDate ? formatDateBr(periodEndDate) : "Hoje";
    handleOpenAttachProofForItems(
      repassedItems, 
      `Comprovante PIX - Período ${pStartStr} a ${pEndStr}`
    );
  };

  const handleOpenAttachProofForSingleItem = (item: RepasseItem) => {
    handleOpenAttachProofForItems(
      [item], 
      `Comprovante PIX - ${item.clientName}`
    );
  };

  const handleModalProofFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo selecionado é muito grande. Escolha um arquivo de até 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAttachProofModal(prev => prev ? ({
        ...prev,
        proofUrl: base64String,
        proofName: file.name
      }) : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAttachedProof = async () => {
    if (!attachProofModal || isReadOnly) return;
    if (!attachProofModal.proofUrl) {
      alert("Por favor, selecione o arquivo do comprovante (imagem ou PDF).");
      return;
    }

    try {
      setSavingAttachProof(true);
      const batchId = `repasse_anexo_${Date.now()}`;
      
      const groupedByLead = new Map<string, typeof attachProofModal.targetItems>();
      attachProofModal.targetItems.forEach(it => {
        const arr = groupedByLead.get(it.clientLeadId) || [];
        arr.push(it);
        groupedByLead.set(it.clientLeadId, arr);
      });

      for (const [leadId, items] of groupedByLead.entries()) {
        const targetLead = leads.find(l => l.id === leadId);
        if (!targetLead) continue;

        const targetPaymentIds = new Set(items.map(i => i.paymentId));
        const updatedPayments = (targetLead.payments || []).map(p => {
          const matchById = p.id && targetPaymentIds.has(p.id);
          const matchByAsaas = (p as any).asaasPaymentId && targetPaymentIds.has((p as any).asaasPaymentId);
          const matchBySetupInst = p.type === "configuration" && items.some(it => it.paymentId === `setup_inst_${p.installmentNumber}_${targetLead.id}`);

          if (matchById || matchByAsaas || matchBySetupInst) {
            return {
              ...p,
              commissionPaidToEgn: true,
              egnRepassePaidDate: attachProofModal.paidDate,
              egnRepasseProofUrl: attachProofModal.proofUrl,
              egnRepasseProofName: attachProofModal.proofName || "comprovante_pix.png",
              egnRepasseNotes: attachProofModal.notes
            };
          }
          return p;
        });

        const newHistoryItem: HistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          text: `Comprovante PIX de repasse anexado (${attachProofModal.proofName || "comprovante"}) em ${formatDateBr(attachProofModal.paidDate)}.`,
          type: "payment"
        };

        const clientRef = doc(db, "leads", targetLead.id);
        await updateDoc(clientRef, cleanForFirestore({
          payments: updatedPayments,
          history: [...(targetLead.history || []), newHistoryItem],
          updatedAt: new Date().toISOString()
        }));
      }

      try {
        const batchDocRef = doc(db, "egn_repasses", batchId);
        await setDoc(batchDocRef, cleanForFirestore({
          id: batchId,
          date: attachProofModal.paidDate,
          totalAmount: attachProofModal.totalAmount,
          proofUrl: attachProofModal.proofUrl,
          proofName: attachProofModal.proofName,
          notes: attachProofModal.notes,
          itemCount: attachProofModal.targetItems.length,
          items: attachProofModal.targetItems,
          createdAt: new Date().toISOString()
        }));
      } catch (e) {
        console.warn("Aviso ao salvar egn_repasses:", e);
      }

      setSavingAttachProof(false);
      setAttachProofModal(null);
      alert(`Comprovante anexado com sucesso a ${attachProofModal.targetItems.length} pagamento(s)!`);
    } catch (err) {
      console.error(err);
      setSavingAttachProof(false);
      alert("Erro ao salvar o comprovante.");
    }
  };

  const getClientFinanceOverview = (client: Lead) => {
    const setupFee = Number(client.configurationFee || 0);
    const monthlyFee = Number(client.monthlyFee || 0);
    const isMonthlyPaidGlobal = client.monthlyPaymentStatus === "paid";
    const isGlobalSetupPaid = client.setupPaymentStatus === "paid" || client.configurationFeePaid === true;
    const isGlobalSetupPartial = client.setupPaymentStatus === "partial";

    // Extrair parcelas de setup e pagamentos mensais normalizados
    const { setupList: setupPayments, monthlyList: monthlyPayments, totalSetupInst, expectedSetupInstAmount } = normalizeClientPayments(client);

    // Total de parcelas de setup configuradas
    const setupTotalInstallments = totalSetupInst;

    // Calcular parcelas pagas de setup
    const setupPaidPayments = setupPayments.filter(p => p.status === "paid");
    let setupPaidCount = setupPaidPayments.length;
    let setupPaidAmount = setupPaidPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const effectiveSetupTotalCount = setupTotalInstallments > 0 ? setupTotalInstallments : (setupPayments.length || 1);

    // Se ainda não há pagamentos estruturados no array mas o flag global foi setado
    if (setupPaidCount === 0 && setupFee > 0 && setupPayments.length === 0) {
      if (isGlobalSetupPaid) {
        setupPaidCount = setupTotalInstallments || 1;
        setupPaidAmount = setupFee;
      } else if (isGlobalSetupPartial) {
        setupPaidCount = 1;
        setupPaidAmount = expectedSetupInstAmount;
      }
    }
    
    // Porcentagem da barra de progresso (loading bar)
    let setupProgressPercent = 0;
    if (setupFee > 0) {
      setupProgressPercent = Math.min(100, Math.round((setupPaidAmount / setupFee) * 100));
    } else if (effectiveSetupTotalCount > 0) {
      setupProgressPercent = Math.min(100, Math.round((setupPaidCount / effectiveSetupTotalCount) * 100));
    }

    let setupStatusBadge: "paid" | "partial" | "pending" = "pending";

    const isFullyPaidByAmount = setupFee > 0 && setupPaidAmount >= setupFee - 0.05;
    const isFullyPaidByCount = effectiveSetupTotalCount > 0 && setupPaidCount >= effectiveSetupTotalCount && setupPaidCount > 0;
    const isFullyPaid = isFullyPaidByAmount || isFullyPaidByCount;

    const isPartiallyPaid = (setupPaidCount > 0 && setupPaidCount < effectiveSetupTotalCount) ||
                            (setupFee > 0 && setupPaidAmount > 0 && setupPaidAmount < setupFee - 0.05) ||
                            (isGlobalSetupPartial && !isFullyPaid);

    if (isFullyPaid) {
      setupStatusBadge = "paid";
      setupProgressPercent = 100;
    } else if (isPartiallyPaid) {
      setupStatusBadge = "partial";
      if (setupFee > 0) {
        setupProgressPercent = Math.min(95, Math.max(5, Math.round((setupPaidAmount / setupFee) * 100)));
      } else if (effectiveSetupTotalCount > 0) {
        setupProgressPercent = Math.min(95, Math.max(5, Math.round((setupPaidCount / effectiveSetupTotalCount) * 100)));
      }
    } else if (isGlobalSetupPaid && (setupPayments.length === 0 || effectiveSetupTotalCount <= 1)) {
      setupStatusBadge = "paid";
      setupProgressPercent = 100;
    } else {
      setupStatusBadge = "pending";
      setupProgressPercent = 0;
    }

    // Identificação do Mês Ativo de Referência (ex: "09/2026" ou "08/2026")
    const now = new Date();
    const defaultMonthRef = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    
    // A mensalidade ativa é a mais recente cadastrada ou a pendente mais urgente
    const pendingMonthly = monthlyPayments.find(p => p.status === "pending");
    const latestMonthly = monthlyPayments[0];
    const activeMonthlyPayment = pendingMonthly || latestMonthly;

    const currentMonthRef = activeMonthlyPayment?.monthReference || 
      (activeMonthlyPayment?.dueDate ? `${activeMonthlyPayment.dueDate.split("-")[1]}/${activeMonthlyPayment.dueDate.split("-")[0]}` : defaultMonthRef);
    
    const isCurrentMonthPaid = activeMonthlyPayment ? (activeMonthlyPayment.status === "paid") : isMonthlyPaidGlobal;
    const activeMonthlyDueDate = activeMonthlyPayment?.dueDate;
    const activeMonthlyPaidDate = activeMonthlyPayment?.paidDate;
    const activeMonthlyInvoiceUrl = (activeMonthlyPayment as any)?.invoiceUrl;
    const activeMonthlyAmount = Number(activeMonthlyPayment?.amount || monthlyFee || 0);

    const totalPayments = (setupPayments.length || effectiveSetupTotalCount) + (monthlyPayments.length || 1);
    const paidCount = setupPaidCount + (isCurrentMonthPaid ? 1 : 0);
    const totalAmount = setupFee + (monthlyFee || 0);
    const paidAmount = setupPaidAmount + (isCurrentMonthPaid ? activeMonthlyAmount : 0);

    const isSetupFullyPaid = (setupFee > 0 ? setupStatusBadge === "paid" : true);

    let statusBadge = "PENDENTE";
    let badgeColor = "bg-amber-50 text-amber-800 border-amber-300";
    let progressColor = "bg-slate-200";

    if (client.financialStatus === "ATRASADO") {
      statusBadge = "ATRASADO";
      badgeColor = "bg-rose-50 text-rose-800 border-rose-300";
      progressColor = "bg-rose-500";
    } else if (isSetupFullyPaid && isCurrentMonthPaid) {
      statusBadge = "CONFIRMADO";
      badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
      progressColor = "bg-emerald-500";
    } else if (setupStatusBadge === "partial" || setupStatusBadge === "paid" || isCurrentMonthPaid || monthlyPayments.some(p => p.status === "paid")) {
      statusBadge = "PAGO PARCIAL";
      badgeColor = "bg-amber-50 text-amber-900 border-amber-300";
      progressColor = "bg-amber-500";
    }

    return {
      setupFee,
      monthlyFee,
      expectedSetupInstAmount,
      setupTotalInstallments: effectiveSetupTotalCount,
      setupPaidInstallments: setupPaidCount,
      setupPaidAmount,
      setupProgressPercent,
      setupStatusBadge,
      isMonthlyPaid: isCurrentMonthPaid,
      activeMonthlyAmount,
      currentMonthRef,
      activeMonthlyDueDate,
      activeMonthlyPaidDate,
      activeMonthlyInvoiceUrl,
      monthlyPayments,
      monthlyPaymentsCount: monthlyPayments.length,
      monthlyPaidCount: monthlyPayments.filter(p => p.status === "paid").length,
      totalPayments,
      paidCount,
      totalAmount,
      paidAmount,
      statusBadge,
      badgeColor,
      progressColor
    };
  };

  const allClientOverviews = clients.map(c => ({ client: c, overview: getClientFinanceOverview(c) }));
  const countTodos = clients.length;
  const countConfirmados = allClientOverviews.filter(o => o.overview.statusBadge === "CONFIRMADO").length;
  const countParcial = allClientOverviews.filter(o => o.overview.statusBadge === "PAGO PARCIAL").length;
  const countPendentes = allClientOverviews.filter(o => o.overview.statusBadge === "PENDENTE").length;
  const countAtrasados = allClientOverviews.filter(o => o.overview.statusBadge === "ATRASADO").length;

  const filteredClientOverviews = allClientOverviews.filter(({ client: c, overview }) => {
    if (statusFilter === "confirmados" && overview.statusBadge !== "CONFIRMADO") return false;
    if (statusFilter === "parcial" && overview.statusBadge !== "PAGO PARCIAL") return false;
    if (statusFilter === "pendentes" && overview.statusBadge !== "PENDENTE") return false;
    if (statusFilter === "atrasados" && overview.statusBadge !== "ATRASADO") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchCompany = (c.company || "").toLowerCase().includes(q);
      const matchEmail = (c.email || "").toLowerCase().includes(q) ||
                         (c.contractConfig?.clientEmail || "").toLowerCase().includes(q) ||
                         (c.contractData?.email || "").toLowerCase().includes(q);
      const matchStatus = overview.statusBadge.toLowerCase().includes(q);

      // Phone matching
      const p1 = (c.phone || "").toLowerCase();
      const p2 = (c.whatsapp || "").toLowerCase();
      const p3 = (c.contractData?.phone || "").toLowerCase();
      const p4 = (c.contractConfig?.clientPhone || "").toLowerCase();
      const pd1 = p1.replace(/\D/g, "");
      const pd2 = p2.replace(/\D/g, "");
      const pd3 = p3.replace(/\D/g, "");
      const pd4 = p4.replace(/\D/g, "");
      const matchPhone = p1.includes(q) || p2.includes(q) || p3.includes(q) || p4.includes(q) ||
        (qDigits.length >= 3 && (pd1.includes(qDigits) || pd2.includes(qDigits) || pd3.includes(qDigits) || pd4.includes(qDigits)));

      // Doc matching
      const d1 = (c.contractData?.document || "").toLowerCase();
      const d2 = (c.contractConfig?.clientDoc || "").toLowerCase();
      const d3 = (c.document || "").toLowerCase();
      const d4 = (c.cpf || "").toLowerCase();
      const d5 = (c.cnpj || "").toLowerCase();
      const dd1 = d1.replace(/\D/g, "");
      const dd2 = d2.replace(/\D/g, "");
      const dd3 = d3.replace(/\D/g, "");
      const dd4 = d4.replace(/\D/g, "");
      const dd5 = d5.replace(/\D/g, "");
      const matchDoc = d1.includes(q) || d2.includes(q) || d3.includes(q) || d4.includes(q) || d5.includes(q) ||
        (qDigits.length >= 3 && (dd1.includes(qDigits) || dd2.includes(qDigits) || dd3.includes(qDigits) || dd4.includes(qDigits) || dd5.includes(qDigits)));

      return matchName || matchCompany || matchEmail || matchStatus || matchPhone || matchDoc;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPIs and Visual Distribution Dashboard */}
      <DashboardKPIs leads={leads} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm">
        <div>
          <h2 className="font-extrabold text-sm uppercase tracking-wider text-[#424733] flex items-center gap-2">
            <Landmark size={16} className="text-[#859159]" />
            Finanças e Integração Asaas (PF)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de mensalidades, faturamentos, repasses de 10% e automação de cobranças do Asaas para sua conta PF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {syncFeedback && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              {syncFeedback}
            </span>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleManualSyncAll}
              disabled={isSyncingAll}
              className="flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer disabled:opacity-50 shadow-sm"
              title="Sincronizar status e pagamentos com o Asaas agora"
            >
              <RefreshCw size={14} className={isSyncingAll ? "animate-spin text-emerald-600" : "text-slate-500"} />
              {isSyncingAll ? "Sincronizando..." : "Sincronizar com Asaas"}
            </button>
          )}
          <button
            onClick={() => setShowMonthlyReport(!showMonthlyReport)}
            className={`flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer ${
              showMonthlyReport ? "bg-[#613C26] text-white" : "bg-amber-50 hover:bg-amber-100 text-[#613C26] border border-amber-200/80"
            }`}
          >
            <BadgePercent size={14} />
            Relatório e Repasses (10%)
            {allPendingRepasses.length > 0 && (
              <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ml-1">
                {allPendingRepasses.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowPeriodFilter(!showPeriodFilter)}
            className={`flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-xl transition cursor-pointer border shadow-sm ${
              isPeriodFilterActive
                ? "bg-[#424733] text-white border-[#424733]" 
                : showPeriodFilter 
                  ? "bg-slate-100 text-slate-800 border-slate-300" 
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            }`}
            title="Filtrar por período personalizado de recebimentos"
          >
            <CalendarRange size={14} />
            Filtrar Período
            {isPeriodFilterActive && (
              <span className="bg-emerald-400 text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1">
                {periodFilteredPayments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Monthly Report Panel */}
      {showMonthlyReport && (
        <div className="bg-white border border-amber-200/80 rounded-2xl p-6 space-y-5 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold">
                <BadgePercent size={22} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-[#424733] uppercase tracking-wider">
                  Relatório & Controle de Repasses EGN (10%)
                </h4>
                <p className="text-xs text-slate-500">Ciclo mensal encerrado dia 24 | Repasse único efetuado dia 25</p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setShowBatchModal(true);
                  setRepasseDate(getSuggested25thDate());
                }}
                className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Upload size={14} />
                Quitar Repasse Mensal (Dia 25 - Zerar Saldo)
              </button>
            )}
          </div>

          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setRepasseFilterTab("pendentes")}
              className={`py-2.5 px-4 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                repasseFilterTab === "pendentes" ? "border-rose-600 text-rose-700" : "border-transparent text-slate-500"
              }`}
            >
              <Clock size={14} /> Repasses Pendentes ({allPendingRepasses.length})
            </button>
            <button
              onClick={() => setRepasseFilterTab("historico")}
              className={`py-2.5 px-4 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                repasseFilterTab === "historico" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"
              }`}
            >
              <History size={14} /> Histórico de Repasses ({allPaidRepasses.length})
            </button>
          </div>

          {repasseFilterTab === "pendentes" ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {allPendingRepasses.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="font-extrabold text-slate-700 text-sm">Saldo 100% Zerado e Repasses em Dia!</p>
                  <p className="text-[11px] text-slate-400 mt-1">Não há nenhuma comissão pendente de transferência para a EGN no momento.</p>
                </div>
              ) : (
                allPendingRepasses.map((item, idx) => {
                  const payTypeDesc = item.payment.type === "configuration"
                    ? `Taxa de Setup (Parcela ${item.payment.installmentNumber || 1} de ${item.payment.totalInstallments || 3})`
                    : `Mensalidade Recorrente (${item.payment.monthReference || "Ciclo Vigente"})`;
                  const payDateStr = item.payment.paidDate || item.payment.dueDate;

                  return (
                    <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-[#424733]">{item.clientName}</p>
                          <span className="text-[10px] font-bold text-slate-400">({item.company})</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600">
                          {payTypeDesc} • Valor Recebido do Cliente: <span className="font-bold text-[#424733]">R$ {formatMoney(item.payment.amount)}</span>
                        </p>
                        {payDateStr && (
                          <p className="text-[10px] text-emerald-700 font-medium">
                            Recebido do cliente em: {formatDateBr(payDateStr)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Comissão EGN (10%)</span>
                          <span className="text-lg font-black text-rose-700">R$ {formatMoney(item.commissionAmount)}</span>
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleSettleSingleRepasse(item)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl transition shadow-xs cursor-pointer"
                            title="Quitar e registrar baixa deste repasse individualmente"
                          >
                            Quitar Item
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {unattachedRepasses.length > 0 && !isReadOnly && (
                <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Paperclip size={16} />
                    </div>
                    <div>
                      <p className="font-extrabold text-amber-900 text-xs">
                        {unattachedRepasses.length} pagamento(s) repassados estão sem comprovante anexado.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Clique ao lado para anexar o comprovante de transferência do 2º repasse a todos esses pagamentos de uma só vez.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAttachProofForItems(unattachedRepasses, "Comprovante do 2º Repasse EGN")}
                    className="bg-amber-700 hover:bg-amber-800 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shrink-0"
                  >
                    <Upload size={13} /> Anexar Comprovante do 2º Repasse
                  </button>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {allPaidRepasses.length === 0 ? (
                  <p className="p-8 text-slate-400 text-center italic">Nenhum histórico de repasse quitado encontrado.</p>
                ) : (
                  allPaidRepasses.map((item, idx) => {
                    const payTypeDesc = item.payment.type === "configuration"
                      ? `Taxa de Setup (Parcela ${item.payment.installmentNumber || 1} de ${item.payment.totalInstallments || 3})`
                      : `Mensalidade Recorrente (${item.payment.monthReference || "Ciclo"})`;

                    return (
                      <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-sm text-[#424733]">{item.clientName}</p>
                            <span className="text-[10px] font-bold text-slate-400">({item.company})</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-600">
                            {payTypeDesc} • Valor Recebido do Cliente: <span className="font-bold text-[#424733]">R$ {formatMoney(item.payment.amount)}</span>
                          </p>
                          <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <Check size={13} className="text-emerald-600" />
                            Repassado à EGN em: {formatDateBr(item.payment.egnRepassePaidDate)}
                            {item.payment.egnRepasseNotes && (
                              <span className="text-slate-400 font-normal ml-2">({item.payment.egnRepasseNotes})</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right mr-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Comissão Paga (10%)</span>
                            <span className="text-lg font-black text-emerald-700">R$ {formatMoney(item.commissionAmount)}</span>
                          </div>
                          {item.payment.egnRepasseProofUrl ? (
                            <button
                              type="button"
                              onClick={() => setProofViewerModal({
                                url: item.payment.egnRepasseProofUrl!,
                                name: item.payment.egnRepasseProofName || "comprovante",
                                date: item.payment.egnRepassePaidDate,
                                clientName: item.clientName,
                                amount: item.commissionAmount
                              })}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                              title="Visualizar Comprovante do PIX"
                            >
                              <Eye size={12} /> Comprovante
                            </button>
                          ) : (
                            !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleOpenAttachProofForSingleItem(item)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold py-1.5 px-3 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition shadow-xs"
                                title="Anexar comprovante de transferência deste pagamento"
                              >
                                <Paperclip size={12} /> Anexar
                              </button>
                            )
                          )}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleRevertRepasse(item.clientLeadId, item.payment.id)}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 font-bold py-1.5 px-2.5 rounded-lg text-xs transition cursor-pointer"
                              title="Desfazer a baixa deste repasse (retornar para pendente)"
                            >
                              Desfazer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Painel de Filtro por Período de Recebimento */}
      {(showPeriodFilter || isPeriodFilterActive) && (
        <div className="bg-white border-2 border-slate-300 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#424733]/10 text-[#424733] flex items-center justify-center font-bold">
                <CalendarRange size={18} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-[#424733]">Consulta por Período de Recebimento</h4>
                <p className="text-xs text-slate-500">Defina uma data inicial e final para apurar exatamente o total recebido e o repasse EGN no intervalo.</p>
              </div>
            </div>
            {isPeriodFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("");
                  setPeriodEndDate("");
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition cursor-pointer self-start md:self-auto"
              >
                Limpar Período
              </button>
            )}
          </div>

          {/* Inputs de Data e Atalhos Rápidos */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Data Inicial:</label>
                <input
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#859159] focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Data Final:</label>
                <input
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#859159] focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Presets / Atalhos de Ciclos */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Atalhos:</span>
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("2026-08-25");
                  setPeriodEndDate("2026-09-24");
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition"
                title="Ciclo anterior até 24/09 (Quitado em 25/09)"
              >
                Ciclo 25/08 a 24/09
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("2026-09-25");
                  setPeriodEndDate("2026-10-24");
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer transition"
                title="Ciclo atual a repassar em 25/10"
              >
                Ciclo 25/09 a 24/10
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("2026-09-01");
                  setPeriodEndDate("2026-09-30");
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition"
              >
                Setembro/2026
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("2026-10-01");
                  setPeriodEndDate("2026-10-31");
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition"
              >
                Outubro/2026
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodStartDate("2026-01-01");
                  setPeriodEndDate("2026-12-31");
                }}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition"
              >
                Ano 2026
              </button>
            </div>
          </div>

          {/* Estado Informativo quando nenhum período está preenchido */}
          {!isPeriodFilterActive && (
            <div className="pt-2 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <p>
                    <strong>Nenhum período selecionado.</strong> Preencha a <strong>Data Inicial</strong> e <strong>Data Final</strong> acima ou clique em um dos atalhos rápidos para apurar exatamente o total recebido, taxas de setup, mensalidades e comissão EGN daquele intervalo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodStartDate("2026-08-25");
                    setPeriodEndDate("2026-09-24");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#859159] hover:bg-[#727d4c] text-white font-bold text-xs shrink-0 cursor-pointer transition shadow-xs"
                >
                  Ver Ciclo Fechado (25/08 a 24/09)
                </button>
              </div>
            </div>
          )}

          {/* Cards de Métricas do Período Ativo */}
          {isPeriodFilterActive && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#424733] flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Apuração de {periodStartDate ? formatDateBr(periodStartDate) : "Início"} até {periodEndDate ? formatDateBr(periodEndDate) : "Hoje"}:
                </span>
                <button
                  type="button"
                  onClick={() => setShowPeriodTable(!showPeriodTable)}
                  className="text-xs font-bold text-[#613C26] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPeriodTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showPeriodTable ? "Ocultar detalhes dos pagamentos" : `Ver ${periodFilteredPayments.length} pagamento(s) recebidos`}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Recebido no Período</span>
                  <p className="text-lg font-black text-[#424733] mt-0.5">R$ {formatMoney(periodTotalReceived)}</p>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-600 mt-1">
                    <span>Setup: R$ {formatMoney(periodSetupReceived)}</span>
                    <span>•</span>
                    <span>Mensal: R$ {formatMoney(periodMonthlyReceived)}</span>
                  </div>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Comissão EGN (10%)</span>
                  <p className="text-lg font-black text-amber-900 mt-0.5">R$ {formatMoney(periodEgnCommission)}</p>
                  <span className="text-[10px] text-amber-700 font-medium block mt-1">10% sobre o apurado no período</span>
                </div>

                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Já Quitado à EGN</span>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">R$ {formatMoney(periodEgnPaid)}</p>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                      {periodRepassedItems.length} baixa(s) confirmada(s)
                    </span>
                  </div>

                  {periodEgnPaid > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-200/80">
                      {periodHasProof ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (periodProofItem?.payment?.egnRepasseProofUrl) {
                                setProofViewerModal({
                                  url: periodProofItem.payment.egnRepasseProofUrl,
                                  name: periodProofItem.payment.egnRepasseProofName || "comprovante_pix",
                                  date: periodProofItem.payment.egnRepassePaidDate,
                                  amount: periodEgnPaid
                                });
                              }
                            }}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                          >
                            <Eye size={12} /> Ver Comprovante
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={handleOpenAttachProofForPeriod}
                              className="text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 font-bold text-[10px] py-1.5 px-2 rounded-lg transition cursor-pointer"
                              title="Substituir ou atualizar comprovante deste ciclo"
                            >
                              Substituir
                            </button>
                          )}
                        </div>
                      ) : (
                        !isReadOnly && (
                          <button
                            type="button"
                            onClick={handleOpenAttachProofForPeriod}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm hover:shadow-md animate-pulse"
                            title="Inserir comprovante PIX de transferência deste repasse"
                          >
                            <Paperclip size={12} /> Inserir Comprovante PIX
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">Saldo Aberto / Pendente</span>
                  <p className="text-lg font-black text-rose-700 mt-0.5">R$ {formatMoney(periodEgnPending)}</p>
                  <span className="text-[10px] text-rose-600 font-semibold block mt-1">A repassar no próximo lote</span>
                </div>
              </div>

              {/* Tabela detalhada de pagamentos do período selecionado */}
              {showPeriodTable && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {periodFilteredPayments.length === 0 ? (
                    <p className="p-6 text-center text-slate-400 italic">Nenhum pagamento registrado no período selecionado.</p>
                  ) : (
                    periodFilteredPayments.map((item, idx) => {
                      const payDateStr = item.payment.paidDate || item.payment.dueDate;
                      const isRepassed = item.payment.commissionPaidToEgn === true;
                      const hasProof = Boolean(item.payment.egnRepasseProofUrl);
                      const payTypeDesc = item.payment.type === "configuration"
                        ? `Setup (Parcela ${item.payment.installmentNumber || 1})`
                        : `Mensalidade (${item.payment.monthReference || "Recorrente"})`;

                      return (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{item.clientName}</p>
                            <p className="text-[11px] text-slate-500">
                              {payTypeDesc} • Pago em: <span className="font-semibold text-slate-700">{formatDateBr(payDateStr)}</span>
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <p className="font-bold text-slate-800 text-xs">R$ {formatMoney(item.payment.amount)}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold text-amber-800">10%: R$ {formatMoney(item.commissionAmount)}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  isRepassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                }`}>
                                  {isRepassed ? "Repassado" : "Pendente"}
                                </span>
                              </div>
                            </div>

                            {isRepassed && (
                              hasProof ? (
                                <button
                                  type="button"
                                  onClick={() => setProofViewerModal({
                                    url: item.payment.egnRepasseProofUrl!,
                                    name: item.payment.egnRepasseProofName || "comprovante",
                                    date: item.payment.egnRepassePaidDate,
                                    clientName: item.clientName,
                                    amount: item.commissionAmount
                                  })}
                                  className="text-slate-500 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title="Ver Comprovante PIX"
                                >
                                  <Eye size={14} />
                                </button>
                              ) : (
                                !isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAttachProofForSingleItem(item)}
                                    className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                    title="Anexar Comprovante PIX deste item"
                                  >
                                    <Paperclip size={11} /> Anexar
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Financial Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 border border-slate-200/80 rounded-xl p-5">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recebido (Geral)</span>
          <p className="text-xl font-extrabold text-[#424733] mt-1">R$ {formatMoney(totalReceived)}</p>
          <div className="mt-2 flex flex-col gap-0.5 text-[10px] font-bold">
            <span className="text-emerald-700">Setup: R$ {formatMoney(totalSetupReceived)}</span>
            <span className="text-blue-700">Mensal: R$ {formatMoney(totalMonthlyReceived)}</span>
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">A Receber (Previsão)</span>
          <p className="text-xl font-extrabold text-[#A38C66] mt-1">R$ {formatMoney(totalPending)}</p>
          <div className="mt-2 flex flex-col gap-0.5 text-[10px] font-bold">
            <span className="text-amber-700">Setup Pend.: R$ {formatMoney(totalSetupPending)}</span>
            <span className="text-slate-500">Mensal Pend.: R$ {formatMoney(totalMonthlyPending)}</span>
          </div>
        </div>
        <div 
          onClick={() => { setShowMonthlyReport(true); setRepasseFilterTab("historico"); }}
          className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Repassado à EGN (10%)</span>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">R$ {formatMoney(totalEgnCommissionPaid)}</p>
          <span className="text-[10px] font-semibold text-emerald-600 block mt-2">Clique para ver histórico</span>
        </div>
        <div 
          onClick={() => { setShowMonthlyReport(true); setRepasseFilterTab("pendentes"); }}
          className="bg-white border border-rose-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md cursor-pointer transition"
        >
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pendente Repasse EGN</span>
          <p className="text-xl font-extrabold text-rose-700 mt-1">R$ {formatMoney(totalEgnCommissionPending)}</p>
          <span className="text-[10px] font-semibold text-rose-600 block mt-2">Clique para ver repasses</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter("todos")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "todos" ? "bg-[#424733] text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <Users size={16} />
            <span>Todos Clientes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">{countTodos}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("confirmados")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "confirmados" ? "bg-emerald-700 text-white" : "bg-white text-emerald-800 border border-emerald-200"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>Clientes Pagos</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">{countConfirmados}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("parcial")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "parcial" ? "bg-amber-700 text-white" : "bg-white text-amber-900 border border-amber-200"
            }`}
          >
            <Clock size={16} />
            <span>Pago Parcial</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-bold">{countParcial}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("pendentes")}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider ${
              statusFilter === "pendentes" ? "bg-slate-700 text-white" : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            <AlertCircle size={16} />
            <span>Pendentes</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">{countPendentes}</span>
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, empresa, CPF/CNPJ, telefone ou e-mail..."
            className="w-full pl-11 pr-10 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-xs font-bold text-[#424733] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#859159]"
          />
        </div>
      </div>

      {/* Main Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
          <div className="col-span-12 sm:col-span-4">Cliente / Empresa</div>
          <div className="col-span-12 sm:col-span-3 hidden sm:block text-left">Status da Parcela (Setup)</div>
          <div className="col-span-12 sm:col-span-3 hidden sm:block text-left">Status da Assinatura (Mensal)</div>
          <div className="col-span-12 sm:col-span-2 hidden sm:block text-right">Ações</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredClientOverviews.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <p className="text-sm font-bold text-slate-600">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            filteredClientOverviews.map(({ client: c, overview }) => {
              return (
                <div 
                  key={c.id} 
                  onClick={() => setSelectedClientId(c.id)}
                  className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-[#424733] group-hover:text-[#859159] transition-colors uppercase">{c.name}</h4>
                      {overview.statusBadge === "CONFIRMADO" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">100% PAGO</span>
                      )}
                      {overview.statusBadge === "PAGO PARCIAL" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold">PAGO PARCIAL</span>
                      )}
                      {overview.statusBadge === "ATRASADO" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold">ATRASADO</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-bold uppercase">{c.company || "EMPRESA INDIVIDUAL"}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{c.email || c.phone || ""}</p>
                  </div>

                  {/* 1. Status da Parcela / Setup com Barra de Progresso (Estilo Loading) */}
                  <div className="col-span-12 sm:col-span-3 text-left">
                    <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-xs group-hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase border ${
                          overview.setupStatusBadge === "paid"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : overview.setupStatusBadge === "partial"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {overview.setupStatusBadge === "paid" ? "✓ PAGO" : overview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                          {overview.setupPaidInstallments} de {overview.setupTotalInstallments} parcelas
                        </span>
                      </div>

                      {/* Barra de Progresso / Loading Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            overview.setupStatusBadge === "paid"
                              ? "bg-emerald-500"
                              : overview.setupStatusBadge === "partial"
                              ? "bg-amber-500"
                              : "bg-transparent"
                          }`}
                          style={{ width: `${Math.max(overview.setupProgressPercent, overview.setupPaidInstallments > 0 ? 20 : 0)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-extrabold pt-0.5">
                        <span className="text-[#424733]">
                          R$ {formatMoney(overview.setupPaidAmount)}
                        </span>
                        <span className="text-slate-400">
                          Total: R$ {formatMoney(overview.setupFee)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Status da Assinatura / Mensal */}
                  <div className="col-span-12 sm:col-span-3 text-left">
                    <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-xs group-hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase border ${
                          overview.isMonthlyPaid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-900 border-amber-300"
                        }`}>
                          {overview.isMonthlyPaid ? "✓ PAGA" : "PENDENTE"}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                          Ref: {overview.currentMonthRef}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-extrabold pt-2">
                        <span className="text-[#424733]">
                          {overview.isMonthlyPaid
                            ? `R$ ${formatMoney(overview.activeMonthlyAmount)}`
                            : overview.monthlyFee
                            ? `R$ ${formatMoney(overview.monthlyFee)}/mês`
                            : "R$ 0,00"}
                        </span>
                        <span className={`text-[9px] font-bold ${overview.isMonthlyPaid ? "text-emerald-700" : "text-amber-700"}`}>
                          {overview.isMonthlyPaid ? (
                            overview.activeMonthlyAmount > (overview.monthlyFee || 0) ? (
                              <span title={`Valor pago com juros (Plano contratado: R$ ${formatMoney(overview.monthlyFee)}/mês)`}>
                                Quitada c/ juros
                              </span>
                            ) : (
                              "Assinatura Ativa"
                            )
                          ) : (overview.activeMonthlyDueDate ? `Venc: ${formatDateBr(overview.activeMonthlyDueDate)}` : "Aguardando Pgto")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientId(c.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-[#424733] text-[#424733] hover:text-white rounded-xl text-xs font-black uppercase transition-all shadow-xs cursor-pointer ml-auto"
                    >
                      <span>VER DETALHES</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL DETALHES FINANCEIROS DO CLIENTE (POPUP EM TELA CHEIA) */}
      {selectedClient && (() => {
        const modalOverview = getClientFinanceOverview(selectedClient);
        const { setupList: normalizedSetupList, monthlyList: normalizedMonthlyList } = normalizeClientPayments(selectedClient);
        
        const setupInstallmentList = (() => {
          const totalInst = modalOverview.setupTotalInstallments || 3;
          const list = [];
          for (let i = 1; i <= totalInst; i++) {
            const found = normalizedSetupList.find(p => p.installmentNumber === i) || normalizedSetupList[i - 1];
            const isPaid = found ? found.status === "paid" : (modalOverview.setupPaidInstallments >= i);
            const val = found?.amount || modalOverview.expectedSetupInstAmount || (modalOverview.setupFee > 0 ? (modalOverview.setupFee / totalInst) : 0);
            list.push({
              number: i,
              total: totalInst,
              status: isPaid ? "paid" : "pending",
              amount: val,
              dueDate: found?.dueDate,
              paidDate: found?.paidDate,
              paymentId: found?.id,
              asaasPaymentId: (found as any)?.asaasPaymentId,
              invoiceUrl: (found as any)?.invoiceUrl
            });
          }
          return list;
        })();

        // Unificar histórico de interações, auditoria e linha do tempo de pagamentos
        const allDisplayPayments = [...normalizedSetupList, ...normalizedMonthlyList];

        const unifiedTimeline = (() => {
          const events: Array<{
            id: string;
            date: string;
            displayDate: string;
            title: string;
            description?: string;
            type: "payment" | "webhook" | "status" | "note";
            badge: string;
            badgeColor: string;
          }> = [];

          // 1. Pagamentos Registrados
          allDisplayPayments.forEach((p, idx) => {
            const pDate = p.paidDate || p.dueDate || selectedClient.createdAt || "";
            const isSetup = p.type === "configuration";
            const pLabel = isSetup 
              ? `Taxa de Setup • Parcela ${p.installmentNumber || idx + 1} de ${p.totalInstallments || modalOverview.setupTotalInstallments}`
              : `Mensalidade Recorrente ${p.monthReference ? `(Ref: ${p.monthReference})` : ""}`;

            events.push({
              id: `pay_evt_${p.id || idx}`,
              date: pDate,
              displayDate: formatDateBr(pDate),
              title: `${pLabel} - R$ ${formatMoney(p.amount)}`,
              description: p.status === "paid" 
                ? `Pagamento confirmado e compensado. ${(p as any).asaasPaymentId ? `(ID Asaas: ${(p as any).asaasPaymentId})` : ""}`
                : `Cobrança pendente com vencimento para ${formatDateBr(p.dueDate)}.`,
              type: "payment",
              badge: p.status === "paid" ? "PAGO / QUITADO" : "PENDENTE",
              badgeColor: p.status === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
            });
          });

          // 2. Histórico de Interações (Lead History)
          (selectedClient.history || []).forEach((h, hIdx) => {
            const txt = h.text || "";
            if (txt.includes("2023") || txt.includes("2022") || txt.includes("2021")) return;
            if (txt.includes("[Sincronização Asaas]")) return; // evita poluição visual de sincronizações repetitivas

            const hDate = h.date || "";
            events.push({
              id: `hist_${h.id || hIdx}`,
              date: hDate,
              displayDate: hDate ? new Date(hDate).toLocaleString("pt-BR") : "-",
              title: h.text || "Anotação registrada",
              type: h.type === "payment" ? "payment" : h.type === "status_change" ? "status" : "note",
              badge: h.type === "payment" ? "PAGAMENTO" : h.type === "status_change" ? "STATUS" : "HISTÓRICO",
              badgeColor: h.type === "payment" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"
            });
          });

          // 3. Logs de Webhook e Notificações Asaas
          (selectedClient.logs || []).forEach((l, lIdx) => {
            const act = l.action || "";
            if (act.includes("2023") || act.includes("2022") || act.includes("2021")) return;
            if (act.includes("[Sincronização Asaas]") || act.includes("[Consulta Asaas]")) return;

            events.push({
              id: `log_${lIdx}`,
              date: l.date || "",
              displayDate: l.date || "-",
              title: l.action || "Notificação Asaas",
              description: `Origem: ${l.user || "Sistema / Webhook Asaas"}`,
              type: "webhook",
              badge: "WEBHOOK / ASAAS",
              badgeColor: "bg-blue-100 text-blue-800 border-blue-300"
            });
          });

          // Ordenar por data mais recente
          return events.sort((a, b) => {
            const tA = a.date ? new Date(a.date).getTime() : 0;
            const tB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
          });
        })();

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header do Modal */}
              <div className="bg-[#424733] text-white p-5 sm:p-6 flex justify-between items-start border-b border-[#859159]/30">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#859159] text-white flex items-center justify-center font-black text-xl shadow-inner shrink-0">
                    {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : "C"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-lg sm:text-xl uppercase tracking-wide">{selectedClient.name}</h3>
                      
                      {/* Badge Parcela / Setup */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        modalOverview.setupStatusBadge === "paid"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : modalOverview.setupStatusBadge === "partial"
                          ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                          : "bg-slate-700/40 text-slate-300 border-slate-600"
                      }`}>
                        Parcelas Setup: {modalOverview.setupPaidInstallments} de {modalOverview.setupTotalInstallments} ({modalOverview.setupStatusBadge === "paid" ? "PAGO" : modalOverview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"})
                      </span>

                      {/* Badge Assinatura / Mensal */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        modalOverview.isMonthlyPaid
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                      }`}>
                        Assinatura: {modalOverview.isMonthlyPaid ? `PAGA (${modalOverview.currentMonthRef})` : `PENDENTE (${modalOverview.currentMonthRef})`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-1">
                      {selectedClient.company || "Empresa Individual"} • CPF/CNPJ: {selectedClient.contractData?.document || selectedClient.document || selectedClient.cpf || selectedClient.cnpj || "Não informado"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleManualSyncStatus}
                      disabled={syncingStatus}
                      title="Consultar status de pagamento em tempo real no Asaas"
                      className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 border border-white/20 transition-colors"
                    >
                      <RefreshCw size={13} className={syncingStatus ? "animate-spin" : ""} />
                      <span className="hidden sm:inline">{syncingStatus ? "Sincronizando..." : "Sincronizar Asaas"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSelectedClientId(null); setShowAddPaymentForm(false); }}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Corpo do Modal (Scrollável) */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
                {actionFeedback && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      {actionFeedback.type === "success" ? <Check size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
                      <span>{actionFeedback.text}</span>
                    </div>
                    <button type="button" onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">×</button>
                  </div>
                )}

                {isReadOnly && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                    <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-extrabold uppercase tracking-wide">Acesso EGN (Modo Visualização)</p>
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        Todas as cobranças, parcelas e status do Asaas estão visíveis para conferência. Ações de baixa manual e edição de faturas são exclusivas da administração.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Informações de Contato e Asaas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">E-mail</span>
                    <span className="font-bold text-slate-800 break-all">{selectedClient.email || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telefone / WhatsApp</span>
                    <span className="font-bold text-slate-800">{selectedClient.phone || selectedClient.whatsapp || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Identificador Asaas</span>
                    <span className="font-bold text-slate-800 text-[11px] font-mono">
                      {(selectedClient as any).asaasCustomerId ? (
                        <span className="text-emerald-700">ID: {(selectedClient as any).asaasCustomerId}</span>
                      ) : (
                        <span className="text-slate-400 italic">Vinculado automaticamente no 1º pgto</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Blocos de Cobrança: Setup e Mensalidade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* 1. Taxa de Setup / Configuração */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-50 text-amber-800 rounded-xl">
                            <CreditCard size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-[#424733] uppercase">Taxa de Setup (Parcelamento)</h4>
                            <p className="text-[11px] text-slate-400 font-bold">Implementação em até {modalOverview.setupTotalInstallments}x</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                          modalOverview.setupStatusBadge === "paid"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : modalOverview.setupStatusBadge === "partial"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {modalOverview.setupStatusBadge === "paid" ? "✓ 100% PAGO" : modalOverview.setupStatusBadge === "partial" ? "PAGO PARCIAL" : "PENDENTE"}
                        </span>
                      </div>

                      {/* Progresso Loading Bar */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className="text-[#424733]">Progresso das Parcelas</span>
                          <span className="text-[#859159] uppercase tracking-wider">{modalOverview.setupPaidInstallments} de {modalOverview.setupTotalInstallments} parcelas pagas</span>
                        </div>
                        
                        {/* Loading Bar */}
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              modalOverview.setupStatusBadge === "paid" ? "bg-emerald-500" : modalOverview.setupStatusBadge === "partial" ? "bg-amber-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${Math.max(modalOverview.setupProgressPercent, modalOverview.setupPaidInstallments > 0 ? 33 : 0)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-extrabold pt-1">
                          <span className="text-emerald-700">Pago: R$ {formatMoney(modalOverview.setupPaidAmount)}</span>
                          <span className="text-slate-500">Total: R$ {formatMoney(modalOverview.setupFee)}</span>
                        </div>
                      </div>

                      {/* Lista discriminada das Parcelas */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linha do Tempo das Parcelas de Setup:</span>
                        <div className="space-y-1.5">
                          {setupInstallmentList.map((inst) => (
                            <div key={inst.number} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${
                                  inst.status === "paid" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-600"
                                }`}>
                                  {inst.status === "paid" ? "✓" : inst.number}
                                </span>
                                <div>
                                  <span className="font-extrabold text-[#424733]">Parcela {inst.number} de {inst.total}</span>
                                  {inst.status === "paid" ? (
                                    <span className="text-[10px] text-emerald-700 font-bold block">
                                      Quitada {inst.paidDate ? `em ${formatDateBr(inst.paidDate)}` : ""} {inst.asaasPaymentId ? `• Asaas: ${inst.asaasPaymentId}` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-bold block">
                                      {inst.dueDate ? `Vencimento: ${formatDateBr(inst.dueDate)}` : "Aguardando pagamento"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-700">R$ {formatMoney(inst.amount)}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                  inst.status === "paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}>
                                  {inst.status === "paid" ? "PAGA" : "PENDENTE"}
                                </span>

                                {!isReadOnly && (
                                  inst.status === "paid" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(inst.number, "pending", inst.paymentId)}
                                      disabled={actionLoading !== null}
                                      className="px-2 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                      title="Desfazer quitação desta parcela"
                                    >
                                      {actionLoading?.type === "installment" && actionLoading?.id === inst.number ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : null}
                                      <span>Desfazer</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInstallment(inst.number, "paid", inst.paymentId)}
                                      disabled={actionLoading !== null}
                                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1"
                                      title="Dar baixa e marcar esta parcela como Paga"
                                    >
                                      {actionLoading?.type === "installment" && actionLoading?.id === inst.number ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : null}
                                      <span>Dar Baixa</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Link do Setup */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link de Pagamento do Setup (Asaas):</span>
                        {selectedClient.setupPaymentLink ? (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedClient.setupPaymentLink}
                              className="bg-transparent text-xs text-blue-600 font-bold flex-1 outline-none truncate"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyLink(selectedClient.setupPaymentLink || "", "setup")}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Copiar Link"
                            >
                              {copiedLinkType === "setup" ? <Check size={15} className="text-emerald-600 font-bold" /> : <Copy size={15} />}
                            </button>
                            <a
                              href={selectedClient.setupPaymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Abrir Checkout"
                            >
                              <ExternalLink size={15} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            Nenhum link configurado para a taxa de setup.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de Alternância Manual */}
                    {!isReadOnly && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={handleToggleSetupStatus}
                          disabled={actionLoading !== null}
                          className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all border disabled:opacity-50 flex items-center justify-center gap-2 ${
                            modalOverview.setupStatusBadge === "paid"
                              ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                              : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                          }`}
                        >
                          {actionLoading?.type === "setup_all" && <Loader2 size={13} className="animate-spin" />}
                          <span>
                            {modalOverview.setupStatusBadge === "paid"
                              ? "Reverter Setup para Pendente"
                              : "Marcar Todas Parcelas como Pagas"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Mensalidade / Assinatura Recorrente */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                            <Activity size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-[#424733] uppercase">Assinatura / Mensalidade</h4>
                            <p className="text-[11px] text-slate-400 font-bold">Cobrança recorrente mensal ativa</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase border ${
                          modalOverview.isMonthlyPaid
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}>
                          {modalOverview.isMonthlyPaid ? "✓ PAGA" : "PENDENTE"}
                        </span>
                      </div>

                      {/* Status do Mês Atual */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">Mês de Referência Ativo:</span>
                          <span className="text-sm font-black text-[#424733] px-2 py-0.5 bg-white rounded-lg border border-slate-200">
                            {modalOverview.currentMonthRef}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-xs font-bold text-slate-500">
                            {modalOverview.isMonthlyPaid ? "Valor Pago no Mês:" : "Valor Mensalidade:"}
                          </span>
                          <span className="text-xl font-black text-[#424733]">
                            {modalOverview.isMonthlyPaid
                              ? `R$ ${formatMoney(modalOverview.activeMonthlyAmount)}`
                              : `R$ ${formatMoney(selectedClient.monthlyFee || 0)}/mês`}
                          </span>
                        </div>
                        {modalOverview.isMonthlyPaid && modalOverview.activeMonthlyAmount > (selectedClient.monthlyFee || 0) && (
                          <p className="text-[10px] text-amber-700 font-extrabold flex items-center justify-end gap-1">
                            * Inclui juros/multa por atraso (Plano base: R$ {formatMoney(selectedClient.monthlyFee || 0)}/mês)
                          </p>
                        )}
                      </div>

                      {/* Linha do Tempo das Mensalidades (Faturas Recorrentes do Asaas) */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linha do Tempo das Mensalidades:</span>
                        <div className="space-y-2">
                          {(normalizedMonthlyList.length > 0 ? normalizedMonthlyList : [
                            {
                              id: `monthly_${selectedClient.id}`,
                              type: "monthly" as const,
                              dueDate: new Date().toISOString().split("T")[0],
                              amount: selectedClient.monthlyFee || 0,
                              status: selectedClient.monthlyPaymentStatus === "paid" ? ("paid" as const) : ("pending" as const),
                              monthReference: modalOverview.currentMonthRef
                            }
                          ]).map((m, idx) => {
                            const isPaid = m.status === "paid";
                            return (
                              <div key={m.id || idx} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200 text-xs transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 ${
                                    isPaid ? "bg-emerald-600 text-white shadow-xs" : "bg-amber-500 text-white shadow-xs"
                                  }`}>
                                    {isPaid ? "✓" : "⏳"}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-[#424733]">
                                        Mensalidade {m.monthReference ? `(Ref: ${m.monthReference})` : `(Ref: ${modalOverview.currentMonthRef})`}
                                      </span>
                                    </div>
                                    {isPaid ? (
                                      <span className="text-[10px] text-emerald-700 font-bold block">
                                        Quitada em {formatDateBr(m.paidDate || m.dueDate)} {(m as any).asaasPaymentId ? `• Asaas: ${(m as any).asaasPaymentId}` : ""}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-amber-700 font-bold block">
                                        Pendente • Vencimento: {formatDateBr(m.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-black text-slate-700">R$ {formatMoney(m.amount)}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase border ${
                                    isPaid ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
                                  }`}>
                                    {isPaid ? "PAGA" : "PENDENTE"}
                                  </span>

                                  {!isReadOnly && (
                                    isPaid ? (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePaymentItemStatus(m.id, m.status)}
                                        disabled={actionLoading !== null}
                                        className="px-2 py-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                        title="Desfazer quitação desta mensalidade"
                                      >
                                        {actionLoading?.type === "payment" && actionLoading?.id === m.id ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : null}
                                        <span>Desfazer</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleTogglePaymentItemStatus(m.id, m.status)}
                                        disabled={actionLoading !== null}
                                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-extrabold uppercase transition-colors cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1"
                                        title="Dar baixa e marcar mensalidade como Paga"
                                      >
                                        {actionLoading?.type === "payment" && actionLoading?.id === m.id ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : null}
                                        <span>Dar Baixa</span>
                                      </button>
                                    )
                                  )}

                                  {(m as any).invoiceUrl && (
                                    <a
                                      href={(m as any).invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition cursor-pointer"
                                      title="Abrir Fatura no Asaas"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Banner Explicativo de como funciona a Assinatura Recorrente */}
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-900 font-black text-[11px] uppercase">
                          <Info size={14} className="text-blue-700 shrink-0" />
                          <span>Como funciona a Assinatura Recorrente:</span>
                        </div>
                        <p className="text-blue-800 text-[11px] leading-relaxed">
                          O link cadastrado abaixo é permanente para este cliente. A cada mês, quando o cliente efetua o pagamento no Asaas, o sistema identifica automaticamente o mês de referência correspondente (ex: {modalOverview.currentMonthRef}) e dá baixa na fatura daquele mês.
                        </p>
                      </div>

                      {/* Link da Mensalidade */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link da Assinatura (Asaas):</span>
                        {selectedClient.monthlyPaymentLink ? (
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                            <input
                              type="text"
                              readOnly
                              value={selectedClient.monthlyPaymentLink}
                              className="bg-transparent text-xs text-blue-600 font-bold flex-1 outline-none truncate"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyLink(selectedClient.monthlyPaymentLink || "", "monthly")}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Copiar Link"
                            >
                              {copiedLinkType === "monthly" ? <Check size={15} className="text-emerald-600 font-bold" /> : <Copy size={15} />}
                            </button>
                            <a
                              href={selectedClient.monthlyPaymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Abrir Assinatura"
                            >
                              <ExternalLink size={15} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            Nenhum link configurado para a assinatura recorrente.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botão de Alternância Manual */}
                    {!isReadOnly && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={handleToggleMonthlyStatus}
                          disabled={actionLoading !== null}
                          className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all border disabled:opacity-50 flex items-center justify-center gap-2 ${
                            modalOverview.isMonthlyPaid
                              ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300"
                              : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                          }`}
                        >
                          {actionLoading?.type === "monthly_all" && <Loader2 size={13} className="animate-spin" />}
                          <span>
                            {modalOverview.isMonthlyPaid
                              ? "Reverter Mensalidade para Pendente"
                              : `Marcar Mensalidade (${modalOverview.currentMonthRef}) como Paga`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extrato e Parcelas Detalhadas */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#424733] uppercase">Extrato Detalhado de Cobranças e Parcelas</h4>
                      <p className="text-[11px] text-slate-400 font-bold">Histórico discriminado de todas as faturas e parcelas recebidas</p>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setShowAddPaymentForm(!showAddPaymentForm)}
                        className="bg-slate-100 hover:bg-slate-200 text-[#424733] text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Fatura / Parcela</span>
                      </button>
                    )}
                  </div>

                  {/* Formulário para Adicionar Parcela Avulsa */}
                  {!isReadOnly && showAddPaymentForm && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                      <h5 className="font-black text-xs text-[#424733] uppercase">Nova Cobrança / Parcela Avulsa</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                          <select
                            value={newPaymentType}
                            onChange={(e: any) => setNewPaymentType(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                          >
                            <option value="monthly">Mensalidade</option>
                            <option value="configuration">Taxa de Setup</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Valor (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newPaymentAmount || ""}
                            onChange={(e) => setNewPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data de Vencimento</label>
                          <BrDateInput value={newPaymentDueDate} onChange={setNewPaymentDueDate} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddPaymentForm(false)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddManualPayment}
                          className="px-4 py-1.5 bg-[#424733] text-white text-xs font-bold rounded-xl hover:bg-[#859159] transition-colors"
                        >
                          Salvar Parcela
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Parcelas */}
                  {allDisplayPayments.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      Nenhuma parcela registrada ainda. Os registros de setup e mensalidade acima são as cobranças padrão.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                      {allDisplayPayments.map((p, idx) => (
                        <div key={p.id || idx} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-[#424733] uppercase">
                                {p.type === "configuration" 
                                  ? `Taxa de Setup • Parcela ${p.installmentNumber || idx + 1} de ${p.totalInstallments || modalOverview.setupTotalInstallments}` 
                                  : `Mensalidade ${p.monthReference ? `(Ref: ${p.monthReference})` : `Parcela #${idx + 1}`}`}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                                p.status === "paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}>
                                {p.status === "paid" ? "PAGO" : "PENDENTE"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold">
                              Vencimento: {formatDateBr(p.dueDate)} {p.paidDate ? `• Quitado em: ${formatDateBr(p.paidDate)}` : ""}
                              {(p as any).asaasPaymentId ? ` • Asaas ID: ${(p as any).asaasPaymentId}` : ""}
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="font-black text-sm text-[#424733]">
                              R$ {formatMoney(p.amount)}
                            </span>
                            {!isReadOnly && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (p.type === "configuration") {
                                      handleToggleInstallment(p.installmentNumber || (idx + 1), p.status === "paid" ? "pending" : "paid", p.id);
                                    } else {
                                      handleTogglePaymentItemStatus(p.id, p.status);
                                    }
                                  }}
                                  disabled={actionLoading !== null}
                                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase border transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 ${
                                    p.status === "paid"
                                      ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700"
                                      : "bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800"
                                  }`}
                                >
                                  {actionLoading && (actionLoading.id === p.id || (actionLoading.type === "installment" && actionLoading.id === (p.installmentNumber || (idx + 1)))) ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : null}
                                  <span>{p.status === "paid" ? "Desfazer Pagamento" : "Dar Baixa (Pago)"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePaymentItem(p.id)}
                                  title="Remover esta fatura/parcela deste cliente"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linha do Tempo e Histórico Financeiro Unificado */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-[#424733]" />
                      <h4 className="font-extrabold text-xs text-[#424733] uppercase">Linha do Tempo e Histórico de Transações</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{unifiedTimeline.length} eventos registrados</span>
                  </div>

                  {unifiedTimeline.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Nenhum evento financeiro ou notificação registrada ainda.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {unifiedTimeline.map((evt) => (
                        <div key={evt.id} className="text-xs bg-white p-3 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${evt.badgeColor}`}>
                                {evt.badge}
                              </span>
                              <span className="font-extrabold text-slate-800 text-xs">{evt.title}</span>
                            </div>
                            {evt.description && (
                              <p className="text-slate-500 text-[11px] font-medium">{evt.description}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0 self-end sm:self-center">
                            {evt.displayDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-500">
                  Total Contratado: <span className="font-black text-[#424733]">R$ {formatMoney((selectedClient.configurationFee || 0) + (selectedClient.monthlyFee || 0))}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedClientId(null); setShowAddPaymentForm(false); }}
                  className="bg-[#424733] hover:bg-[#859159] text-white font-black text-xs py-2.5 px-6 rounded-xl uppercase tracking-wider transition-colors cursor-pointer ml-auto"
                >
                  Fechar Detalhes
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-[#424733]">Fechamento & Prestação de Contas (Repasse EGN 10%)</h3>
                <p className="text-xs text-slate-500">Quitação consolidada de comissões de intermediação comercial</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">Total a Repassar à EGN (10%)</span>
                  <span className="text-2xl font-black text-rose-800 block mt-1">R$ {formatMoney(totalEgnCommissionPending)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Efetivamente Recebido</span>
                  <span className="text-2xl font-black text-[#424733] block mt-1">
                    R$ {formatMoney(allPendingRepasses.reduce((acc, it) => acc + (it.payment.amount || 0), 0))}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{allPendingRepasses.length} item(ns) selecionado(s)</span>
                </div>
              </div>

              {/* Tabela de itens detalhados para conferência rigorosa */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 p-2.5 px-3 font-bold text-[11px] text-slate-700 uppercase tracking-wider flex justify-between">
                  <span>Conferência dos Clientes / Itens</span>
                  <span>Comissão (10%)</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {allPendingRepasses.map((it, idx) => (
                    <div key={idx} className="p-2.5 px-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#424733]">{it.clientName} <span className="text-slate-400 font-normal">({it.company})</span></p>
                        <p className="text-[10px] text-slate-500">
                          {it.payment.type === "configuration" ? `Taxa Setup Parcela ${it.payment.installmentNumber || 1}` : `Mensalidade ${it.payment.monthReference || ""}`} • Recebido: R$ {formatMoney(it.payment.amount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-rose-700">R$ {formatMoney(it.commissionAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Data do Repasse / Transferência (PIX): <span className="text-rose-600">*</span>
                  </label>
                  <BrDateInput value={repasseDate} onChange={setRepasseDate} required />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Observações / Identificação do Pagamento (Opcional):
                  </label>
                  <input
                    type="text"
                    value={repasseNotes}
                    onChange={(e) => setRepasseNotes(e.target.value)}
                    placeholder="Ex: Transferência PIX banco Inter, chave CNPJ EGN..."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#859159]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Comprovante de Transferência / PIX (Imagem ou PDF):
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleProofFileUpload} 
                      className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" 
                    />
                    {repasseProofFileName && (
                      <span className="text-[10px] text-emerald-700 font-bold shrink-0">✓ {repasseProofFileName}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-4 py-2 font-bold text-slate-500 cursor-pointer">Cancelar</button>
                <button type="button" onClick={handleSaveBatchMonthlyRepasse} disabled={savingRepasse} className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-2.5 px-6 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50">
                  {savingRepasse ? "Salvando e Quitando..." : "Confirmar Quitação e Zerar Saldo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof Viewer */}
      {proofViewerModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-extrabold text-[#424733] text-base">Comprovante de Repasse EGN</h3>
                <p className="text-xs text-slate-500">
                  {proofViewerModal.clientName ? `Cliente: ${proofViewerModal.clientName} • ` : ""}
                  {proofViewerModal.amount ? `Valor: R$ ${formatMoney(proofViewerModal.amount)} • ` : ""}
                  {proofViewerModal.date ? `Data: ${formatDateBr(proofViewerModal.date)}` : ""}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setProofViewerModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[62vh] overflow-auto flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-100">
              {proofViewerModal.url.startsWith("data:application/pdf") || proofViewerModal.url.endsWith(".pdf") ? (
                <iframe src={proofViewerModal.url} className="w-full h-[55vh] rounded-lg" title="Comprovante PDF" />
              ) : (
                <img src={proofViewerModal.url} alt="Comprovante" className="max-h-[55vh] object-contain rounded-lg shadow-xs" />
              )}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <a 
                href={proofViewerModal.url} 
                download={proofViewerModal.name || "comprovante_pix"} 
                className="text-xs font-bold text-[#859159] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} /> Baixar Comprovante
              </a>
              <button 
                type="button" 
                onClick={() => setProofViewerModal(null)} 
                className="bg-[#424733] hover:bg-[#323627] text-white font-extrabold py-2 px-5 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Anexar / Atualizar Comprovante PIX */}
      {attachProofModal && attachProofModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <Paperclip size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#424733]">{attachProofModal.title}</h3>
                  <p className="text-[11px] text-slate-500">{attachProofModal.description}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setAttachProofModal(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Card Resumo */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Comissão EGN Quitada (10%)</span>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">R$ {formatMoney(attachProofModal.totalAmount)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-800 font-bold block">{attachProofModal.targetItems.length} pagamento(s)</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                    Quitado à EGN
                  </span>
                </div>
              </div>

              {/* Data da Transferência / PIX */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Data do Pagamento / Transferência PIX: <span className="text-rose-600">*</span>
                </label>
                <BrDateInput 
                  value={attachProofModal.paidDate} 
                  onChange={(d) => setAttachProofModal(prev => prev ? ({ ...prev, paidDate: d }) : null)} 
                  required 
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Identificação / Observação (Opcional):
                </label>
                <input
                  type="text"
                  value={attachProofModal.notes}
                  onChange={(e) => setAttachProofModal(prev => prev ? ({ ...prev, notes: e.target.value }) : null)}
                  placeholder="Ex: 2º Repasse EGN quitado via PIX..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#859159]"
                />
              </div>

              {/* Campo de Upload de Comprovante */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Arquivo do Comprovante (Imagem ou PDF): <span className="text-rose-600">*</span>
                </label>
                <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-xl p-4 text-center hover:bg-emerald-50/70 transition relative">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleModalProofFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Upload size={18} />
                    </div>
                    {attachProofModal.proofName ? (
                      <p className="text-xs font-bold text-emerald-800">
                        Arquivo selecionado: <span className="underline">{attachProofModal.proofName}</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-slate-700">
                          Clique aqui ou arraste o comprovante
                        </p>
                        <p className="text-[10px] text-slate-400">Suporta JPG, PNG, WEBP ou PDF (até 10MB)</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Prévia se for imagem */}
                {attachProofModal.proofUrl && !attachProofModal.proofUrl.includes("pdf") && (
                  <div className="mt-2.5 text-center p-2 bg-slate-50 rounded-xl border border-slate-100 max-h-40 overflow-hidden flex items-center justify-center">
                    <img 
                      src={attachProofModal.proofUrl} 
                      alt="Prévia do comprovante" 
                      className="max-h-36 object-contain rounded-lg shadow-xs" 
                    />
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setAttachProofModal(null)}
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttachedProof}
                  disabled={savingAttachProof || !attachProofModal.proofUrl}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-2.5 px-6 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingAttachProof ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Salvando Comprovante...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Salvar e Vincular Comprovante
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
