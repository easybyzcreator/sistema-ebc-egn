import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead, HistoryItem, ContractConfig } from "../types";
import { getDefaultContractConfig, formatClause3 } from "../lib/contractDefaults";
import { printContract } from "../lib/printContract";
import { formatCpfCnpj, formatDateBRInput, formatPhoneBR } from "../lib/masks";
import { 
  FileSignature, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Calendar, 
  Building2, 
  User2, 
  DollarSign, 
  Clock, 
  FileCheck, 
  Printer, 
  Check, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  KeyRound,
  PenTool,
  Type,
  RotateCcw,
  Eraser
} from "lucide-react";

interface ClientContractPortalProps {
  slug: string;
  onBackToAdmin?: () => void;
}

export default function ClientContractPortal({ slug, onBackToAdmin }: ClientContractPortalProps) {
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Custom contract configuration resolved for this client
  const [contractConfig, setContractConfig] = useState<ContractConfig | null>(null);

  // Signer Form State
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [company, setCompany] = useState("");
  const [representative, setRepresentative] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  // Signing state
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Format CPF or CNPJ on the fly
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocument(formatCpfCnpj(e.target.value));
  };

  // Canvas drawing handlers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b"; // dark ink
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.closePath();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Fetch lead data by contract slug or direct doc id
  useEffect(() => {
    async function fetchLeadBySlug() {
      try {
        setLoading(true);
        const cleanSlug = (slug || "").trim();

        // 1. Busca por contractSlug exato
        const q = query(collection(db, "leads"), where("contractSlug", "==", cleanSlug));
        const querySnapshot = await getDocs(q);

        let leadData: Lead | null = null;

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          leadData = { id: docSnap.id, ...docSnap.data() } as Lead;
        } else {
          // 2. Busca direta por ID do documento no Firestore
          try {
            const directSnap = await getDoc(doc(db, "leads", cleanSlug));
            if (directSnap.exists()) {
              leadData = { id: directSnap.id, ...directSnap.data() } as Lead;
            }
          } catch (dErr) {
            // ignore
          }

          // 3. Fallback de varredura se slug sofreu encoding ou case change
          if (!leadData) {
            const allSnap = await getDocs(collection(db, "leads"));
            for (const d of allSnap.docs) {
              const data = d.data();
              if (
                data.contractSlug === cleanSlug ||
                data.contractSlug?.toLowerCase() === cleanSlug.toLowerCase() ||
                d.id === cleanSlug
              ) {
                leadData = { id: d.id, ...data } as Lead;
                break;
              }
            }
          }
        }

        if (!leadData) {
          setError("Contrato não encontrado ou link expirado.");
          setLoading(false);
          return;
        }

        if (leadData.isActive === false) {
          setError("Este contrato ou aplicativo encontra-se atualmente inativo ou suspenso. Por favor, entre em contato com nossa equipe.");
          setLoading(false);
          return;
        }

        setLead(leadData);

        // Populate configuration
        const config = leadData.contractConfig ? { ...leadData.contractConfig } : getDefaultContractConfig(leadData);
        if (config.activationInstructions && config.activationInstructions.includes("é de até 7 dias úteis, contados a partir da data de confirmação")) {
          config.activationInstructions = config.activationInstructions.replace(
            "é de até 7 dias úteis, contados a partir da data de confirmação",
            "é de até 10 dias úteis, contados a partir da data de confirmação"
          );
        }
        if (config.clause2Body && config.clause2Body.includes("em até 7 (sete) dias úteis.")) {
          config.clause2Body = config.clause2Body.replace(
            "em até 7 (sete) dias úteis.",
            "em até 10 (dez) dias úteis."
          );
        }
        setContractConfig(config);

        // Prepopulate form if lead already had basic info
        setFullName(config.clientName || leadData.name || "");
        setCompany(config.clientCompany || leadData.company || "");
        setDocument(config.clientDoc || "");
        setEmail(config.clientEmail || leadData.email || "");
        setPhone(config.clientPhone || leadData.phone || "");
        setAddress(config.clientAddress || "");
        setBirthDate(config.clientBirthDate || "");
        setSignatureName(config.clientName || leadData.name || "");

        if (leadData.contractStatus === "signed" || leadData.contractData) {
          setSignedSuccess(true);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading contract:", err);
        setError("Erro ao carregar os dados do contrato.");
        setLoading(false);
      }
    }

    if (slug) {
      fetchLeadBySlug();
    }
  }, [slug]);

  // Handle Form Submission and Digital Signature
  const handleSignContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !contractConfig) return;

    if (!agreedToTerms) {
      alert("Por favor, confirme a leitura e concordância com todos os termos do contrato.");
      return;
    }

    let finalSignature = "";

    if (signatureMode === "draw") {
      if (!hasDrawn || !canvasRef.current) {
        alert("Por favor, faça o desenho da sua assinatura no quadro com o mouse ou dedo antes de continuar.");
        return;
      }
      finalSignature = canvasRef.current.toDataURL("image/png");
    } else {
      const typed = signatureName.trim() || fullName.trim();
      if (!typed) {
        alert("Por favor, digite seu nome completo para a assinatura eletrônica.");
        return;
      }
      finalSignature = `TYPED:${typed.toUpperCase()}`;
    }

    try {
      setSubmitting(true);

      // Simple IP lookup or placeholder
      let clientIp = "127.0.0.1";
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        if (ipData && ipData.ip) {
          clientIp = String(ipData.ip);
        }
      } catch {
        // Continue if IP fetch fails
      }

      const signedAtTimestamp = new Date().toISOString();

      const contractPayload = {
        signedAt: signedAtTimestamp,
        fullName: fullName.trim(),
        document: document.trim(),
        company: company.trim() || "",
        representative: representative.trim() || "",
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        birthDate: birthDate.trim() || "",
        signature: finalSignature,
        ipAddress: clientIp,
        userAgent: navigator.userAgent || ""
      };

      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        date: signedAtTimestamp,
        text: `Contrato assinado eletronicamente (${signatureMode === "draw" ? "rubrica manuscrita" : "assinatura digitada"}) pelo cliente ${fullName} (${document}) via IP ${clientIp}.`,
        type: "contract"
      };

      const leadRef = doc(db, "leads", lead.id);
      const existingHistory = Array.isArray(lead.history) ? lead.history : [];

      const updatedContractConfig: ContractConfig = {
        ...contractConfig,
        clientName: fullName.trim() || contractConfig.clientName || lead.name,
        clientDoc: document.trim() || contractConfig.clientDoc || "",
        clientCompany: company.trim() || contractConfig.clientCompany || lead.company || "",
        clientPhone: phone.trim() || contractConfig.clientPhone || lead.phone || "",
        clientEmail: email.trim() || contractConfig.clientEmail || lead.email || "",
        clientAddress: address.trim() || contractConfig.clientAddress || "",
        clientBirthDate: birthDate.trim() || contractConfig.clientBirthDate || ""
      };

      // Helper function to safely strip any undefined values for Firestore
      const cleanForFirestore = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(cleanForFirestore);
        } else if (obj !== null && typeof obj === "object") {
          const cleaned: Record<string, any> = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) {
              cleaned[k] = cleanForFirestore(v);
            }
          }
          return cleaned;
        }
        return obj;
      };

      const updateData = cleanForFirestore({
        contractStatus: "signed",
        contractData: contractPayload,
        contractConfig: updatedContractConfig,
        name: fullName.trim() || lead.name,
        company: company.trim() || lead.company || "",
        email: email.trim() || lead.email || "",
        phone: phone.trim() || lead.phone || "",
        status: "client", // automatically moves/ensures status is client
        history: [...existingHistory, newHistoryItem],
        updatedAt: signedAtTimestamp
      });

      await updateDoc(leadRef, updateData);

      setSignedSuccess(true);
      setSubmitting(false);

      // Trigger automatic printer/PDF receipt preview for the client
      setTimeout(() => {
        const updatedLead: Lead = {
          ...lead,
          contractStatus: "signed",
          contractData: contractPayload,
          contractConfig: updatedContractConfig
        };
        printContract(updatedLead, updatedContractConfig);
      }, 800);
    } catch (err: any) {
      console.error("Error signing contract:", err);
      alert("Ocorreu um erro ao salvar sua assinatura eletrônica. Tente novamente.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFCF7] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-full border-4 border-[#859159] border-t-transparent animate-spin" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#424733]">Carregando Contrato Seguro</h2>
          <p className="text-xs text-slate-500">Preparando ambiente criptografado para assinatura eletrônica...</p>
        </div>
      </div>
    );
  }

  if (error || !lead || !contractConfig) {
    return (
      <div className="min-h-screen bg-[#FDFCF7] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 text-center max-w-md w-full space-y-4">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-base font-bold text-slate-800 uppercase">Documento Não Encontrado</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || "O link do contrato que você tentou acessar é inválido ou foi desativado pela administração."}
          </p>
          {onBackToAdmin ? (
            <button
              type="button"
              onClick={onBackToAdmin}
              className="inline-block bg-[#424733] hover:bg-[#859159] text-white text-xs font-bold py-2.5 px-6 rounded-xl transition cursor-pointer"
            >
              Voltar ao Painel
            </button>
          ) : (
            <a
              href="/"
              className="inline-block bg-[#424733] hover:bg-[#859159] text-white text-xs font-bold py-2.5 px-6 rounded-xl transition"
            >
              Voltar ao Início
            </a>
          )}
        </div>
      </div>
    );
  }

  const formattedClause3 = formatClause3(contractConfig.clause3Body, {
    frequency: contractConfig.frequency,
    installmentValue: contractConfig.installmentValue,
    setupFee: contractConfig.setupFee,
    totalAnnualValue: contractConfig.totalAnnualValue,
    setupInstallments: lead.setupInstallments || contractConfig.setupInstallments || 1,
    firstMonthlyDueDate: contractConfig.firstMonthlyDueDate || lead.firstMonthlyDueDate,
    setupDueDate: contractConfig.setupDueDate || lead.setupDueDate,
    setupDueDateOption: contractConfig.setupDueDateOption || lead.setupDueDateOption
  });

  return (
    <div className="min-h-screen bg-[#fcfdfa] text-slate-800 font-sans pb-12">
      {/* Admin Test / Preview Banner */}
      {onBackToAdmin && (
        <div className="bg-[#424733] text-white px-4 sm:px-8 py-3 sticky top-0 z-50 shadow-md flex items-center justify-between border-b border-[#859159]/40">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <span className="text-xs font-black uppercase tracking-wider block sm:inline">Modo de Teste & Assinatura</span>
              <span className="hidden sm:inline text-[11px] text-slate-300 font-normal sm:ml-2">• Esta é a tela que o cliente vê ao abrir o link</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToAdmin}
            className="bg-white hover:bg-slate-100 text-[#424733] text-xs font-black px-4 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <span>← Voltar ao Painel</span>
          </button>
        </div>
      )}

      <div className="py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Security & Brand Banner */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <img 
            src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
            alt="EBC Logo" 
            className="h-9 object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
          <p className="text-[11px] font-bold text-slate-600">
            Ambiente Seguro de Assinatura Eletrônica • <span className="text-[#859159] font-black uppercase">EBC</span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck size={14} className="text-emerald-700" />
          <span>Validade Jurídica MP 2.200-2/2001</span>
        </div>
      </div>

      {/* Main Signed Success Banner or Document Container */}
      <div className="max-w-4xl mx-auto space-y-8">
        
        {signedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black uppercase tracking-wider text-emerald-900">
                  Contrato Assinado com Sucesso!
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Sua assinatura eletrônica e dados cadastrais foram registrados com validade jurídica integral. Um comprovante criptográfico com carimbo de tempo oficial e IP foi emitido.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-emerald-200/60">
              <div className="text-[11px] text-emerald-800 font-mono">
                Data do Registro: {new Date(lead.contractData?.signedAt || new Date()).toLocaleString("pt-BR")}
              </div>
              <button
                type="button"
                onClick={() => printContract(lead, contractConfig)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-4 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer size={14} />
                Imprimir / Salvar Cópia em PDF
              </button>
            </div>
          </div>
        )}

        {/* The Contract Document (A4 Styling) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-6 sm:p-12 text-[#424733] leading-relaxed relative overflow-hidden">
          
          {/* Subtle Background Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
            <img 
              src="https://i.ibb.co/2z275rh/logoapp.png" 
              alt="Watermark" 
              className="w-[500px] h-[500px] object-contain rotate-[-15deg]"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-6 relative z-10 text-xs">
            
            {/* Header Logos */}
            <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-4">
              <img 
                src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
                alt="EBC Logo" 
                className="h-12 object-contain mb-2"
                referrerPolicy="no-referrer"
              />
              <h1 className="text-base font-black uppercase tracking-wider text-center text-[#424733]">
                Contrato de Prestação de Serviços - {contractConfig.serviceTitle}
              </h1>
            </div>

            {/* Contratada Qualification */}
            <div className="text-[11px] space-y-1">
              <p>
                <strong>CONTRATADA:</strong> {contractConfig.contratadaName}, operando sob a marca <strong>{contractConfig.contratadaBrand}</strong>, com sede em {contractConfig.contratadaAddress}.
              </p>
            </div>

            {/* Instructions Box */}
            {contractConfig.activationInstructions && (
              <div className="bg-[#859159]/10 text-[#424733] p-4 rounded-xl border border-[#859159]/20 text-[11px] space-y-1 shadow-xs">
                <p className="font-bold flex items-center gap-1.5 text-[#424733]">
                  <Sparkles size={14} className="text-[#859159]" />
                  Instruções de Ativação do Setup
                </p>
                <p className="whitespace-pre-line leading-relaxed text-slate-600 font-sans">
                  {contractConfig.activationInstructions}
                </p>
              </div>
            )}

            {/* Clauses */}
            <div className="space-y-4 text-justify text-slate-700 leading-relaxed">
              {contractConfig.clause1Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause1Title}</h4>
                  <p>{contractConfig.clause1Body}</p>
                </div>
              )}

              {contractConfig.clause2Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause2Title}</h4>
                  <p>{contractConfig.clause2Body}</p>
                </div>
              )}

              {contractConfig.clause3Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause3Title}</h4>
                  <p className="whitespace-pre-line">{formattedClause3}</p>
                </div>
              )}

              {contractConfig.clause4Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause4Title}</h4>
                  <p>{contractConfig.clause4Body}</p>
                </div>
              )}

              {contractConfig.clause5Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause5Title}</h4>
                  <p>{contractConfig.clause5Body}</p>
                  
                  {(contractConfig.zelleKey || contractConfig.venmoKey || contractConfig.pixKey || contractConfig.paymentLink) && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                      {contractConfig.zelleKey && <p><strong>ZELLE:</strong> {contractConfig.zelleKey}</p>}
                      {contractConfig.venmoKey && <p><strong>VENMO:</strong> {contractConfig.venmoKey}</p>}
                      {contractConfig.pixKey && <p><strong>PIX:</strong> {contractConfig.pixKey}</p>}
                      {contractConfig.paymentLink && <p className="sm:col-span-2 truncate"><strong>LINK:</strong> {contractConfig.paymentLink}</p>}
                    </div>
                  )}
                </div>
              )}

              {contractConfig.clause6Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause6Title}</h4>
                  <p className="whitespace-pre-line">{contractConfig.clause6Body}</p>
                </div>
              )}

              {contractConfig.clause7Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause7Title}</h4>
                  <p className="whitespace-pre-line">{contractConfig.clause7Body}</p>
                </div>
              )}

              {contractConfig.clause8Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause8Title}</h4>
                  <p className="whitespace-pre-line">{contractConfig.clause8Body}</p>
                </div>
              )}

              {contractConfig.clause9Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause9Title}</h4>
                  <p>{contractConfig.clause9Body}</p>
                </div>
              )}

              {contractConfig.clause10Body && (
                <div className="space-y-1">
                  <h4 className="font-bold text-[#424733] uppercase">{contractConfig.clause10Title || "CLÁUSULA 10"}</h4>
                  <p className="whitespace-pre-line">{contractConfig.clause10Body}</p>
                </div>
              )}

              {contractConfig.additionalClauses && contractConfig.additionalClauses.map((extra, idx) => (
                extra.body ? (
                  <div key={extra.id || idx} className="space-y-1">
                    <h4 className="font-bold text-[#424733] uppercase">{extra.title || `CLÁUSULA ${11 + idx}`}</h4>
                    <p className="whitespace-pre-line">{extra.body}</p>
                  </div>
                ) : null
              ))}
            </div>

            {/* Signed Signatures Display if already signed */}
            {signedSuccess && lead.contractData && (
              <div className="pt-8 border-t border-slate-200 mt-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-[10px] text-slate-500">
                  <div>
                    <div className="h-14 flex items-center justify-center font-serif italic text-base text-[#424733]">
                      {contractConfig.contratadaBrand}
                    </div>
                    <div className="border-t border-slate-300 pt-1">
                      <p className="font-bold uppercase text-[#424733]">{contractConfig.contratadaName}</p>
                      <p>CONTRATADA</p>
                    </div>
                  </div>

                  <div>
                    <div className="h-14 flex items-center justify-center">
                      {lead.contractData.signature.startsWith("TYPED:") ? (
                        <span className="font-serif italic text-xl text-[#424733] font-bold">
                          {lead.contractData.signature.replace("TYPED:", "")}
                        </span>
                      ) : (
                        <img 
                          src={lead.contractData.signature} 
                          alt="Assinatura Manuscrita" 
                          className="max-h-12 object-contain mx-auto" 
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <div className="border-t border-slate-300 pt-1">
                      <p className="font-bold uppercase text-[#424733]">{lead.contractData.fullName}</p>
                      <p>CONTRATANTE ({lead.contractData.document})</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Electronic Signature & Qualification Form (Only if not signed) */}
        {!signedSuccess && (
          <form 
            onSubmit={handleSignContract}
            className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-10 space-y-6"
          >
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#424733] flex items-center gap-2">
                <FileSignature size={18} className="text-[#859159]" />
                Qualificação Cadastral & Assinatura Eletrônica
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Preencha seus dados abaixo para formalizar a contratação e assinar digitalmente este instrumento.
              </p>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Nome Completo ou Razão Social *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (!signatureName || signatureName === fullName) {
                      setSignatureName(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="Ex: João da Silva ou Empresa Ltda"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Nome Fantasia (Opcional)</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="Ex: Minha Empresa"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">CPF ou CNPJ *</label>
                <input
                  type="text"
                  required
                  value={document}
                  onChange={handleDocumentChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">WhatsApp / Telefone *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">E-mail de Notificação *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="seuemail@dominio.com"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Data de Nascimento (Se Pessoa Física)</label>
                <input
                  type="text"
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatDateBRInput(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="DD/MM/AAAA"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-600 uppercase text-[10px]">Endereço Completo com CEP *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#859159]/30"
                  placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                />
              </div>
            </div>

            {/* Signature Section with Dual Options (Draw or Type) */}
            <div className="p-5 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-[#424733]">Como você deseja assinar?</h3>
                  <p className="text-[11px] text-slate-500">Escolha desenhar sua rubrica com o dedo/mouse ou digitar seu nome.</p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setSignatureMode("draw")}
                    className={`py-2 px-3.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                      signatureMode === "draw"
                        ? "bg-white text-[#424733] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <PenTool size={13} className={signatureMode === "draw" ? "text-[#859159]" : ""} />
                    <span>Desenhar Assinatura</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSignatureMode("type");
                      if (!signatureName.trim() && fullName.trim()) {
                        setSignatureName(fullName.trim());
                      }
                    }}
                    className={`py-2 px-3.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                      signatureMode === "type"
                        ? "bg-white text-[#424733] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Type size={13} className={signatureMode === "type" ? "text-[#859159]" : ""} />
                    <span>Digitar Nome</span>
                  </button>
                </div>
              </div>

              {/* OPTION 1: DRAW CANVAS */}
              {signatureMode === "draw" && (
                <div className="space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#424733] uppercase text-[10px] flex items-center gap-1.5">
                      <PenTool size={13} className="text-[#859159]" />
                      Desenhe sua assinatura ou rubrica no quadro abaixo *
                    </label>
                    {hasDrawn && (
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition"
                      >
                        <Eraser size={13} />
                        <span>Limpar / Redesenhar</span>
                      </button>
                    )}
                  </div>

                  <div className="relative bg-white border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden hover:border-[#859159] transition shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={180}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-44 touch-none cursor-crosshair bg-white block"
                    />
                    {/* Visual Guide Line */}
                    <div className="absolute bottom-8 left-8 right-8 border-b border-dashed border-slate-200 pointer-events-none flex items-center justify-between text-[9px] text-slate-300 font-mono">
                      <span>✕ Assine sobre esta linha</span>
                      <span>Rubrica Digital</span>
                    </div>

                    {!hasDrawn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300 gap-1.5 bg-slate-50/20">
                        <PenTool size={28} className="opacity-40 text-[#859159]" />
                        <span className="text-xs font-bold text-slate-400">Use o dedo no celular ou o mouse para assinar aqui</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Sua rubrica manuscrita digitalizada será fixada no contrato com carimbo de autenticidade criptográfica e endereço IP.
                  </p>
                </div>
              )}

              {/* OPTION 2: TYPE NAME */}
              {signatureMode === "type" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <label className="font-bold text-[#424733] uppercase text-[10px]">
                      Digite seu nome completo como assinatura eletrônica *
                    </label>
                    <input
                      type="text"
                      required={signatureMode === "type"}
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]"
                      placeholder="DIGITE SEU NOME COMPLETO"
                    />
                  </div>

                  {/* Cursive style preview */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prévia da Assinatura Gerada:</span>
                    <div className="font-serif italic text-2xl text-[#424733] py-2">
                      {signatureName.trim() || fullName.trim() || "Sua Assinatura Cursiva"}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Ao digitar seu nome, você concorda que esta assinatura possui o mesmo efeito jurídico de uma assinatura física manuscrita.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-200/80">
                <input
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#859159] focus:ring-[#859159] cursor-pointer"
                />
                <span className="text-xs text-slate-600 leading-snug">
                  Declaro que li, compreendi e concordo integralmente com todas as cláusulas e condições deste contrato de prestação de serviços.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !agreedToTerms}
              className={`w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 ${
                submitting || !agreedToTerms
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-[#859159] hover:bg-[#4c5432] text-white cursor-pointer"
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando Assinatura Criptográfica...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Assinar Eletronicamente e Concluir
                </>
              )}
            </button>
          </form>
        )}

      </div>
      </div>

    </div>
  );
}
