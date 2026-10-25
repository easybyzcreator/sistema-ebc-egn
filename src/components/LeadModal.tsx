import React, { useState } from "react";
import { doc, updateDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, HistoryItem, Payment } from "../types";
import { X, Calendar, Plus, Trash2, ArrowRightLeft, Landmark, MessageSquare, Mail, Phone, Building, ShieldAlert, Link as LinkIcon, Copy, ExternalLink, Check, Clock, CheckCircle2 } from "lucide-react";
import { calcEgnCommissionSetup, calcEgnCommissionSingle, formatPhoneBR } from "../lib/masks";

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
  isReadOnly: boolean;
  initialTab?: "history" | "edit" | "convert";
}

export default function LeadModal({ lead, onClose, isReadOnly, initialTab }: LeadModalProps) {
  const [activeTab, setActiveTab] = useState<"history" | "edit" | "convert">(initialTab || (lead.id ? "history" : "edit"));
  
  // Note creation state
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Lead Editing states
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone);
  const [company, setCompany] = useState(lead.company);
  const [instagram, setInstagram] = useState(lead.instagram || "");
  const [site, setSite] = useState(lead.site || "");
  const [googleStudioAppAccount, setGoogleStudioAppAccount] = useState(lead.googleStudioAppAccount || "");
  const [firebaseAppAccount, setFirebaseAppAccount] = useState(lead.firebaseAppAccount || "");
  
  // Asaas Manual Links & Status
  const [setupPaymentLink, setSetupPaymentLink] = useState(lead.setupPaymentLink || "");
  const [setupPaymentStatus, setSetupPaymentStatus] = useState<"pending" | "paid" | "partial">(lead.setupPaymentStatus || (lead.configurationFeePaid ? "paid" : "pending"));
  const [monthlyPaymentLink, setMonthlyPaymentLink] = useState(lead.monthlyPaymentLink || "");
  const [monthlyPaymentStatus, setMonthlyPaymentStatus] = useState<"pending" | "paid">(lead.monthlyPaymentStatus || "pending");
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);

  const [monthlyFeeDueDay, setMonthlyFeeDueDay] = useState<number>(lead.monthlyFeeDueDay || 10);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const copyToClipboard = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const formatPhoneNumber = (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length <= 2) {
      return clean.length > 0 ? `(${clean}` : "";
    }
    if (clean.length <= 6) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    }
    if (clean.length <= 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
  };

  // Helper to format currency with automatic cents / virgula as user types
  const formatCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper to parse localized Brazilian currency strings
  const parseCurrency = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Conversion states preloaded with lead values if present
  const [configFeeInput, setConfigFeeInput] = useState<string>(
    lead.configurationFee !== undefined && lead.configurationFee !== null && lead.configurationFee > 0
      ? lead.configurationFee.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );
  const [monthlyFeeInput, setMonthlyFeeInput] = useState<string>(
    lead.monthlyFee !== undefined && lead.monthlyFee !== null && lead.monthlyFee > 0
      ? lead.monthlyFee.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ""
  );
  const [setupInstallments, setSetupInstallments] = useState<number>(lead.setupInstallments || 1);
  const [converting, setConverting] = useState(false);

  // Add a history item note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!noteText.trim()) return;

    try {
      setAddingNote(true);
      
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: noteText,
        type: "note"
      };

      const updatedHistory = [...(lead.history || []), newItem];
      
      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      lead.history = updatedHistory; // local sync
      setNoteText("");
      setAddingNote(false);
    } catch (err) {
      console.error("Error adding note:", err);
      alert("Erro ao salvar nota.");
      setAddingNote(false);
    }
  };

  // Edit general & financial info
  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!name.trim()) return;

    const parsedConfigFee = parseCurrency(configFeeInput);
    const parsedMonthlyFee = parseCurrency(monthlyFeeInput);

    try {
      setSaving(true);
      
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Dados do contato atualizados: Nome=${name}, Email=${email}, Tel=${phone}, Empresa=${company}, Setup=R$ ${parsedConfigFee.toFixed(2)} (${setupInstallments}x), Mensalidade=R$ ${parsedMonthlyFee.toFixed(2)}`,
        type: "note"
      };

      if (!lead.id) {
        await addDoc(collection(db, "leads"), {
          name,
          email,
          phone,
          company,
          instagram,
          site,
          googleStudioAppAccount: googleStudioAppAccount.trim(),
          firebaseAppAccount: firebaseAppAccount.trim(),
          status: lead.status || "new",
          configurationFee: parsedConfigFee,
          monthlyFee: parsedMonthlyFee,
          monthlyFeeDueDay: Number(monthlyFeeDueDay),
          setupInstallments: setupInstallments,
          setupPaymentLink: setupPaymentLink.trim(),
          setupPaymentStatus: setupPaymentStatus,
          configurationFeePaid: setupPaymentStatus === "paid",
          monthlyPaymentLink: monthlyPaymentLink.trim(),
          monthlyPaymentStatus: monthlyPaymentStatus,
          history: [newItem],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        alert("Contato cadastrado com sucesso!");
        onClose();
        return;
      }

      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        name,
        email,
        phone,
        company,
        instagram,
        site,
        googleStudioAppAccount: googleStudioAppAccount.trim(),
        firebaseAppAccount: firebaseAppAccount.trim(),
        configurationFee: parsedConfigFee,
        monthlyFee: parsedMonthlyFee,
        monthlyFeeDueDay: Number(monthlyFeeDueDay),
        setupInstallments: setupInstallments,
        setupPaymentLink: setupPaymentLink.trim(),
        setupPaymentStatus: setupPaymentStatus,
        configurationFeePaid: setupPaymentStatus === "paid",
        monthlyPaymentLink: monthlyPaymentLink.trim(),
        monthlyPaymentStatus: monthlyPaymentStatus,
        history: [...(lead.history || []), newItem],
        updatedAt: new Date().toISOString()
      });

      // Local mutations
      lead.name = name;
      lead.email = email;
      lead.phone = phone;
      lead.company = company;
      lead.instagram = instagram;
      lead.site = site;
      lead.googleStudioAppAccount = googleStudioAppAccount.trim();
      lead.firebaseAppAccount = firebaseAppAccount.trim();
      lead.configurationFee = parsedConfigFee;
      lead.monthlyFee = parsedMonthlyFee;
      lead.monthlyFeeDueDay = Number(monthlyFeeDueDay);
      lead.setupInstallments = setupInstallments;
      lead.setupPaymentLink = setupPaymentLink.trim();
      lead.setupPaymentStatus = setupPaymentStatus;
      lead.configurationFeePaid = setupPaymentStatus === "paid";
      lead.monthlyPaymentLink = monthlyPaymentLink.trim();
      lead.monthlyPaymentStatus = monthlyPaymentStatus;
      lead.history.push(newItem);

      alert("Cadastro e condições financeiras atualizados com sucesso!");
      setActiveTab("history");
      setSaving(false);
    } catch (err) {
      console.error("Error updating info:", err);
      alert("Erro ao salvar cadastro.");
      setSaving(false);
    }
  };

  // Delete lead completely
  const handleDeleteLead = async () => {
    if (isReadOnly) return;
    try {
      setSaving(true);
      await deleteDoc(doc(db, "leads", lead.id));
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error("Error deleting lead:", err);
      setSaving(false);
    }
  };

  // Convert lead to client
  const handleConvertToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    // Helper to parse localized Brazilian currency strings
    const parseCurrency = (val: string): number => {
      if (!val) return 0;
      const clean = val.replace(/\./g, "").replace(",", ".");
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    };

    const parsedConfigFee = parseCurrency(configFeeInput);
    const parsedMonthlyFee = parseCurrency(monthlyFeeInput);

    try {
      setConverting(true);

      const setupPayments: Payment[] = [];
      const installmentCount = setupInstallments || 1;
      const installmentAmount = parsedConfigFee / installmentCount;

      for (let i = 0; i < installmentCount; i++) {
        const dateObj = new Date();
        dateObj.setMonth(dateObj.getMonth() + i);
        const calcDueDate = dateObj.toISOString().split("T")[0];

        setupPayments.push({
          id: `setup_inst_${i}_` + Math.random().toString(36).substr(2, 9),
          type: "configuration",
          dueDate: calcDueDate,
          amount: parseFloat(installmentAmount.toFixed(2)),
          status: "pending"
        });
      }

      const firstMonthlyPayment: Payment = {
        id: "mth_" + Math.random().toString(36).substr(2, 9),
        type: "monthly",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        amount: parsedMonthlyFee,
        status: "pending"
      };

      // Local Asaas customer ID if available from contract signature
      const asaasCustomerId = lead.asaasCustomerId || "";

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Contato ativado como CLIENTE ATIVO (PAGANDO) no sistema. Taxa setup: R$ ${parsedConfigFee.toFixed(2)} (${installmentCount}x), Mensalidade: R$ ${parsedMonthlyFee.toFixed(2)}.`,
        type: "status_change"
      };

      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        status: "client",
        configurationFee: parsedConfigFee,
        configurationFeePaid: false,
        monthlyFee: parsedMonthlyFee,
        setupInstallments: installmentCount,
        asaasCustomerId: asaasCustomerId,
        payments: [...setupPayments, firstMonthlyPayment],
        history: [...(lead.history || []), newItem],
        updatedAt: new Date().toISOString()
      });

      alert("Contato ativado como CLIENTE com sucesso! A cobrança será gerada no Asaas assim que o cliente assinar o contrato.");
      onClose();
    } catch (err) {
      console.error("Error converting lead:", err);
      alert("Erro ao realizar conversão de status.");
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-[#424733] text-white px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between">
          <div className="min-w-0">
            <span className={`text-[10px] sm:text-xs font-black py-1 px-3 rounded-full inline-block mb-1 uppercase tracking-wider ${
              lead.status === "client" ? "bg-[#859159] text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {lead.status === "client" ? "Cliente Ativo (Pagando)" : "Cliente Inativo"}
            </span>
            <h3 className="font-black text-lg sm:text-xl tracking-tight truncate">{lead.name}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/80 hover:text-white flex-shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 bg-slate-50">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3.5 text-center border-b-2 transition cursor-pointer ${
              activeTab === "history" 
                ? "border-[#859159] text-[#424733] bg-white font-black" 
                : "border-transparent hover:text-slate-700"
            }`}
          >
            Histórico / Linha do Tempo
          </button>
          
          {!isReadOnly && (
            <>
              <button
                onClick={() => setActiveTab("edit")}
                className={`flex-1 py-3.5 text-center border-b-2 transition cursor-pointer ${
                  activeTab === "edit" 
                    ? "border-[#859159] text-[#424733] bg-white font-black" 
                    : "border-transparent hover:text-slate-700"
                }`}
              >
                Editar Informações
              </button>

              {lead.status === "lead" && (
                <button
                  onClick={() => setActiveTab("convert")}
                  className={`flex-1 py-3.5 text-center border-b-2 transition text-emerald-800 font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "convert" 
                      ? "border-[#859159] bg-[#859159]/10" 
                      : "border-transparent hover:bg-[#859159]/5"
                  }`}
                >
                  <ArrowRightLeft size={14} />
                  Ativar como Ativo (Pagando)
                </button>
              )}
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {isReadOnly && activeTab !== "history" && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-center gap-2 border border-red-200">
              <ShieldAlert size={16} />
              Apenas leitura. Você não tem permissões de gravação.
            </div>
          )}

          {/* TAB 1: History of operations */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {/* Quick lead stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 text-sm text-slate-700">
                <p className="flex items-center gap-2.5 truncate">
                  <Phone size={16} className="text-slate-400 flex-shrink-0" />
                  {lead.phone ? (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, "").startsWith("55") ? lead.phone.replace(/\D/g, "") : "55" + lead.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800 font-bold truncate text-sm"
                      title="Clique para abrir o WhatsApp"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">Sem telefone</span>
                  )}
                </p>

                <p className="flex items-center gap-2.5 truncate">
                  <Building size={16} className="text-slate-400 flex-shrink-0" /> 
                  <span className="font-bold text-[#424733] truncate text-sm">{lead.company || "Sem empresa definida"}</span>
                </p>

                {lead.email ? (
                  <p className="flex items-center gap-2.5 truncate">
                    <Mail size={16} className="text-slate-400 flex-shrink-0" /> 
                    <span className="truncate text-sm">{lead.email}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2.5 text-slate-400">
                    <Mail size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm">Sem e-mail</span>
                  </p>
                )}

                {lead.instagram && (
                  <p className="flex items-center gap-2.5 truncate text-pink-600 font-bold">
                    <span className="text-xs font-mono bg-pink-50 px-1.5 py-0.5 rounded border border-pink-200">IG</span> 
                    <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="underline truncate text-sm">
                      {lead.instagram}
                    </a>
                  </p>
                )}

                {lead.site && (
                  <p className="flex items-center gap-2.5 truncate text-blue-600 font-bold">
                    <span className="text-xs font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Site</span> 
                    <a href={lead.site.startsWith('http') ? lead.site : `https://${lead.site}`} target="_blank" rel="noreferrer" className="underline truncate text-sm">
                      {lead.site}
                    </a>
                  </p>
                )}

                {lead.googleStudioAppAccount && (
                  <p className="flex items-center gap-2.5 truncate text-slate-700 font-bold">
                    <span className="text-xs font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">Google Studio</span> 
                    <span className="truncate text-sm">{lead.googleStudioAppAccount}</span>
                  </p>
                )}

                {lead.firebaseAppAccount && (
                  <p className="flex items-center gap-2.5 truncate text-slate-700 font-bold">
                    <span className="text-xs font-mono bg-orange-50 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200">Firebase</span> 
                    <span className="truncate text-sm">{lead.firebaseAppAccount}</span>
                  </p>
                )}
              </div>

              {/* Financial Parameters Summary Card */}
              {(lead.configurationFee !== undefined || lead.monthlyFee !== undefined) && (
                <div className="bg-[#424733]/5 border border-[#424733]/15 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between font-black text-[#424733]">
                    <span className="flex items-center gap-2 uppercase tracking-wider text-xs sm:text-sm">
                      <Landmark size={16} className="text-[#859159]" /> Condições Financeiras Cadastradas
                    </span>
                    <span className={`text-[10px] sm:text-xs font-black py-1 px-3 rounded-full uppercase tracking-wider ${
                      lead.status === "client" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                    }`}>
                      {lead.status === "client" ? "Cliente Ativo" : "Cliente Inativo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-white/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-slate-400 block text-[11px] uppercase font-black tracking-wider">Taxa de Setup</span>
                      <p className="font-black text-lg sm:text-xl text-[#424733]">
                        R$ {(lead.configurationFee || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs text-slate-500 font-bold ml-1.5">({lead.setupInstallments || 1}x)</span>
                      </p>
                      {(() => {
                        const setupComm = calcEgnCommissionSetup(lead.configurationFee || 0, lead.setupInstallments || 1);
                        return (
                          <span className="text-xs text-slate-600 font-bold block">
                            Repasse EGN 10% (Líq. taxas R$ 1,99 + R$ 0,99):{" "}
                            <span className="text-[#859159] font-black">
                              {setupComm.installments > 1 
                                ? `${setupComm.installments}x de R$ ${setupComm.commissionPerInstallment.toFixed(2)} (Total: R$ ${setupComm.totalCommission.toFixed(2)})`
                                : `R$ ${setupComm.totalCommission.toFixed(2)}`
                              }
                            </span>
                          </span>
                        );
                      })()}
                      <div className="pt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          lead.setupPaymentStatus === "paid" || lead.configurationFeePaid
                            ? "bg-emerald-100 text-emerald-800"
                            : lead.setupPaymentStatus === "partial"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          Setup: {lead.setupPaymentStatus === "paid" || lead.configurationFeePaid ? "PAGO" : lead.setupPaymentStatus === "partial" ? "PAGO PARCIAL" : "PENDENTE"}
                        </span>
                      </div>
                      {lead.setupPaymentLink && (
                        <a
                          href={lead.setupPaymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline font-bold block truncate mt-1.5"
                          title={lead.setupPaymentLink}
                        >
                          Link do Setup (Asaas) →
                        </a>
                      )}
                    </div>

                    <div className="bg-white/80 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                      <span className="text-slate-400 block text-[11px] uppercase font-black tracking-wider">Mensalidade Recorrente</span>
                      <p className="font-black text-lg sm:text-xl text-[#424733]">
                        R$ {(lead.monthlyFee || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className="text-xs text-slate-500 font-bold ml-1">/mês</span>
                      </p>
                      {(() => {
                        const mComm = calcEgnCommissionSingle(lead.monthlyFee || 0);
                        return (
                          <span className="text-xs text-slate-600 font-bold block">
                            Repasse EGN 10% (Líq. taxas R$ 1,99 + R$ 0,99):{" "}
                            <span className="text-[#859159] font-black">
                              R$ {mComm.toFixed(2)} /mês
                            </span>
                          </span>
                        );
                      })()}
                      <div className="pt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          lead.monthlyPaymentStatus === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          Mensalidade: {lead.monthlyPaymentStatus === "paid" ? "PAGA" : "PENDENTE"}
                        </span>
                      </div>
                      {lead.monthlyPaymentLink && (
                        <a
                          href={lead.monthlyPaymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 underline font-bold block truncate mt-1.5"
                          title={lead.monthlyPaymentLink}
                        >
                          Link da Mensalidade (Asaas) →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Add Note Form */}
              {!isReadOnly && (
                <form onSubmit={handleAddNote} className="flex gap-2.5">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Registrar nova ligação, e-mail ou observação..."
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#859159]/40 focus:border-[#859159] transition text-[#424733]"
                  />
                  <button
                    type="submit"
                    disabled={addingNote || !noteText.trim()}
                    className="bg-[#424733] hover:bg-[#859159] text-white rounded-xl px-5 py-3 text-sm font-black transition flex items-center justify-center gap-1.5 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </form>
              )}

              {/* History Timeline */}
              <div className="space-y-4">
                <span className="block text-xs font-black text-slate-400 uppercase tracking-wider">Histórico de Interações</span>
                
                <div className="relative border-l-2 border-slate-200 pl-5 space-y-4">
                  {lead.history && lead.history.length > 0 ? (
                    [...lead.history]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((item) => (
                        <div key={item.id} className="relative text-sm bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          {/* Dot accent on timeline */}
                          <div className={`absolute -left-[27px] top-4 w-3 h-3 rounded-full border-2 bg-white ${
                            item.type === "status_change" ? "border-amber-500 bg-amber-100" :
                            item.type === "payment" ? "border-emerald-500 bg-emerald-100" :
                            item.type === "contract" ? "border-[#859159] bg-[#859159]/25" : "border-slate-400"
                          }`}></div>
                          
                          <span className="text-xs text-slate-400 font-mono font-bold block">
                            {new Date(item.date).toLocaleString("pt-BR")}
                          </span>
                          <p className="text-slate-800 font-medium mt-1 leading-relaxed text-sm">{item.text}</p>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-slate-400 italic py-2">Nenhuma anotação registrada ainda.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Edit General Details */}
          {activeTab === "edit" && !isReadOnly && (
            <form onSubmit={handleUpdateInfo} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome do Lead / Cliente *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Nome da Empresa / Marmitaria</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Telefone de Contato / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">E-mail para contato</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Instagram</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="Ex: @nome_usuario"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Site</label>
                  <input
                    type="text"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="Ex: www.restaurante.com.br"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Conta google studio app</label>
                  <input
                    type="text"
                    value={googleStudioAppAccount}
                    onChange={(e) => setGoogleStudioAppAccount(e.target.value)}
                    placeholder="Ex: conta@gmail.com ou ID do app"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Conta firebase app</label>
                  <input
                    type="text"
                    value={firebaseAppAccount}
                    onChange={(e) => setFirebaseAppAccount(e.target.value)}
                    placeholder="Ex: firebase-projeto-id ou conta@gmail.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <span className="block text-xs font-black text-[#424733] uppercase tracking-wider">Condições Financeiras do Cliente</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Taxa de Setup (R$)</label>
                    <input
                      type="text"
                      value={configFeeInput}
                      onChange={(e) => setConfigFeeInput(formatCurrencyInput(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                    />
                    {(() => {
                      const comm = calcEgnCommissionSetup(parseCurrency(configFeeInput), setupInstallments);
                      return (
                        <span className="text-xs text-slate-500 block font-bold" title="10% calculado após abater taxas bancárias (R$ 1,99 boleto + R$ 0,99 mensagem por parcela)">
                          EGN 10% (Líq. taxas):{" "}
                          <span className="text-[#859159]">
                            {comm.installments > 1 
                              ? `${comm.installments}x R$ ${comm.commissionPerInstallment.toFixed(2)}`
                              : `R$ ${comm.totalCommission.toFixed(2)}`}
                          </span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Parcelas Setup</label>
                    <select
                      value={setupInstallments}
                      onChange={(e) => setSetupInstallments(parseInt(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#859159]/40 text-[#424733]"
                    >
                      <option value={1}>À Vista (1x)</option>
                      <option value={2}>2x Sem Juros</option>
                      <option value={3}>3x Sem Juros</option>
                      <option value={4}>4x Sem Juros</option>
                      <option value={5}>5x Sem Juros</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Mensalidade (R$)</label>
                    <input
                      type="text"
                      value={monthlyFeeInput}
                      onChange={(e) => setMonthlyFeeInput(formatCurrencyInput(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                    />
                    {(() => {
                      const comm = calcEgnCommissionSingle(parseCurrency(monthlyFeeInput));
                      return (
                        <span className="text-xs text-slate-500 block font-bold" title="10% calculado após abater taxas bancárias (R$ 1,99 boleto + R$ 0,99 mensagem)">
                          EGN 10% (Líq. taxas): <span className="text-[#859159]">R$ {comm.toFixed(2)}/mês</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* SESSÃO DE LINKS MANUAIS DO ASAAS */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-black text-[#424733] uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon size={14} className="text-[#859159]" /> Links de Pagamento Asaas (Configurados Manualmente)
                    </span>
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-bold border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Baixa 100% Automática
                    </span>
                  </div>

                  {/* 1. LINK DE TAXA DE SETUP */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-xs font-black text-[#424733] uppercase">
                        1. Link da Taxa de Setup / Configuração (Asaas)
                      </label>
                      
                      {/* STATUS AUTOMATIZADO (NÃO MANUAL) */}
                      {setupPaymentStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={13} /> Setup: Pago (100%)
                        </span>
                      ) : setupPaymentStatus === "partial" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock size={13} /> Setup: Pago Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={13} /> Setup: Pendente
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={setupPaymentLink}
                        onChange={(e) => setSetupPaymentLink(e.target.value)}
                        placeholder="Cole aqui o link gerado no Asaas (Ex: https://www.asaas.com/c/...)"
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#859159]/40 text-slate-800"
                      />
                      {setupPaymentLink && (
                        <div className="absolute right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(setupPaymentLink, "setup")}
                            className="p-1.5 text-slate-500 hover:text-[#424733] hover:bg-slate-100 rounded-lg transition"
                            title="Copiar Link"
                          >
                            {copiedLinkType === "setup" ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                          </button>
                          <a
                            href={setupPaymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-[#859159] hover:bg-slate-100 rounded-lg transition"
                            title="Abrir Link"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* DADOS DO LINK: VALOR, PARCELAS E VENCIMENTO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Valor da Taxa</span>
                        <span className="font-black text-sm text-[#424733]">
                          R$ {configFeeInput || "0,00"} {setupInstallments > 1 ? `(em até ${setupInstallments}x de R$ ${(parseCurrency(configFeeInput) / setupInstallments).toFixed(2).replace(".", ",")})` : "(À Vista)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Vencimento do Setup</span>
                        <span className="font-black text-sm text-[#424733]">
                          No ato da adesão / 1º vencimento
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. LINK DA MENSALIDADE RECORRENTE */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-xs font-black text-[#424733] uppercase">
                        2. Link da Mensalidade Recorrente / Assinatura (Asaas)
                      </label>
                      
                      {/* STATUS AUTOMATIZADO (NÃO MANUAL) */}
                      {monthlyPaymentStatus === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={13} /> Mensalidade: Paga
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={13} /> Mensalidade: Pendente
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="url"
                        value={monthlyPaymentLink}
                        onChange={(e) => setMonthlyPaymentLink(e.target.value)}
                        placeholder="Cole aqui o link da assinatura gerado no Asaas (Ex: https://www.asaas.com/c/...)"
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#859159]/40 text-slate-800"
                      />
                      {monthlyPaymentLink && (
                        <div className="absolute right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(monthlyPaymentLink, "monthly")}
                            className="p-1.5 text-slate-500 hover:text-[#424733] hover:bg-slate-100 rounded-lg transition"
                            title="Copiar Link"
                          >
                            {copiedLinkType === "monthly" ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                          </button>
                          <a
                            href={monthlyPaymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-[#859159] hover:bg-slate-100 rounded-lg transition"
                            title="Abrir Link"
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* DADOS DO LINK: VALOR E VENCIMENTO RECORRENTE */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Valor da Mensalidade</span>
                        <span className="font-black text-sm text-[#424733]">
                          R$ {monthlyFeeInput || "0,00"} / mês
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-black uppercase">Dia de Vencimento</span>
                        <span className="font-black text-sm text-[#424733]">
                          {lead.contractData?.signedAt
                            ? `Todo dia ${new Date(lead.contractData.signedAt).getDate()} de cada mês (Dia da assinatura)`
                            : "Mesmo dia em que o contrato for assinado (Asaas)"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-5 flex justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-4 py-2.5 hover:bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 border border-transparent hover:border-red-100 cursor-pointer"
                >
                  <Trash2 size={16} />
                  Excluir Lead
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#859159] hover:bg-[#424733] text-white rounded-xl px-6 py-2.5 text-xs sm:text-sm font-black transition shadow-sm cursor-pointer"
                >
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Conversion to Client */}
          {activeTab === "convert" && !isReadOnly && (
            <form onSubmit={handleConvertToClient} className="space-y-6">
              <div className="bg-emerald-50 text-emerald-900 rounded-2xl p-5 text-xs sm:text-sm leading-relaxed border border-emerald-200/80 space-y-1.5">
                <p className="font-black flex items-center gap-2 text-sm sm:text-base"><Landmark size={18} className="text-[#859159]" /> Lançamento de Configuração & Mensalidade</p>
                <p>Ao ativar este contato como Cliente Ativo (Pagando), o sistema criará as faturas iniciais correspondentes. 10% de todo valor pago será repassado para a EGN como comissão de intermediação comercial.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Taxa de Configuração / Setup (R$)</label>
                <input
                  type="text"
                  required
                  value={configFeeInput}
                  onChange={(e) => setConfigFeeInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  placeholder="Ex: 1500,00"
                />
                <span className="text-xs text-slate-500 block font-bold">
                  Comissão EGN estimada (10%): <span className="text-[#859159]">R$ {((parseFloat(configFeeInput.replace(/\./g, "").replace(",", ".")) || 0) * 0.1).toFixed(2)}</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Parcelamento da Taxa de Setup</label>
                <select
                  value={setupInstallments}
                  onChange={(e) => setSetupInstallments(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#859159]/40 text-[#424733]"
                >
                  <option value={1}>À Vista (1x)</option>
                  <option value={2}>2x Sem Juros</option>
                  <option value={3}>3x Sem Juros</option>
                  <option value={4}>4x Sem Juros</option>
                  <option value={5}>5x Sem Juros</option>
                </select>
                {setupInstallments > 1 && configFeeInput && (
                  <span className="text-xs text-[#859159] block font-bold italic">
                    Serão gerados {setupInstallments} lançamentos mensais de R$ {((parseFloat(configFeeInput.replace(/\./g, "").replace(",", ".")) || 0) / setupInstallments).toFixed(2)} cada.
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Mensalidade do Cliente (R$)</label>
                <input
                  type="text"
                  required
                  value={monthlyFeeInput}
                  onChange={(e) => setMonthlyFeeInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:ring-2 focus:ring-[#859159]/40"
                  placeholder="Ex: 450,00"
                />
                <span className="text-xs text-slate-500 block font-bold">
                  Comissão EGN estimada mensal (10%): <span className="text-[#859159]">R$ {((parseFloat(monthlyFeeInput.replace(/\./g, "").replace(",", ".")) || 0) * 0.1).toFixed(2)}</span>
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={converting}
                  className="w-full bg-[#424733] hover:bg-[#859159] text-white font-black py-3.5 px-6 rounded-2xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {converting ? "Ativando Cliente..." : "Confirmar e Ativar Cliente (Pagando)"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* MODAL IN-APP: CONFIRMAÇÃO DE EXCLUSÃO DE LEAD */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 uppercase">Excluir Lead?</h3>
                <p className="text-xs text-slate-500 font-semibold">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
              Tem certeza de que deseja excluir permanentemente o lead <strong>"{lead.name}"</strong>? Todos os dados cadastrais e histórico serão removidos.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteLead}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
