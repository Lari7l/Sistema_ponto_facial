import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

export default function App() {
  const [aba, setAba] = useState("ponto");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [cargo, setCargo] = useState("");
  const [tipoPonto, setTipoPonto] = useState("Entrada");
  const [feedback, setFeedback] = useState(null); // { tipo: 'success' | 'error' | 'info', texto: '' }
  const [carregando, setCarregando] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [agora, setAgora] = useState(new Date());

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Atualiza o relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Controla a câmera conforme a aba selecionada
  useEffect(() => {
    if (aba === "historico") {
      carregarHistorico();
      return;
    }

    let streamAtual;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamAtual = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() =>
        setFeedback({
          tipo: "error",
          texto: "Não foi possível acessar a câmera. Verifique as permissões do navegador.",
        })
      );

    return () => {
      if (streamAtual) {
        streamAtual.getTracks().forEach((track) => track.stop());
      }
    };
  }, [aba]);

  const capturarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg");
  };

  const handleCadastrar = async (e) => {
    e.preventDefault();
    setCarregando(true);
    setFeedback({ tipo: "info", texto: "Salvando dados e biometria facial..." });

    const foto = capturarFoto();
    try {
      const resp = await fetch(`${API_URL}/cadastrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, matricula, cargo, foto }),
      });
      const dados = await resp.json();
      if (resp.ok) {
        setFeedback({ tipo: "success", texto: dados.mensagem });
        setNome("");
        setMatricula("");
        setCargo("");
      } else {
        setFeedback({ tipo: "error", texto: dados.erro });
      }
    } catch {
      setFeedback({ tipo: "error", texto: "Erro de conexão com o servidor Python." });
    }
    setCarregando(false);
  };

  const handleRegistrarPonto = async () => {
    setCarregando(true);
    setFeedback({ tipo: "info", texto: "Analisando biometria facial com DeepFace..." });

    const foto = capturarFoto();
    try {
      const resp = await fetch(`${API_URL}/registrar-ponto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foto, tipo: tipoPonto }),
      });
      const dados = await resp.json();
      if (resp.ok) {
        setFeedback({
          tipo: "success",
          texto: `${dados.tipo} confirmada para ${dados.funcionario} (${dados.cargo}) às ${dados.horario}.`,
        });
      } else {
        setFeedback({ tipo: "error", texto: dados.erro });
      }
    } catch {
      setFeedback({ tipo: "error", texto: "Erro de conexão com o servidor Python." });
    }
    setCarregando(false);
  };

  const carregarHistorico = async () => {
    try {
      const resp = await fetch(`${API_URL}/registros`);
      const dados = await resp.json();
      setRegistros(dados);
    } catch {
      setFeedback({ tipo: "error", texto: "Erro ao carregar histórico de registros." });
    }
  };

  const mudarAba = (novaAba) => {
    setAba(novaAba);
    setFeedback(null);
  };

  const getBadgeClass = (tipo) => {
    if (tipo === "Entrada") return "badge badge-entrada";
    if (tipo === "Intervalo") return "badge badge-intervalo";
    return "badge badge-saida";
  };

  return (
    <div>
      {/* Cabeçalho */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <circle cx="12" cy="10" r="3" />
              <path d="M7 18c1.2-2.2 3-3 5-3s3.8.8 5 3" />
            </svg>
          </div>
          <div>
            <h1>PontoFacial AI</h1>
            <span>Controle Biométrico Corporativo</span>
          </div>
        </div>

        <div className="clock-box">
          <div className="clock-time">{agora.toLocaleTimeString("pt-BR")}</div>
          <div className="clock-date">
            {agora.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            })}
          </div>
        </div>
      </header>

      <main className="container">
        {/* Navegação */}
        <nav className="tabs">
          <button className={`tab-btn ${aba === "ponto" ? "active" : ""}`} onClick={() => mudarAba("ponto")}>
            Registrar Ponto
          </button>
          <button className={`tab-btn ${aba === "cadastro" ? "active" : ""}`} onClick={() => mudarAba("cadastro")}>
            Novo Funcionário
          </button>
          <button className={`tab-btn ${aba === "historico" ? "active" : ""}`} onClick={() => mudarAba("historico")}>
            Histórico
          </button>
        </nav>

        {/* Conteúdo Principal */}
        <section className="card">
          {aba !== "historico" ? (
            <div className="split-layout">
              {/* Coluna da Câmera */}
              <div className="camera-wrapper">
                <video ref={videoRef} autoPlay playsInline className="camera-video" />
                <div className="face-guide" />
                <div className="camera-badge">
                  <span className="status-dot" />
                  Câmera Ativa
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>

              {/* Coluna de Ação */}
              <div>
                {aba === "ponto" && (
                  <>
                    <div className="panel-header">
                      <h2>Registro de Ponto</h2>
                      <p>Posicione seu rosto dentro da área demarcada e selecione o tipo de marcação.</p>
                    </div>

                    <span className="label">Tipo de Registro</span>
                    <div className="type-selector">
                      {["Entrada", "Intervalo", "Saída"].map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          className={`type-option ${tipoPonto === tipo ? "selected" : ""}`}
                          onClick={() => setTipoPonto(tipo)}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>

                    <button className="btn-primary" onClick={handleRegistrarPonto} disabled={carregando}>
                      {carregando ? "Identificando rosto..." : `Confirmar ${tipoPonto}`}
                    </button>
                  </>
                )}

                {aba === "cadastro" && (
                  <>
                    <div className="panel-header">
                      <h2>Cadastrar Funcionário</h2>
                      <p>Preencha os dados abaixo olhando para a câmera para registrar a biometria facial.</p>
                    </div>

                    <form onSubmit={handleCadastrar}>
                      <div className="form-group">
                        <label className="label">Nome Completo</label>
                        <input
                          className="input"
                          placeholder="Ex: Ana Paula Silva"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="label">Matrícula</label>
                        <input
                          className="input"
                          placeholder="Ex: FUNC-042"
                          value={matricula}
                          onChange={(e) => setMatricula(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="label">Cargo</label>
                        <input
                          className="input"
                          placeholder="Ex: Analista de Sistemas"
                          value={cargo}
                          onChange={(e) => setCargo(e.target.value)}
                          required
                        />
                      </div>

                      <button type="submit" className="btn-primary" disabled={carregando}>
                        {carregando ? "Salvando cadastro..." : "Capturar Biometria e Cadastrar"}
                      </button>
                    </form>
                  </>
                )}

                {feedback && <div className={`alert ${feedback.tipo}`}>{feedback.texto}</div>}
              </div>
            </div>
          ) : (
            /* Aba de Histórico */
            <div>
              <div className="history-header">
                <div className="panel-header" style={{ marginBottom: 0 }}>
                  <h2 style={{ marginBottom: 4 }}>Histórico de Registros</h2>
                  <p style={{ marginBottom: 0 }}>
                    {registros.length} {registros.length === 1 ? "marcação registrada" : "marcações registradas"} no banco de dados.
                  </p>
                </div>
                <button className="btn-outline" onClick={carregarHistorico}>
                  Atualizar lista
                </button>
              </div>

              <div className="table-container">
                {registros.length === 0 ? (
                  <div className="empty-state">Nenhum registro de ponto encontrado ainda.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Funcionário</th>
                        <th>Matrícula</th>
                        <th>Cargo</th>
                        <th>Data</th>
                        <th>Horário</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.nome}</td>
                          <td>{r.matricula}</td>
                          <td>{r.cargo}</td>
                          <td>{r.data}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.horario}</td>
                          <td>
                            <span className={getBadgeClass(r.tipo)}>{r.tipo}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}