# SISTEMA EBC & EGN - Gestão de Leads, Clientes, Financeiro e Contratos

Sistema completo de gestão comercial, esteira de clientes, automação financeira com Asaas e geração/assinatura de contratos eletrônicos personalizados.

## Principais Funcionalidades

1. **Gestão de Leads & CRM (Kanban & Tabela)**:
   - Funil com etapas dinâmicas (Novos Leads, Em Contato, Em Negociação, Ganhos, Perdidos).
   - Drag-and-drop no Kanban.
   - Histórico de interações por cliente.
   - Importador de Leads em lote (CSV ou Colar texto).

2. **Gestão de Contratos Digitais Personalizados**:
   - Geração de links únicos (`?contract=slug`).
   - Editor em tempo real de cláusulas, instruções de ativação, dados da contratada e chaves de pagamento (Zelle, Venmo, PIX).
   - Assinatura eletrônica com validade jurídica (MP 2.200-2/2001), carimbo de data/hora e registro de IP.
   - Impressão e exportação direta em PDF.

3. **Módulo Financeiro & Integração Asaas (PF)**:
   - Sincronização automática de clientes com o Asaas.
   - Geração e acompanhamento de cobranças de Setup e Assinaturas mensais.
   - Webhook em `/api/asaas/webhook` para confirmação de pagamentos em tempo real.
   - Sincronização em segundo plano a cada 10s para clientes selecionados e a cada 20s para todos os pendentes.
   - Controle de Repasses à EGN (10%) com ciclo mensal fechado no dia 24 e repasse único no dia 25.
   - Upload de comprovante bancário (imagem ou PDF) com visualizador integrado.

4. **Níveis de Acesso**:
   - Administrador (leitura e escrita total).
   - Visualizador (somente leitura para acompanhamento).
