import React, { useState } from "react";
import { UserRole } from "../types";
import { Lock, Shield, Eye, EyeOff, CheckCircle2, UserCheck, KeyRound, ArrowRight } from "lucide-react";

interface AuthLoginProps {
  onLogin: (role: UserRole) => void;
}

export default function AuthLogin({ onLogin }: AuthLoginProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Senhas de acesso definidas para os perfis
  // Administrador (EBC): "1306"
  // EGN (Leitura): "0711"
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const cleanPass = password.trim();

      if (selectedRole === "admin") {
        if (cleanPass === "1306" || cleanPass === "ebcadm2026" || cleanPass === "admin") {
          onLogin("admin");
        } else {
          setError("Senha de Administrador incorreta. Tente novamente.");
          setLoading(false);
        }
      } else if (selectedRole === "viewer") {
        if (cleanPass === "0711" || cleanPass === "egn2026" || cleanPass === "leitura") {
          onLogin("viewer");
        } else {
          setError("Senha de EGN incorreta. Tente novamente.");
          setLoading(false);
        }
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF7] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 space-y-6 relative overflow-hidden">
        
        {/* Top Header Logo */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img 
            src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
            alt="EBC Logo" 
            className="h-12 object-contain mb-1"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-base font-black tracking-tight text-[#424733] uppercase">
            SISTEMA EBC & EGN
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Acesso Restrito • Gestão de Clientes, Contratos & Finanças
          </p>
        </div>

        {/* Profile Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Selecione o Perfil de Acesso
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedRole("admin");
                setError(null);
              }}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                selectedRole === "admin"
                  ? "bg-[#424733] text-white border-[#424733] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <Shield size={16} className={selectedRole === "admin" ? "text-[#859159]" : "text-slate-400"} />
                {selectedRole === "admin" && <CheckCircle2 size={14} className="text-[#859159]" />}
              </div>
              <span className="text-xs font-black uppercase tracking-wider mt-1">Administrador</span>
              <span className={`text-[10px] ${selectedRole === "admin" ? "text-slate-300" : "text-slate-400"}`}>
                Acesso Total (EBC)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole("viewer");
                setError(null);
              }}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                selectedRole === "viewer"
                  ? "bg-[#424733] text-white border-[#424733] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <UserCheck size={16} className={selectedRole === "viewer" ? "text-[#859159]" : "text-slate-400"} />
                {selectedRole === "viewer" && <CheckCircle2 size={14} className="text-[#859159]" />}
              </div>
              <span className="text-xs font-black uppercase tracking-wider mt-1">EGN</span>
              <span className={`text-[10px] ${selectedRole === "viewer" ? "text-slate-300" : "text-slate-400"}`}>
                Acesso EGN (Leitura)
              </span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Senha de Acesso ({selectedRole === "admin" ? "Administrador" : "EGN"})</span>
            </label>

            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={selectedRole === "admin" ? "Digite a senha de admin..." : "Digite a senha EGN..."}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-[#424733] focus:outline-none focus:ring-2 focus:ring-[#859159]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              loading || !password.trim()
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-[#859159] hover:bg-[#4c5432] text-white"
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
