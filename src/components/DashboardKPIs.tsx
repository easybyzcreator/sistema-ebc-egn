import React from "react";
import { Lead } from "../types";
import { Users, UserCheck, DollarSign, Award, TrendingUp, Percent, ArrowUpRight } from "lucide-react";
import { calcEgnCommissionSingle } from "../lib/masks";

interface DashboardKPIsProps {
  leads: Lead[];
}

export default function DashboardKPIs({ leads }: DashboardKPIsProps) {
  // Apenas clientes ativos (isActive !== false) entram nas métricas e cálculos financeiros
  const activeLeads = leads.filter(l => l.isActive !== false);
  const totalLeadsCount = activeLeads.length;
  const clientsCount = activeLeads.filter(l => l.status === "client").length;
  const leadCount = totalLeadsCount - clientsCount;
  
  const conversionRate = totalLeadsCount > 0 
    ? Math.round((clientsCount / totalLeadsCount) * 100) 
    : 0;

  // Helper to check if a date string falls in the current batch cycle (25th prev month to 24th curr month)
  const isDateInCurrentBatchPeriod = (dateStr?: string): boolean => {
    if (!dateStr) return true;
    const cleanDate = dateStr.split("T")[0];
    const d = new Date(cleanDate);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let startYear = currentYear;
    let startMonth = currentMonth;
    let endYear = currentYear;
    let endMonth = currentMonth;

    if (currentDay > 24) {
      startMonth = currentMonth;
      endMonth = currentMonth + 1;
      if (endMonth > 11) {
        endMonth = 0;
        endYear += 1;
      }
    } else {
      startMonth = currentMonth - 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
      endMonth = currentMonth;
    }

    const cycleStart = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
    const cycleEnd = new Date(endYear, endMonth, 24, 23, 59, 59, 999);

    return d >= cycleStart && d <= cycleEnd;
  };

  // Financial calculations from payments marked as "paid"
  let totalSetupCollected = 0; // Total arrecadado em Taxas de Configuração / Setup
  let totalSetupExpected = 0;  // Total previsto em Taxas de Configuração / Setup
  let totalMonthlyCollected = 0; // Total arrecadado em Mensalidades
  let totalCollected = 0; // Total EFETIVAMENTE recebido via Asaas (Setup + Mensalidades)
  let currentPeriodCollected = 0; // Recebido no Asaas no ciclo atual (até o dia 24)
  let expectedMRR = 0; // MRR Estimado (Recorrente mensal dos contratos ativos)
  let egnCommissionCurrentPeriod = 0; // 10% sobre o recebido no ciclo
  let egnCommissionEstimated = 0; // 10% estimado sobre MRR ativo
  let egnCommissionPending = 0; // 10% pendente de repasse para EGN (saldo aberto)
  let egnCommissionPaid = 0; // 10% já repassado à EGN

  activeLeads.forEach(l => {
    if (l.status === "client") {
      const mFee = l.monthlyFee || 0;
      const sFee = l.configurationFee || 0;
      expectedMRR += mFee;
      totalSetupExpected += sFee;
      if (mFee > 0) {
        egnCommissionEstimated += calcEgnCommissionSingle(mFee);
      }
      
      const clientPayments: { type?: string; amount: number; status: string; paidDate?: string; dueDate?: string; commissionPaidToEgn?: boolean }[] = [];
      const instCount = Number(l.setupInstallments || (sFee > 0 ? 3 : 1));
      const instVal = instCount > 0 ? Math.round((sFee / instCount) * 100) / 100 : sFee;

      if (l.payments && l.payments.length > 0) {
        const validPayments = l.payments.filter(p => {
          const pDate = p.paidDate || p.dueDate || "";
          const isOld = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
          if (isOld) return false;
          return Number(p.amount || 0) > 0;
        });
        clientPayments.push(...validPayments);
      } else {
        const isSetupPaid = l.setupPaymentStatus === "paid" || l.configurationFeePaid === true;
        const isMonthlyPaid = l.monthlyPaymentStatus === "paid";
        if (sFee > 0) {
          clientPayments.push({
            type: "configuration",
            amount: sFee,
            status: isSetupPaid ? "paid" : "pending",
            dueDate: l.createdAt ? l.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
            paidDate: isSetupPaid ? (l.updatedAt ? l.updatedAt.split("T")[0] : undefined) : undefined
          });
        }
        if (mFee > 0) {
          clientPayments.push({
            type: "monthly",
            amount: mFee,
            status: isMonthlyPaid ? "paid" : "pending",
            dueDate: new Date().toISOString().split("T")[0],
            paidDate: isMonthlyPaid ? (l.updatedAt ? l.updatedAt.split("T")[0] : undefined) : undefined
          });
        }
      }

      clientPayments.forEach(p => {
        if (p.status === "paid") {
          totalCollected += p.amount;
          if (p.type === "configuration") {
            totalSetupCollected += p.amount;
          } else {
            totalMonthlyCollected += p.amount;
          }
          const comm = (p as any).egnCommissionAmount !== undefined && (p as any).egnCommissionAmount !== null
            ? Number((p as any).egnCommissionAmount)
            : calcEgnCommissionSingle(p.amount);
          if (p.commissionPaidToEgn === true) {
            egnCommissionPaid += comm;
          } else {
            egnCommissionPending += comm;
          }
          const payDate = p.paidDate || p.dueDate;
          if (isDateInCurrentBatchPeriod(payDate)) {
            currentPeriodCollected += p.amount;
            egnCommissionCurrentPeriod += comm;
          }
        }
      });
    }
  });

  egnCommissionCurrentPeriod = Math.round(egnCommissionCurrentPeriod * 100) / 100;
  egnCommissionEstimated = Math.round(egnCommissionEstimated * 100) / 100;
  egnCommissionPending = Math.round(egnCommissionPending * 100) / 100;
  egnCommissionPaid = Math.round(egnCommissionPaid * 100) / 100;

  const formatMoney = (val: number) => {
    const rounded = Math.round((val || 0) * 100) / 100;
    return rounded.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Last 5 registered leads
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Leads */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Contatos</p>
              <h3 className="text-2xl font-black mt-2 text-[#424733]">{totalLeadsCount}</h3>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">{leadCount}</span> contatos inativos
          </div>
        </div>

        {/* Total Clients */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clientes Ativos</p>
              <h3 className="text-2xl font-black mt-2 text-[#859159]">{clientsCount}</h3>
            </div>
            <div className="w-10 h-10 bg-[#859159]/10 rounded-lg flex items-center justify-center text-[#859159]">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            Taxa de Ativação: <span className="font-bold text-[#859159]">{conversionRate}%</span>
          </div>
        </div>

        {/* Total Collected (Confirmed strictly via Asaas) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recebido (Geral Asaas)</p>
              <h3 className="text-2xl font-black mt-2 text-[#424733]">
                R$ {formatMoney(totalCollected)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#A38C66]/10 rounded-lg flex items-center justify-center text-[#A38C66]">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="px-2 py-0.5 rounded bg-[#859159]/15 text-[#4c5432]">
              Setup: R$ {formatMoney(totalSetupCollected)}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              Mensalidades: R$ {formatMoney(totalMonthlyCollected)}
            </span>
          </div>
        </div>

        {/* Taxas de Setup / Configuração */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxas de Setup / Configuração</p>
              <h3 className="text-2xl font-black mt-2 text-[#859159]">
                R$ {formatMoney(totalSetupCollected)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#859159]/10 rounded-lg flex items-center justify-center text-[#859159]">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Total Contratado:</span>
            <span className="font-bold text-[#424733]">R$ {formatMoney(totalSetupExpected)}</span>
          </div>
        </div>

        {/* Faturamento Estimado / MRR Esperado */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Faturamento Estimado (MRR)</p>
              <h3 className="text-2xl font-black mt-2 text-[#859159]">
                R$ {formatMoney(expectedMRR)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#859159]/10 rounded-lg flex items-center justify-center text-[#859159]">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            Recorrência mensal prevista dos contratos ativos
          </div>
        </div>

        {/* Repasse EGN 10% - Pendente de Repasse */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendente Repasse EGN (10%)</p>
              <h3 className={`text-2xl font-black mt-2 ${egnCommissionPending > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                R$ {formatMoney(egnCommissionPending)}
              </h3>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${egnCommissionPending > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              <Award size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium">
            {egnCommissionPending > 0 ? (
              <span className="text-rose-700 font-bold">10% pendente de quitação para EGN</span>
            ) : (
              <span className="text-emerald-700 font-bold">Saldo zerado • Repasses em dia</span>
            )}
          </div>
        </div>

        {/* Estimativa de Comissão EGN */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimativa Mensal EGN (MRR)</p>
              <h3 className="text-2xl font-black mt-2 text-[#A38C66]">
                R$ {formatMoney(egnCommissionEstimated)}
              </h3>
            </div>
            <div className="w-10 h-10 bg-[#A38C66]/10 rounded-lg flex items-center justify-center text-[#A38C66]">
              <Percent size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-medium">
            10% previsto sobre a receita recorrente contratada
          </div>
        </div>
      </div>

      {/* Visual Analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead and conversion graphics card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-6 flex items-center justify-between">
            <span>Distribuição e Ativação de Contatos</span>
            <span className="text-xs text-slate-500 normal-case font-normal">Representação visual</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
            {/* SVG Pie/Donut Chart */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle 
                  cx="18" 
                  cy="18" 
                  r="15.915" 
                  fill="none" 
                  stroke="#859159" 
                  strokeWidth="3.2" 
                  strokeDasharray={`${conversionRate} ${100 - conversionRate}`} 
                  strokeDashoffset="25" 
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#424733]">{conversionRate}%</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Ativação</span>
              </div>
            </div>

            {/* Custom Legend & Bars */}
            <div className="flex-1 w-full space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#859159]"></span> Clientes Ativos (Pagando)</span>
                  <span>{clientsCount} ({conversionRate}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[#859159] h-full" style={{ width: `${conversionRate}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Clientes Inativos</span>
                  <span>{leadCount} ({100 - conversionRate}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-slate-400 h-full" style={{ width: `${100 - conversionRate}%` }}></div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                Toda vez que a equipe EGN insere novos contatos e a EBC realiza a ativação, este gráfico é atualizado de forma instantânea para todos os aparelhos sincronizados.
              </div>
            </div>
          </div>
        </div>

        {/* Recent Registered Activity */}
        <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 mb-5 flex items-center justify-between">
            <span>Últimos Cadastrados</span>
            <TrendingUp size={16} className="text-[#859159]" />
          </h3>

          <div className="space-y-4">
            {recentLeads.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-6 text-center">Nenhum contato cadastrado ainda.</p>
            ) : (
              recentLeads.map(l => (
                <div key={l.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition border border-transparent hover:border-slate-100">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-[#424733] truncate">{l.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{l.company || l.email}</p>
                  </div>
                  <span className={`text-[10px] font-bold py-1 px-2.5 rounded-full flex-shrink-0 ${
                    l.status === "client" 
                      ? "bg-[#859159]/10 text-[#859159]" 
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {l.status === "client" ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
