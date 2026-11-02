import React, { useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, HistoryItem, ContractConfig } from "../types";
import { 
  Users, 
  UserCheck, 
  FileText, 
  FileSignature, 
  CheckCircle2, 
  Clock, 
  Link as LinkIcon, 
  Copy, 
  ExternalLink, 
  Sliders, 
  Printer, 
  Edit3, 
  Trash2, 
  Plus, 
  Search, 
  Check, 
  Eye, 
  Building2, 
  Phone, 
  Mail, 
  Sparkles,
  AlertCircle,
  X,
  Power,
  PowerOff,
  UserX,
  Loader2
} from "lucide-react";
import ContractConfigurator from "./ContractConfigurator";
import ClientContractPortal from "./ClientContractPortal";
import { printContract } from "../lib/printContract";
import { getDefaultContractConfig } from "../lib/contractDefaults";

interface UnifiedClientsTabProps {
  leads: Lead[];
  isReadOnly: boolean;
  onOpenNewClientModal: () => void;
  onEditClient: (client: Lead) => void;
}

export default function UnifiedClientsTab({
  leads,
  isReadOnly,
  onOpenNewClientModal,
  onEditClient
}: UnifiedClientsTabProps) {
  // We treat all entries in this simplified app as clients/contracts
  const clients = leads;

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "signed" | "pending" | "inactive">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [confirmToggleClient, setConfirmToggleClient] = useState<Lead | null>(null);

  // In-App Simulated Signing Portal state
  const [simulatedContractLead, setSimulatedContractLead] = useState<Lead | null>(null);

  // Contract Configurator state
  const [configuringClient, setConfiguringClient] = useState<Lead | null>(null);

  // Viewing Signed Details Modal
  const [viewingSignedModal, setViewingSignedModal] = useState<Lead | null>(null);

  // Generated Link Success Modal
  const [generatedLinkModal, setGeneratedLinkModal] = useState<{
    isOpen: boolean;
    client: Lead;
    url: string;
    copied: boolean;
  } | null>(null);

  // Custom in-app Delete Confirmation Modal
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const isClientActive = client.isActive !== false;

    // Status filter
    if (statusFilter === "signed" && (!isClientActive || client.contractStatus !== "signed")) return false;
    if (statusFilter === "pending" && (!isClientActive || client.contractStatus === "signed")) return false;
    if (statusFilter === "inactive" && isClientActive) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      const matchName = (client.name || "").toLowerCase().includes(q);
      const matchCompany = (client.company || "").toLowerCase().includes(q);
      const matchEmail = (client.email || "").toLowerCase().includes(q) ||
                         (client.contractConfig?.clientEmail || "").toLowerCase().includes(q) ||
                         (client.contractData?.email || "").toLowerCase().includes(q);

      // Phone matching (both formatted strings and raw digits)
      const clientPhone1 = (client.phone || "").toLowerCase();
      const clientPhone2 = (client.whatsapp || "").toLowerCase();
      const clientPhone3 = (client.contractData?.phone || "").toLowerCase();
      const clientPhone4 = (client.contractConfig?.clientPhone || "").toLowerCase();

      const phoneDigits1 = clientPhone1.replace(/\D/g, "");
      const phoneDigits2 = clientPhone2.replace(/\D/g, "");
      const phoneDigits3 = clientPhone3.replace(/\D/g, "");
      const phoneDigits4 = clientPhone4.replace(/\D/g, "");

      const matchPhoneText = clientPhone1.includes(q) || clientPhone2.includes(q) || clientPhone3.includes(q) || clientPhone4.includes(q);
      const matchPhoneDigits = qDigits.length >= 3 && (
        phoneDigits1.includes(qDigits) ||
        phoneDigits2.includes(qDigits) ||
        phoneDigits3.includes(qDigits) ||
        phoneDigits4.includes(qDigits)
      );
      const matchPhone = matchPhoneText || matchPhoneDigits;

      // CPF / CNPJ / Document matching
      const doc1 = (client.contractData?.document || "").toLowerCase();
      const doc2 = (client.contractConfig?.clientDoc || "").toLowerCase();
      const doc3 = (client.document || "").toLowerCase();
      const doc4 = (client.cpf || "").toLowerCase();
      const doc5 = (client.cnpj || "").toLowerCase();

      const docDigits1 = doc1.replace(/\D/g, "");
      const docDigits2 = doc2.replace(/\D/g, "");
      const docDigits3 = doc3.replace(/\D/g, "");
      const docDigits4 = doc4.replace(/\D/g, "");
      const docDigits5 = doc5.replace(/\D/g, "");

      const matchDocText = doc1.includes(q) || doc2.includes(q) || doc3.includes(q) || doc4.includes(q) || doc5.includes(q);
      const matchDocDigits = qDigits.length >= 3 && (
        docDigits1.includes(qDigits) ||
        docDigits2.includes(qDigits) ||
        docDigits3.includes(qDigits) ||
        docDigits4.includes(qDigits) ||
        docDigits5.includes(qDigits)
      );
      const matchDoc = matchDocText || matchDocDigits;

      return matchName || matchCompany || matchEmail || matchPhone || matchDoc;
    }

    return true;
  });

  // Handle Copy Contract URL
  const handleCopyLink = (client: Lead) => {
    let slug = client.contractSlug;
    if (!slug) {
      // If no slug yet, generate one on the fly
      const clean = (client.name || "cliente")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 30);
      const uniqueSuffix = Math.random().toString(36).substr(2, 4);
      slug = `${clean}-${uniqueSuffix}`;

      // Save slug asynchronously
      const clientRef = doc(db, "leads", client.id);
      updateDoc(clientRef, {
        contractSlug: slug,
        contractStatus: client.contractStatus || "pending",
        updatedAt: new Date().toISOString()
      }).catch(console.error);
    }

    const url = `${window.location.origin}/?contract=${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Handle Save Contract Configuration
  const handleSaveContractConfig = async (config: ContractConfig) => {
    if (isReadOnly || !configuringClient) return;

    try {
      let slug = configuringClient.contractSlug;
      if (!slug) {
        const clean = (configuringClient.name || "cliente")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 30);
        const uniqueSuffix = Math.random().toString(36).substr(2, 4);
        slug = `${clean}-${uniqueSuffix}`;
      }

      const clientRef = doc(db, "leads", configuringClient.id);
      await updateDoc(clientRef, {
        contractConfig: config,
        contractSlug: slug,
        contractStatus: configuringClient.contractStatus || "pending",
        monthlyFee: config.installmentValue !== "" ? Number(config.installmentValue) : configuringClient.monthlyFee,
        configurationFee: config.setupFee !== "" ? Number(config.setupFee) : configuringClient.configurationFee,
        firstMonthlyDueDate: config.firstMonthlyDueDate || "",
        monthlyDueDateOption: config.monthlyDueDateOption || "signing_date",
        setupDueDate: config.setupDueDate || "",
        setupDueDateOption: config.setupDueDateOption || "signing_date",
        setupInstallments: config.setupInstallments || configuringClient.setupInstallments || 1,
        updatedAt: new Date().toISOString()
      });

      const clientUpdated: Lead = {
        ...configuringClient,
        contractConfig: config,
        contractSlug: slug,
        contractStatus: configuringClient.contractStatus || "pending",
        monthlyFee: config.installmentValue !== "" ? Number(config.installmentValue) : configuringClient.monthlyFee,
        configurationFee: config.setupFee !== "" ? Number(config.setupFee) : configuringClient.configurationFee,
        firstMonthlyDueDate: config.firstMonthlyDueDate || "",
        monthlyDueDateOption: config.monthlyDueDateOption || "signing_date",
        setupDueDate: config.setupDueDate || "",
        setupDueDateOption: config.setupDueDateOption || "signing_date",
        setupInstallments: config.setupInstallments || configuringClient.setupInstallments || 1,
      };

      const generatedUrl = `${window.location.origin}/?contract=${slug}`;
      setConfiguringClient(null);
      setGeneratedLinkModal({
        isOpen: true,
        client: clientUpdated,
        url: generatedUrl,
        copied: false
      });
    } catch (err) {
      console.error("Error saving contract config:", err);
    }
  };

  // Trigger Delete Confirmation Modal
  const requestDeleteClient = (client: Lead) => {
    if (isReadOnly) return;
    setDeleteConfirmClient(client);
  };

  // Open in-app modal to Toggle Client Active / Inactive status
  const promptToggleActiveClient = (client: Lead) => {
    if (isReadOnly) return;
    setConfirmToggleClient(client);
  };

  // Execute Toggle Client Active / Inactive status in Firestore
  const executeToggleActiveClient = async () => {
    if (!confirmToggleClient || isReadOnly) return;
    const client = confirmToggleClient;
    const currentIsActive = client.isActive !== false;
    const nextStatus = !currentIsActive;

    try {
      setTogglingActiveId(client.id);
      const clientRef = doc(db, "leads", client.id);
      const historyItem: HistoryItem = {
        id: `hist_${Date.now()}`,
        date: new Date().toISOString(),
        text: nextStatus 
          ? "Cliente e aplicativo REATIVADOS no sistema." 
          : "Cliente e aplicativo INATIVADOS no sistema (Contrato/Serviço suspenso).",
        type: "status_change"
      };

      await updateDoc(clientRef, {
        isActive: nextStatus,
        history: [...(client.history || []), historyItem],
        updatedAt: new Date().toISOString()
      });
      setTogglingActiveId(null);
      setConfirmToggleClient(null);
    } catch (err) {
      console.error("Error toggling client active state:", err);
      setTogglingActiveId(null);
      setConfirmToggleClient(null);
    }
  };

  // Perform Delete Client
  const executeDeleteClient = async () => {
    if (!deleteConfirmClient || isReadOnly) return;
    try {
      setDeleting(true);
      await deleteDoc(doc(db, "leads", deleteConfirmClient.id));
      setDeleteConfirmClient(null);
      setDeleting(false);
    } catch (err) {
      console.error("Error deleting client:", err);
      setDeleting(false);
    }
  };

  const countActive = clients.filter(c => c.isActive !== false).length;
  const countInactive = clients.filter(c => c.isActive === false).length;
  const countSigned = clients.filter(c => c.isActive !== false && c.contractStatus === "signed").length;
  const countPending = clients.filter(c => c.isActive !== false && c.contractStatus !== "signed").length;

  // If user is testing/simulating contract signing in-app
  if (simulatedContractLead) {
    return (
      <ClientContractPortal
        slug={simulatedContractLead.contractSlug || simulatedContractLead.id}
        onBackToAdmin={() => setSimulatedContractLead(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Clean Top Action & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        
        {/* Search & Status Filters */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, empresa, CPF/CNPJ, telefone ou e-mail..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition cursor-pointer whitespace-nowrap ${
                statusFilter === "all" ? "bg-white text-[#424733] shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Ativos ({countActive})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("signed")}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                statusFilter === "signed" ? "bg-emerald-800 text-white shadow-xs" : "text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 size={12} /> Assinados ({countSigned})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                statusFilter === "pending" ? "bg-amber-800 text-white shadow-xs" : "text-amber-800 hover:bg-amber-50"
              }`}
            >
              <Clock size={12} /> Pendentes ({countPending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] tracking-wider transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                statusFilter === "inactive" ? "bg-slate-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              <UserX size={12} /> Inativos ({countInactive})
            </button>
          </div>
        </div>

        {/* New Client Action */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={onOpenNewClientModal}
            className="bg-[#859159] hover:bg-[#4c5432] text-white font-black text-xs py-2.5 px-5 rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer uppercase tracking-wider"
          >
            <Plus size={16} />
            <span>Novo Cliente / Contrato</span>
          </button>
        )}

      </div>

      {/* Main Unified Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Cliente & Contato</th>
                <th className="px-5 py-3.5">Status do Contrato</th>
                <th className="px-5 py-3.5">Link de Assinatura</th>
                <th className="px-5 py-3.5">Valores Contratados</th>
                <th className="px-5 py-3.5 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum cliente ou contrato encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isSigned = client.contractStatus === "signed";
                  const isClientActive = client.isActive !== false;
                  const slug = client.contractSlug;
                  const contractUrl = slug ? `${window.location.origin}/?contract=${slug}` : null;

                  return (
                    <tr key={client.id} className={`transition group ${isClientActive ? "hover:bg-slate-50/70" : "bg-rose-50/25 hover:bg-rose-50/50"}`}>
                      
                      {/* Client info */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className={`font-extrabold text-sm flex items-center gap-1.5 ${
                              isClientActive ? "text-[#424733]" : "text-rose-600"
                            }`}>
                              {client.name || "Sem Nome"}
                            </p>
                            {!isClientActive && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 tracking-wider shadow-2xs">
                                ● INATIVO
                              </span>
                            )}
                          </div>
                          {client.company && (
                            <p className={`text-[11px] font-bold flex items-center gap-1 ${
                              isClientActive ? "text-slate-500" : "text-rose-900/60"
                            }`}>
                              <Building2 size={12} className={isClientActive ? "text-slate-400" : "text-rose-400"} />
                              {client.company}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                            {client.phone && <span>{client.phone}</span>}
                            {client.email && <span>{client.email}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Contract Status */}
                      <td className="px-5 py-4">
                        {isSigned ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 size={12} /> Assinado
                            </span>
                            {client.contractData?.signedAt && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                {new Date(client.contractData.signedAt).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock size={12} /> Pendente
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Contract Link / Access */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {/* Copy Link Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(client)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                              copiedId === client.id
                                ? "bg-emerald-800 text-white border-emerald-800"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                            title="Copiar link de assinatura para enviar ao cliente"
                          >
                            {copiedId === client.id ? (
                              <>
                                <Check size={13} className="text-white" />
                                <span>Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} className="text-slate-500" />
                                <span>Copiar Link</span>
                              </>
                            )}
                          </button>

                          {/* In-App Test / Signing Simulator Button (No 403 error) */}
                          <button
                            type="button"
                            onClick={() => setSimulatedContractLead(client)}
                            className="px-2.5 py-1.5 bg-[#859159]/15 hover:bg-[#859159]/25 text-[#424733] hover:text-black border border-[#859159]/30 rounded-lg transition flex items-center gap-1 text-xs font-bold cursor-pointer"
                            title="Testar e Assinar diretamente no painel (Sem erro 403)"
                          >
                            <FileSignature size={13} className="text-[#859159]" />
                            <span>Testar</span>
                          </button>
                        </div>
                      </td>

                      {/* Contract & Setup Values */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5 font-mono text-xs">
                          <p className="font-extrabold text-[#424733]">
                            Mensal: {client.monthlyFee ? `R$ ${client.monthlyFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Não definido"}
                          </p>
                          {client.configurationFee ? (
                            <p className="text-[10px] text-slate-500">
                              Setup: R$ {client.configurationFee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Inactivate / Activate Toggle Button */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => promptToggleActiveClient(client)}
                              disabled={togglingActiveId === client.id}
                              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                                isClientActive
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:border-amber-300"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 hover:border-emerald-400"
                              }`}
                              title={isClientActive ? "Inativar Cliente / Bloquear App" : "Reativar Cliente & App"}
                            >
                              {togglingActiveId === client.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : isClientActive ? (
                                <PowerOff size={14} />
                              ) : (
                                <Power size={14} />
                              )}
                            </button>
                          )}

                          {/* Configurator */}
                          <button
                            type="button"
                            onClick={() => setConfiguringClient(client)}
                            className="p-1.5 bg-slate-50 hover:bg-[#859159]/10 text-slate-600 hover:text-[#859159] border border-slate-200 rounded-lg transition cursor-pointer"
                            title="Personalizar cláusulas e dados do contrato"
                          >
                            <Sliders size={14} />
                          </button>

                          {/* Print / PDF */}
                          <button
                            type="button"
                            onClick={() => printContract(client, client.contractConfig || getDefaultContractConfig(client))}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition cursor-pointer"
                            title="Imprimir / Salvar PDF"
                          >
                            <Printer size={14} />
                          </button>

                          {/* View Signed Details */}
                          {isSigned && (
                            <button
                              type="button"
                              onClick={() => setViewingSignedModal(client)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition cursor-pointer"
                              title="Ver Comprovante de Assinatura Eletrônica"
                            >
                              <Eye size={14} />
                            </button>
                          )}

                          {/* Edit Client */}
                          <button
                            type="button"
                            onClick={() => onEditClient(client)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition cursor-pointer"
                            title="Editar Dados Cadastrais & Cobranças"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Delete (Admin only) */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => requestDeleteClient(client)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition cursor-pointer"
                              title="Excluir Cliente"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Configurator Modal */}
      {configuringClient && (
        <ContractConfigurator
          lead={configuringClient}
          onSave={handleSaveContractConfig}
          onClose={() => setConfiguringClient(null)}
          isReadOnly={isReadOnly}
        />
      )}

      {/* MODAL IN-APP: LINK DO CONTRATO GERADO COM SUCESSO (Com Acesso Direto, Cópia e WhatsApp) */}
      {generatedLinkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#859159]/20 text-[#4c5432] flex items-center justify-center shrink-0">
                  <Sparkles size={22} className="text-[#859159]" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#424733] uppercase tracking-wide">
                    Link do Contrato Gerado!
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Cliente: <strong>{generatedLinkModal.client.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedLinkModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                O contrato foi configurado e salvo com sucesso. Você pode copiar o link de assinatura abaixo para enviar diretamente ao cliente por WhatsApp ou e-mail:
              </p>

              {/* Link Input Container with Copy Button */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Link Único de Assinatura Digital:
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-[#859159]">
                  <LinkIcon size={16} className="text-[#859159] ml-2 shrink-0" />
                  <input
                    type="text"
                    readOnly
                    value={generatedLinkModal.url}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLinkModal.url);
                      setGeneratedLinkModal(prev => prev ? { ...prev, copied: true } : null);
                      setTimeout(() => {
                        setGeneratedLinkModal(prev => prev ? { ...prev, copied: false } : null);
                      }, 3000);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs ${
                      generatedLinkModal.copied
                        ? "bg-emerald-600 text-white"
                        : "bg-[#859159] hover:bg-[#424733] text-white"
                    }`}
                  >
                    {generatedLinkModal.copied ? (
                      <>
                        <Check size={14} />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Direct Test in-app + WhatsApp */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedContractLead(generatedLinkModal.client);
                    setGeneratedLinkModal(null);
                  }}
                  className="flex-1 bg-[#859159] hover:bg-[#4c5432] text-white text-xs font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <FileSignature size={16} />
                  <span>Testar / Assinar no Painel</span>
                </button>

                <a
                  href={`https://wa.me/${(generatedLinkModal.client.phone || generatedLinkModal.client.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${generatedLinkModal.client.name}, segue o link para conferência e assinatura digital do seu contrato Easy Menu EGN:\n\n${generatedLinkModal.url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Phone size={15} />
                  <span>Enviar por WhatsApp</span>
                </a>
              </div>

              {/* Helpful Explanatory Box about 403 on Google Dev vs Production */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1 text-slate-600">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#424733]">
                  <Sparkles size={14} className="text-[#859159]" />
                  <span>Ambiente de Testes vs. Link de Produção:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  • Para testar agora, clique no botão verde <strong>"Testar / Assinar no Painel"</strong> acima.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  • <em>Nota:</em> O Google Cloud bloqueia novas abas externas para o link interno temporário (Erro 403). Quando publicado no seu domínio oficial ou Vercel, o link público será 100% acessível para qualquer cliente no celular ou computador.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGeneratedLinkModal(null)}
                className="w-full sm:w-auto bg-[#424733] hover:bg-[#2b2e21] text-white text-xs font-black py-2.5 px-6 rounded-xl transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IN-APP: CONFIRMAÇÃO DE EXCLUSÃO DE CLIENTE */}
      {deleteConfirmClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 uppercase">Excluir Cliente?</h3>
                <p className="text-xs text-slate-500 font-semibold">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
              Tem certeza de que deseja excluir permanentemente o cliente <strong>"{deleteConfirmClient.name}"</strong>? Todos os dados cadastrais, contratos e faturas associadas serão apagados.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmClient(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={executeDeleteClient}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Signed Details Modal */}
      {viewingSignedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-[#424733]">Comprovante de Assinatura</h3>
                  <p className="text-xs text-slate-500 font-medium">Validade Jurídica MP 2.200-2/2001</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSignedModal(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-sm text-slate-800 font-mono">
              <div>
                <span className="text-xs text-slate-500 uppercase block font-sans font-bold">Assinante:</span>
                <span className="font-bold text-[#424733] text-base">
                  {viewingSignedModal.contractData?.fullName || viewingSignedModal.name}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase block font-sans font-bold">Documento (CPF/CNPJ):</span>
                <span className="font-semibold text-slate-700">{viewingSignedModal.contractData?.document || "Não informado"}</span>
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase block font-sans font-bold">Data & Hora do Registro:</span>
                <span className="font-semibold text-slate-700">
                  {viewingSignedModal.contractData?.signedAt
                    ? new Date(viewingSignedModal.contractData.signedAt).toLocaleString("pt-BR")
                    : "-"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase block font-sans font-bold">Endereço IP Registrado:</span>
                <span className="font-semibold text-slate-700">{viewingSignedModal.contractData?.ipAddress || "127.0.0.1"}</span>
              </div>

              <div>
                <span className="text-xs text-slate-500 uppercase block font-sans font-bold mb-1">Rubrica / Assinatura Capturada:</span>
                {viewingSignedModal.contractData?.signature?.startsWith("TYPED:") ? (
                  <span className="font-serif italic font-bold text-[#424733] text-xl block py-1">
                    {viewingSignedModal.contractData.signature.replace("TYPED:", "")}
                  </span>
                ) : viewingSignedModal.contractData?.signature ? (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block">
                    <img 
                      src={viewingSignedModal.contractData.signature} 
                      alt="Assinatura Manuscrita" 
                      className="max-h-16 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <span className="text-slate-400 font-sans">-</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  printContract(viewingSignedModal, viewingSignedModal.contractConfig || getDefaultContractConfig(viewingSignedModal));
                }}
                className="bg-[#859159] hover:bg-[#424733] text-white text-sm font-black py-3 px-5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer size={16} />
                Imprimir Documento Completo
              </button>
              <button
                type="button"
                onClick={() => setViewingSignedModal(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-3 px-5 rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Confirmação Inativar / Reativar Cliente */}
      {confirmToggleClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmToggleClient.isActive !== false
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-800"
              }`}>
                {confirmToggleClient.isActive !== false ? <PowerOff size={20} /> : <Power size={20} />}
              </div>
              <div>
                <h3 className="font-extrabold text-[#424733] text-base">
                  {confirmToggleClient.isActive !== false ? "Inativar Cliente / Bloquear App" : "Reativar Cliente e App"}
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmToggleClient.name || "Cliente"} {confirmToggleClient.company ? `(${confirmToggleClient.company})` : ""}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmToggleClient.isActive !== false
                ? "Ao inativar, o cliente ficará marcado em vermelho/inativo, sairá da contagem financeira do Dashboard e o portal de contrato será pausado."
                : "Ao reativar, o cliente voltará ao status ativo regular e será contabilizado normalmente no sistema."}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmToggleClient(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeToggleActiveClient}
                disabled={togglingActiveId !== null}
                className={`px-4 py-2 text-xs font-black text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                  confirmToggleClient.isActive !== false
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-700 hover:bg-emerald-800"
                }`}
              >
                {togglingActiveId ? <Loader2 size={14} className="animate-spin" /> : null}
                {confirmToggleClient.isActive !== false ? "Sim, Inativar" : "Sim, Reativar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
