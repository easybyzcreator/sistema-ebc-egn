// Mask and Commission Calculation Utilities for EBC & EGN

export const ASAAS_BOLETO_FEE = 1.99;
export const ASAAS_NOTIFICATION_FEE = 0.99;
export const ASAAS_TOTAL_TRANSACTION_FEE = ASAAS_BOLETO_FEE + ASAAS_NOTIFICATION_FEE; // R$ 2,98 por recebimento

/**
 * Formats a raw document string into CPF (000.000.000-00) or CNPJ (00.000.000/0000-00)
 */
export function formatCpfCnpj(value: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    digits = digits.slice(0, 11);
    digits = digits.replace(/(\d{3})(\d)/, "$1.$2");
    digits = digits.replace(/(\d{3})(\d)/, "$1.$2");
    digits = digits.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return digits;
  } else {
    // CNPJ: 00.000.000/0000-00
    digits = digits.slice(0, 14);
    digits = digits.replace(/^(\d{2})(\d)/, "$1.$2");
    digits = digits.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    digits = digits.replace(/\.(\d{3})(\d)/, ".$1/$2");
    digits = digits.replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    return digits;
  }
}

/**
 * Formats a date string into DD/MM/AAAA
 */
export function formatDateBRInput(value: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length >= 5) {
    return digits.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
  } else if (digits.length >= 3) {
    return digits.replace(/(\d{2})(\d{1,2})/, "$1/$2");
  }
  return digits;
}

/**
 * Formats a phone string into (00) 00000-0000 or (00) 0000-0000
 */
export function formatPhoneBR(value: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length > 10) {
    // (00) 00000-0000
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (digits.length > 6) {
    // (00) 0000-0000
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (digits.length > 2) {
    return digits.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  }
  return digits;
}

/**
 * Calculates EGN 10% commission on a single payment amount
 * Exato 10% do valor efetivamente pago pelo cliente (conforme cláusula contratual de intermediação comercial)
 */
export function calcEgnCommissionSingle(amount: number): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  return Math.round(amount * 0.10 * 100) / 100;
}

/**
 * Calculates EGN 10% commission for setup fee with installments (10% de cada parcela)
 */
export function calcEgnCommissionSetup(totalSetup: number, installments: number = 1) {
  const count = Math.max(1, installments || 1);
  if (!totalSetup || isNaN(totalSetup) || totalSetup <= 0) {
    return {
      installments: count,
      installmentAmount: 0,
      commissionPerInstallment: 0,
      totalCommission: 0,
    };
  }

  const instAmount = totalSetup / count;
  const commPerInst = calcEgnCommissionSingle(instAmount);
  const totalComm = Math.round(commPerInst * count * 100) / 100;

  return {
    installments: count,
    installmentAmount: instAmount,
    commissionPerInstallment: commPerInst,
    totalCommission: totalComm,
  };
}
