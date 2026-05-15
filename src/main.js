import {
  isConnected,
  getLocalStorage,
  connect,
  disconnect,
  openContractCall,
} from "@stacks/connect";

import { uintCV, Pc } from "@stacks/transactions";
import { STACKS_DEVNET } from "@stacks/network";

const btnConnect = document.getElementById("btn-connect");
const btnLogout = document.getElementById("btn-logout");
const addressInput = document.getElementById("addressInput");
const sendBtn = document.getElementById("sendBtn");
const messagesContainer = document.getElementById("messagesContainer");

let board = Array(9).fill(null);
let currentPlayer = "X";

// --- DELEGACIÓN DE EVENTOS ---
// Un único 'listener' padre de todos.
messagesContainer.addEventListener("click", (event) => {
  // Si el clic aterrizó exactamente en algo con la clase "cell"
  if (event.target.classList.contains("cell")) {
    // Extraemos su número a partir del atributo data-index oculto
    const index = parseInt(event.target.dataset.index, 10);
    handlePlay(index);
  }
});

function renderBoard() {
  messagesContainer.innerHTML = "";
  const boardEl = document.createElement("div");
  boardEl.className = "tic-tac-toe-board";

  board.forEach((cellValue, index) => {
    const cell = document.createElement("div");
    cell.className = "cell";

    // Etiquetamos la caja con su número de forma pasiva
    cell.dataset.index = index;

    // Estilos para la marca X o O
    if (cellValue === "X") {
      cell.classList.add("player-x");
    } else if (cellValue === "O") {
      cell.classList.add("player-o");
    }

    cell.innerText = cellValue ? cellValue : "";
    boardEl.appendChild(cell);
  });
  messagesContainer.appendChild(boardEl);
}

async function handlePlay(index) {
  if (addressInput.textContent === "Disconnected") {
    alert("Por favor, conecta tu wallet primero para jugar.");
    return;
  }

  if (!board[index]) {
    // Detectar si es el primer movimiento
    const isFirstMove = board.every((cell) => cell === null);
    if (isFirstMove) {
      // Disparar billetera para crear en la red
      await createGameOnChain(index);
    } else {
      // Simulamos movimiento local temporalmente
      board[index] = currentPlayer;
      currentPlayer = currentPlayer === "X" ? "O" : "X";
      renderBoard();
    }
  }
}

function startGame() {
  board = Array(9).fill(null);
  currentPlayer = "X";
  renderBoard();
}

async function handleConnect() {
  try {
    await connect();
    updateUI();
  } catch (error) {
    console.error("Error al conectar:", error);
  }
}

function updateUI() {
  const authenticated = isConnected();
  if (authenticated) {
    btnConnect.style.display = "none";
    btnLogout.style.display = "inline";
    const userData = getLocalStorage();
    if (userData?.addresses) {
      addressInput.textContent = userData.addresses.stx[0].address;
    }
  } else {
    btnConnect.style.display = "inline";
    btnLogout.style.display = "none";
    addressInput.textContent = "Disconnected";
  }
}

// Listeners
btnConnect.addEventListener("click", handleConnect);
btnLogout.addEventListener("click", () => {
  disconnect();
  updateUI();
});
sendBtn.addEventListener("click", startGame);

// --- LLAMADAS A SMART CONTRACTS ---
const network = STACKS_DEVNET;

const contractAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const contractName = "tic-tac-toe";

async function createGameOnChain(moveIndex) {
  const betAmount = 10000; // microSTX (Ejemplo: 0.01 STX)
  const move = 1; // 1 = Jugador X

  const functionArgs = [uintCV(betAmount), uintCV(moveIndex), uintCV(move)];

  // Condición de seguridad (Post-Condition) para autorizar transferir los STX
  const postConditions = [
    Pc.principal(addressInput.textContent).willSendEq(betAmount).ustx(),
  ];

  // openContractCall lanza la ventana de Hiro Wallet en la pantalla del usuario
  await openContractCall({
    network,
    contractAddress,
    contractName,
    functionName: "create-game",
    functionArgs,
    postConditions, // <- Agregamos la regla de seguridad a la transacción
    appDetails: {
      name: "Tic Tac Toe Explorer",
      icon: window.location.origin + "/favicon.ico",
    },
    onFinish: (data) => {
      console.log(
        "Transacción de creación confirmada en la Billetera. TX ID:",
        data.txId,
      );

      // Pintamos localmente asumiendo que la transacción se confirmó
      board[moveIndex] = currentPlayer;
      currentPlayer = currentPlayer === "X" ? "O" : "X";
      renderBoard();
    },
    onCancel: () => {
      console.log("El usuario cerró la ventana de su billetera sin confirmar.");
    },
  });
}

// Iniciar UI y renderizar tablero vacío al cargar
updateUI();
renderBoard();
