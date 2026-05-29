require("dotenv").config();
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const {
  sendInvoice,
  waitForInvoiceProcessed,
  fetchAllInvoices,
} = require("./invoicesService");

const { getChallenge, authByToken } = require("./auth");

const { createKsefClient } = require("./ksefClient");

const BASE_URL = "https://api-test.ksef.mf.gov.pl/v2";
const KSEF_TOKEN =
  "20260514-EC-238C7A7000-D27AFFD57D-66|nip-9571118171|20d5a343ce3443d79e46aad66caf3883d7a1a9408be847af9b959333cb98dad4";
console.log("KSEF TOKEN:", KSEF_TOKEN);

app.post("/invoices", async (req, res) => {
  console.log("=================================");
  console.log("INVOICES REQUEST");
  console.log("=================================");
  const response = await main();
  console.log("SENDING RESPONSE", response);
  res.json(response);
});

app.post("/sendInvoice", async (req, res) => {
  console.log("=================================");
  console.log("SEND INVOICE REQUEST");
  console.log("=================================");
  const { xmlBuffer } = req.body;

  const xmlBuf = Buffer.from(xmlBuffer, "utf8");

  const response = await main(true, xmlBuf);
  res.json(response);
});
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

async function main(sendingInvoice = false, xmlBuffer) {
  try {
    console.log("START KSEF FLOW");
    console.log("=================================");

    const challenge = await getChallenge(BASE_URL);
    console.log("CHALLENGE RECEIVED");
    const authResult = await authByToken(BASE_URL, challenge, KSEF_TOKEN);
    // authResult = { referenceNumber: "...", authenticationToken: { token: "..." } }

    const { referenceNumber, authenticationToken } = authResult;

    await waitForAuth(BASE_URL, referenceNumber, authenticationToken.token);

    const accessToken = await redeemToken(BASE_URL, authenticationToken.token);
    console.log("Authorization successful. Access token received.");

    const client = createKsefClient(accessToken, BASE_URL);
    console.log("KSEF CLIENT CREATED");
    if (!sendingInvoice) {
      console.log("=================================");
      console.log("CLIENT READY", client);
      console.log("=================================");
      console.log("FETCH INVOICES");

      const response = await fetchAllInvoices(client);

      console.log("INVOICES:");
      console.log(response);
      return response;
    } else {
      console.log("=================================");
      console.log("SENDING INVOICE");
      console.log("=================================");

      const { sessionReferenceNumber, invoiceReferenceNumber } =
        await sendInvoice(BASE_URL, accessToken, xmlBuffer);

      const status = await waitForInvoiceProcessed(
        BASE_URL,
        accessToken,
        sessionReferenceNumber,
        invoiceReferenceNumber,
      );
      console.log("FINAL STATUS:", status);
      return status;
    }
  } catch (error) {
    if (error.response) {
      console.log("error status", error.response.status);
      console.log("body error", JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function waitForAuth(baseUrl, referenceNumber, authenticationToken) {
  for (let i = 0; i < 10; i++) {
    const res = await axios.get(`${baseUrl}/auth/${referenceNumber}`, {
      headers: { Authorization: `Bearer ${authenticationToken}` },
    });

    const statusCode = res.data?.status?.code;
    console.log(`Attempt ${i + 1}: status.code = ${statusCode}`);

    if (statusCode === 200) {
      console.log("auth confirmed");
      return true;
    }

    if (statusCode >= 400) {
      throw new Error(
        `Auth failed with code ${statusCode}: ${res.data?.status?.description}`,
      );
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error("auth timeout");
}
async function redeemToken(baseUrl, authenticationToken) {
  console.log("=================================");
  console.log("REDEEM TOKEN");
  console.log("=================================");

  const res = await axios.post(
    `${baseUrl}/auth/token/redeem`,
    {},
    {
      headers: { Authorization: `Bearer ${authenticationToken}` },
    },
  );

  console.log("REDEEM RESPONSE:", JSON.stringify(res.data, null, 2));
  console.log("FULL REDEEM RESPONSE:", JSON.stringify(res.data, null, 2));
  return res.data.accessToken.token;
}
