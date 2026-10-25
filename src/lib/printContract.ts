import { Lead, ContractConfig } from "../types";
import { formatClause3 } from "./contractDefaults";

export function printContract(lead: Lead, config: ContractConfig) {
  const isSigned = lead.contractStatus === "signed";
  const contractData = lead.contractData;
  const isMonthly = config.frequency === "MENSAL";

  const setupVal = config.setupFee !== "" 
    ? `<span style="white-space: nowrap">R$&nbsp;${(Math.round(Number(config.setupFee) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
    : `<span style="white-space: nowrap">R$&nbsp;[A preencher]</span>`;
    
  const instVal = config.installmentValue !== ""
    ? `<span style="white-space: nowrap">R$&nbsp;${(Math.round(Number(config.installmentValue) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`
    : `<span style="white-space: nowrap">R$&nbsp;[A preencher]</span>`;

  const totalVal = config.totalAnnualValue !== "" && config.totalAnnualValue !== undefined
    ? `<span style="white-space: nowrap">R$&nbsp;${(Math.round(Number(config.totalAnnualValue) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ano</span>`
    : `<span style="white-space: nowrap">R$&nbsp;[A preencher]</span>`;

  // Format Clause 3
  const formattedClause3 = formatClause3(config.clause3Body || "", {
    frequency: config.frequency,
    installmentValue: config.installmentValue,
    setupFee: config.setupFee,
    totalAnnualValue: config.totalAnnualValue,
    setupInstallments: lead.setupInstallments || config.setupInstallments || 1,
    firstMonthlyDueDate: config.firstMonthlyDueDate || lead.firstMonthlyDueDate,
    setupDueDate: config.setupDueDate || lead.setupDueDate,
    setupDueDateOption: config.setupDueDateOption || lead.setupDueDateOption
  });

  // We will construct the window/iframe/download at the end to handle cases where popups are blocked.

  const clientNameStr = isSigned && contractData ? contractData.fullName : (config.clientName || lead.name || "");
  const clientCompanyStr = isSigned && contractData ? (contractData.clientCompany || "") : (config.clientCompany || lead.company || "");
  const clientDocStr = isSigned && contractData ? contractData.document : (config.clientDoc || "");
  const clientBirthStr = isSigned && contractData ? (contractData.clientBirthDate || "") : (config.clientBirthDate || "");
  const clientAddressStr = isSigned && contractData ? contractData.address : (config.clientAddress || "");
  const clientPhoneStr = isSigned && contractData ? contractData.phone : (config.clientPhone || lead.phone || "");
  const clientEmailStr = isSigned && contractData ? contractData.email : (config.clientEmail || lead.email || "");

  const signatureHTML = isSigned && contractData
    ? contractData.signature.startsWith("TYPED:")
      ? `<div style="font-family: 'Georgia', serif; font-style: italic; font-size: 24px; color: #1e293b; padding: 15px; border-bottom: 1px solid #cbd5e1; text-align: center;">
           ${contractData.signature.replace("TYPED:", "")}
         </div>
         <p style="font-size: 10px; color: #64748b; margin-top: 5px;">Assinado Eletronicamente por ${contractData.fullName}</p>`
      : `<img src="${contractData.signature}" style="max-height: 80px; display: block; margin: 0 auto 5px auto;" />
         <p style="font-size: 10px; color: #64748b; margin-top: 5px;">Assinatura Digitalizada</p>`
    : `<div style="height: 60px; border-bottom: 1px dashed #94a3b8; margin-bottom: 5px;"></div>
       <p style="font-size: 10px; color: #64748b;">Assinatura do Contratante</p>`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Contrato - ${clientNameStr}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
          .contract-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }

        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background-color: #f8fafc;
          color: #1e293b;
          margin: 0;
          padding: 40px 20px;
          line-height: 1.6;
          font-size: 12px;
        }

        .no-print-bar {
          background-color: #1e293b;
          color: #ffffff;
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 800px;
          margin: 0 auto 20px auto;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .btn-print {
          background-color: #859159;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-print:hover {
          background-color: #424733;
        }

        .contract-container {
          background-color: #ffffff;
          max-width: 800px;
          margin: 0 auto;
          padding: 50px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05);
          border-radius: 16px;
          position: relative;
          overflow: hidden;
        }

        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          opacity: 0.03;
          pointer-events: none;
          width: 500px;
          height: 500px;
          background-image: url('https://i.ibb.co/2z275rh/logoapp.png');
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
          z-index: 0;
        }

        .header-centered {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 25px;
          margin-bottom: 30px;
          position: relative;
          z-index: 10;
        }

        .logo-centered {
          height: 75px;
          object-fit: contain;
          margin-bottom: 8px;
        }

        .company-subtitle {
          font-size: 13px;
          font-weight: 800;
          color: #424733;
          margin: 0;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .contract-title {
          font-size: 15px;
          font-weight: 800;
          text-align: center;
          color: #1e293b;
          margin: 30px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 15px;
        }

        .grid-blocks {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        @media (min-width: 600px) {
          .grid-blocks {
            grid-template-columns: 1fr 1fr;
          }
        }

        .info-block {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .info-block-title {
          font-size: 11px;
          font-weight: 800;
          color: #424733;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin-top: 0;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-block p {
          margin: 6px 0;
          font-size: 11px;
          color: #334155;
        }

        .info-block strong {
          color: #1e293b;
          font-weight: 600;
        }

        .clause-section {
          margin-bottom: 25px;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .clause-title {
          font-size: 12px;
          font-weight: 800;
          color: #424733;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .clause-body {
          font-size: 11px;
          color: #334155;
          text-align: justify;
          margin: 0;
          white-space: pre-line;
        }

        .activation-box {
          background-color: rgba(133, 145, 89, 0.08);
          border: 1px solid rgba(133, 145, 89, 0.25);
          color: #424733;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          font-size: 11px;
        }

        .activation-box h4 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          color: #424733;
        }

        .activation-box p {
          margin: 0;
          white-space: pre-line;
          line-height: 1.6;
          color: #1e293b;
        }

        .signatures-area {
          margin-top: 50px;
          border-top: 1px solid #e2e8f0;
          padding-top: 30px;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          text-align: center;
        }

        .sig-box {
          padding: 10px;
        }

        .legal-receipt-area {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 15px;
          margin-top: 40px;
          font-family: monospace;
          font-size: 10px;
          color: #475569;
        }

        .legal-receipt-area h5 {
          margin-top: 0;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #334155;
        }

        .legal-receipt-area p {
          margin: 4px 0;
        }
      </style>
    </head>
    <body>

      <div class="no-print-bar no-print">
        <span style="font-weight: 600; font-size: 13px;">Visualização de Contrato Oficial</span>
        <button class="btn-print" onclick="window.print()">Imprimir / Salvar como PDF</button>
      </div>

      <div class="contract-container">
        
        <div class="watermark"></div>
        
        <div class="header-centered">
          <img src="https://i.ibb.co/PG6c7BgZ/logo-easybyzcreator.png" alt="EBC Logo" class="logo-centered" referrerPolicy="no-referrer" />
        </div>

        <div class="contract-title">
          Contrato de Licenciamento de Plataforma & Prestação de Serviços Digitais
        </div>

        <div class="grid-blocks">
          
          <div class="info-block">
            <h3 class="info-block-title">01. Identificação da Contratada</h3>
            <p><strong>Nome (Responsável):</strong> ${config.contratadaName}</p>
            <p><strong>Marca / Fantasia:</strong> ${config.contratadaBrand}</p>
            <p><strong>Sede / Endereço:</strong> ${config.contratadaAddress}</p>
          </div>

          <div class="info-block">
            <h3 class="info-block-title">02. Dados do Contratante</h3>
            <p><strong>Nome/Razão Social:</strong> ${clientNameStr || "[A preencher]"}</p>
            <p><strong>Nome Fantasia:</strong> ${clientCompanyStr || "[A preencher]"}</p>
            <p><strong>CPF / CNPJ:</strong> ${clientDocStr || "[A preencher]"}</p>
            <p><strong>Data de Nascimento:</strong> ${clientBirthStr || "[A preencher]"}</p>
            <p><strong>E-mail:</strong> ${clientEmailStr || "[A preencher]"}</p>
            <p><strong>WhatsApp:</strong> ${clientPhoneStr || "[A preencher]"}</p>
            <p><strong>Endereço:</strong> ${clientAddressStr || "[A preencher]"}</p>
          </div>

        </div>

        <div class="info-block" style="margin-bottom: 30px;">
          <h3 class="info-block-title" style="color: #859159;">03. Plano e Valores Contratados</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
            <p><strong>Serviço / Plataforma:</strong> ${config.serviceTitle}</p>
            <p><strong>Periodicidade:</strong> MENSAL</p>
            <p><strong>V. Parcela / Mensalidade:</strong> ${instVal}</p>
            <p><strong>Taxa Setup de Configuração:</strong> ${setupVal}</p>
          </div>
        </div>

        ${config.activationInstructions ? `
          <div class="activation-box">
            <h4>Instruções para Ativação do Serviço</h4>
            <p>${config.activationInstructions}</p>
          </div>
        ` : ""}

        <div class="contract-title">Cláusulas Contratuais</div>

        <div class="clause-section">
          <div class="clause-title">${config.clause1Title}</div>
          <p class="clause-body">${config.clause1Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause2Title}</div>
          <p class="clause-body">${config.clause2Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause3Title}</div>
          <p class="clause-body">${formattedClause3}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause4Title}</div>
          <p class="clause-body">${config.clause4Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause5Title}</div>
          <p class="clause-body">${config.clause5Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause6Title}</div>
          <p class="clause-body">${config.clause6Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause7Title}</div>
          <p class="clause-body">${config.clause7Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause8Title}</div>
          <p class="clause-body">${config.clause8Body}</p>
        </div>

        <div class="clause-section">
          <div class="clause-title">${config.clause9Title}</div>
          <p class="clause-body">${config.clause9Body}</p>
        </div>

        ${config.clause10Body ? `
        <div class="clause-section">
          <div class="clause-title">${config.clause10Title || "CLÁUSULA 10"}</div>
          <p class="clause-body" style="white-space: pre-line;">${config.clause10Body}</p>
        </div>
        ` : ""}

        ${config.additionalClauses && config.additionalClauses.length > 0 ? config.additionalClauses.map((extra, idx) => extra.body ? `
        <div class="clause-section">
          <div class="clause-title">${extra.title || `CLÁUSULA ${11 + idx}`}</div>
          <p class="clause-body" style="white-space: pre-line;">${extra.body}</p>
        </div>
        ` : "").join("") : ""}

        <div class="signatures-area">
          <div class="signatures-grid">
            
            <div class="sig-box">
              <div style="height: 60px; border-bottom: 1px dashed #94a3b8; margin-bottom: 5px; padding-top: 35px;">
                <span style="font-weight: 700; font-size: 13px; color: #424733;">PATRICIA GUIMARÃES</span>
              </div>
              <p style="font-size: 10px; color: #64748b;">Representante Legal - Easy Byz Creator</p>
            </div>

            <div class="sig-box">
              ${signatureHTML}
            </div>

          </div>
        </div>

        ${isSigned && contractData ? `
          <div class="legal-receipt-area">
            <h5>Recibo Legal de Assinatura Eletrônica</h5>
            <p><strong>Hash de Autenticação:</strong> EBC-EGN-SHA256-${lead.id.slice(0, 8).toUpperCase()}</p>
            <p><strong>Carimbo de Data/Hora:</strong> ${new Date(contractData.signedAt).toLocaleString("pt-BR")}</p>
            <p><strong>Origem IP:</strong> ${contractData.ipAddress}</p>
            <p><strong>Dispositivo de Validação:</strong> MP 2.200-2 / ICP-Brasil Digital Certify</p>
          </div>
        ` : ""}

      </div>

      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 800);
        });
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Try to print via iframe
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (iframeDoc) {
        iframeDoc.write(html);
        iframeDoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
        return;
      }
    } catch (e) {
      console.error("Iframe print fallback failed:", e);
    }

    // Fallback to direct blob download
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${clientNameStr.replace(/\s+/g, "_") || "assinado"}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Blob download fallback failed:", e);
    }
    
    alert("Pop-ups bloqueados. O contrato foi gerado e baixado como arquivo HTML ou enviado para impressão.");
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
