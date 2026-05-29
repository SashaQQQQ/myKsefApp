const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser();

function parseInvoice(xml) {
  const json = parser.parse(xml);

  return {
    seller: json.Fa.Podmiot1.Nazwa,
    buyer: json.Fa.Podmiot2.Nazwa,
    total: json.Fa.P_15,
    nipSeller: json.Fa.Podmiot1.NIP,
  };
}

async function downloadXml(sessionToken, invoiceId) {
  const response = await axios.get(
    `https://ksef.mf.gov.pl/api/invoices/${invoiceId}/xml`,
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
      responseType: "text",
    },
  );
  return response.data;
}

module.exports = {
  parseInvoice,
  downloadXml,
};
