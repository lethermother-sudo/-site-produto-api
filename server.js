const Fastify = require("fastify");
const cors = require("@fastify/cors");
require("dotenv").config();

const app = Fastify({
  logger: true
});

app.register(cors, {
  origin: true
});

// ================================
// HEALTH CHECK
// ================================
app.get("/", async () => {
  return {
    status: "online",
    service: "site-produto-api"
  };
});

// ================================
// CRIAR PIX
// ================================
app.post("/api/create-pix", async (request, reply) => {
  try {
    const { name, document, phone, email } = request.body || {};

    if (!name || !document || !phone || !email) {
      return reply.code(400).send({
        success: false,
        message: "Nome, CPF/CNPJ, telefone e e-mail são obrigatórios."
      });
    }

    const amount = Number(process.env.PRODUCT_PRICE);

    if (!amount || amount <= 0) {
      return reply.code(500).send({
        success: false,
        message: "PRODUCT_PRICE não configurado no servidor."
      });
    }

    const externalReference =
      `pedido-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const response = await fetch(
      "https://api.orbitpagamentos.com/v2/transactions/",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.ORBIT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          provider: "v2",
          method: "pix",

          customer: {
            name,
            document: String(document).replace(/\D/g, ""),
            phone: String(phone).replace(/\D/g, ""),
            email
          },

          externalReference,

          productName:
            process.env.PRODUCT_NAME || "Seu Produto",

          postBackUrl:
            `${process.env.PUBLIC_API_URL}/webhook/orbit`
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      request.log.error({
        status: response.status,
        orbit: data
      });

      return reply.code(response.status).send({
        success: false,
        message: data.message || "Erro ao criar cobrança na Orbit.",
        orbit: data
      });
    }

    return reply.send({
      success: true,
      paymentCode: data.paymentCode,
      idTransaction: data.idTransaction,
      externalReference
    });

  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      message: "Erro interno ao criar pagamento."
    });
  }
});

// ================================
// CONSULTAR PIX
// ================================
app.get("/api/check-pix/:transactionId", async (request, reply) => {
  try {
    const { transactionId } = request.params;

    const url =
      `https://api.orbitpagamentos.com/v2/transactions/me/?transactionId=${encodeURIComponent(transactionId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.ORBIT_API_KEY}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return reply.code(response.status).send({
        success: false,
        orbit: data
      });
    }

    return reply.send({
      success: true,
      transaction: data
    });

  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      message: "Erro ao consultar pagamento."
    });
  }
});

// ================================
// WEBHOOK ORBIT
// ================================
app.post("/webhook/orbit", async (request, reply) => {
  try {
    const data = request.body || {};

    request.log.info({
      message: "Webhook recebido da Orbit",
      data
    });

    // Por enquanto apenas confirmamos o recebimento.
    // Na próxima etapa vamos ligar isso ao pedido/entrega.

    return reply.code(200).send({
      received: true
    });

  } catch (error) {
    request.log.error(error);

    return reply.code(200).send({
      received: true
    });
  }
});

// ================================
// INICIAR SERVIDOR
// ================================
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

app.listen({
  port: PORT,
  host: HOST
})
.then(() => {
  console.log(`Servidor rodando na porta ${PORT}`);
})
.catch((error) => {
  app.log.error(error);
  process.exit(1);
});
