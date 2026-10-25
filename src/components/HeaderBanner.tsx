import React from "react";

export default function HeaderBanner() {
  return (
    <div className="bg-gradient-to-br from-[#424733] to-[#515740] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-[#859159]/20 mb-8">
      {/* Authentic EGN Watermark on the Right */}
      <div className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-15 pointer-events-none select-none">
        <img 
          src="https://i.ibb.co/2z275rh/logoapp.png" 
          alt="Watermark" 
          className="w-72 h-72 sm:w-80 sm:h-80 object-contain brightness-0 invert"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 max-w-2xl">
        <span className="bg-[#859159] text-white text-[11px] uppercase tracking-wider font-bold py-1 px-3 rounded-full">
          Painel Geral da Parceria
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
          EBC & EGN Management
        </h2>
        <p className="text-slate-200/90 text-sm mt-2 leading-relaxed">
          Gestão integrada de clientes e contatos da Escola de Gastronomia e Negócios (EGN) com ativação técnica, assinaturas digitais de contratos e comissionamentos da Easy Byz Creator (EBC).
        </p>
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Sincronização em tempo real ativa
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-white/5">
            <span className="text-[#A38C66] font-bold">10%</span>
            Comissão fixa EGN configurada
          </div>
        </div>
      </div>
    </div>
  );
}

