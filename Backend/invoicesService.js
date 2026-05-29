const axios = require("axios");
const crypto = require("crypto");
const forge = require("node-forge");

async function fetchAllInvoices(client) {
  const allInvoices = [];

  const ranges = [
    { from: "2026-01-01T00:00:00.000Z", to: "2026-03-31T23:59:59.000Z" }, //ISO 8601
    { from: "2026-04-01T00:00:00.000Z", to: "2026-06-30T23:59:59.000Z" },
    { from: "2026-07-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z" },
    { from: "2026-10-01T00:00:00.000Z", to: "2026-12-31T23:59:59.000Z" },
  ];

  for (const range of ranges) {
    let pageOffset = 0;
    const pageSize = 10;

    while (true) {
      const body = {
        pageSize,
        pageOffset,
        subjectType: "subject1",
        dateRange: {
          dateType: "issue",
          from: range.from,
          to: range.to,
        },
      };

      const response = await client.post("/invoices/query/metadata", body);
      const data = response.data;
      const invoices = data.invoices ?? [];

      allInvoices.push(...invoices);

      if (invoices.length < pageSize) break;
      pageOffset += pageSize;
    }
  }

  console.log(`found: ${allInvoices.length} invoices`);
  return allInvoices;
}

async function sendInvoice(baseUrl, accessToken, xmlBuffer) {
  const certsRes = await axios.get(
    `${baseUrl}/security/public-key-certificates`,
  );
  const invoiceCert = certsRes.data.find((c) =>
    c.usage.includes("SymmetricKeyEncryption"),
  );

  const { encryptedContent, encryptedKey, iv } = encryptInvoice(
    xmlBuffer,
    invoiceCert,
  );

  const encryptedBytes = Buffer.from(encryptedContent, "base64");

  const invoiceHashBase64 = crypto
    .createHash("sha256")
    .update(xmlBuffer)
    .digest("base64");
  const encryptedHashBase64 = crypto
    .createHash("sha256")
    .update(encryptedBytes)
    .digest("base64");

  let sessionRes;
  try {
    sessionRes = await axios.post(
      `${baseUrl}/sessions/online`,
      {
        formCode: { systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA" },
        encryption: {
          encryptedSymmetricKey: encryptedKey,
          initializationVector: iv,
          publicKeyId: invoiceCert.publicKeyId,
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    console.log("FULL SESSION RES:", JSON.stringify(sessionRes.data, null, 2));
  } catch (err) {
    console.log("SESSION OPEN ERROR STATUS:", err.response?.status);
    console.log(
      "SESSION OPEN ERROR BODY:",
      JSON.stringify(err.response?.data, null, 2),
    );
    throw err;
  }
  const { referenceNumber, sessionToken } = sessionRes.data;
  console.log("Session opened:", referenceNumber);

  const payload = {
    invoiceHash: invoiceHashBase64, // plain base64 string
    invoiceSize: xmlBuffer.length, // original XML byte size
    encryptedInvoiceHash: encryptedHashBase64, // hash of encrypted bytes
    encryptedInvoiceSize: encryptedBytes.length, // encrypted byte size
    encryptedInvoiceContent: encryptedContent, // base64 encrypted body
  };

  console.log(
    "INVOICE PAYLOAD:",
    JSON.stringify(
      { ...payload, encryptedInvoiceContent: "[omitted]" },
      null,
      2,
    ),
  );

  const sendRes = await axios.post(
    `${baseUrl}/sessions/online/${referenceNumber}/invoices`,
    payload,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  console.log("FULL SESSION RES:", JSON.stringify(sessionRes.data, null, 2));
  await axios.post(
    `${baseUrl}/sessions/online/${referenceNumber}/close`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  return {
    sessionReferenceNumber: referenceNumber,
    invoiceReferenceNumber: sendRes.data.referenceNumber,
  };
}
async function waitForInvoiceProcessed(
  baseUrl,
  accessToken,
  sessionReferenceNumber,
  invoiceReferenceNumber,
  maxAttempts = 10,
) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const res = await axios.get(
      `${baseUrl}/sessions/${sessionReferenceNumber}/invoices/${invoiceReferenceNumber}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    console.log(
      `[${i + 1}/${maxAttempts}] Status:`,
      JSON.stringify(res.data, null, 2),
    );

    const code = res.data.processingCode;
    if (code === 200) {
      console.log(
        "accepted, ksefReferenceNumber:",
        res.data.ksefReferenceNumber,
      );
      return res.data;
    }
    if (code >= 400) {
      console.error("rejected:", res.data);
      throw new Error(`invoice rejected: code ${code}`);
    }
  }
  throw new Error("timeout");
}

function encryptInvoice(xmlBuffer, cert) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  const encryptedContent = Buffer.concat([
    cipher.update(xmlBuffer),
    cipher.final(),
  ]);

  const derBytes = forge.util.decode64(cert.certificate);
  const asn1 = forge.asn1.fromDer(derBytes);
  const forgeCert = forge.pki.certificateFromAsn1(asn1);

  const encryptedKey = forgeCert.publicKey.encrypt(
    forge.util.createBuffer(aesKey).getBytes(),
    "RSA-OAEP",
    { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } },
  );

  return {
    encryptedContent: encryptedContent.toString("base64"),
    encryptedKey: forge.util.encode64(encryptedKey),
    iv: iv.toString("base64"),
    publicKeyId: cert.publicKeyId,
  };
}

module.exports = {
  fetchAllInvoices,
  sendInvoice,
  waitForInvoiceProcessed,
};
