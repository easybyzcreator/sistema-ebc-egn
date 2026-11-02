import React from "react";

export default function HeaderBanner() {
  return (
    <div className="bg-gradient-to-br from-[#424733] to-[#515740] rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-[#859159]/20 mb-8">
      {/* Ambient EGN Watermark */}
      <div className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none select-none hidden lg:block">
        <img 
          src="https://raw.githubusercontent.com/easybyzcreator/imagens/4be0417568b59c5b83bee41cd24a6107c0b6d20e/pwa%20egn.png" 
          alt="Watermark" 
          className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-2xl">
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

        {/* EGN School Logo on the Right */}
        <div className="flex items-center justify-center md:justify-end shrink-0">
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-white/20 shadow-xl transition-all duration-300 hover:scale-105">
            <img 
              src="https://raw.githubusercontent.com/easybyzcreator/imagens/4be0417568b59c5b83bee41cd24a6107c0b6d20e/pwa%20egn.png" 
              alt="Escola de Gastronomia e Negócios (EGN)" 
              className="h-24 w-24 sm:h-28 sm:w-28 object-contain drop-shadow"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

