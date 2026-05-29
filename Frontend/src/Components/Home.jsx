import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";

const Home = () => {
  const [xmlContent, setXmlContent] = useState(null);
  const [fileName, setFileName] = useState("");
  const [warningText, setWarningText] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.name.endsWith(".xml")) {
      setWarningText("Wybierz plik .xml");
      setXmlContent(null);
      return;
    }

    setFileName(file.name);
    setWarningText(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setXmlContent(event.target.result); // string z zawartością XML
    };
    reader.readAsText(file);
  };

  const handleSendingXml = () => {
    if (!xmlContent) {
      setWarningText("This xml is not valid");
      return;
    }

    navigate("/result", { state: { xmlContent, fileName } });
  };

  return (
    <div className="homePage">
      <div>
        <h1>Please, load your xml</h1>
        <input
          onChange={(e) => {
            handleFileChange(e);
          }}
          type="file"
        />
      </div>
      <p>{warningText}</p>
      <button
        onClick={() => {
          handleSendingXml();
        }}
      >
        Submit
      </button>
    </div>
  );
};

export default Home;
