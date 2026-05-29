const axios = require("axios");
const crypto = require("crypto");
const forge = require("node-forge");

async function getChallenge(baseUrl) {
  try {
    console.log("=================================");
    console.log("GET CHALLENGE");
    console.log("=================================");

    const response = await axios.post(`${baseUrl}/auth/challenge`); // ✅

    console.log("CHALLENGE RESPONSE:");
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.log("GET CHALLENGE ERROR");
    if (error.response) {
      console.log(error.response.data);
    } else {
      console.log(error.message);
    }
    throw error;
  }
}

async function authByToken(baseUrl, challengeResponse, rawKsefToken) {
  try {
    // klucz dla szyfru
    const certsRes = await axios.get(
      `${baseUrl}/security/public-key-certificates`,
    );
    const tokenCert = certsRes.data.find((c) =>
      c.usage.includes("KsefTokenEncryption"),
    );

    const challengeStr = challengeResponse.challenge;
    const timestampMs = challengeResponse.timestampMs;

    console.log("challenge string", challengeStr);
    console.log("timestamp ms:", timestampMs);
    //szyfrowanie
    const encryptedToken = encryptKsefToken(
      rawKsefToken,
      timestampMs,
      tokenCert.certificate,
    );

    const payload = {
      challenge: challengeStr,
      contextIdentifier: {
        type: "Nip",
        value: "9571118171",
      },
      encryptedToken: encryptedToken,
    };

    console.log("PAYLOAD:", JSON.stringify(payload, null, 2));

    const response = await axios.post(`${baseUrl}/auth/ksef-token`, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return response.data; // { referenceNumber: "smth", authenticationToken: { token: "..." } }
  } catch (error) {
    console.log("AUTH ERROR");
    if (error.response) {
      console.log("status", error.response.status);
      console.log("body", JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
    throw error;
  }
}

function encryptKsefToken(rawToken, timestampMs, certificateBase64) {
  const plaintext = `${rawToken}|${timestampMs}`;

  const derBytes = forge.util.decode64(certificateBase64);
  const asn1 = forge.asn1.fromDer(derBytes);
  const cert = forge.pki.certificateFromAsn1(asn1);

  const publicKey = cert.publicKey;

  // szyfrowanie  RSA-OAEP z SHA-256
  const encryptedBytes = publicKey.encrypt(plaintext, "RSA-OAEP", {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });

  //  wynik w Base64
  return forge.util.encode64(encryptedBytes);
}
module.exports = {
  getChallenge,
  authByToken,
};
