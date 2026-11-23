import os
import base64
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace

app = Flask(__name__)
CORS(app)  # Permite que o React acesse esta API

PASTA_FOTOS = "fotos"
DB_PATH = "ponto.db"
os.makedirs(PASTA_FOTOS, exist_ok=True)


# 1. Inicialização do Banco de Dados (SQLite)
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS funcionarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            matricula TEXT UNIQUE NOT NULL,
            cargo TEXT NOT NULL,
            caminho_foto TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS registros_ponto (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            funcionario_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            horario TEXT NOT NULL,
            tipo TEXT NOT NULL,
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios (id)
        )
    """)
    conn.commit()
    conn.close()


# Função auxiliar para salvar imagem enviada em Base64 pelo React
def salvar_imagem_base64(imagem_b64, caminho_destino):
    # Remove o cabeçalho "data:image/jpeg;base64," se existir
    if "," in imagem_b64:
        imagem_b64 = imagem_b64.split(",")[1]
    with open(caminho_destino, "wb") as f:
        f.write(base64.b64decode(imagem_b64))


# 2. Rota de Cadastro de Funcionário
@app.route("/cadastrar", methods=["POST"])
def cadastrar_funcionario():
    dados = request.json
    nome = dados.get("nome")
    matricula = dados.get("matricula")
    cargo = dados.get("cargo")
    foto_b64 = dados.get("foto")

    if not all([nome, matricula, cargo, foto_b64]):
        return jsonify({"erro": "Preencha todos os campos e capture a foto."}), 400

    caminho_foto = os.path.join(PASTA_FOTOS, f"{matricula}.jpg")
    salvar_imagem_base64(foto_b64, caminho_foto)

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO funcionarios (nome, matricula, cargo, caminho_foto) VALUES (?, ?, ?, ?)",
            (nome, matricula, cargo, caminho_foto),
        )
        conn.commit()
        conn.close()
        return jsonify({"mensagem": f"Funcionário {nome} cadastrado com sucesso!"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"erro": "Já existe um funcionário com essa matrícula."}), 409


# 3. Rota de Registro de Ponto com Reconhecimento Facial
@app.route("/registrar-ponto", methods=["POST"])
def registrar_ponto():
    dados = request.json
    foto_b64 = dados.get("foto")
    tipo = dados.get("tipo", "Entrada")  # Entrada, Saída ou Intervalo

    if not foto_b64:
        return jsonify({"erro": "Nenhuma imagem enviada."}), 400

    caminho_temp = os.path.join(PASTA_FOTOS, "temp_ponto.jpg")
    salvar_imagem_base64(foto_b64, caminho_temp)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, matricula, cargo, caminho_foto FROM funcionarios")
    funcionarios = cursor.fetchall()

    funcionario_identificado = None

    # Compara a foto capturada com cada funcionário cadastrado
    for func in funcionarios:
        func_id, nome, matricula, cargo, caminho_foto = func
        if not os.path.exists(caminho_foto):
            continue
        try:
            # SFace é rápido e leve, ideal para rodar em notebooks comuns
            resultado = DeepFace.verify(
                img1_path=caminho_temp,
                img2_path=caminho_foto,
                model_name="SFace",
                enforce_detection=False,
            )
            if resultado["verified"]:
                funcionario_identificado = func
                break
        except Exception as e:
            print(f"Erro ao comparar com {nome}: {e}")

    # Remove a foto temporária
    if os.path.exists(caminho_temp):
        os.remove(caminho_temp)

    if not funcionario_identificado:
        conn.close()
        return jsonify({"erro": "Rosto não reconhecido no sistema."}), 404

    # Salva o registro de ponto no banco
    agora = datetime.now()
    data_atual = agora.strftime("%d/%m/%Y")
    hora_atual = agora.strftime("%H:%M:%S")

    cursor.execute(
        "INSERT INTO registros_ponto (funcionario_id, data, horario, tipo) VALUES (?, ?, ?, ?)",
        (funcionario_identificado[0], data_atual, hora_atual, tipo),
    )
    conn.commit()
    conn.close()

    return jsonify({
        "mensagem": "Ponto registrado com sucesso!",
        "funcionario": funcionario_identificado[1],
        "matricula": funcionario_identificado[2],
        "cargo": funcionario_identificado[3],
        "data": data_atual,
        "horario": hora_atual,
        "tipo": tipo,
    }), 200


# 4. Rota para listar histórico de registros
@app.route("/registros", methods=["GET"])
def listar_registros():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, f.nome, f.matricula, f.cargo, r.data, r.horario, r.tipo
        FROM registros_ponto r
        JOIN funcionarios f ON r.funcionario_id = f.id
        ORDER BY r.id DESC
    """)
    linhas = cursor.fetchall()
    conn.close()

    registros = [
        {
            "id": l[0],
            "nome": l[1],
            "matricula": l[2],
            "cargo": l[3],
            "data": l[4],
            "horario": l[5],
            "tipo": l[6],
        }
        for l in linhas
    ]
    return jsonify(registros), 200


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)