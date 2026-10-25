import React from "react";

export default function Footer() {
  return (
    <footer className="mt-auto bg-white/80 border-t border-slate-200/80 py-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center space-y-3">
        {/* Subtitle */}
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Desenvolvido Por
        </span>

        {/* Brand Logo Link with 100% larger size */}
        <div className="py-2">
          <a
            href="https://easybyzcreator.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block transition-transform hover:scale-105 cursor-pointer"
            title="Visitar Easy Byz Creator"
          >
            <img 
              src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" 
              alt="Easy Byz Creator" 
              className="h-20 sm:h-24 object-contain"
              referrerPolicy="no-referrer"
            />
          </a>
        </div>

        {/* Rights and Cloud Sync */}
        <p className="text-xs font-medium text-slate-400">
          © 2026 EBC/EGN CRM. Todos os direitos reservados. Sincronização em Nuvem Ativa.
        </p>
      </div>
    </footer>
  );
}
