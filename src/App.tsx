import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { Lead, UserRole } from "./types";
import AuthLogin from "./components/AuthLogin";
import HeaderBanner from "./components/HeaderBanner";
import Footer from "./components/Footer";
import UnifiedClientsTab from "./components/UnifiedClientsTab";
import ClientFinanceTab from "./components/ClientFinanceTab";
import ClientContractPortal from "./components/ClientContractPortal";
import LeadModal from "./components/LeadModal";
import { 
  Users, 
  DollarSign, 
  Shield, 
  UserCheck, 
  LogOut, 
  Lock, 
  Building2 
} from "lucide-react";

export default function App() {
  // Check if URL has ?contract=slug query, ?contrato=slug or /contrato/:slug path (direct client contract signing portal)
  const getContractSlugFromUrl = (): string | null => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const qContract = urlParams.get("contract") || urlParams.get("c") || urlParams.get("contrato");
      if (qContract) return qContract.trim();

      const path = window.location.pathname;
      if (path.startsWith("/contrato/")) {
        const seg = path.replace("/contrato/", "").split("/")[0].split("?")[0];
        if (seg) return decodeURIComponent(seg).trim();
      }
      if (path.startsWith("/contract/")) {
        const seg = path.replace("/contract/", "").split("/")[0].split("?")[0];
        if (seg) return decodeURIComponent(seg).trim();
      }

      if (window.location.hash) {
        const hash = window.location.hash.replace(/^#\/?/, "");
        if (hash.startsWith("contrato/")) {
          return decodeURIComponent(hash.replace("contrato/", "").split("?")[0]).trim();
        }
        if (hash.startsWith("contract=")) {
          return decodeURIComponent(hash.replace("contract=", "").split("&")[0]).trim();
        }
      }
    } catch (e) {
      console.warn("Error parsing contract URL:", e);
    }
    return null;
  };

  const contractSlugParam = getContractSlugFromUrl();

  if (contractSlugParam) {
    return <ClientContractPortal slug={contractSlugParam} />;
  }

  // Authentication State
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem("ebc_egn_auth_role");
    if (saved === "admin" || saved === "viewer") return saved as UserRole;
    return null;
  });

  // App Main State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"clients" | "finances">("clients");

  // Client Modal State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isReadOnly = currentUserRole === "viewer";

  // Login handler
  const handleLogin = (role: UserRole) => {
    localStorage.setItem("ebc_egn_auth_role", role);
    setCurrentUserRole(role);
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("ebc_egn_auth_role");
    setCurrentUserRole(null);
  };

  // Real-time Firestore synchronization with stable sorting to prevent UI jumping
  useEffect(() => {
    const q = query(collection(db, "leads"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Lead[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Lead);
        });
        // Ordenação estável por nome para manter a posição fixa dos clientes e evitar oscilações na tela
        items.sort((a, b) => 
          (a.name || a.company || "").localeCompare(b.name || b.company || "", "pt-BR", { sensitivity: "base" })
        );
        setLeads(items);
        setLoading(false);
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Show Auth Screen if not logged in
  if (!currentUserRole) {
    return <AuthLogin onLogin={handleLogin} />;
  }

  const handleOpenNewClientModal = () => {
    setSelectedLead({
      id: "",
      name: "",
      email: "",
      phone: "",
      company: "",
      status: "client",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    });
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Lead) => {
    setSelectedLead(client);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-[#424733] flex flex-col font-sans">
      
      {/* Clean Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
                alt="EBC & EGN" 
                className="h-9 sm:h-10 object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:block">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block leading-none">
                  Gestão Integrada
                </span>
                <span className="text-sm font-black tracking-tight text-[#424733] uppercase">
                  EBC & EGN
                </span>
              </div>
            </div>

            {/* Main Tabs Navigation (Clean: 2 Tabs only) */}
            <nav className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("clients")}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  activeTab === "clients"
                    ? "bg-[#424733] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#424733] hover:bg-slate-200/60"
                }`}
              >
                <Users size={15} />
                <span>Clientes & Contratos</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === "clients" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {leads.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("finances")}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                  activeTab === "finances"
                    ? "bg-[#424733] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#424733] hover:bg-slate-200/60"
                }`}
              >
                <DollarSign size={15} />
                <span>Finanças & Repasses</span>
              </button>
            </nav>

            {/* Profile Info & Logout */}
            <div className="flex items-center gap-2.5">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                {currentUserRole === "admin" ? (
                  <>
                    <Shield size={14} className="text-[#859159]" />
                    <span className="font-extrabold text-[#424733] uppercase text-[10px]">
                      Admin (EBC)
                    </span>
                  </>
                ) : (
                  <>
                    <UserCheck size={14} className="text-amber-600" />
                    <span className="font-extrabold text-amber-700 uppercase text-[10px]">
                      EGN (Leitura)
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition cursor-pointer"
                title="Sair / Trocar Perfil"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        {/* Global Header Banner on all pages */}
        <HeaderBanner />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-[#859159] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold uppercase tracking-wider">Carregando dados...</p>
          </div>
        ) : (
          <>
            {activeTab === "clients" && (
              <UnifiedClientsTab
                leads={leads}
                isReadOnly={isReadOnly}
                onOpenNewClientModal={handleOpenNewClientModal}
                onEditClient={handleEditClient}
              />
            )}

            {activeTab === "finances" && (
              <ClientFinanceTab
                leads={leads}
                isReadOnly={isReadOnly}
              />
            )}
          </>
        )}
      </main>

      {/* Global Footer on all pages */}
      <Footer />

      {/* Client Create/Edit Modal */}
      {isModalOpen && selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLead(null);
          }}
          isReadOnly={isReadOnly}
        />
      )}

    </div>
  );
}
