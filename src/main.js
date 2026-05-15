import {
  isConnected,
  getLocalStorage,
  connect,
  disconnect,
  openContractCall,
} from "@stacks/connect";

import {
  Cl,
  Pc,
  PostConditionMode,
  uintCV,
  fetchCallReadOnlyFunction,
} from "@stacks/transactions";
import { createNetwork } from "@stacks/network";

// DOM elements
const btnConnect = document.getElementById("btn-connect");
const btnLogout = document.getElementById("btn-logout");
const addressInput = document.getElementById("addressInput");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messagesContainer = document.getElementById("messagesContainer");
const messageCount = document.getElementById("messageCount");

// Contract config
const contractAddress = "ST1KQYEWGK8023G55G9JHSH8A3YHP3RNX6JJY1F9Q";
const contractName = "message-board-v2";
const sbtcTokenAddress = "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT";
const sbtcTokenContractName = "sbtc-token";
const fallbackSenderAddress = contractAddress;
const NETWORK = createNetwork("testnet");

// This id helps ignore old async render calls.
let latestRenderRequestId = 0;

function getWalletAddress(userData) {
  return userData?.addresses?.stx?.[0]?.address || "";
}

function getReadOnlySender() {
  const userData = getLocalStorage();
  return getWalletAddress(userData) || fallbackSenderAddress;
}

function setAddressInput(address) {
  if (!addressInput) return;
  if ("value" in addressInput) {
    addressInput.value = address;
  }
  addressInput.textContent = address;
}

function parseMessageTuple(cv) {
  // Real shape: some -> tuple -> fields
  if (!cv || cv.type === "none") return null;

  const tupleCv = cv.type === "some" ? cv.value : cv;
  if (!tupleCv || tupleCv.type !== "tuple" || !tupleCv.value) return null;

  const message = tupleCv.value?.message?.value ?? "";
  const author = tupleCv.value?.author?.value ?? "Desconocido";
  const timeRaw = tupleCv.value?.time?.value ?? 0;

  return {
    message: String(message),
    author: String(author),
    time: Number(timeRaw),
  };
}

function extractUint(cv) {
  if (cv?.type === "uint") {
    return Number(cv.value);
  }
  return 0;
}

function clearMessages() {
  // Increase id to cancel old render calls.
  latestRenderRequestId += 1;
  document.querySelectorAll("#messagesList").forEach((node) => node.remove());
  messageCount.textContent = "";
}

async function renderMessagesList(count) {
  const requestId = ++latestRenderRequestId;

  document.querySelectorAll("#messagesList").forEach((node) => node.remove());

  const list = document.createElement("div");
  list.id = "messagesList";
  list.className = "messages-list";

  if (count <= 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No hay mensajes todavía.";
    list.appendChild(empty);
    messagesContainer.appendChild(list);
    return;
  }

  const senderAddress = getReadOnlySender();

  for (let id = 1; id <= count; id += 1) {
    if (requestId !== latestRenderRequestId) {
      return;
    }

    try {
      const response = await fetchCallReadOnlyFunction({
        contractName,
        contractAddress,
        functionName: "get-message",
        functionArgs: [uintCV(BigInt(id))],
        senderAddress,
        network: NETWORK,
      });

      const parsed = parseMessageTuple(response);
      if (!parsed) continue;

      const item = document.createElement("div");
      item.className = "message-item";

      const messageText = document.createElement("p");
      messageText.className = "message-text";
      messageText.textContent = parsed.message;

      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.textContent = `#${id} | ${parsed.author} | bloque ${parsed.time}`;

      item.appendChild(messageText);
      item.appendChild(meta);
      list.appendChild(item);
    } catch (error) {
      console.error(`Error leyendo mensaje ${id}:`, error);
    }
  }

  if (requestId !== latestRenderRequestId) {
    return;
  }

  document.querySelectorAll("#messagesList").forEach((node) => node.remove());
  messagesContainer.appendChild(list);
}

async function loadMessageData() {
  try {
    const senderAddress = getReadOnlySender();

    const response = await fetchCallReadOnlyFunction({
      contractName,
      contractAddress,
      functionName: "get-message-count",
      functionArgs: [],
      senderAddress,
      network: NETWORK,
    });

    const count = extractUint(response);
    messageCount.textContent = String(count);
    await renderMessagesList(count);
  } catch (error) {
    console.error("Error al traer el conteo de mensajes:", error);
    messageCount.textContent = "Error al cargar mensajes";
  }
}

async function handleConnect() {
  try {
    await connect();
    updateUI();
  } catch (error) {
    console.error("Error al conectar:", error);
  }
}

async function handleSendMessage() {
  try {
    if (!isConnected()) {
      messageCount.textContent =
        "Conecta tu wallet para enviar mensajes al contrato.";
      return;
    }

    const content = messageInput?.value?.trim();
    if (!content) {
      messageCount.textContent = "Escribe un mensaje antes de enviarlo.";
      return;
    }

    const userData = getLocalStorage();
    const senderAddress = getWalletAddress(userData);
    if (!senderAddress) {
      messageCount.textContent = "No se pudo leer la dirección de la wallet.";
      return;
    }

    const postConditions = [
      Pc.principal(senderAddress)
        .willSendEq(1)
        .ft(
          `${sbtcTokenAddress}.${sbtcTokenContractName}`,
          sbtcTokenContractName,
        ),
    ];

    await openContractCall({
      contractAddress,
      contractName,
      functionName: "add-message",
      functionArgs: [Cl.stringUtf8(content)],
      network: NETWORK,
      postConditions,
      postConditionMode: PostConditionMode.Deny,
      appDetails: {
        name: "Message Board",
        icon: window.location.origin + "/favicon.ico",
      },
      onFinish: async (data) => {
        console.log("Transacción enviada:", data);
        if (messageInput) messageInput.value = "";
        await loadMessageData();
      },
      onCancel: () => {
        console.log("Transacción cancelada por el usuario");
      },
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    messageCount.textContent = "No se pudo enviar el mensaje.";
  }
}

function updateUI() {
  const authenticated = isConnected();
  if (authenticated) {
    btnConnect.style.display = "none";
    btnLogout.style.display = "inline";
    const userData = getLocalStorage();
    const address = getWalletAddress(userData) || fallbackSenderAddress;
    setAddressInput(address || "Desconocido");
  } else {
    btnConnect.style.display = "inline";
    btnLogout.style.display = "none";
    setAddressInput("Disconected");
    clearMessages();
    return;
  }

  loadMessageData();
}

// Events
btnConnect.addEventListener("click", handleConnect);
sendBtn.addEventListener("click", handleSendMessage);
messageInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSendMessage();
  }
});
btnLogout.addEventListener("click", () => {
  disconnect();
  updateUI();
});

// Init
document.addEventListener("DOMContentLoaded", updateUI);
updateUI();
