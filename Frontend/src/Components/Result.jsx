import { useParams, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase.js";
import axios from "axios";
import "../Styles/Result.css";

const Result = () => {
  const { state } = useLocation();
  const xmlContent = state?.xmlContent;
  const fileName = state?.fileName;
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [warningText, setWarningText] = useState(null);
  const [flag, setFlag] = useState(false);
  const [totalSum, setTotalSum] = useState(0);

  const invoiceTypes = [
    {
      code: "Vat",
      namePl: "Faktura VAT",
    },
    {
      code: "Kor",
      namePl: "Faktura korygująca",
    },
    {
      code: "Zal",
      namePl: "Faktura zaliczkowa",
    },
    {
      code: "Roz",
      namePl: "Faktura rozliczeniowa",
    },
    {
      code: "Upr",
      namePl: "Faktura uproszczona",
    },
    {
      code: "Pro",
      namePl: "Faktura proforma",
    },
    {
      code: "Dup",
      namePl: "Duplikat faktury",
    },
    {
      code: "Rr",
      namePl: "Faktura VAT RR",
    },
    {
      code: "Oss",
      namePl: "Faktura OSS",
    },
    {
      code: "Imp",
      namePl: "Faktura importowa",
    },
    {
      code: "Exp",
      namePl: "Faktura eksportowa",
    },
    {
      code: "Wew",
      namePl: "Faktura wewnętrzna",
    },
  ];

  const getTypeOfInvoice = (invoice) => {
    console.log("INVOICE TYPE", invoice.invoiceType);
    return invoiceTypes.find((type) => type.code === invoice.invoiceType)
      ?.namePl;
  };

  const sendInvoices = () => {
    if (!xmlContent) {
      setWarningText("This xml is not valid", xmlContent);
      return;
    }
    setWarningText("Sending invoice...", xmlContent);
    axios
      .post("http://localhost:3000/sendInvoice", {
        xmlBuffer: xmlContent,
      })
      .then((res) => {
        setWarningText(`Invoice sent successfully. Response: ${res.data}`);
      });
  };

  const getInvoices = () => {
    axios.post("http://localhost:3000/invoices").then((res) => {
      if (res?.data?.length) {
        setInvoices(res.data);
        setFlag(true);
      }
      console.log(res.data);
      setIsLoading(false);
    });
  };

  const insertInvoices = async () => {
    const { error } = await supabase.from("invoices").insert(
      invoices.map((invoice) => ({
        ksefNumber: invoice.ksefNumber,
      })),
    );

    if (error) {
      console.log("err while insert", error);
      return;
    }
    console.log("inserted");
  };

  const syncInvoicesWithDB = async () => {
    console.log("works");
    if (!invoices?.length) return;
    console.log("works2");
    const ksefNumbers = invoices.map((inv) => inv.ksefNumber);

    const { data: existingInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("ksefNumber, isPayed, whenPayed")
      .in("ksefNumber", ksefNumbers);

    if (fetchError) {
      console.log(fetchError);
      return;
    }

    const existingNumbers = new Set(
      existingInvoices.map((inv) => inv.ksefNumber),
    );

    const invoicesToInsert = invoices
      .filter((inv) => !existingNumbers.has(inv.ksefNumber))
      .map((inv) => ({
        ksefNumber: inv.ksefNumber,
      }));

    if (invoicesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("invoices")
        .insert(invoicesToInsert);

      if (insertError) {
        console.log(insertError);
        return;
      }

      console.log("new invoices inserted");
    }

    const { data: dbInvoices, error: dbError } = await supabase
      .from("invoices")
      .select("ksefNumber, isPayed, whenPayed");

    if (dbError) {
      console.log(dbError);
      return;
    }

    const updatedInvoices = invoices.map((invoice) => {
      const dbInvoice = dbInvoices.find(
        (inv) => inv.ksefNumber === invoice.ksefNumber,
      );

      return {
        ...invoice,
        isPayed: dbInvoice?.isPayed || false,
        whenPayed: dbInvoice?.whenPayed || null,
      };
    });

    setInvoices(updatedInvoices);
  };

  useEffect(() => {
    syncInvoicesWithDB();
    setFlag(false);
  }, [flag]);

  useEffect(() => {
    if (invoices && invoices.length !== 0) {
      // ________________________________
      let sum = 0;
      invoices.forEach((invoice) => {
        sum += invoice.netAmount;
      });
      setTotalSum(sum);
      // ________________________________
      // syncInvoicesWithDB();
      /*    const setDataBaseInvoices = async () => {
        const { data: fetchData, error: fetchError } = await supabase
          .from("invoices")
          .select("ksefNumber,isPayed, whenPayed");

        if (fetchError) {
          console.log(fetchError);
          return;
        }
        console.log("fetched data", fetchData);
        if (fetchData) {
          const updatedInvoices = fetchData.map((inv) => {
            const thatInvoice = invoices.find((invoice) => {
              return invoice.ksefNumber === inv.ksefNumber;
            });
            return {
              ...(thatInvoice || {}),
              isPayed: inv.isPayed,
              whenPayed: inv.whenPayed,
            };
          });
          console.log("updated invoices", updatedInvoices);
          setInvoices(updatedInvoices);
        }
      };
      setDataBaseInvoices();
      */
    }
  }, [invoices]);

  return (
    <div className="resultPage">
      <button
        onClick={() => {
          getInvoices();
        }}
      >
        Get invoices
      </button>
      <button
        onClick={() => {
          sendInvoices();
        }}
      >
        Send invoice
      </button>
      {isLoading ? <div className="loading"></div> : null}
      {warningText && <div className="warning">{warningText}</div>}
      <h3>Invoices</h3>
      <table>
        <tr>
          <th>Typ faktury</th>
          <th>Sprzedawca</th>
          <th>Nabywca</th>
          <th>Netto</th>
          <th>Brutto</th>
          <th>Data wyplaty</th>
          <th>Czy oplacona</th>
          <th>Kiedy oplacona</th>
          {invoices && invoices.length !== 0 ? (
            <th>
              Razem przychody (netto) <br />
              {totalSum} PLN
            </th>
          ) : null}
        </tr>

        {invoices && invoices.length !== 0 ? (
          invoices.map((invoice) => (
            <tr key={invoice.ksefNumber}>
              <td>{getTypeOfInvoice(invoice)}</td>
              <td>{invoice.seller.name}</td>
              <td>{invoice.buyer.name}</td>
              <td>
                {invoice.netAmount} {invoice.currency}
              </td>
              <td>
                {invoice.grossAmount} {invoice.currency}
              </td>
              <td>{invoice.acquisitionDate.slice(0, 10)}</td>
              <td>{invoice.isPayed ? "Tak" : "Nie"}</td>
              <td>
                {invoice.whenPayed !== null
                  ? `${invoice.whenPayed}`
                  : "Nie oplacona"}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="7">No data</td>
          </tr>
        )}
      </table>
    </div>
  );
};

export default Result;
