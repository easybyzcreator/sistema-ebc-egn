import express from "express";
import path from "path";
import { config } from "dotenv";
import { initializeApp as initializeFirebase, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, limit, getDocs, updateDoc, doc } from "firebase/firestore";

// Load environment variables from .env
config();

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBoSHCUsfEjLuyVH8T_kv9y9EWHSnznu4I",
  authDomain: "app-ebc-egn.firebaseapp.com",
  projectId: "app-ebc-egn",
  storageBucket: "app-ebc-egn.firebasestorage.app",
  messagingSenderId: "977345104546",
  appId: "1:977345104546:web:4bd81679770974075a65fb",
  measurementId: "G-6GCLGG9PWL"
};

// Initialize Firebase App & Firestore Database safely for serverless environments
const firebaseApp = getApps().length === 0 ? initializeFirebase(firebaseConfig) : getApp();
const dbStore = getFirestore(firebaseApp);
console.log("[EBC/EGN Proxy] Firebase inicializado com sucesso para o backend.");

function onlyDigits(val: any): string {
  if (!val) return "";
  return String(val).replace(/\D/g, "");
}

// Helper function to resolve Asaas credentials from environment or headers
function getAsaasKeyAndEnv(requestedKey?: string, requestedEnv?: string) {
  const envVarVal = (process.env.ASAAS_ENV || "").trim();
  const mainApiKey = (process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || "").trim();
  
  // Detect Sandbox key from any environment variable
  let sandboxKeyFromEnv = (process.env.ASAAS_SANDBOX_KEY || "").trim();
  if (!sandboxKeyFromEnv && (envVarVal.startsWith("$aact_") || envVarVal.startsWith("aact_")) && (envVarVal.includes("hmlg") || envVarVal.includes("sandbox"))) {
    sandboxKeyFromEnv = envVarVal;
  }
  if (!sandboxKeyFromEnv && (mainApiKey.includes("hmlg") || mainApiKey.includes("sandbox"))) {
    sandboxKeyFromEnv = mainApiKey;
  }

  // Detect Production key from any environment variable
  let prodKeyFromEnv = (mainApiKey.includes("prod") ? mainApiKey : "").trim();
  if (!prodKeyFromEnv && (envVarVal.startsWith("$aact_") || envVarVal.startsWith("aact_")) && envVarVal.includes("prod")) {
    prodKeyFromEnv = envVarVal;
  }
  if (!prodKeyFromEnv && !mainApiKey.includes("hmlg")) {
    prodKeyFromEnv = mainApiKey;
  }

  let finalEnv = (requestedEnv || "").toLowerCase().trim();
  let finalKey = (requestedKey || "").trim();

  if (finalKey) {
    if (finalKey.includes("hmlg") || finalKey.includes("sandbox")) {
      finalEnv = "sandbox";
    } else if (finalKey.includes("prod")) {
      finalEnv = "production";
    }
  }

  if (!finalEnv) {
    if (envVarVal === "sandbox" || (!envVarVal.startsWith("$aact_") && envVarVal.toLowerCase() === "sandbox")) {
      finalEnv = "sandbox";
    } else if (sandboxKeyFromEnv && !prodKeyFromEnv) {
      finalEnv = "sandbox";
    } else {
      finalEnv = "production";
    }
  }

  if (!finalKey) {
    finalKey = finalEnv === "sandbox" ? (sandboxKeyFromEnv || prodKeyFromEnv) : (prodKeyFromEnv || sandboxKeyFromEnv);
  }

  return { apiKey: finalKey, env: finalEnv, sandboxKey: sandboxKeyFromEnv, prodKey: prodKeyFromEnv };
}

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Helper function to fetch Asaas with timeout and fast failover
async function fetchAsaas(
  endpoint: string,
  method: string,
  body: any,
  apiKey: string,
  env: string
) {
  const creds = getAsaasKeyAndEnv(apiKey, env);
  let activeEnv = (env || creds.env || "").trim().toLowerCase();
  if (activeEnv !== "sandbox") {
    activeEnv = "production";
  }

  let cleanKey = (apiKey || "").trim();
  // Ensure the right key is used for the targeted environment
  if (activeEnv === "sandbox") {
    if (!cleanKey || cleanKey.includes("prod")) {
      cleanKey = creds.sandboxKey || cleanKey;
    }
  } else {
    if (!cleanKey || cleanKey.includes("hmlg")) {
      cleanKey = creds.prodKey || cleanKey;
    }
  }

  if (!cleanKey) {
    cleanKey = creds.apiKey;
  }

  const primaryUrl = activeEnv === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const fallbackUrl = activeEnv === "production" ? "https://www.asaas.com/api/v3" : "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(`${primaryUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "access_token": cleanKey,
        "User-Agent": "EBC-EGN-App"
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // If 404/redirect on primary URL, try fallback URL
    if (!response.ok && fallbackUrl && (response.status === 404 || response.status === 301 || response.status === 302)) {
      const altController = new AbortController();
      const altTimeout = setTimeout(() => altController.abort(), 5000);
      try {
        const altResponse = await fetch(`${fallbackUrl}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "access_token": cleanKey,
            "User-Agent": "EBC-EGN-App"
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: altController.signal
        });
        clearTimeout(altTimeout);
        if (altResponse.ok) return altResponse;
      } catch {
        clearTimeout(altTimeout);
      }
    }

    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function extractErrorMessage(data: any): string {
  if (!data) return "Erro na comunicação com o Asaas.";
  
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "[]") {
      return "O Asaas não retornou detalhes do erro. Verifique os dados fornecidos.";
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return extractErrorMessage(parsed);
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  // Asaas array error response: { errors: [ { code: "...", description: "..." } ] }
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const messages = data.errors
      .map((e: any) => {
        if (typeof e === "string") return e;
        return e.description || e.message || e.code || "";
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" | ");
  }

  if (data.error) {
    if (typeof data.error === "string") {
      const trimmedErr = data.error.trim();
      try {
        const parsed = JSON.parse(trimmedErr);
        if (parsed && typeof parsed === "object") {
          const sub = extractErrorMessage(parsed);
          if (sub && sub !== "{}" && sub !== "[]") return sub;
        }
      } catch {
        // Not JSON
      }
      if (trimmedErr && trimmedErr !== "{}" && trimmedErr !== "[]") {
        return trimmedErr;
      }
    } else if (typeof data.error === "object") {
      const sub = extractErrorMessage(data.error);
      if (sub && sub !== "{}" && sub !== "[]") return sub;
    }
  }

  if (data.message && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  try {
    const str = JSON.stringify(data);
    if (str && str !== "{}" && str !== "[]") return str;
  } catch {}

  return "Ocorreu um problema ao comunicar com o Asaas. Verifique o cadastro do cliente e a chave de API.";
}

function parseCurrencyToNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (!str) return 0;
  if (str.includes(",")) {
    const cleaned = str.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  } else {
    const cleaned = str.replace(/[^\d.]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
}

const app = express();
const PORT = 3000;

// CORS headers for Vercel & client requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// API Routes for Asaas Proxy integration
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is healthy." });
});

// Diagnóstico de status e integridade da conexão Asaas
app.get("/api/asaas/status", async (req, res) => {
  const customKey = (req.headers["x-asaas-key"] || "").toString().trim();
  const customEnv = (req.headers["x-asaas-env"] || "").toString().trim();
  const creds = getAsaasKeyAndEnv(customKey, customEnv);

  const results: any = {
    configured: Boolean(creds.apiKey || creds.prodKey || creds.sandboxKey),
    activeEnv: creds.env,
    hasProdKey: Boolean(creds.prodKey),
    hasSandboxKey: Boolean(creds.sandboxKey),
    webhookEndpoints: [
      "/api/webhooks/asaas",
      "/api/asaas/webhook"
    ]
  };

  // Testa conexão rápida na produção
  if (creds.prodKey) {
    try {
      const prodRes = await fetchAsaas("/customers?limit=1", "GET", null, creds.prodKey, "production");
      results.prodConnection = prodRes.ok ? "OK (200)" : `Erro (${prodRes.status})`;
    } catch (e: any) {
      results.prodConnection = `Falha: ${e.message}`;
    }
  }

  // Testa conexão rápida no sandbox
  if (creds.sandboxKey) {
    try {
      const sbRes = await fetchAsaas("/customers?limit=1", "GET", null, creds.sandboxKey, "sandbox");
      results.sandboxConnection = sbRes.ok ? "OK (200)" : `Erro (${sbRes.status})`;
    } catch (e: any) {
      results.sandboxConnection = `Falha: ${e.message}`;
    }
  }

  res.json(results);
});

// 1. TRATAMENTO E CRIAÇÃO DO CLIENTE (POST /v3/customers)
app.post("/api/asaas/customer", async (req, res) => {
  try {
    const apiKey = (req.headers["x-asaas-key"] || process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || "").toString().trim();
    const env = (req.headers["x-asaas-env"] || process.env.ASAAS_ENV || "production").toString().trim();

    if (!apiKey) {
      return res.status(400).json({ error: "Chave de API do Asaas não configurada no servidor (ASAAS_API_KEY)." });
    }

    const { name, email, phone, mobilePhone, company, cpfCnpj, postalCode, addressNumber, birthDate, signedAt } = req.body || {};

    const cleanCpfCnpj = onlyDigits(cpfCnpj);
    const cleanPhone = onlyDigits(phone || mobilePhone);
    const cleanPostalCode = onlyDigits(postalCode);

    const validCpfCnpj = (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) ? cleanCpfCnpj : undefined;

    // Search existing customer by CPF/CNPJ or Email
    let existingId: string | null = null;

    if (validCpfCnpj) {
      try {
        const searchCpfRes = await fetchAsaas(`/customers?cpfCnpj=${validCpfCnpj}`, "GET", null, apiKey, env);
        if (searchCpfRes.ok) {
          const searchData: any = await searchCpfRes.json();
          if (searchData.data && searchData.data.length > 0) {
            existingId = searchData.data[0].id;
          }
        }
      } catch (e) {
        console.error("Asaas CPF search warning:", e);
      }
    }

    if (!existingId && email) {
      try {
        const searchEmailRes = await fetchAsaas(`/customers?email=${encodeURIComponent(email)}`, "GET", null, apiKey, env);
        if (searchEmailRes.ok) {
          const searchData: any = await searchEmailRes.json();
          if (searchData.data && searchData.data.length > 0) {
            existingId = searchData.data[0].id;
          }
        }
      } catch (e) {
        console.error("Asaas Email search warning:", e);
      }
    }

    if (existingId) {
      try {
        await fetchAsaas(`/customers/${existingId}`, "POST", {
          name: name || undefined,
          email: email || undefined,
          phone: cleanPhone || undefined,
          mobilePhone: cleanPhone || undefined,
          cpfCnpj: validCpfCnpj || undefined,
          postalCode: cleanPostalCode || undefined,
          addressNumber: addressNumber || undefined,
          notificationDisabled: false
        }, apiKey, env);
      } catch (uErr) {
        console.warn("Notice: could not update existing customer profile:", uErr);
      }
      return res.json({ id: existingId, customerId: existingId, message: "Cliente localizado e atualizado no Asaas.", isNew: false });
    }

    // Create new customer with strictly cleaned digits
    const createPayload: any = {
      name: name || "Cliente EBC/EGN",
      cpfCnpj: validCpfCnpj || undefined,
      email: email || undefined,
      phone: cleanPhone || undefined,
      mobilePhone: cleanPhone || undefined,
      postalCode: cleanPostalCode || undefined,
      addressNumber: addressNumber || undefined,
      company: company || undefined,
      notificationDisabled: false,
      observations: `Contrato Assinado em: ${signedAt || new Date().toLocaleString("pt-BR")}`
    };

    const response = await fetchAsaas("/customers", "POST", createPayload, apiKey, env);

    if (!response.ok) {
      const errText = await response.text();
      const errorMsg = extractErrorMessage(errText);
      console.error("Asaas customer creation error:", errText);
      return res.status(response.status).json({ error: `Erro ao cadastrar cliente no Asaas: ${errorMsg}`, details: errText });
    }

    const customerData: any = await response.json();
    return res.json({ id: customerData.id, customerId: customerData.id, raw: customerData, isNew: true });
  } catch (err: any) {
    console.error("Server customer error:", err);
    return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
  }
});

// 2 & 3 & 4. CRIAÇÃO DA ASSINATURA E BUSCA OBRIGATÓRIA DA FATURA (POST /v3/subscriptions & GET /v3/subscriptions/{id}/payments)
app.post("/api/asaas/subscription", async (req, res) => {
  try {
    const apiKey = (req.headers["x-asaas-key"] || process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || "").toString().trim();
    const env = (req.headers["x-asaas-env"] || process.env.ASAAS_ENV || "production").toString().trim();

    if (!apiKey) {
      return res.status(400).json({ error: "Chave de API do Asaas não configurada no servidor (ASAAS_API_KEY)." });
    }

    const { customerId, customerName, value, nextDueDate, billingType, description, leadId } = req.body || {};
    const numericValue = parseCurrencyToNumber(value);

    if (!customerId) {
      return res.status(400).json({ error: "customerId é obrigatório para criar a assinatura." });
    }

    if (numericValue < 5) {
      return res.status(400).json({ error: `O valor da assinatura (R$ ${numericValue.toFixed(2)}) é inferior ao valor mínimo de R$ 5,00 permitido pelo Asaas.` });
    }

    // Strict YYYY-MM-DD
    const todayBR = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const formattedDueDate = (nextDueDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) ? nextDueDate : todayBR;

    // Payload for POST /v3/subscriptions
    const subPayload = {
      customer: customerId,
      billingType: billingType || "UNDEFINED",
      value: numericValue,
      nextDueDate: formattedDueDate,
      cycle: "MONTHLY",
      description: description || `Mensalidade do Contrato - ${customerName || "Cliente EBC/EGN"}`
    };

    console.log("[Asaas Subscription] Criando assinatura:", JSON.stringify(subPayload));

    const response = await fetchAsaas("/subscriptions", "POST", subPayload, apiKey, env);

    if (!response.ok) {
      const errText = await response.text();
      const parsedErr = extractErrorMessage(errText);
      console.error("[Asaas Subscription Error]:", errText);
      return res.status(response.status).json({
        error: `Erro ao criar assinatura no Asaas: ${parsedErr}`,
        details: errText
      });
    }

    const subscriptionData: any = await response.json();
    const subscriptionId = subscriptionData.id;

    // STEP 3: BUSCA DA PRIMEIRA FATURA / LINK DE CHECKOUT
    // GET /v3/subscriptions/{subscriptionId}/payments
    let paymentId = "";
    let invoiceUrl = subscriptionData.invoiceUrl || "";
    let bankSlipUrl = subscriptionData.bankSlipUrl || "";

    try {
      const paymentsRes = await fetchAsaas(`/subscriptions/${subscriptionId}/payments`, "GET", null, apiKey, env);
      if (paymentsRes.ok) {
        const paymentsData: any = await paymentsRes.json();
        if (paymentsData.data && paymentsData.data.length > 0) {
          const firstPayment = paymentsData.data[0];
          paymentId = firstPayment.id;
          invoiceUrl = firstPayment.invoiceUrl || invoiceUrl;
          bankSlipUrl = firstPayment.bankSlipUrl || bankSlipUrl;
        }
      }
    } catch (payPollErr) {
      console.error("Notice: payment list fetch warning:", payPollErr);
    }

    const finalCheckoutUrl = invoiceUrl || bankSlipUrl;

    // RETORNO PARA O FRONT-END
    return res.json({
      success: true,
      id: subscriptionId,
      subscriptionId: subscriptionId,
      paymentId: paymentId,
      invoiceUrl: finalCheckoutUrl,
      bankSlipUrl: bankSlipUrl,
      raw: subscriptionData
    });
  } catch (err: any) {
    console.error("Server subscription error:", err);
    return res.status(500).json({ error: `Erro interno ao criar assinatura: ${err.message}` });
  }
});

// FULL COMBINED ENDPOINT: CRIAÇÃO COMPLETA DE CONTRATO E ASSINATURA (Passos 1 a 5)
app.post("/api/asaas/create-contract-subscription", async (req, res) => {
  try {
    const apiKey = (req.headers["x-asaas-key"] || process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || "").toString().trim();
    const env = (req.headers["x-asaas-env"] || process.env.ASAAS_ENV || "production").toString().trim();

    if (!apiKey) {
      return res.status(400).json({ error: "Chave de API do Asaas não configurada no servidor (ASAAS_API_KEY)." });
    }

    const { name, email, phone, cpfCnpj, postalCode, value, nextDueDate, description, leadId } = req.body || {};

    const cleanCpfCnpj = onlyDigits(cpfCnpj);
    const cleanPhone = onlyDigits(phone);
    const cleanPostalCode = onlyDigits(postalCode);
    const numericValue = parseCurrencyToNumber(value);

    if (numericValue < 5) {
      return res.status(400).json({ error: `O valor informado (R$ ${numericValue.toFixed(2)}) é inferior ao valor mínimo de R$ 5,00 permitido pelo Asaas.` });
    }

    // 1. TRATAMENTO E CRIAÇÃO DO CLIENTE (POST /v3/customers)
    const validCpfCnpj = (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) ? cleanCpfCnpj : undefined;
    let customerId: string | null = null;

    if (validCpfCnpj) {
      try {
        const searchCpfRes = await fetchAsaas(`/customers?cpfCnpj=${validCpfCnpj}`, "GET", null, apiKey, env);
        if (searchCpfRes && searchCpfRes.ok) {
          const searchData: any = await searchCpfRes.json().catch(() => ({}));
          if (searchData && searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
          }
        }
      } catch (e) {
        console.error("CPF search warning:", e);
      }
    }

    if (!customerId && email) {
      try {
        const searchEmailRes = await fetchAsaas(`/customers?email=${encodeURIComponent(email)}`, "GET", null, apiKey, env);
        if (searchEmailRes && searchEmailRes.ok) {
          const searchData: any = await searchEmailRes.json().catch(() => ({}));
          if (searchData && searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
          }
        }
      } catch (e) {
        console.error("Email search warning:", e);
      }
    }

    if (customerId) {
      try {
        await fetchAsaas(`/customers/${customerId}`, "POST", {
          name: name || undefined,
          email: email || undefined,
          phone: cleanPhone || undefined,
          mobilePhone: cleanPhone || undefined,
          cpfCnpj: validCpfCnpj || undefined,
          postalCode: cleanPostalCode || undefined,
          notificationDisabled: false
        }, apiKey, env);
      } catch (uErr) {
        console.warn("Notice: could not update customer:", uErr);
      }
    } else {
      let createRes: Response;
      try {
        createRes = await fetchAsaas("/customers", "POST", {
          name: name || "Cliente EBC/EGN",
          cpfCnpj: validCpfCnpj || undefined,
          email: email || undefined,
          phone: cleanPhone || undefined,
          mobilePhone: cleanPhone || undefined,
          postalCode: cleanPostalCode || undefined,
          notificationDisabled: false
        }, apiKey, env);
      } catch (fErr: any) {
        return res.status(400).json({ error: `Erro na conexão com Asaas: ${fErr.message}` });
      }

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => "");
        const errorMsg = extractErrorMessage(errText);
        return res.status(400).json({ error: `Erro ao cadastrar cliente no Asaas: ${errorMsg}` });
      }

      const cData: any = await createRes.json().catch(() => ({}));
      customerId = cData.id || null;
    }

    if (!customerId) {
      return res.status(400).json({ error: "Não foi possível criar/localizar o cadastro do cliente no Asaas." });
    }

    // 2. CRIAÇÃO DA ASSINATURA (POST /v3/subscriptions)
    let todayBR = new Date().toISOString().split("T")[0];
    try {
      todayBR = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    } catch {}

    const formattedDueDate = (nextDueDate && /^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) ? nextDueDate : todayBR;

    const subPayload = {
      customer: customerId,
      billingType: "UNDEFINED",
      value: numericValue,
      nextDueDate: formattedDueDate,
      cycle: "MONTHLY",
      description: description || `Mensalidade do Contrato - ${name || "Cliente EBC/EGN"}`
    };

    let subRes: Response;
    try {
      subRes = await fetchAsaas("/subscriptions", "POST", subPayload, apiKey, env);
    } catch (sErr: any) {
      return res.status(400).json({ error: `Erro de rede ao criar assinatura no Asaas: ${sErr.message}` });
    }

    if (!subRes.ok) {
      const subErrText = await subRes.text().catch(() => "");
      const errorMsg = extractErrorMessage(subErrText);
      return res.status(400).json({ error: `Erro ao criar assinatura no Asaas: ${errorMsg}` });
    }

    const subData: any = await subRes.json().catch(() => ({}));
    const subscriptionId = subData.id;

    // 3. OBTER A PRIMEIRA FATURA / LINK DE CHECKOUT (GET /v3/subscriptions/{id}/payments)
    let paymentId = "";
    let invoiceUrl = subData.invoiceUrl || "";
    let bankSlipUrl = subData.bankSlipUrl || "";

    try {
      const paysRes = await fetchAsaas(`/subscriptions/${subscriptionId}/payments`, "GET", null, apiKey, env);
      if (paysRes && paysRes.ok) {
        const paysData: any = await paysRes.json().catch(() => ({}));
        if (paysData && paysData.data && paysData.data.length > 0) {
          const firstPayment = paysData.data[0];
          paymentId = firstPayment.id;
          invoiceUrl = firstPayment.invoiceUrl || invoiceUrl;
          bankSlipUrl = firstPayment.bankSlipUrl || bankSlipUrl;
        }
      }
    } catch (pErr) {
      console.error("Notice: subscription payment list fetch warning:", pErr);
    }

    const finalInvoiceUrl = invoiceUrl || bankSlipUrl;

    // RETORNO DE SUCESSO
    return res.json({
      success: true,
      customerId: customerId,
      subscriptionId: subscriptionId,
      paymentId: paymentId,
      invoiceUrl: finalInvoiceUrl,
      bankSlipUrl: bankSlipUrl
    });
  } catch (err: any) {
    console.error("Error in create-contract-subscription:", err);
    return res.status(400).json({ error: `Erro interno no servidor: ${err.message || String(err)}` });
  }
});

// RESOLVER DINÂMICO E GARANTIDO DE LINK DE PAGAMENTO
app.post("/api/asaas/get-payment-link", async (req, res) => {
  try {
    const apiKey = (req.headers["x-asaas-key"] || process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN || "").toString().trim();
    const env = (req.headers["x-asaas-env"] || process.env.ASAAS_ENV || "production").toString().trim();

    if (!apiKey) {
      return res.status(400).json({ error: "Chave de API do Asaas não configurada no servidor (ASAAS_API_KEY)." });
    }

    let { customerId, name, email, phone, cpfCnpj, postalCode, value, description, leadId } = req.body || {};
    const numericValue = parseCurrencyToNumber(value);

    if (numericValue < 5) {
      return res.status(400).json({ error: `O valor informado (R$ ${numericValue.toFixed(2)}) é inferior ao valor mínimo de R$ 5,00 exigido pelo Asaas.` });
    }

    const cleanCpfCnpj = onlyDigits(cpfCnpj);
    const cleanPhone = onlyDigits(phone);
    const cleanPostalCode = onlyDigits(postalCode);
    const validCpfCnpj = (cleanCpfCnpj.length === 11 || cleanCpfCnpj.length === 14) ? cleanCpfCnpj : undefined;

    // 1. Localizar ou criar cliente no Asaas
    if (!customerId) {
      if (validCpfCnpj) {
        try {
          const searchRes = await fetchAsaas(`/customers?cpfCnpj=${validCpfCnpj}`, "GET", null, apiKey, env);
          if (searchRes.ok) {
            const data: any = await searchRes.json();
            if (data.data && data.data.length > 0) customerId = data.data[0].id;
          }
        } catch (e) {
          console.error("Error searching customer by CPF:", e);
        }
      }

      if (!customerId && email) {
        try {
          const searchRes = await fetchAsaas(`/customers?email=${encodeURIComponent(email)}`, "GET", null, apiKey, env);
          if (searchRes.ok) {
            const data: any = await searchRes.json();
            if (data.data && data.data.length > 0) customerId = data.data[0].id;
          }
        } catch (e) {
          console.error("Error searching customer by Email:", e);
        }
      }

      if (!customerId) {
        const createRes = await fetchAsaas("/customers", "POST", {
          name: name || "Cliente EBC/EGN",
          email: email || undefined,
          phone: cleanPhone || undefined,
          mobilePhone: cleanPhone || undefined,
          cpfCnpj: validCpfCnpj || undefined,
          postalCode: cleanPostalCode || undefined,
          notificationDisabled: false
        }, apiKey, env);

        if (createRes.ok) {
          const cData: any = await createRes.json();
          customerId = cData.id;
        } else {
          const cErrText = await createRes.text();
          const errorMsg = extractErrorMessage(cErrText);
          return res.status(400).json({ error: `Erro ao cadastrar cliente no Asaas: ${errorMsg}` });
        }
      }
    }

    if (!customerId) {
      return res.status(400).json({ error: "Não foi possível identificar ou criar o cadastro do cliente no Asaas." });
    }

    let foundLink = "";
    let foundSubId = "";
    let foundPayId = "";

    // 2. Buscar assinaturas ativas do cliente
    try {
      const subListRes = await fetchAsaas(`/subscriptions?customer=${customerId}`, "GET", null, apiKey, env);
      if (subListRes.ok) {
        const subListData: any = await subListRes.json();
        if (subListData.data && subListData.data.length > 0) {
          const activeSub = subListData.data.find((s: any) => s.status === "ACTIVE") || subListData.data[0];
          foundSubId = activeSub.id;
          const subPaysRes = await fetchAsaas(`/subscriptions/${foundSubId}/payments`, "GET", null, apiKey, env);
          if (subPaysRes.ok) {
            const subPaysData: any = await subPaysRes.json();
            if (subPaysData.data && subPaysData.data.length > 0) {
              foundPayId = subPaysData.data[0].id;
              foundLink = subPaysData.data[0].invoiceUrl || subPaysData.data[0].bankSlipUrl;
            }
          }
        }
      }
    } catch (sErr) {
      console.error("Error checking existing subscriptions:", sErr);
    }

    // 3. Se não houver link de assinatura, criar nova assinatura recorrente
    if (!foundLink && numericValue >= 5) {
      const todayBR = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const newSubRes = await fetchAsaas("/subscriptions", "POST", {
        customer: customerId,
        billingType: "UNDEFINED",
        value: numericValue,
        nextDueDate: todayBR,
        cycle: "MONTHLY",
        description: description || `Mensalidade do Contrato - ${name || "Cliente EBC/EGN"}`
      }, apiKey, env);

      if (newSubRes.ok) {
        const newSubData: any = await newSubRes.json();
        foundSubId = newSubData.id;
        foundLink = newSubData.invoiceUrl || newSubData.bankSlipUrl;

        if (!foundLink && foundSubId) {
          for (let poll = 0; poll < 10; poll++) {
            await new Promise(r => setTimeout(r, 300));
            const subPRes = await fetchAsaas(`/subscriptions/${foundSubId}/payments`, "GET", null, apiKey, env);
            if (subPRes.ok) {
              const subPData: any = await subPRes.json();
              if (subPData.data && subPData.data.length > 0) {
                foundPayId = subPData.data[0].id;
                foundLink = subPData.data[0].invoiceUrl || subPData.data[0].bankSlipUrl;
                if (foundLink) break;
              }
            }
          }
        }
      } else {
        const subErrText = await newSubRes.text();
        const subErrMsg = extractErrorMessage(subErrText);
        return res.status(400).json({ error: `Erro ao gerar fatura no Asaas: ${subErrMsg}` });
      }
    }

    if (!foundLink) {
      return res.status(400).json({ error: "Não foi possível gerar a fatura no Asaas. Verifique os dados do cliente e tente novamente." });
    }

    // Salvar no Firestore se leadId fornecido
    if (leadId) {
      try {
        const leadRef = doc(dbStore, "leads", leadId);
        await updateDoc(leadRef, {
          asaasCustomerId: customerId,
          asaasSubscriptionId: foundSubId || "",
          monthlyPaymentLink: foundLink,
          updatedAt: new Date().toISOString()
        });
      } catch (dbE) {
        console.warn("Could not save to lead:", dbE);
      }
    }

    return res.json({
      success: true,
      invoiceUrl: foundLink,
      customerId: customerId,
      subscriptionId: foundSubId,
      paymentId: foundPayId
    });
  } catch (err: any) {
    console.error("Server get-payment-link error:", err);
    return res.status(500).json({ error: `Erro interno no servidor: ${err.message}` });
  }
});

// Helper para extrair o valor real total pago pelo cliente (incluindo juros e multa do Asaas)
function getAsaasPaymentRealAmount(p: any): number {
  const nominal = Number(p.value || p.amount || 0);
  const interest = Number(p.interestValue || 0);
  const fine = Number(p.fineValue || 0);
  const original = Number(p.originalValue || 0);

  // Se o Asaas reportou juros ou multa separadamente e o nominal ainda está no valor original
  if ((interest > 0 || fine > 0) && original > 0 && Math.abs(nominal - original) < 0.05) {
    return Math.round((nominal + interest + fine) * 100) / 100;
  }
  return nominal;
}

// ROUTE DE SINCRONIZAÇÃO E VERIFICAÇÃO ATIVA DO ASAAS (GET /api/asaas/sync-client-status)
function classifyAsaasPayment(
  p: any,
  leadData: any,
  setupCode?: string,
  monthlyCode?: string
): {
  isSetup: boolean;
  isMonthly: boolean;
  installmentNumber: number;
  totalInstallments: number;
  monthReference: string;
} {
  const desc = (p.description || "").toLowerCase();
  const pVal = getAsaasPaymentRealAmount(p);
  const subId = p.subscription || p.asaasSubscriptionId;
  const pId = (p.id || p.asaasPaymentId || "").toLowerCase();
  const paymentLink = (p.paymentLink || "").toLowerCase();
  const invoiceUrl = (p.invoiceUrl || "").toLowerCase();

  const cfgFee = Number(leadData.configurationFee || 0);
  const monFee = Number(leadData.monthlyFee || 0);
  const cfgInstCount = Number(leadData.setupInstallments || leadData.contractConfig?.setupInstallments || (cfgFee > 0 ? 3 : 1));
  const expectedInstVal = cfgInstCount > 0 ? Math.round((cfgFee / cfgInstCount) * 100) / 100 : cfgFee;

  let isSetup = false;
  let isMonthly = false;
  let installmentNumber = Number(p.installmentNumber || 0);
  let totalInstallments = Number(p.totalInstallments || (cfgInstCount || 3));

  // 1. PRIORIDADE MÁXIMA: Se pertence explicitamente a uma assinatura (Assinatura Recorrente NÃO TEM limite de parcelas)
  if (subId || (monthlyCode && (paymentLink.includes(monthlyCode) || invoiceUrl.includes(monthlyCode) || pId.includes(monthlyCode)))) {
    isMonthly = true;
    isSetup = false;
  }
  // 2. Se tem vínculo com o Link de Pagamento de Setup ou Carnê de Parcelamento
  else if (p.installment || (setupCode && (paymentLink.includes(setupCode) || invoiceUrl.includes(setupCode) || pId.includes(setupCode)))) {
    isSetup = true;
    isMonthly = false;
  }
  // 3. Se a descrição cita explicitamente
  else if (desc.includes("setup") || desc.includes("config") || desc.includes("implan") || desc.includes("taxa") || /parcela\s*(\d+)/i.test(desc)) {
    isSetup = true;
    isMonthly = false;
  } else if (desc.includes("mensal") || desc.includes("assinatura") || desc.includes("recorren")) {
    isMonthly = true;
    isSetup = false;
  }
  // 4. Comparação de valores (tolerância para juros, multas ou pequenos descontos):
  else if (cfgFee > 0 && (Math.abs(expectedInstVal - pVal) < (expectedInstVal * 0.25 + 10) || Math.abs(cfgFee - pVal) < (cfgFee * 0.25 + 10))) {
    isSetup = true;
    isMonthly = false;
  } else if (monFee > 0 && Math.abs(monFee - pVal) < (monFee * 0.25 + 10)) {
    isMonthly = true;
    isSetup = false;
  } else {
    // Fallback inteligente: sem subscription id e com taxa de setup, atribui a setup
    if (cfgFee > 0 && !subId) {
      isSetup = true;
    } else {
      isMonthly = true;
    }
  }

  // Extrair números de parcela se for setup
  if (isSetup) {
    const matchParcela = desc.match(/parcela\s*(\d+)\s*(?:de|\/)\s*(\d+)/i) || desc.match(/(\d+)\s*(?:de|\/)\s*(\d+)/i);
    if (matchParcela) {
      installmentNumber = parseInt(matchParcela[1], 10) || installmentNumber;
      totalInstallments = parseInt(matchParcela[2], 10) || totalInstallments;
    }
    if (totalInstallments === 0) totalInstallments = cfgInstCount;
  }

  const isReceived = p.status === "RECEIVED" || p.status === "CONFIRMED" || p.status === "RECEIVED_IN_CASH";

  // Identificação do mês de referência para mensalidades
  let monthReference = "";
  const descMatch = (p.description || "").match(/(\d{2}\/\d{4})/);
  if (descMatch) {
    monthReference = descMatch[1];
  } else {
    let pDateStr = "";
    if (isReceived && (p.paymentDate || p.clientPaymentDate || p.confirmedDate)) {
      pDateStr = p.paymentDate || p.clientPaymentDate || p.confirmedDate;
    } else {
      pDateStr = p.dueDate || p.paymentDate || new Date().toISOString().split("T")[0];
    }
    const dateParts = pDateStr.split("-");
    monthReference = dateParts.length >= 2 ? `${dateParts[1]}/${dateParts[0]}` : "";
  }

  return {
    isSetup,
    isMonthly,
    installmentNumber,
    totalInstallments,
    monthReference
  };
}

function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore).filter(item => item !== undefined);
  }
  if (typeof obj === "object") {
    const clean: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        clean[k] = sanitizeForFirestore(v);
      }
    }
    return clean;
  }
  return obj;
}

/**
 * FUNÇÃO UNIFICADA DE SINCRONIZAÇÃO COMPLETA COM O ASAAS
 * Consulta links de pagamento, customerId, assinaturas, carnês/parcelamentos e histórico recente
 */
async function syncLeadWithAsaas(leadId: string, leadDataOverride?: any, customKey?: string) {
  const leadRef = doc(dbStore, "leads", leadId);
  let leadData = leadDataOverride;
  if (!leadData) {
    const snap = await getDocs(query(collection(dbStore, "leads"), where("__name__", "==", leadId)));
    if (snap.empty) {
      throw new Error(`Lead ${leadId} não encontrado.`);
    }
    leadData = snap.docs[0].data();
  }

  const creds = getAsaasKeyAndEnv(customKey || "");

  let setupStatus = leadData.setupPaymentStatus || (leadData.configurationFeePaid ? "paid" : "pending");
  let monthlyStatus = leadData.monthlyPaymentStatus || "pending";
  let updatedPayments = [...(leadData.payments || [])];
  let updatedHistory = [...(leadData.history || [])];

  const sLink = (leadData.setupPaymentLink || "").toLowerCase();
  const mLink = (leadData.monthlyPaymentLink || "").toLowerCase();
  const isSandboxLead = sLink.includes("sandbox") || mLink.includes("sandbox") || (process.env.ASAAS_ENV || "").toLowerCase() === "sandbox";

  const envsToTry = isSandboxLead ? ["sandbox", "production"] : ["production", "sandbox"];

  // Extrair códigos dos links (ex: 1tc5tmunm3e8cerr, 4of48t8aqnkisr55)
  const extractCode = (link: string) => {
    if (!link) return "";
    const match = link.match(/\/(?:c|i)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : link.replace(/https?:\/\/[^\/]+\/(c|i)\//g, "").trim();
  };

  const setupCode = extractCode(sLink);
  const monthlyCode = extractCode(mLink);

  const docCandidates = [
    leadData.contractData?.document,
    leadData.contractConfig?.clientDoc,
    leadData.document,
    leadData.cpf,
    leadData.cnpj,
    leadData.cpfCnpj
  ].map(d => onlyDigits(d || "")).filter(d => d.length >= 8);

  const targetEmail = (leadData.email || leadData.contractData?.email || leadData.contractConfig?.clientEmail || "").toLowerCase().trim();
  const clientFullName = (leadData.name || leadData.contractData?.fullName || leadData.contractConfig?.clientName || "").trim();
  const normName = normalizeStr(clientFullName);

  // Cache para clientes do Asaas confirmados como pertencentes a este Lead
  const verifiedCustomerIds = new Set<string>();
  const rejectedCustomerIds = new Set<string>();
  const discoveredSubIds = new Set<string>();
  if (leadData.asaasSubscriptionId) discoveredSubIds.add(leadData.asaasSubscriptionId);

  let foundAny = false;
  let foundDetails: string[] = [];

  const cfgFee = Number(leadData.configurationFee || 0);
  const monFee = Number(leadData.monthlyFee || 0);
  const totalSetupInst = Number(leadData.setupInstallments || (leadData.contractConfig?.setupInstallments) || (cfgFee > 0 ? 3 : 1));
  const expectedInstVal = totalSetupInst > 0 ? Math.round((cfgFee / totalSetupInst) * 100) / 100 : cfgFee;

  const rawPaymentsFromAsaas: any[] = [];

  for (const currentEnv of envsToTry) {
    const envKey = currentEnv === "sandbox" ? (creds.sandboxKey || creds.apiKey) : (creds.prodKey || creds.apiKey);
    if (!envKey) continue;

    // Helper para verificar se um customerId do Asaas pertence a este Lead (ESTRITAMENTE por CPF/CNPJ)
    const verifyCustomerMatch = async (custId: string): Promise<boolean> => {
      if (!custId) return false;
      if (verifiedCustomerIds.has(custId)) return true;
      if (rejectedCustomerIds.has(custId)) return false;

      try {
        const cRes = await fetchAsaas(`/customers/${custId}`, "GET", null, envKey, currentEnv);
        if (cRes.ok) {
          const cInfo: any = await cRes.json();
          const cCpf = onlyDigits(cInfo.cpfCnpj || "");

          let match = false;
          if (docCandidates.length > 0 && cCpf && docCandidates.includes(cCpf)) {
            match = true;
          }

          if (match) {
            verifiedCustomerIds.add(custId);
            return true;
          } else {
            rejectedCustomerIds.add(custId);
            return false;
          }
        }
      } catch (err) {
        console.warn(`[verifyCustomerMatch] Erro ao consultar customer ${custId}:`, err);
      }
      return false;
    };

    // 1. Buscar clientes no Asaas ESTRITAMENTE pelo CPF/CNPJ do Lead
    for (const docCpf of docCandidates) {
      try {
        const custRes = await fetchAsaas(`/customers?cpfCnpj=${docCpf}`, "GET", null, envKey, currentEnv);
        if (custRes.ok) {
          const cData: any = await custRes.json();
          if (cData.data && cData.data.length > 0) {
            for (const c of cData.data) {
              const cCpf = onlyDigits(c.cpfCnpj || "");
              if (c.id && docCandidates.includes(cCpf)) {
                verifiedCustomerIds.add(c.id);
              }
            }
          }
        }
      } catch (e: any) {
        console.warn(`[sync] Busca CPF erro:`, e.message);
      }
    }

    // 2. Buscar pagamentos de TODOS os customerIds CONFIRMADOS deste Lead (por CPF)
    for (const custId of Array.from(verifiedCustomerIds)) {
      try {
        const paysRes = await fetchAsaas(`/payments?customer=${custId}&limit=100`, "GET", null, envKey, currentEnv);
        if (paysRes.ok) {
          const pData: any = await paysRes.json();
          if (pData.data && Array.isArray(pData.data)) {
            for (const p of pData.data) {
              const pVal = Number(p.value || p.amount || 0);
              const pDate = p.paymentDate || p.clientPaymentDate || p.confirmedDate || p.dueDate || "";
              
              // Descartar pagamentos antigos anteriores a 2024
              const isOldYear = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
              // Tolerância inteligente para juros, multas ou descontos
              const matchesAmount = (cfgFee > 0 && Math.abs(pVal - expectedInstVal) < (expectedInstVal * 0.25 + 10)) ||
                                    (cfgFee > 0 && Math.abs(pVal - cfgFee) < (cfgFee * 0.25 + 10)) ||
                                    (monFee > 0 && Math.abs(pVal - monFee) < (monFee * 0.25 + 10)) ||
                                    (cfgFee === 0 && monFee === 0) ||
                                    Boolean(p.subscription || p.installment);

              if (!isOldYear && matchesAmount) {
                rawPaymentsFromAsaas.push(p);
                if (p.subscription) discoveredSubIds.add(p.subscription);
              }
            }
          }
        }
      } catch (e: any) {
        console.warn(`[sync] Erro customer pays no ${currentEnv}:`, e.message);
      }
    }

    // 3. Buscar pagamentos de assinaturas descobertas deste Lead
    for (const subId of Array.from(discoveredSubIds)) {
      try {
        const subPaysRes = await fetchAsaas(`/subscriptions/${subId}/payments?limit=100`, "GET", null, envKey, currentEnv);
        if (subPaysRes.ok) {
          const spData: any = await subPaysRes.json();
          if (spData.data && Array.isArray(spData.data)) {
            for (const p of spData.data) {
              const pVal = getAsaasPaymentRealAmount(p);
              const pDate = p.paymentDate || p.clientPaymentDate || p.confirmedDate || p.dueDate || "";
              const isOldYear = pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021");
              // Tolerância inteligente para juros/multas/descontos em faturas da assinatura
              const matchesAmount = (monFee > 0 && Math.abs(pVal - monFee) < (monFee * 0.25 + 10)) || (monFee === 0) || Boolean(p.subscription);

              if (!isOldYear && matchesAmount) {
                rawPaymentsFromAsaas.push(p);
              }
            }
          }
        }
      } catch (subErr: any) {
        console.warn(`[sync sub] Erro no ${currentEnv}:`, subErr.message);
      }
    }

    // 4. Se algum pagamento possui 'installment' (carnê/parcelamento), buscar todas as parcelas do grupo
    const installmentIds = Array.from(new Set(rawPaymentsFromAsaas.map(p => p.installment).filter(Boolean)));
    for (const instId of installmentIds) {
      try {
        const instPaysRes = await fetchAsaas(`/payments?installment=${instId}&limit=100`, "GET", null, envKey, currentEnv);
        if (instPaysRes.ok) {
          const ipData: any = await instPaysRes.json();
          if (ipData.data && Array.isArray(ipData.data)) {
            for (const p of ipData.data) {
              const pVal = Number(p.value || p.amount || 0);
              const pDate = p.paymentDate || p.clientPaymentDate || p.confirmedDate || p.dueDate || "";
              const isOldYear = pDate.startsWith("2023") || pDate.startsWith("2022");
              if (!isOldYear) {
                rawPaymentsFromAsaas.push(p);
              }
            }
          }
        }
      } catch {}
    }
  }

  // 7. Processar e classificar todos os pagamentos brutos obtidos
  if (rawPaymentsFromAsaas.length > 0) {
    const uniqueAsaasPayments = new Map<string, any>();
    for (const p of rawPaymentsFromAsaas) {
      if (p && p.id && !uniqueAsaasPayments.has(p.id)) {
        uniqueAsaasPayments.set(p.id, p);
      }
    }

    // Separar em pagamentos de Setup e Mensalidade
    const asaasSetupList: any[] = [];
    const asaasMonthlyList: any[] = [];

    for (const p of uniqueAsaasPayments.values()) {
      const isReceived = p.status === "RECEIVED" || p.status === "CONFIRMED" || p.status === "RECEIVED_IN_CASH";
      const pVal = getAsaasPaymentRealAmount(p);
      const pDate = p.paymentDate || p.clientPaymentDate || p.confirmedDate || p.dueDate || new Date().toISOString().split("T")[0];
      const pDueDate = p.dueDate || pDate;
      const invoiceUrl = p.invoiceUrl || p.bankSlipUrl || "";

      const { isSetup, installmentNumber, totalInstallments, monthReference } = classifyAsaasPayment(
        p,
        leadData,
        setupCode,
        monthlyCode
      );

      const enriched = {
        ...p,
        isReceived,
        pVal,
        pDate,
        pDueDate,
        invoiceUrl,
        isSetup,
        installmentNumber,
        totalInstallments,
        monthReference
      };

      if (isSetup) {
        asaasSetupList.push(enriched);
      } else {
        asaasMonthlyList.push(enriched);
      }
    }

    // Ordenar pagamentos de Setup do Asaas
    asaasSetupList.sort((a, b) => {
      if (a.installmentNumber && b.installmentNumber) return a.installmentNumber - b.installmentNumber;
      const tA = new Date(a.pDate || a.pDueDate || 0).getTime();
      const tB = new Date(b.pDate || b.pDueDate || 0).getTime();
      return tA - tB;
    });

    // Montar lista de parcelas de Setup atualizadas (1..totalSetupInst)
    const newSetupPayments: any[] = [];
    let setupPaidCount = 0;
    let setupPaidAmount = 0;

    for (let i = 1; i <= totalSetupInst; i++) {
      // Procura pagamento com número de parcela exato OU o primeiro pagamento se houver apenas 1 pagamento avulso
      const matchedPay = asaasSetupList.find(p => p.installmentNumber === i) || (asaasSetupList.length === 1 && i === 1 ? asaasSetupList[0] : undefined);
      
      // Verificar se esta parcela já constava como PAGA no Firestore (baixa manual ou anterior)
      const existingInFirestore = (leadData.payments || []).find((p: any) => 
        p.type === "configuration" && (
          p.installmentNumber === i || 
          p.id === `setup_inst_${i}_${leadId}` ||
          (matchedPay && (p.id === matchedPay.id || p.asaasPaymentId === matchedPay.id))
        )
      );

      if (matchedPay && matchedPay.isReceived) {
        foundAny = true;
        setupPaidCount++;
        setupPaidAmount += matchedPay.pVal;
        foundDetails.push(`Parcela Setup #${i} de ${totalSetupInst} (R$ ${matchedPay.pVal}) PAGA em ${matchedPay.pDate}`);
        
        newSetupPayments.push({
          id: matchedPay.id || `setup_inst_${i}_${leadId}`,
          type: "configuration",
          dueDate: matchedPay.pDueDate || matchedPay.pDate,
          paidDate: matchedPay.pDate,
          amount: matchedPay.pVal || expectedInstVal,
          status: "paid",
          asaasPaymentId: matchedPay.id || "",
          invoiceUrl: matchedPay.invoiceUrl || "",
          installmentNumber: i,
          totalInstallments: totalSetupInst,
          commissionPaidToEgn: existingInFirestore?.commissionPaidToEgn || false,
          egnCommissionAmount: existingInFirestore?.egnCommissionAmount,
          egnRepassePaidDate: existingInFirestore?.egnRepassePaidDate,
          egnRepasseProofUrl: existingInFirestore?.egnRepasseProofUrl,
          egnRepasseProofName: existingInFirestore?.egnRepasseProofName,
          egnRepasseNotes: existingInFirestore?.egnRepasseNotes,
          egnRepasseBatchId: existingInFirestore?.egnRepasseBatchId
        });
      } else if (existingInFirestore && existingInFirestore.status === "paid") {
        // PRESERVAR baixa manual já realizada no app
        setupPaidCount++;
        setupPaidAmount += (Number(existingInFirestore.amount) || expectedInstVal);
        newSetupPayments.push({
          ...existingInFirestore,
          installmentNumber: i,
          totalInstallments: totalSetupInst,
          status: "paid"
        });
      } else if ((leadData.setupPaymentStatus === "paid" || leadData.configurationFeePaid === true) && (!existingInFirestore || existingInFirestore.status === "paid")) {
        setupPaidCount++;
        setupPaidAmount += (Number(existingInFirestore?.amount) || expectedInstVal);
        newSetupPayments.push({
          id: existingInFirestore?.id || `setup_inst_${i}_${leadId}`,
          type: "configuration",
          dueDate: existingInFirestore?.dueDate || new Date().toISOString().split("T")[0],
          paidDate: existingInFirestore?.paidDate || new Date().toISOString().split("T")[0],
          amount: existingInFirestore?.amount || expectedInstVal,
          status: "paid",
          installmentNumber: i,
          totalInstallments: totalSetupInst,
          commissionPaidToEgn: existingInFirestore?.commissionPaidToEgn || false,
          egnCommissionAmount: existingInFirestore?.egnCommissionAmount,
          egnRepassePaidDate: existingInFirestore?.egnRepassePaidDate,
          egnRepasseProofUrl: existingInFirestore?.egnRepasseProofUrl,
          egnRepasseProofName: existingInFirestore?.egnRepasseProofName,
          egnRepasseNotes: existingInFirestore?.egnRepasseNotes,
          egnRepasseBatchId: existingInFirestore?.egnRepasseBatchId
        });
      } else if (matchedPay && !matchedPay.isReceived && matchedPay.installment) {
        // Cobrança real de carnê/parcelamento pendente no Asaas
        newSetupPayments.push({
          id: matchedPay.id || `setup_inst_${i}_${leadId}`,
          type: "configuration",
          dueDate: matchedPay.pDueDate,
          amount: matchedPay.pVal || expectedInstVal,
          status: "pending",
          asaasPaymentId: matchedPay.id || "",
          invoiceUrl: matchedPay.invoiceUrl || "",
          installmentNumber: i,
          totalInstallments: totalSetupInst
        });
      } else {
        // Parcela pendente aguardando geração/pagamento futuro - SEM Asaas ID fantasma
        newSetupPayments.push({
          id: existingInFirestore?.id || `setup_inst_${i}_${leadId}`,
          type: "configuration",
          dueDate: existingInFirestore?.dueDate || new Date().toISOString().split("T")[0],
          amount: expectedInstVal,
          status: "pending",
          installmentNumber: i,
          totalInstallments: totalSetupInst
        });
      }
    }

    if (setupPaidCount >= totalSetupInst && totalSetupInst > 0) {
      setupStatus = "paid";
    } else if (setupPaidCount > 0) {
      setupStatus = "partial";
    } else {
      setupStatus = "pending";
    }

    // Processar Mensalidades com Deduplicação Rigorosa por Mês de Referência
    // Uma assinatura recorrente possui apenas 1 fatura por mês de competência
    const uniqueMonthlyByRef = new Map<string, any>();
    for (const mp of asaasMonthlyList) {
      const ref = mp.monthReference || (mp.pDueDate && mp.pDueDate.includes("-") ? `${mp.pDueDate.split("-")[1]}/${mp.pDueDate.split("-")[0]}` : "atual");
      const existing = uniqueMonthlyByRef.get(ref);
      if (!existing) {
        uniqueMonthlyByRef.set(ref, mp);
      } else {
        // Prioriza a fatura que estiver PAGA/QUITADA
        if (mp.isReceived && !existing.isReceived) {
          uniqueMonthlyByRef.set(ref, mp);
        } else if (!existing.invoiceUrl && mp.invoiceUrl) {
          uniqueMonthlyByRef.set(ref, mp);
        }
      }
    }

    const filteredMonthlyList = Array.from(uniqueMonthlyByRef.values());
    const newMonthlyPayments: any[] = [];
    let monthlyPaid = false;
    const now = new Date();
    const currentMonthYear = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

    // Separar mensalidades pagas e pendentes
    const paidMonthlies = filteredMonthlyList.filter(mp => mp.isReceived);
    const pendingMonthlies = filteredMonthlyList.filter(mp => !mp.isReceived);

    // Adiciona todas as mensalidades pagas
    for (const mp of paidMonthlies) {
      foundAny = true;
      monthlyPaid = true;
      foundDetails.push(`Mensalidade ${mp.monthReference || ""} (R$ ${mp.pVal}) PAGA em ${mp.pDate}`);
      
      const existingInFirestore = (leadData.payments || []).find((p: any) => 
        (p.id && (p.id === mp.id || p.asaasPaymentId === mp.id)) ||
        (p.type === "monthly" && mp.monthReference && p.monthReference === mp.monthReference) ||
        (p.type === "monthly" && p.paidDate && mp.pDate && p.paidDate.substring(0, 7) === mp.pDate.substring(0, 7)) ||
        (p.type === "monthly" && p.dueDate && mp.pDueDate && p.dueDate.substring(0, 7) === mp.pDueDate.substring(0, 7))
      );

      newMonthlyPayments.push({
        id: mp.id || existingInFirestore?.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        type: "monthly",
        dueDate: mp.pDueDate,
        paidDate: mp.pDate,
        amount: mp.pVal || existingInFirestore?.amount || monFee,
        status: "paid",
        asaasPaymentId: mp.id || "",
        invoiceUrl: mp.invoiceUrl || "",
        monthReference: mp.monthReference || "",
        commissionPaidToEgn: existingInFirestore?.commissionPaidToEgn || false,
        egnCommissionAmount: existingInFirestore?.egnCommissionAmount,
        egnRepassePaidDate: existingInFirestore?.egnRepassePaidDate,
        egnRepasseProofUrl: existingInFirestore?.egnRepasseProofUrl,
        egnRepasseProofName: existingInFirestore?.egnRepasseProofName,
        egnRepasseNotes: existingInFirestore?.egnRepasseNotes,
        egnRepasseBatchId: existingInFirestore?.egnRepasseBatchId
      });
    }

    // Se NÃO há mensalidade paga no ciclo atual, adiciona a cobrança pendente real do ciclo atual (se existir no Asaas)
    // Se a mensalidade do ciclo atual já estiver PAGA, não adiciona meses futuros como pendência
    if (pendingMonthlies.length > 0) {
      for (const mp of pendingMonthlies) {
        const isFutureMonth = mp.monthReference && mp.monthReference > currentMonthYear;
        // Se a fatura é de um mês futuro e o cliente já está em dia, não polui como pendência
        if (isFutureMonth && monthlyPaid) {
          continue;
        }
        // Se a fatura é do mês atual ou atrasada, registra
        newMonthlyPayments.push({
          id: mp.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          type: "monthly",
          dueDate: mp.pDueDate,
          amount: mp.pVal || monFee,
          status: "pending",
          asaasPaymentId: mp.id || "",
          invoiceUrl: mp.invoiceUrl || "",
          monthReference: mp.monthReference || ""
        });
      }
    }

    // Preservar mensalidades já quitadas no Firestore que não constam nessa query do Asaas
    const manualPaidMonthlies = (leadData.payments || []).filter((p: any) => 
      p.type === "monthly" && p.status === "paid" && !newMonthlyPayments.some((np: any) => 
        (np.monthReference && np.monthReference === p.monthReference) || 
        np.id === p.id ||
        (p.paidDate && np.paidDate && p.paidDate.substring(0, 7) === np.paidDate.substring(0, 7)) ||
        (p.dueDate && np.dueDate && p.dueDate.substring(0, 7) === np.dueDate.substring(0, 7))
      )
    );
    if (manualPaidMonthlies.length > 0) {
      newMonthlyPayments.push(...manualPaidMonthlies);
      monthlyPaid = true;
    }

    // Se não há mensalidades do Asaas verificadas para este cliente, preservar apenas parcelas manuais sem IDs de outros clientes
    if (newMonthlyPayments.length === 0) {
      const manualMonthlies = (leadData.payments || []).filter((p: any) => p.type === "monthly" && !p.asaasPaymentId && !String(p.id || "").startsWith("pay_"));
      if (manualMonthlies.length > 0) {
        newMonthlyPayments.push(...manualMonthlies);
      } else {
        newMonthlyPayments.push({
          id: `monthly_${leadId}`,
          type: "monthly",
          dueDate: new Date().toISOString().split("T")[0],
          amount: monFee || 0,
          status: leadData.monthlyPaymentStatus === "paid" ? "paid" : "pending",
          monthReference: ""
        });
      }
    }

    // Se não há cobrança/pagamento para o ciclo atual (mês vigente) e o cliente possui mensalidade ativa
    const hasCurrentMonthInAsaas = newMonthlyPayments.some((p: any) => {
      if (p.monthReference === currentMonthYear) return true;
      const pDate = p.dueDate || p.paidDate;
      if (pDate && pDate.includes("-")) {
        const parts = pDate.split("-");
        return `${parts[1]}/${parts[0]}` === currentMonthYear;
      }
      return false;
    });

    if (!hasCurrentMonthInAsaas && monFee > 0) {
      const manualCurrentMonth = (leadData.payments || []).find((p: any) => 
        p.type === "monthly" && (p.monthReference === currentMonthYear || (p.dueDate && p.dueDate.startsWith(currentMonthYear.split("/")[1] + "-" + currentMonthYear.split("/")[0])))
      );
      if (manualCurrentMonth) {
        newMonthlyPayments.push(manualCurrentMonth);
      } else {
        newMonthlyPayments.push({
          id: `monthly_${leadId}_${currentMonthYear.replace("/", "_")}`,
          type: "monthly",
          dueDate: `${currentMonthYear.split("/")[1]}-${currentMonthYear.split("/")[0]}-10`,
          amount: monFee,
          status: "pending",
          monthReference: currentMonthYear
        });
      }
    }

    // O status da mensalidade no documento deve refletir se o ciclo atual está quitado
    const currentMonthItem = newMonthlyPayments.find((p: any) => {
      if (p.monthReference === currentMonthYear) return true;
      const pDate = p.dueDate || p.paidDate;
      if (pDate && pDate.includes("-")) {
        const parts = pDate.split("-");
        return `${parts[1]}/${parts[0]}` === currentMonthYear;
      }
      return false;
    });

    if (currentMonthItem) {
      monthlyStatus = currentMonthItem.status === "paid" ? "paid" : "pending";
    } else {
      monthlyStatus = newMonthlyPayments.some((p: any) => p.status === "pending") ? "pending" : (newMonthlyPayments.some((p: any) => p.status === "paid") ? "paid" : "pending");
    }

    updatedPayments = [...newSetupPayments, ...newMonthlyPayments];
  }

  // 8. Recalcular Status de Setup e Mensalidade
  const setupPayments = updatedPayments.filter((p: any) => p.type === "configuration");
  const setupPaidPayments = setupPayments.filter((p: any) => p.status === "paid");
  const setupPaidAmount = setupPaidPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
  const setupTargetAmount = cfgFee > 0 ? cfgFee : setupPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

  if (setupTargetAmount > 0) {
    if (setupPaidAmount >= setupTargetAmount - 0.05 || (setupPayments.length > 0 && setupPaidPayments.length >= setupPayments.length)) {
      setupStatus = "paid";
    } else if (setupPaidAmount > 0 || setupPaidPayments.length > 0) {
      setupStatus = "partial";
    } else {
      setupStatus = "pending";
    }
  }

  const monthlyPayments = updatedPayments.filter((p: any) => p.type === "monthly");
  // Ordena por data de vencimento / cadastro decrescente (mais recente primeiro)
  const sortedMonthlies = [...monthlyPayments].sort((a: any, b: any) => {
    const tA = new Date(a.dueDate || a.paidDate || 0).getTime();
    const tB = new Date(b.dueDate || b.paidDate || 0).getTime();
    return tB - tA;
  });

  const latestMonthly = sortedMonthlies[0];
  if (latestMonthly) {
    monthlyStatus = latestMonthly.status === "paid" ? "paid" : "pending";
  } else {
    monthlyStatus = monthlyPayments.some((p: any) => p.status === "paid") ? "paid" : "pending";
  }

  // Determinar status financeiro consolidado
  let finalFinancialStatus: "CONFIRMADO" | "PAGO PARCIAL" | "PENDENTE" | "ATRASADO" = "PENDENTE";
  const hasSetup = (leadData.configurationFee && leadData.configurationFee > 0) || updatedPayments.some(p => p.type === "configuration");

  if (hasSetup) {
    if (setupStatus === "paid" && monthlyStatus === "paid") {
      finalFinancialStatus = "CONFIRMADO";
    } else if (setupStatus === "paid" || setupStatus === "partial" || monthlyStatus === "paid") {
      finalFinancialStatus = "PAGO PARCIAL";
    } else {
      finalFinancialStatus = "PENDENTE";
    }
  } else {
    finalFinancialStatus = monthlyStatus === "paid" ? "CONFIRMADO" : "PENDENTE";
  }

  // Purga de histórico e logs com resíduos antigos (2023, duplicatas de sincronização)
  const cleanHistory = (leadData.history || []).filter((h: any) => {
    const txt = h.text || "";
    if (txt.includes("2023")) return false;
    if (txt.includes("[Sincronização Asaas]")) return false; // remove logs duplicados automáticos
    return true;
  });

  const cleanLogs = (leadData.logs || []).filter((l: any) => {
    const act = l.action || "";
    if (act.includes("2023")) return false;
    if (act.includes("[Sincronização Asaas]") || act.includes("[Consulta Asaas]")) return false;
    return true;
  });

  const primeCustomerId = Array.from(verifiedCustomerIds)[0] || leadData.asaasCustomerId || "";
  const primeSubId = Array.from(discoveredSubIds)[0] || leadData.asaasSubscriptionId || "";

  const docUpdate: any = {
    setupPaymentStatus: setupStatus,
    configurationFeePaid: setupStatus === "paid",
    monthlyPaymentStatus: monthlyStatus,
    financialStatus: finalFinancialStatus,
    payments: updatedPayments,
    history: cleanHistory,
    logs: cleanLogs,
    updatedAt: new Date().toISOString()
  };

  if (primeCustomerId) {
    docUpdate.asaasCustomerId = primeCustomerId;
  }
  if (primeSubId) {
    docUpdate.asaasSubscriptionId = primeSubId;
  }

  if (foundAny && foundDetails.length > 0) {
    const logText = foundDetails.join("; ");
    docUpdate.history = [
      ...cleanHistory,
      {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        text: `[Sincronização Asaas] ${logText}`,
        type: "payment"
      }
    ];
    docUpdate.logs = [
      {
        action: `[Sincronização Asaas] ${logText}`,
        user: "Sistema / Sincronização",
        date: new Date().toLocaleString("pt-BR")
      },
      ...cleanLogs
    ];
  }

  const isSetupStatusChanged = (leadData.setupPaymentStatus || "pending") !== setupStatus;
  const isMonthlyStatusChanged = (leadData.monthlyPaymentStatus || "pending") !== monthlyStatus;
  const isFinancialStatusChanged = (leadData.financialStatus || "PENDENTE") !== finalFinancialStatus;
  const isCustomerChanged = Boolean(primeCustomerId && leadData.asaasCustomerId !== primeCustomerId);
  const isSubscriptionChanged = Boolean(primeSubId && leadData.asaasSubscriptionId !== primeSubId);
  const isPaymentsChanged = JSON.stringify(leadData.payments || []) !== JSON.stringify(updatedPayments || []);

  const hasRealChanges = isSetupStatusChanged || isMonthlyStatusChanged || isFinancialStatusChanged || isCustomerChanged || isSubscriptionChanged || isPaymentsChanged || (foundAny && foundDetails.length > 0);

  if (hasRealChanges) {
    await updateDoc(leadRef, sanitizeForFirestore(docUpdate));
  }

  return {
    success: true,
    found: foundAny,
    details: foundDetails,
    setupPaymentStatus: setupStatus,
    monthlyPaymentStatus: monthlyStatus,
    financialStatus: finalFinancialStatus,
    asaasCustomerId: primeCustomerId,
    asaasSubscriptionId: primeSubId,
    payments: updatedPayments
  };
}

app.post("/api/asaas/sync-client-status", async (req, res) => {
  try {
    const { leadId } = req.body || {};
    const customKey = (req.headers["x-asaas-key"] || "").toString().trim();
    if (!leadId) {
      return res.status(400).json({ error: "leadId obrigatório." });
    }

    const result = await syncLeadWithAsaas(leadId, null, customKey);
    return res.json(result);
  } catch (err: any) {
    console.error("[sync-client-status error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ROUTE DE SINCRONIZAÇÃO AUTOMÁTICA EM LOTE DE TODOS OS CLIENTES PENDENTES
app.post("/api/asaas/sync-all-pending", async (req, res) => {
  try {
    const customKey = (req.headers["x-asaas-key"] || "").toString().trim();
    const leadsRef = collection(dbStore, "leads");
    const allSnap = await getDocs(leadsRef);
    let updatedCount = 0;

    for (const docItem of allSnap.docs) {
      const data = docItem.data();
      const isSetupPaid = data.setupPaymentStatus === "paid" || data.configurationFeePaid;
      const isMonthlyPaid = data.monthlyPaymentStatus === "paid";
      const hasSetup = Boolean(data.configurationFee && data.configurationFee > 0);

      // Se já está 100% pago, não precisa reprocessar no loop de 20 segundos
      if (hasSetup ? (isSetupPaid && isMonthlyPaid) : isMonthlyPaid) {
        continue;
      }

      try {
        const syncResult = await syncLeadWithAsaas(docItem.id, data, customKey);
        if (syncResult.found) {
          updatedCount++;
        }
      } catch (clientErr: any) {
        console.warn(`[sync-all-pending] Erro ao sincronizar lead ${docItem.id}:`, clientErr.message);
      }
    }

    return res.json({ success: true, updatedCount });
  } catch (err: any) {
    console.error("[sync-all-pending error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ROUTE DE LIMPEZA E FAXINA PROFUNDA (Remove cobranças indevidas de todos os clientes)
app.post("/api/asaas/cleanup-all", async (req, res) => {
  try {
    const customKey = (req.headers["x-asaas-key"] || "").toString().trim();
    const leadsRef = collection(dbStore, "leads");
    const allSnap = await getDocs(leadsRef);
    let cleanedCount = 0;

    for (const docItem of allSnap.docs) {
      try {
        const data = docItem.data();
        const cfgFee = Number(data.configurationFee || 0);
        const monFee = Number(data.monthlyFee || 0);
        const totalSetupInst = Number(data.setupInstallments || (data.contractConfig?.setupInstallments) || (cfgFee > 0 ? 3 : 1));
        const expectedInstVal = totalSetupInst > 0 ? Math.round((cfgFee / totalSetupInst) * 100) / 100 : cfgFee;

        // Filtrar pagamentos válidos (remover apenas resíduos antigos de 2021-2023)
        const rawPayments = Array.isArray(data.payments) ? data.payments : [];
        const cleanPayments = rawPayments.filter(p => {
          const pDate = p.paidDate || p.dueDate || "";
          if (pDate.startsWith("2023") || pDate.startsWith("2022") || pDate.startsWith("2021")) return false;
          return Number(p.amount || p.value || 0) > 0;
        });

        // Limpar logs e history de 2021-2023
        const cleanHistory = (data.history || []).filter((h: any) => {
          const txt = h.text || "";
          if (txt.includes("2023") || txt.includes("2022") || txt.includes("2021")) return false;
          if (txt.includes("[Sincronização Asaas]")) return false;
          return true;
        });

        const cleanLogs = (data.logs || []).filter((l: any) => {
          const act = l.action || "";
          if (act.includes("2023") || act.includes("2022") || act.includes("2021")) return false;
          if (act.includes("[Sincronização Asaas]") || act.includes("[Consulta Asaas]")) return false;
          return true;
        });

        await updateDoc(doc(dbStore, "leads", docItem.id), {
          payments: cleanPayments,
          history: cleanHistory,
          logs: cleanLogs,
          updatedAt: new Date().toISOString()
        });

        await syncLeadWithAsaas(docItem.id, null, customKey);
        cleanedCount++;
      } catch (err: any) {
        console.warn(`[cleanup-all] Erro ao limpar lead ${docItem.id}:`, err.message);
      }
    }

    return res.json({ success: true, message: `Faxina concluída com sucesso em ${cleanedCount} clientes.`, cleanedCount });
  } catch (err: any) {
    console.error("[cleanup-all error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ROUTE DE WEBHOOK ASAAS (POST /api/webhooks/asaas E POST /api/asaas/webhook)
/**
 * WEBHOOK DE RECEBIMENTO DO ASAAS (/api/webhooks/asaas e /api/asaas/webhook)
 * 
 * O QUE RECEBE DE INFORMAÇÃO:
 * - Evento disparado pelo Asaas (ex: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, SUBSCRIPTION_DELETED)
 * - Identificadores: customer (ID do cliente no Asaas), subscription (ID da assinatura), id (ID do pagamento/fatura)
 * - Valores e datas: valor da transação (value), data de confirmação (paymentDate/confirmedDate), tipo de cobrança
 * 
 * O QUE ELE FAZ E GERA:
 * 1. Localiza o cliente no banco de dados (por asaasCustomerId, asaasSubscriptionId ou por consulta de CPF/E-mail no Asaas)
 * 2. Atualiza o status financeiro do cliente para "PAGO" (ou "ATRASADO" / "ESTORNADO" / "CANCELADO")
 * 3. Identifica se a quitação foi da Taxa de Setup (atualiza setupPaymentStatus = "paid") ou Mensalidade (monthlyPaymentStatus = "paid")
 * 4. Insere/Atualiza a fatura no array de pagamentos com a data de quitação e o ID do Asaas
 * 5. Registra o evento de pagamento no histórico de auditoria do cliente
 */
async function handleAsaasWebhook(req: express.Request, res: express.Response) {
  try {
    // 1. CONFIGURAÇÃO E VALIDAÇÃO DE SEGURANÇA
    const asaasToken = req.headers["asaas-access-token"] || req.headers["x-asaas-token"];
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET || process.env.ASAAS_WEBHOOK_TOKEN;

    if (webhookSecret && asaasToken && asaasToken !== webhookSecret) {
      console.warn("[Asaas Webhook] Token de webhook não autorizado recebido:", asaasToken);
      return res.status(401).json({ error: "Token de webhook não autorizado." });
    }

    const { event, payment, subscription } = req.body || {};

    if (!event) {
      console.warn("[Asaas Webhook] Payload sem evento recebido.");
      return res.status(200).json({ received: true, message: "Payload sem evento. Ignorado." });
    }

    // 2. ESTRUTURA E EXTRAÇÃO DE DADOS DO ASAAS
    const customerId = payment?.customer || subscription?.customer || req.body?.customer;
    const subscriptionId = payment?.subscription || subscription?.id || req.body?.subscription;
    const paymentId = payment?.id;
    const externalRef = payment?.externalReference || subscription?.externalReference || req.body?.externalReference || "";
    const value = payment?.value || subscription?.value || 0;
    const description = payment?.description || subscription?.description || "";
    const paymentDate = payment?.paymentDate || payment?.clientPaymentDate || payment?.confirmedDate || new Date().toISOString().split("T")[0];
    const paymentLinkRaw = payment?.paymentLink || "";
    const invoiceUrlRaw = payment?.invoiceUrl || subscription?.invoiceUrl || "";
    const bankSlipUrlRaw = payment?.bankSlipUrl || subscription?.bankSlipUrl || "";

    console.log(`[Asaas Webhook] Evento: '${event}' | Customer: ${customerId} | Sub: ${subscriptionId} | Pay: ${paymentId} | ExtRef: ${externalRef} | Valor: R$ ${value}`);

    // 3. LOCALIZAR REGISTRO DO CLIENTE NO FIRESTORE COM MÚLTIPLAS ESTRATÉGIAS
    const leadsRef = collection(dbStore, "leads");
    let targetDoc: any = null;

    // Estratégia 0: Busca por External Reference (se foi enviado o ID do lead ou slug)
    if (externalRef) {
      const qExt = query(leadsRef, where("__name__", "==", externalRef), limit(1));
      const extSnap = await getDocs(qExt);
      if (!extSnap.empty) {
        targetDoc = extSnap.docs[0];
      } else {
        const qSlug = query(leadsRef, where("contractSlug", "==", externalRef), limit(1));
        const slugSnap = await getDocs(qSlug);
        if (!slugSnap.empty) {
          targetDoc = slugSnap.docs[0];
        }
      }
    }

    // Estratégia 1: Busca por ID da Assinatura no Asaas
    if (!targetDoc && subscriptionId) {
      const qSub = query(leadsRef, where("asaasSubscriptionId", "==", subscriptionId), limit(1));
      const subSnap = await getDocs(qSub);
      if (!subSnap.empty) {
        targetDoc = subSnap.docs[0];
      }
    }

    // Estratégia 2: Busca por ID do Cliente no Asaas
    if (!targetDoc && customerId) {
      const qCust = query(leadsRef, where("asaasCustomerId", "==", customerId), limit(1));
      const custSnap = await getDocs(qCust);
      if (!custSnap.empty) {
        targetDoc = custSnap.docs[0];
      }
    }

    // Estratégia 3: Consulta API Asaas para obter CPF/CNPJ, Nome Completo e E-mail de quem realizou o pagamento
    if (!targetDoc && (customerId || paymentId)) {
      const isSandboxRequest = (invoiceUrlRaw + bankSlipUrlRaw).includes("sandbox") || (process.env.ASAAS_ENV || "").toLowerCase() === "sandbox";
      const environmentsToTry = isSandboxRequest ? ["sandbox", "production"] : ["production", "sandbox"];
      const creds = getAsaasKeyAndEnv("", isSandboxRequest ? "sandbox" : "production");
      const keysToTry = [creds.apiKey, creds.prodKey, creds.sandboxKey].filter(Boolean);

      let fetchedCpfCnpj = "";
      let fetchedEmail = "";
      let fetchedName = "";

      for (const envAttempt of environmentsToTry) {
        for (const currentKey of keysToTry) {
          if (fetchedCpfCnpj || fetchedEmail || fetchedName) break;
          try {
            // 1. Tenta buscar dados do cliente
            if (customerId) {
              const asaasCustRes = await fetchAsaas(`/customers/${customerId}`, "GET", null, currentKey, envAttempt);
              if (asaasCustRes.ok) {
                const custData: any = await asaasCustRes.json().catch(() => ({}));
                if (custData && custData.id) {
                  fetchedCpfCnpj = onlyDigits(custData.cpfCnpj || "");
                  fetchedEmail = (custData.email || "").toLowerCase().trim();
                  fetchedName = (custData.name || "").trim();
                }
              }
            }

            // 2. Se não veio pelo customer, tenta buscar direto pelo pagamento
            if ((!fetchedCpfCnpj && !fetchedName) && paymentId) {
              const asaasPayRes = await fetchAsaas(`/payments/${paymentId}`, "GET", null, currentKey, envAttempt);
              if (asaasPayRes.ok) {
                const payData: any = await asaasPayRes.json().catch(() => ({}));
                if (payData.customer && !customerId) {
                  const payCustRes = await fetchAsaas(`/customers/${payData.customer}`, "GET", null, currentKey, envAttempt);
                  if (payCustRes.ok) {
                    const cData: any = await payCustRes.json().catch(() => ({}));
                    fetchedCpfCnpj = onlyDigits(cData.cpfCnpj || "");
                    fetchedEmail = (cData.email || "").toLowerCase().trim();
                    fetchedName = (cData.name || "").trim();
                  }
                }
              }
            }
          } catch (fetchErr: any) {
            console.warn(`[Asaas Webhook] Consulta Asaas API no ${envAttempt}:`, fetchErr.message);
          }
        }
        if (fetchedCpfCnpj || fetchedEmail || fetchedName) break;
      }

      console.log(`[Asaas Webhook] Dados obtidos do Asaas -> CPF/CNPJ: '${fetchedCpfCnpj}' | Nome: '${fetchedName}' | Email: '${fetchedEmail}'`);

      // Realiza a varredura e cruzamento com os clientes cadastrados
      const allLeadsSnap = await getDocs(leadsRef);
      const cleanAsaasCpf = onlyDigits(fetchedCpfCnpj);
      const normAsaasName = normalizeStr(fetchedName);

      for (const ld of allLeadsSnap.docs) {
        const lData = ld.data();
        
        // 3.1 Cruzamento por CPF / CNPJ do Contratante (PRIORIDADE MÁXIMA)
        if (cleanAsaasCpf && cleanAsaasCpf.length >= 8) {
          const leadCpfs = [
            onlyDigits(lData.contractData?.document || ""),
            onlyDigits(lData.contractConfig?.clientDoc || ""),
            onlyDigits(lData.document || ""),
            onlyDigits(lData.cpf || ""),
            onlyDigits(lData.cnpj || ""),
            onlyDigits(lData.cpfCnpj || "")
          ].filter(d => d && d.length >= 8);

          if (leadCpfs.includes(cleanAsaasCpf)) {
            console.log(`[Asaas Webhook] Reconhecido com sucesso pelo CPF/CNPJ: ${cleanAsaasCpf} -> Lead: ${lData.name}`);
            targetDoc = ld;
            break;
          }
        }

        // 3.2 Cruzamento por Nome do Contratante (Fallback caso CPF não tenha sido informado no Asaas)
        if (!targetDoc && normAsaasName && normAsaasName.length >= 4) {
          const leadName1 = normalizeStr(lData.name || "");
          const leadName2 = normalizeStr(lData.contractData?.fullName || "");
          const leadName3 = normalizeStr(lData.contractConfig?.clientName || "");

          if (
            (leadName1 && (leadName1 === normAsaasName || leadName1.includes(normAsaasName) || normAsaasName.includes(leadName1))) ||
            (leadName2 && (leadName2 === normAsaasName || leadName2.includes(normAsaasName) || normAsaasName.includes(leadName2))) ||
            (leadName3 && (leadName3 === normAsaasName || leadName3.includes(normAsaasName) || normAsaasName.includes(leadName3)))
          ) {
            console.log(`[Asaas Webhook] Reconhecido com sucesso pelo Nome: ${fetchedName} -> Lead: ${lData.name}`);
            targetDoc = ld;
            break;
          }
        }

        // 3.3 Cruzamento por E-mail do Contratante
        if (!targetDoc && fetchedEmail && fetchedEmail.includes("@")) {
          const leadEmail1 = (lData.email || "").toLowerCase().trim();
          const leadEmail2 = (lData.contractConfig?.clientEmail || "").toLowerCase().trim();
          const leadEmail3 = (lData.contractData?.email || "").toLowerCase().trim();

          if (
            (leadEmail1 && leadEmail1 === fetchedEmail) ||
            (leadEmail2 && leadEmail2 === fetchedEmail) ||
            (leadEmail3 && leadEmail3 === fetchedEmail)
          ) {
            console.log(`[Asaas Webhook] Reconhecido com sucesso pelo E-mail: ${fetchedEmail} -> Lead: ${lData.name}`);
            targetDoc = ld;
            break;
          }
        }
      }
    }

    if (!targetDoc) {
      console.warn(`[Asaas Webhook] Nenhum lead/cliente localizado para Customer: ${customerId} / Sub: ${subscriptionId} / Link: ${paymentLinkRaw}`);
      return res.status(200).json({ received: true, message: "Cliente não localizado no banco de dados. Notificação registrada com sucesso." });
    }

    const clientData = targetDoc.data();
    const clientPayments = [...(clientData.payments || [])];
    const clientHistory = [...(clientData.history || [])];

    let financialStatusToSet = clientData.financialStatus || "PENDENTE";
    let generalStatusToSet = clientData.status;
    let setupPaymentStatusToSet = clientData.setupPaymentStatus || "pending";
    let monthlyPaymentStatusToSet = clientData.monthlyPaymentStatus || "pending";
    let logText = "";

    // 4. IDENTIFICAR SE É SETUP OU MENSALIDADE
    const sLinkLower = (clientData.setupPaymentLink || "").toLowerCase();
    const mLinkLower = (clientData.monthlyPaymentLink || "").toLowerCase();
    const extractCode = (link: string) => {
      if (!link) return "";
      const match = link.match(/\/(?:c|i)\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : link.replace(/https?:\/\/[^\/]+\/(c|i)\//g, "").trim();
    };
    const setupCode = extractCode(sLinkLower);
    const monthlyCode = extractCode(mLinkLower);

    const classification = classifyAsaasPayment(
      {
        description: description,
        value: value,
        subscription: subscriptionId,
        id: paymentId,
        paymentLink: paymentLinkRaw,
        invoiceUrl: invoiceUrlRaw,
        dueDate: payment?.dueDate,
        paymentDate: paymentDate,
        installmentNumber: payment?.installmentNumber,
        totalInstallments: payment?.totalInstallments,
        installment: payment?.installment
      },
      clientData,
      setupCode,
      monthlyCode
    );

    const isSetupPayment = classification.isSetup;
    const isMonthlyPayment = classification.isMonthly;
    const installmentNumber = classification.installmentNumber;
    const totalInstallments = classification.totalInstallments;
    const monthReference = classification.monthReference;

    // 5. TRATAMENTO DOS EVENTOS E ATUALIZAÇÃO DOS STATUS
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const targetPaymentId = paymentId || `pay_${Date.now()}`;
      
      let resolvedInstNum = installmentNumber;
      if (isSetupPayment && (!resolvedInstNum || resolvedInstNum === 0)) {
        // Encontrar a primeira parcela de setup pendente
        const firstPending = clientPayments.find((p: any) => p.type === "configuration" && p.status !== "paid");
        if (firstPending && firstPending.installmentNumber) {
          resolvedInstNum = firstPending.installmentNumber;
        } else {
          const paidCount = clientPayments.filter((p: any) => p.type === "configuration" && p.status === "paid").length;
          resolvedInstNum = paidCount + 1;
        }
      }

      const pIdx = clientPayments.findIndex((p: any) => 
        (paymentId && (p.asaasPaymentId === paymentId || p.id === paymentId)) ||
        (isSetupPayment && p.type === "configuration" && p.installmentNumber && p.installmentNumber === resolvedInstNum)
      );

      if (pIdx !== -1) {
        clientPayments[pIdx] = {
          ...clientPayments[pIdx],
          status: "paid",
          paidDate: paymentDate,
          asaasPaymentId: paymentId || clientPayments[pIdx].asaasPaymentId || "",
          amount: value || clientPayments[pIdx].amount,
          installmentNumber: resolvedInstNum || clientPayments[pIdx].installmentNumber,
          totalInstallments: totalInstallments || clientPayments[pIdx].totalInstallments,
          monthReference: monthReference || clientPayments[pIdx].monthReference
        };
      } else {
        clientPayments.push({
          id: targetPaymentId,
          type: isSetupPayment ? "configuration" : "monthly",
          dueDate: payment?.dueDate || paymentDate,
          amount: value,
          status: "paid",
          asaasPaymentId: paymentId || "",
          asaasSubscriptionId: subscriptionId || "",
          paidDate: paymentDate,
          installmentNumber: isSetupPayment ? (resolvedInstNum || 1) : undefined,
          totalInstallments: isSetupPayment ? (totalInstallments || 3) : undefined,
          monthReference: monthReference
        });
      }

      // Recalcular setup status
      const totalSetupFee = Number(clientData.configurationFee || 0);
      const setupPayments = clientPayments.filter((p: any) => p.type === "configuration");
      const setupPaidPayments = setupPayments.filter((p: any) => p.status === "paid");
      const setupPaidAmount = setupPaidPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const setupTargetAmount = totalSetupFee > 0 ? totalSetupFee : setupPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);

      if (setupTargetAmount > 0) {
        if (setupPaidAmount >= setupTargetAmount - 0.05) {
          setupPaymentStatusToSet = "paid";
        } else if (setupPaidAmount > 0 || setupPaidPayments.length > 0) {
          setupPaymentStatusToSet = "partial";
        } else {
          setupPaymentStatusToSet = "pending";
        }
      }

      const monthlyPayments = clientPayments.filter((p: any) => p.type === "monthly");
      const sortedMonthlies = [...monthlyPayments].sort((a: any, b: any) => {
        const tA = new Date(a.dueDate || a.paidDate || 0).getTime();
        const tB = new Date(b.dueDate || b.paidDate || 0).getTime();
        return tB - tA;
      });
      const latestMonthly = sortedMonthlies[0];
      if (latestMonthly) {
        monthlyPaymentStatusToSet = latestMonthly.status === "paid" ? "paid" : "pending";
      } else {
        monthlyPaymentStatusToSet = monthlyPayments.some((p: any) => p.status === "paid") ? "paid" : "pending";
      }

      if (isSetupPayment) {
        logText = `Parcela Setup #${installmentNumber || 1} de R$ ${value.toFixed(2)} CONFIRMADA no Asaas em ${paymentDate}.`;
      } else {
        logText = `Mensalidade ${monthReference || ""} de R$ ${value.toFixed(2)} CONFIRMADA no Asaas em ${paymentDate}.`;
      }

      // Calcula status financeiro global
      const hasSetup = totalSetupFee > 0 || setupPayments.length > 0;
      if (hasSetup) {
        if (setupPaymentStatusToSet === "paid" && monthlyPaymentStatusToSet === "paid") {
          financialStatusToSet = "CONFIRMADO";
        } else if (setupPaymentStatusToSet === "partial" || setupPaymentStatusToSet === "paid" || monthlyPaymentStatusToSet === "paid") {
          financialStatusToSet = "PAGO PARCIAL";
        } else {
          financialStatusToSet = "PENDENTE";
        }
      } else {
        financialStatusToSet = monthlyPaymentStatusToSet === "paid" ? "CONFIRMADO" : "PENDENTE";
      }
    }
    else if (event === "PAYMENT_OVERDUE") {
      financialStatusToSet = "ATRASADO";
      logText = `Cobrança de R$ ${value.toFixed(2)} marcada como VENCIDA/ATRASADA no Asaas. Status financeiro alterado para ATRASADO.`;

      if (paymentId) {
        const pIdx = clientPayments.findIndex((p: any) => p.asaasPaymentId === paymentId || p.id === paymentId);
        if (pIdx !== -1) {
          clientPayments[pIdx].status = "overdue";
        }
      }
    }
    else if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
      financialStatusToSet = "PENDENTE";
      logText = `Pagamento de R$ ${value.toFixed(2)} foi ESTORNADO/CONTESTADO no Asaas.`;

      if (isSetupPayment) setupPaymentStatusToSet = "pending";
      if (isMonthlyPayment) monthlyPaymentStatusToSet = "pending";

      if (paymentId) {
        const pIdx = clientPayments.findIndex((p: any) => p.asaasPaymentId === paymentId || p.id === paymentId);
        if (pIdx !== -1) {
          clientPayments[pIdx].status = "refunded";
        }
      }
    }
    else if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_DISABLED") {
      generalStatusToSet = "CANCELADO";
      financialStatusToSet = "CANCELADO";
      logText = `Assinatura recorrente foi CANCELADA no Asaas. Status do cliente alterado para CANCELADO.`;
    } else {
      logText = `Notificação do Asaas recebida: evento '${event}' para valor de R$ ${value.toFixed(2)}.`;
    }

    // 6. REGISTRO NO HISTÓRICO DE AUDITORIA
    clientHistory.push({
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString(),
      text: `[Webhook Asaas] ${logText}`,
      type: "payment"
    });

    const updateData: any = {
      financialStatus: financialStatusToSet,
      setupPaymentStatus: setupPaymentStatusToSet,
      monthlyPaymentStatus: monthlyPaymentStatusToSet,
      configurationFeePaid: setupPaymentStatusToSet === "paid",
      payments: clientPayments,
      history: clientHistory,
      lastPaymentDate: (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") ? paymentDate : clientData.lastPaymentDate || "",
      updatedAt: new Date().toISOString()
    };

    // Salvar referências do Asaas no Lead se ainda não existirem
    if (customerId && !clientData.asaasCustomerId) {
      updateData.asaasCustomerId = customerId;
    }
    if (subscriptionId && !clientData.asaasSubscriptionId) {
      updateData.asaasSubscriptionId = subscriptionId;
    }
    if (generalStatusToSet) {
      updateData.status = generalStatusToSet;
    }

    await updateDoc(targetDoc.ref, sanitizeForFirestore(updateData));

    console.log(`[Asaas Webhook Sucesso] Lead/Cliente '${clientData.name}' atualizado com sucesso! Status Financeiro: ${financialStatusToSet} | Setup: ${setupPaymentStatusToSet} | Mensalidade: ${monthlyPaymentStatusToSet}`);

    return res.status(200).json({ received: true, success: true });
  } catch (err: any) {
    console.error("[Asaas Webhook Critical Error]:", err);
    return res.status(200).json({ received: true, error: err.message });
  }
}

app.all("/api/webhooks/asaas", handleAsaasWebhook);
app.all("/api/asaas/webhook", handleAsaasWebhook);
app.all("/api/asaas/webhooks", handleAsaasWebhook);
app.all("/api/webhook", handleAsaasWebhook);
app.all("/api/webhooks", handleAsaasWebhook);
app.all("/webhooks/asaas", handleAsaasWebhook);
app.all("/asaas/webhook", handleAsaasWebhook);
app.all("/webhook", handleAsaasWebhook);

// Setup Vite or Static File Serving for local/container dev
async function startServer() {
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (vErr: any) {
        console.warn("Vite middleware error:", vErr.message);
      }
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[EBC/EGN Proxy] Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
