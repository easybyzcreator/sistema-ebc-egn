import { Lead, ContractConfig } from "../types";

export function getDefaultContractConfig(lead: Lead): ContractConfig {
  return {
    contratadaName: "PATRICIA GUIMARÃES",
    contratadaBrand: "EASY BYZ CREATOR",
    contratadaAddress: "Santa Ana, CA - EUA",

    clientName: lead.name || "",
    clientCompany: lead.company || "",
    clientEmail: lead.email || "",
    clientDoc: lead.contractData?.document || "",
    clientBirthDate: "",
    clientPhone: lead.phone || "",
    clientAddress: lead.contractData?.address || "",

    serviceTitle: "Easy Menu EGN",
    frequency: "MENSAL",
    installmentValue: lead.monthlyFee || "",
    firstMonthlyDueDate: lead.firstMonthlyDueDate || "",
    monthlyDueDateOption: lead.monthlyDueDateOption || (lead.firstMonthlyDueDate ? "custom_date" : "signing_date"),
    totalAnnualValue: lead.monthlyFee ? lead.monthlyFee * 12 : "",
    setupFee: lead.configurationFee || "",
    setupInstallments: lead.setupInstallments || 1,
    setupDueDate: lead.setupDueDate || "",
    setupDueDateOption: lead.setupDueDateOption || (lead.setupDueDate ? "custom_date" : "signing_date"),

    zelleKey: "",
    venmoKey: "",
    pixKey: "",
    paymentLink: "",

    activationInstructions: `Para que a Easy Byz Creator inicie a personalização e configuração da infraestrutura do seu sistema, o CONTRATANTE deverá seguir os passos abaixo:

1. Envio de Comprovante e Identidade Visual: Após realizar o pagamento inicial (Setup + 1ª Mensalidade), o cliente deve enviar uma confirmação para o WhatsApp oficial da CONTRATADA (+1 803 888 9018) ou para o e-mail contato@easybyzcreator.com com cópia para contato.easybyzcreator@gmail.com, contendo:

- O comprovante de pagamento;

- O logotipo da empresa (em alta resolução) e a indicação das cores da marca para personalização do layout.

2. Início do Fluxo de Trabalho: O desenvolvimento da interface será iniciado apenas após a confirmação do recebimento do pagamento e dos elementos visuais (logo/cores). A CONTRATADA enviará uma confirmação formal de recebimento.

3. Entrega da Estrutura: A CONTRATADA configurará o Web App com a identidade visual do cliente e entregará o link de acesso ao Painel Administrativo. A partir deste momento, o sistema estará disponível para que o CONTRATANTE realize o cadastro de seus serviços, fotos e preços de forma autônoma.

4. Prazo de Entrega: O prazo para a entrega da estrutura personalizada e ativação do link é de até 10 dias úteis, contados a partir da data de confirmação do recebimento do pagamento e do material visual.

Nota Importante: A ausência do comprovante de pagamento ou do logotipo impede o início da personalização, desobrigando a CONTRATADA do cumprimento do prazo de entrega até que as pendências sejam regularizadas.`,

    clause1Title: "CLÁUSULA 1 – DO OBJETO",
    clause1Body: "O presente contrato tem por objeto a licença de uso da plataforma EASY MENU EGN e a prestação de serviço de configuração personalizada (Setup) pela CONTRATADA em favor do CONTRATANTE.",

    clause2Title: "CLÁUSULA 2 – DO FLUXO DE TRABALHO E PRAZO DE ENTREGA",
    clause2Body: "Para o início da configuração, o CONTRATANTE deverá: a) Efetuar o pagamento da Taxa de Setup e/ou da primeira parcela da assinatura; b) Enviar os dados e materiais necessários para personalização. Prazo: A CONTRATADA entregará o sistema configurado e pronto para uso em até 10 (dez) dias úteis.",

    clause3Title: "CLÁUSULA 3 – DOS VALORES E PLANOS",
    clause3Body: `O CONTRATANTE opta pelo plano selecionado no ato da assinatura. Todos os valores estipulados no presente instrumento são expressos em moeda corrente nacional (Real - R$).

3.1. O CONTRATANTE opta pelo {FREQUENCY} no valor total de {TOTAL_VALUE}, o qual será pago em {INSTALLMENT_TEXT} + Taxa de Setup de {SETUP_VALUE}.

3.2. Do Vencimento da Mensalidade: O dia de vencimento de cada mensalidade corresponderá exatamente ao mesmo dia do mês em que este contrato for formalmente assinado eletronicamente pelo CONTRATANTE.

3.3. A Taxa de Setup destina-se exclusivamente à remuneração do trabalho manual de personalização e inserção de dados no sistema.

3.4. Do Inadimplemento e Atraso no Pagamento: Em caso de não pagamento de qualquer parcela ou taxa até a data de seu respectivo vencimento, incidirão sobre o valor devido:

a) Multa Moratória: Aplicação de multa de 2% sobre o valor da parcela em atraso, cobrada a partir do primeiro dia útil subsequente ao vencimento.

b) Juros de Mora: Incidência de juros moratórios de 1% ao mês (calculados e acumulados pro rata die/diariamente) sobre o valor da parcela devida, a contar da data de vencimento até a efetiva quitação.

3.5. Dos Descontos: A CONTRATANTE poderá conceder, a seu exclusivo critério, desconto pontual sobre o valor da parcela para pagamentos realizados antecipadamente à data de vencimento estipulada.`,

    clause4Title: "CLÁUSULA 4 – POLÍTICA DE CANCELAMENTO E REEMBOLSO",
    clause4Body: "Direito de Arrependimento: Prazo de 7 dias para desistência com reembolso total. Caso o Setup já tenha sido entregue, o valor da taxa de setup não será reembolsado. Pós-7 dias não há reembolso de mensalidades pagas.",

    clause5Title: "CLÁUSULA 5 – DOS PAGAMENTOS VIA PIX / ZELLE / VENMO",
    clause5Body: "O sistema atua como um facilitador visual. A transação financeira via PIX ou outros meios acordados ocorre fora da plataforma (Peer-to-Peer). A CONTRATADA não processa pagamentos e não valida a entrada de valores em conta sem a apresentação do respectivo comprovante.",

    clause6Title: "CLÁUSULA 6 – DAS FUNCIONALIDADES E ESPECIFICAÇÕES DO SISTEMA",
    clause6Body: `A plataforma Easy Menu EGN consiste em uma solução de infraestrutura para cardápio digital interativo, cujas especificações e condições são:

6.1. Estrutura e Metodologia do Sistema:
A plataforma foi desenvolvida com base na metodologia da Escola de Gastronomia e Negócios (EGN), sendo entregue pré-estruturada e pronta para o uso, com arquitetura otimizada para categorias, produtos, fotos, descrições e fluxo de pedidos, dispensando o envio prévio de modelos ou arquivos por parte do CONTRATANTE.

6.2. Responsabilidade pelo Cadastro de Produtos e Dados:
O CONTRATANTE é o único responsável pelo cadastramento, precificação e manutenção dos seus produtos, fotos e informações no painel administrativo, bem como pela correta inserção do seu número de WhatsApp para recebimento dos pedidos. A CONTRATADA não realiza serviços de digitação, alimentação contínua de cardápio ou gestão de dados privados do CONTRATANTE.

6.3. Link Personalizado e Hospedagem:
O CONTRATANTE terá acesso a um link exclusivo e personalizado para o seu estabelecimento. O sistema permanecerá hospedado em infraestrutura em nuvem de alta performance, estando a manutenção e disponibilidade do link estritamente vinculadas à pontualidade no pagamento da mensalidade/assinatura.

6.4. Ferramentas Administrativas para o Usuário:
Autonomia de Gestão: Acesso ao painel administrativo para criar, editar ou desativar itens, alterar preços e atualizar descrições em tempo real.
Gestão de Pedidos: Acesso ao histórico de pedidos recebidos e à base de dados dos clientes que utilizaram o sistema.

6.5. Fluxo de Fechamento de Pedido e Pagamento:
Envio do Pedido: Ao finalizar a escolha dos itens, o sistema consolida o pedido e gera automaticamente uma mensagem estruturada direcionada ao WhatsApp do CONTRATANTE.
Ausência de Gateway de Pagamento Integrado: O sistema não possui integração com intermediadores financeiros ou processamento automático de cartão. Caso o CONTRATANTE deseje receber via PIX ou outros meios, deverá cadastrar autonomamente suas instruções e chave PIX nos campos de texto/mensagem disponíveis no sistema, ficando a conferência do pagamento e envio do comprovante a cargo da negociação direta entre o cliente final e o CONTRATANTE via WhatsApp.`,

    clause7Title: "CLÁUSULA 7 – PRIVACIDADE E DADOS DE TERCEIROS",
    clause7Body: `7.1. A CONTRATADA fornece a infraestrutura tecnológica, mas não acessa, utiliza ou comercializa os dados dos consumidores finais coletados pelo link de vendas.
7.2. O CONTRATANTE é o único controlador e responsável pelo tratamento de dados e pela segurança das informações de seus clientes.`,

    clause8Title: "CLÁUSULA 8 – ISENÇÃO DE RESPONSABILIDADE",
    clause8Body: `8.1. A CONTRATADA não se responsabiliza por:
(i) Falhas de conexão, interrupções no fornecimento de internet ou energia elétrica por parte do CONTRATANTE ou de seus clientes finais;
(ii) Instabilidades, bloqueios, alterações de diretrizes ou falhas técnicas em plataformas de terceiros, incluindo o WhatsApp, serviços de hospedagem e APIs externas;
(iii) Problemas no processamento, envio ou validação de transferências bancárias, PIX ou quaisquer meios de pagamento acordados diretamente entre o CONTRATANTE e seus clientes finais;
(iv) Erros cadastrais, valores incorretos, digitação de preços ou descrições inseridas pelo CONTRATANTE no painel administrativo;
(v) Eventuais perdas financeiras, lucros cessantes ou pedidos não concretizados decorrentes de instabilidades momentâneas do sistema, de redes de telecomunicaciones ou de serviços de terceiros.`,

    clause9Title: "CLÁUSULA 9 – FORO",
    clause9Body: "Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer dúvidas ou controvérsias oriundas deste instrumento.",

    clause10Title: "CLÁUSULA 10 – DISPOSIÇÕES FINAIS",
    clause10Body: "",
    additionalClauses: []
  };
}

export function formatClause3(
  body: string, 
  config: { 
    frequency: string; 
    totalAnnualValue?: number | ""; 
    installmentValue: number | ""; 
    setupFee: number | ""; 
    setupInstallments?: number | "";
    firstMonthlyDueDate?: string;
    setupDueDate?: string;
    setupDueDateOption?: "signing_date" | "custom_date";
  }
): string {
  const isMonthly = config.frequency === "MENSAL";
  const freqText = isMonthly ? "PLANO MENSAL" : "PLANO ANUAL";
  
  const setupNum = config.setupFee !== "" ? Number(config.setupFee) : 0;
  const setupInstNum = config.setupInstallments ? Number(config.setupInstallments) : 1;

  let setupVal = "";
  if (config.setupFee !== "") {
    const formattedSetup = `R$\u00A0${(Math.round(setupNum * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    let setupDueText = "no ato da assinatura";
    if (config.setupDueDate && config.setupDueDate.trim()) {
      const cleanDate = config.setupDueDate.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
        const [y, m, d] = cleanDate.split("-");
        setupDueText = `com vencimento em ${d}/${m}/${y}`;
      }
    }

    if (setupInstNum > 1) {
      const singleInstVal = (Math.round((setupNum / setupInstNum) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (setupDueText.startsWith("com vencimento")) {
        setupVal = `${formattedSetup} (parcelada em ${setupInstNum}x de R$\u00A0${singleInstVal}, 1ª parcela ${setupDueText} e as demais a cada 30 dias)`;
      } else {
        setupVal = `${formattedSetup} (parcelada em ${setupInstNum}x de R$\u00A0${singleInstVal}, 1ª parcela paga no ato da assinatura e as demais a cada 30 dias)`;
      }
    } else {
      if (setupDueText.startsWith("com vencimento")) {
        setupVal = `${formattedSetup} (${setupDueText})`;
      } else {
        setupVal = `${formattedSetup} (paga à vista no ato da assinatura)`;
      }
    }
  } else {
    setupVal = "R$\u00A0[A preencher]";
  }
    
  const instVal = config.installmentValue !== ""
    ? `R$\u00A0${(Math.round(Number(config.installmentValue) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "R$\u00A0[A preencher]";
  
  let totalVal = "";
  let installmentText = "";
  
  if (isMonthly) {
    if (config.installmentValue !== "") {
      const instNum = Number(config.installmentValue);
      const totalMonthWithSetup = (instNum * 12) + setupNum;
      totalVal = `R$\u00A0${(Math.round(totalMonthWithSetup * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ano`;
      installmentText = `12 parcelas mensais de ${instVal} (renovação anual automática)`;
    } else {
      totalVal = "R$\u00A0[A preencher]";
      installmentText = `parcelas mensais de ${instVal} (renovação anual automática)`;
    }
  } else {
    const totalAnnVal = config.totalAnnualValue !== "" && config.totalAnnualValue !== undefined
      ? config.totalAnnualValue 
      : (config.installmentValue !== "" ? Number(config.installmentValue) * 12 : "");
    
    totalVal = totalAnnVal !== ""
      ? `R$\u00A0${(Math.round(Number(totalAnnVal) * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "R$\u00A0[A preencher]";
    installmentText = `parcela única anual de ${totalVal}`;
  }

  // Format firstMonthlyDueDate in DD/MM/AAAA if provided
  let dueDateClauseText = "O dia de vencimento de cada mensalidade corresponderá exatamente ao mesmo dia do mês em que este contrato for formalmente assinado eletronicamente pelo CONTRATANTE.";
  if (config.firstMonthlyDueDate && config.firstMonthlyDueDate.trim()) {
    const cleanDate = config.firstMonthlyDueDate.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      const [y, m, d] = cleanDate.split("-");
      const formattedDateBR = `${d}/${m}/${y}`;
      dueDateClauseText = `O pagamento da primeira mensalidade vencerá no dia ${formattedDateBR}, sendo as parcelas subsequentes devidas no mesmo dia dos meses seguintes.`;
    }
  }

  let fullBody = body || "";
  if (fullBody && !fullBody.includes("3.3.") && (fullBody.includes("3.2.") || fullBody.includes("{SETUP_VALUE}"))) {
    fullBody = `${fullBody}\n\n3.3. Do Inadimplemento e Atraso no Pagamento: Em caso de não pagamento de qualquer parcela ou taxa até a data de seu respectivo vencimento, incidirão sobre o valor devido:\n\na) Multa Moratória: Aplicação de multa de 2% sobre o valor da parcela em atraso, cobrada a partir do primeiro dia útil subsequente ao vencimento.\n\nb) Juros de Mora: Incidência de juros moratórios de 1% ao mês (calculados e acumulados pro rata die/diariamente) sobre o valor da parcela devida, a contar da data de vencimento até a efetiva quitação.\n\n3.4. Dos Descontos: A CONTRATANTE poderá conceder, a seu exclusivo critério, desconto pontual sobre o valor da parcela para pagamentos realizados antecipadamente à data de vencimento estipulada.`;
  }

  // Replace due date text in clause 3.2 if present
  if (config.firstMonthlyDueDate && fullBody.includes("3.2. Do Vencimento da Mensalidade:")) {
    fullBody = fullBody.replace(
      /3\.2\.\s*Do Vencimento da Mensalidade:.*?(?=\n\n3\.3\.|\n\n3\.4\.|\n\nCLÁUSULA|$)/s,
      `3.2. Do Vencimento da Mensalidade: ${dueDateClauseText}`
    );
  }

  return fullBody
    .replace(/{FREQUENCY}/g, freqText)
    .replace(/{TOTAL_VALUE}/g, totalVal)
    .replace(/{INSTALLMENT_TEXT}/g, installmentText)
    .replace(/{SETUP_VALUE}/g, setupVal);
}
