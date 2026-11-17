import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { StandardMessage } from "../types";
import {
  MessageSquare,
  Search,
  Plus,
  Copy,
  Check,
  Edit3,
  Trash2,
  X,
  Save,
  AlertCircle,
  Loader2
} from "lucide-react";

interface StandardMessagesTabProps {
  isReadOnly: boolean;
}

const normalizeSearch = (text: string) =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function StandardMessagesTab({ isReadOnly }: StandardMessagesTabProps) {
  const [messages, setMessages] = useState<StandardMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Search filter (by title/subject or any word in content)
  const [searchQuery, setSearchQuery] = useState("");

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<StandardMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "standard_messages"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: StandardMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StandardMessage, "id">)
        }));
        setMessages(items);
        setFirestoreError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao carregar mensagens padrão:", err);
        setFirestoreError(
          err?.code === "permission-denied"
            ? "Permissão negada no Firestore para a coleção 'standard_messages'. Atualize as Regras do Firebase no Console."
            : "Não foi possível carregar as mensagens padrão."
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredMessages = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return messages;
    return messages.filter(
      (m) =>
        normalizeSearch(m.title).includes(q) ||
        normalizeSearch(m.content).includes(q)
    );
  }, [messages, searchQuery]);

  const handleCreateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      setSavingNew(true);
      const now = new Date().toISOString();
      await addDoc(collection(db, "standard_messages"), {
        title: newTitle.trim(),
        content: newContent.trim(),
        createdAt: now,
        updatedAt: now
      });
      setNewTitle("");
      setNewContent("");
      setFirestoreError(null);
    } catch (err: any) {
      console.error("Erro ao cadastrar mensagem:", err);
      setFirestoreError(
        err?.code === "permission-denied"
          ? "Permissão negada no Firestore. Atualize as Regras do Firebase para liberar 'standard_messages'."
          : "Erro ao salvar mensagem padrão."
      );
    } finally {
      setSavingNew(false);
    }
  };

  const startEditing = (msg: StandardMessage) => {
    if (isReadOnly) return;
    setEditingId(msg.id);
    setEditTitle(msg.title);
    setEditContent(msg.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (isReadOnly) return;
    if (!editTitle.trim() || !editContent.trim()) return;

    try {
      setSavingEdit(true);
      await updateDoc(doc(db, "standard_messages", id), {
        title: editTitle.trim(),
        content: editContent.trim(),
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      setEditTitle("");
      setEditContent("");
      setFirestoreError(null);
    } catch (err: any) {
      console.error("Erro ao editar mensagem:", err);
      setFirestoreError("Erro ao atualizar a mensagem padrão.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isReadOnly || !deleteTarget) return;
    try {
      setDeleting(true);
      await deleteDoc(doc(db, "standard_messages", deleteTarget.id));
      if (editingId === deleteTarget.id) {
        cancelEditing();
      }
      setDeleteTarget(null);
      setFirestoreError(null);
    } catch (err) {
      console.error("Erro ao excluir mensagem:", err);
      setFirestoreError("Erro ao excluir a mensagem padrão.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyMessage = async (msg: StandardMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === msg.id ? null : prev));
      }, 2500);
    } catch (err) {
      console.error("Erro ao copiar texto:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter / Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#859159]/15 text-[#424733] flex items-center justify-center shrink-0">
            <MessageSquare size={20} className="text-[#859159]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-[#424733]">
              Mensagens Padrão
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Cadastre modelos de mensagens para copiar e enviar rapidamente aos clientes
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-96">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título/assunto ou palavra na mensagem..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]/40 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Firestore Warning if Rules Not Updated Yet */}
      {firestoreError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs font-semibold">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{firestoreError}</span>
        </div>
      )}

      {/* New Standard Message Form (Admin) */}
      {!isReadOnly && (
        <form
          onSubmit={handleCreateMessage}
          className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-[#424733] flex items-center gap-2">
              <Plus size={15} className="text-[#859159]" />
              Cadastrar Nova Mensagem Padrão
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {messages.length} {messages.length === 1 ? "mensagem salva" : "mensagens salvas"}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Título / Assunto da Mensagem
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Boas-vindas e envio do contrato digital"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]/40 focus:bg-white transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
              Texto da Mensagem
            </label>
            <textarea
              required
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Digite aqui a mensagem padrão que você costuma enviar para os clientes..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#859159]/40 focus:bg-white transition resize-y"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingNew || !newTitle.trim() || !newContent.trim()}
              className="bg-[#859159] hover:bg-[#424733] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {savingNew ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              <span>{savingNew ? "Salvando..." : "Salvar Mensagem"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Saved Messages Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <div className="w-7 h-7 border-3 border-[#859159] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider">Carregando mensagens...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-2">
          <MessageSquare size={28} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-600">
            {searchQuery.trim()
              ? "Nenhuma mensagem encontrada para essa busca."
              : "Nenhuma mensagem padrão cadastrada ainda."}
          </p>
          <p className="text-xs text-slate-400">
            {searchQuery.trim()
              ? "Tente buscar por outra palavra do título ou do texto."
              : "Use o formulário acima para cadastrar sua primeira mensagem padrão."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMessages.map((msg) => {
            const isEditing = editingId === msg.id;
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between gap-4 hover:border-[#859159]/40 transition"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Título / Assunto
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]/40"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Mensagem
                      </label>
                      <textarea
                        rows={6}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#859159]/40 resize-y"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={savingEdit}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(msg.id)}
                        disabled={savingEdit || !editTitle.trim() || !editContent.trim()}
                        className="bg-[#859159] hover:bg-[#424733] disabled:opacity-50 text-white text-xs font-black px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{savingEdit ? "Salvando..." : "Salvar"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <h3 className="text-sm font-black text-[#424733] leading-snug">
                          {msg.title}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 max-h-60 overflow-y-auto">
                        {msg.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          isCopied
                            ? "bg-emerald-700 text-white"
                            : "bg-[#424733] hover:bg-[#859159] text-white"
                        }`}
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{isCopied ? "Copiado!" : "Copiar Mensagem"}</span>
                      </button>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditing(msg)}
                            className="p-2 bg-slate-50 hover:bg-[#859159]/10 text-slate-600 hover:text-[#424733] border border-slate-200 rounded-xl transition cursor-pointer"
                            title="Editar mensagem"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(msg)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition cursor-pointer"
                            title="Excluir mensagem"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3.5 text-rose-600">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={22} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 uppercase">Excluir Mensagem?</h3>
                <p className="text-xs text-slate-500 font-semibold">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
              Tem certeza de que deseja excluir a mensagem padrão <strong>"{deleteTarget.title}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{deleting ? "Excluindo..." : "Sim, Excluir"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
