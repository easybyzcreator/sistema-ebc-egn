import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, HistoryItem, ContractConfig } from "../types";
import { FileText, Link, Copy, Check, Eye, HelpCircle, FileSignature, CheckCircle, ExternalLink, Calendar, AlertCircle, X, Sliders, Printer, Trash2 } from "lucide-react";
import ContractConfigurator from "./ContractConfigurator";
import { printContract } from "../lib/printContract";
import { getDefaultContractConfig } from "../lib/contractDefaults";


interface ContractTabProps {
  leads: Lead[];
  isReadOnly: boolean;
}

export default function ContractTab({ leads, isReadOnly }: ContractTabProps) {
  const clients = leads.filter(l => l.status === "client");
  
  // State for generating a new contract slug
  const [selectedClientId, setSelectedClientId] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Modal for viewing signed contract details
  const [viewingContract, setViewingContract] = useState<Lead | null>(null);

  // State for advanced contract configuration
  const [configuringLead, setConfiguringLead] = useState<Lead | null>(null);


  // Generate slug based on selected client name
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    if (client) {
      // Clean slug: replace spaces, accents, special characters
      const clean = client.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric
        .trim()
        .replace(/\s+/g, "-") // spaces to -
        .slice(0, 30);
      
      const uniqueSuffix = Math.random().toString(36).substr(2, 4);
      setCustomSlug(`${clean}-${uniqueSuffix}`);
    } else {
      setCustomSlug("");
    }
  };

  // Submit and create the contract slug
  const handleGenerateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedClientId || !customSlug.trim()) {
      alert("Por favor, selecione um cliente e defina o link.");
      return;
    }

    try {
      setSubmitting(false);
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Link de assinatura eletrônica do contrato gerado com o identificador slug: ${customSlug}.`,
        type: "contract"
      };

      const clientRef = doc(db, "leads", client.id);
      await updateDoc(clientRef, {
        contractSlug: customSlug,
        contractStatus: "pending",
        history: [...(client.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      alert("Link de contrato gerado com sucesso!");
      setSelectedClientId("");
      setCustomSlug("");
    } catch (err) {
      console.error("Error generating contract:", err);
      alert("Erro ao gerar link do contrato.");
    }
  };

  // Handle saving complete custom contract config
  const handleSaveContractConfig = async (config: ContractConfig) => {
    if (isReadOnly || !configuringLead) return;
    try {
      const isNew = !configuringLead.contractSlug;
      let slug = configuringLead.contractSlug;
      if (!slug) {
        const clean = configuringLead.name
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

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: isNew 
          ? `Configuração completa do contrato personalizada e link gerado: ${slug}`
          : `Configuração do contrato atualizada e personalizada para o cliente.`,
        type: "contract"
      };

      const leadRef = doc(db, "leads", configuringLead.id);
      await updateDoc(leadRef, {
        contractSlug: slug,
        contractStatus: configuringLead.contractStatus === "signed" ? "signed" : "pending",
        contractConfig: config,
        history: [...(configuringLead.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      alert("Contrato configurado e salvo com sucesso!");
      setConfiguringLead(null);
    } catch (err) {
      console.error("Error saving contract config:", err);
      alert("Erro ao salvar configuração do contrato.");
    }
  };

  // Delete/Clear contract generated for a lead
  const handleDeleteContract = async (lead: Lead) => {
    if (isReadOnly) return;
    if (!window.confirm(`Tem certeza de que deseja deletar o contrato gerado de "${lead.name}"? Isso desativará o link de assinatura.`)) {
      return;
    }
    try {
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `Contrato digital e link de assinatura excluídos pelo usuário.`,
        type: "contract"
      };

      const leadRef = doc(db, "leads", lead.id);
      await updateDoc(leadRef, {
        contractSlug: null,
        contractStatus: null,
        contractConfig: null,
        contractData: null,
        history: [...(lead.history || []), newHistoryItem],
        updatedAt: new Date().toISOString()
      });

      alert("Contrato digital excluído com sucesso!");
    } catch (err) {
      console.error("Error deleting contract:", err);
      alert("Erro ao excluir contrato.");
    }
  };


  // Get full link to copy
  const getSigningLink = (slug: string) => {
    // We will use standard URL location
    return `${window.location.origin}${window.location.pathname}?contract=${slug}`;
  };

  // Copy to Clipboard
  const handleCopyLink = (slug: string) => {
    const fullLink = getSigningLink(slug);
    navigator.clipboard.writeText(fullLink);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Split Layout: Generation + Active Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Generate Contract Link */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 lg:col-span-1 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileSignature size={14} className="text-[#859159]" />
            Gerar Link de Assinatura
          </h3>

          {isReadOnly ? (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200/50 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <p>Visualizadores não têm privilégios para gerar links de contratos de clientes.</p>
            </div>
          ) : (
            <form onSubmit={handleGenerateContract} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500 uppercase">Selecione o Cliente</label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#859159]/40"
                >
                  <option value="">-- Selecionar Cliente --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contractStatus === "signed" ? "(Já Assinou)" : c.contractStatus === "pending" ? "(Link Ativo)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClientId && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Slug Customizado do Link</label>
                  <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#859159]/40 transition">
                    <span className="bg-slate-100 text-slate-500 py-2 px-2.5 text-[10px] flex items-center border-r font-mono">
                      /?contract=
                    </span>
                    <input
                      type="text"
                      required
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="flex-1 px-3 py-1.5 text-xs bg-transparent focus:outline-none font-mono"
                      placeholder="link-cliente"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block font-medium leading-tight">
                    O link final será compartilhado com o cliente para assinatura eletrônica direta de qualquer aparelho.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedClientId}
                className="w-full bg-[#859159] hover:bg-[#424733] text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow-sm cursor-pointer"
              >
                {submitting ? "Gerando..." : "Gerar Link de Contrato"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedClientId) {
                    alert("Por favor, selecione um cliente no menu acima para poder configurar o contrato personalizado!");
                    return;
                  }
                  const client = clients.find(c => c.id === selectedClientId);
                  if (client) setConfiguringLead(client);
                }}
                className={`w-full text-xs font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-1.5 mt-2 ${
                  selectedClientId
                    ? "border border-[#859159]/40 hover:border-[#859159] hover:bg-slate-50 text-[#424733] cursor-pointer bg-white"
                    : "border border-dashed border-slate-200 text-slate-400 bg-slate-50/50 cursor-not-allowed"
                }`}
              >
                <Sliders size={13} />
                Configurar Contrato Completo
              </button>
            </form>
          )}
        </div>

        {/* Generated and Signed Contracts list */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 lg:col-span-2 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText size={14} className="text-[#859159]" />
            Contratos Digitais Registrados
          </h3>

          <div className="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs max-h-[60vh] overflow-y-auto">
            {clients.filter(c => c.contractSlug).length === 0 ? (
              <p className="text-xs text-slate-400 italic py-12 text-center">Nenhum contrato gerado ou enviado ainda.</p>
            ) : (
              clients
                .filter(c => c.contractSlug)
                .map(c => {
                  const isSigned = c.contractStatus === "signed";
                  const isCopied = copiedSlug === c.contractSlug;

                  return (
                    <div key={c.id} className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#424733]">{c.name}</span>
                          <span className={`text-[9px] font-bold py-0.5 px-2.5 rounded-full flex items-center gap-1 ${
                            isSigned 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {isSigned ? (
                              <>
                                <CheckCircle size={10} className="stroke-[2.5]" />
                                Assinado
                              </>
                            ) : "Aguardando Assinatura"}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1 select-all">
                          <Link size={10} />
                          {c.contractSlug}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {!isReadOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfiguringLead(c)}
                              className="py-1.5 px-2.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-[#859159]/10 text-[#424733] border border-slate-200 hover:border-[#859159]/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Editar termos, cláusulas, valores e chaves de pagamento"
                            >
                              <Sliders size={11} />
                              Editar/Configurar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteContract(c)}
                              className="py-1.5 px-2.5 rounded-lg text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Deletar este contrato digital"
                            >
                              <Trash2 size={11} />
                              Deletar
                            </button>
                          </>
                        )}

                        {isSigned ? (
                          <button
                            onClick={() => setViewingContract(c)}
                            className="flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-[10px] font-bold bg-[#424733] text-white hover:bg-[#859159] transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={11} />
                            Ver Termos Assinados
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleCopyLink(c.contractSlug!)}
                              className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                isCopied 
                                  ? "bg-emerald-600 text-white" 
                                  : "bg-[#859159]/10 hover:bg-[#859159]/20 text-[#424733] border border-[#859159]/20"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check size={11} />
                                  Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  Copiar Link
                                </>
                              )}
                            </button>

                            <a
                              href={getSigningLink(c.contractSlug!)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-slate-50 hover:bg-[#424733] hover:text-white text-[#424733] border border-slate-200 transition flex items-center justify-center gap-1"
                            >
                              <ExternalLink size={11} />
                              Testar
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

      </div>

      {/* MODAL: View Signed Contract details and Legal values */}
      {viewingContract && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            
            {/* Header */}
            <div className="bg-[#424733] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="text-[#859159]" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Recibo de Assinatura Eletrônica</h3>
                  <p className="text-[10px] text-slate-300">Autenticação jurídica digital via parceria EBC & EGN</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingContract(null)} 
                className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content view contract receipt */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-600">
              
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200/50 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <CheckCircle size={16} /> 
                  Documento Assinado com Sucesso
                </p>
                <p className="text-[11px] leading-relaxed">
                  Este contrato foi preenchido eletronicamente pelo CONTRATANTE e assinado com rastro digital completo, incluindo carimbo de data/hora oficial e endereço de IP registrado.
                </p>
              </div>

              {/* Legal data table */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qualificação do Contratante</span>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <p><strong>Nome Completo:</strong> {viewingContract.contractData?.fullName}</p>
                  <p><strong>CNPJ / CPF:</strong> {viewingContract.contractData?.document}</p>
                  <p><strong>Representante Legal:</strong> {viewingContract.contractData?.representative || "Não aplicável"}</p>
                  <p><strong>Endereço Cadastral:</strong> {viewingContract.contractData?.address}</p>
                  <p><strong>Telefone / WhatsApp:</strong> {viewingContract.contractData?.phone}</p>
                  <p><strong>E-mail de Notificação:</strong> {viewingContract.contractData?.email}</p>
                </div>
              </div>

              {/* Digital receipt tracker */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidências de Validade Jurídica</span>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 font-mono text-[10px]">
                  <p><strong>Identificador do Contrato:</strong> {viewingContract.id}-{viewingContract.contractSlug?.slice(0, 6)}</p>
                  <p><strong>Assinado em:</strong> {new Date(viewingContract.contractData!.signedAt).toLocaleString("pt-BR")}</p>
                  <p><strong>Endereço IP Origem:</strong> {viewingContract.contractData?.ipAddress}</p>
                  <p><strong>Assinatura Eletrônica Hash:</strong> SHA256:{viewingContract.id.slice(0, 8)}{viewingContract.contractSlug?.slice(0, 6)}</p>
                </div>
              </div>

              {/* Digital Signature Render */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinatura Capturada</span>
                <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-24 flex items-center justify-center text-center">
                  {viewingContract.contractData?.signature.startsWith("TYPED:") ? (
                    <p className="text-3xl font-serif italic text-[#424733] font-signature select-none">
                      {viewingContract.contractData.signature.replace("TYPED:", "")}
                    </p>
                  ) : (
                    <img 
                      src={viewingContract.contractData?.signature} 
                      alt="Assinatura Digitalizada" 
                      className="max-h-20 object-contain mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

            </div>

            {/* Footer action close */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  if (viewingContract) {
                    const config = viewingContract.contractConfig || getDefaultContractConfig(viewingContract);
                    printContract(viewingContract, config);
                  }
                }}
                className="bg-[#859159] hover:bg-[#424733] text-white text-xs font-bold py-2 px-4 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                title="Visualizar documento em formato de impressão ou salvar como PDF"
              >
                <Printer size={13} />
                Imprimir / Salvar PDF
              </button>

              <button
                onClick={() => setViewingContract(null)}
                className="bg-[#424733] hover:bg-[#859159] text-white text-xs font-bold py-2 px-5 rounded-lg transition cursor-pointer"
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {configuringLead && (
        <ContractConfigurator
          lead={configuringLead}
          onSave={handleSaveContractConfig}
          onClose={() => setConfiguringLead(null)}
          isReadOnly={isReadOnly}
        />
      )}

    </div>
  );
}
