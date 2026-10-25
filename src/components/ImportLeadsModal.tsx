import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Lead } from "../types";
import { Upload, HelpCircle, Check, AlertCircle, RefreshCw, X, Table, FileSpreadsheet } from "lucide-react";

interface ImportLeadsModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
  isReadOnly: boolean;
}

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  company: string;
}

export default function ImportLeadsModal({ onClose, onImportSuccess, isReadOnly }: ImportLeadsModalProps) {
  const [pasteContent, setPasteContent] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Helper to parse CSV or TSV (Excel copy-paste)
  const parseData = (rawText: string) => {
    if (!rawText.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      // Split into lines
      const lines = rawText.split(/\r?\n/);
      const tempRows: ParsedRow[] = [];

      lines.forEach((line) => {
        if (!line.trim()) return;

        // Try to split by Tab (Excel copy) or Comma / Semicolon (CSV)
        let parts: string[] = [];
        if (line.includes("\t")) {
          parts = line.split("\t");
        } else if (line.includes(";")) {
          parts = line.split(";");
        } else {
          parts = line.split(",");
        }

        // Map column details dynamically or look for basic formats
        // Let's assume standard order or guess based on email/phone pattern:
        // Order: Name, Email, Phone, Company
        let name = parts[0]?.trim() || "";
        let email = parts[1]?.trim() || "";
        let phone = parts[2]?.trim() || "";
        let company = parts[3]?.trim() || "";

        // If email doesn't look like an email but another column does, swap them
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const allParts = parts.map(p => p.trim());
        
        const foundEmailIndex = allParts.findIndex(p => emailRegex.test(p));
        if (foundEmailIndex !== -1 && foundEmailIndex !== 1) {
          // Re-arrange dynamically
          email = allParts[foundEmailIndex];
          // Simple heuristc: name is first index that is not email
          const nameIdx = allParts.findIndex((p, idx) => idx !== foundEmailIndex && p.length > 2 && !/\d/.test(p));
          if (nameIdx !== -1) name = allParts[nameIdx];
        }

        if (name && name.toLowerCase() !== "nome" && name.toLowerCase() !== "name") {
          tempRows.push({
            name: name.slice(0, 100),
            email: email.slice(0, 100),
            phone: phone.slice(0, 40),
            company: company.slice(0, 100)
          });
        }
      });

      setParsedRows(tempRows);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Erro ao processar as colunas. Verifique a formatação.");
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPasteContent(val);
    parseData(val);
  };

  // Drag and Drop File Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setPasteContent(text);
        parseData(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setPasteContent(text);
        parseData(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImportSubmit = async () => {
    if (isReadOnly) {
      alert("Apenas administradores podem fazer alterações.");
      return;
    }

    if (parsedRows.length === 0) return;

    try {
      setLoading(true);
      let count = 0;

      for (const row of parsedRows) {
        const newLead: Omit<Lead, "id"> = {
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          status: "lead",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: [
            {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date().toISOString(),
              text: "Lead importado via planilha/Excel.",
              type: "note"
            }
          ]
        };

        await addDoc(collection(db, "leads"), newLead);
        count++;
      }

      setSuccessCount(count);
      setLoading(false);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error importing leads:", err);
      setError("Erro ao salvar contatos no Firebase Firestore.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#424733] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-[#859159]" />
            <div>
              <h3 className="font-bold text-base tracking-tight">Importar Contatos de Planilha</h3>
              <p className="text-[11px] text-slate-300">Suporta arquivos Excel, CSV e colunas coladas</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {isReadOnly && (
            <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-lg flex items-center gap-2 border border-red-200">
              <AlertCircle size={16} />
              Acesso de Visualizador: Você não tem permissões para realizar importações.
            </div>
          )}

          {successCount !== null ? (
            <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl text-center space-y-2 border border-emerald-200">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
                <Check size={24} />
              </div>
              <h4 className="font-bold text-base">Importação Concluída!</h4>
              <p className="text-xs">{successCount} contatos novos foram adicionados com sucesso.</p>
            </div>
          ) : (
            <>
              {/* Method 1: Paste directly */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Método 1: Copiar e colar do Excel (Mais prático)</span>
                  <span className="text-[10px] text-[#859159] lowercase flex items-center gap-1 font-normal">
                    <HelpCircle size={11} />
                    Selecione as colunas no Excel, copie (Ctrl+C) e cole abaixo
                  </span>
                </label>
                <textarea
                  disabled={isReadOnly}
                  value={pasteContent}
                  onChange={handleTextareaChange}
                  rows={4}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#859159]/40 focus:border-[#859159] transition resize-none placeholder-slate-400 disabled:bg-slate-100"
                  placeholder="Nome&#9;E-mail&#9;Telefone&#9;Empresa&#10;João Silva&#9;joao@email.com&#9;(11) 99999-9999&#9;Restaurante Gourmet&#10;Maria Santos&#9;maria@email.com&#9;(11) 88888-8888&#9;Cantina Italiana"
                />
              </div>

              {/* Method 2: Drag & Drop File */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Método 2: Upload de arquivo (.csv ou .txt)
                </label>
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
                    dragActive ? "border-[#859159] bg-[#859159]/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100/50"
                  }`}
                >
                  <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                  <p className="text-xs font-semibold text-slate-600 mb-1">Arraste e solte seu arquivo de contatos aqui</p>
                  <p className="text-[10px] text-slate-400 mb-3">Formatos aceitos: CSV delimitado por vírgula, ponto-e-vírgula ou tabulações</p>
                  
                  <label className="inline-block bg-white hover:bg-slate-50 text-[#424733] border border-slate-200 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm cursor-pointer transition">
                    Procurar Arquivo
                    <input
                      disabled={isReadOnly}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Preview Box */}
              {parsedRows.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Table size={14} className="text-[#859159]" />
                    Visualização Prévia ({parsedRows.length} contatos detectados)
                  </span>
                  
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0 z-10">
                          <th className="p-2.5">Nome</th>
                          <th className="p-2.5">E-mail</th>
                          <th className="p-2.5">Telefone</th>
                          <th className="p-2.5">Empresa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold text-[#424733]">{row.name}</td>
                            <td className="p-2.5">{row.email || <span className="text-slate-300 italic">Vazio</span>}</td>
                            <td className="p-2.5">{row.phone || <span className="text-slate-300 italic">Vazio</span>}</td>
                            <td className="p-2.5">{row.company || <span className="text-slate-300 italic">Vazio</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-200">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {successCount === null && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              disabled={parsedRows.length === 0 || loading || isReadOnly}
              onClick={handleImportSubmit}
              className="bg-[#859159] hover:bg-[#424733] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold py-2 px-5 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Confirmar e Importar {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
