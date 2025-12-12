// NOTE TO SELF: No var. Only const/let.
// NOTE TO SELF: Keep state in ONE place. Save to LocalStorage often.

const STORAGE_KEY = "lotusFlashcards_v1";

const state = {
  decks: [],
  cardsByDeckId: {},
  activeDeckId: null,
  ui: {
    activeCardIndex: 0,
    isFlipped: false,
    deckModalMode: "create", // "create" | "rename"
    cardModalMode: "create", // "create" | "edit"
    editingCardId: null,
    searchTerm: "",
    sessionOrder: null
  }
};

// ---------- Helpers ----------
function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function safeParse(json, fallback) {
  try {
    const data = JSON.parse(json);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  const data = safeParse(raw, null);
  if (!data) return false;

  state.decks = Array.isArray(data.decks) ? data.decks : [];
  state.cardsByDeckId = data.cardsByDeckId && typeof data.cardsByDeckId === "object" ? data.cardsByDeckId : {};
  state.activeDeckId = data.activeDeckId ?? null;

  // UI resets each load (safer)
  state.ui.activeCardIndex = 0;
  state.ui.isFlipped = false;
  state.ui.searchTerm = "";
  state.ui.sessionOrder = null;

  return true;
}

function getActiveDeck() {
  return state.decks.find(d => d.id === state.activeDeckId) ?? null;
}

function getCardsForActiveDeck() {
  const deckId = state.activeDeckId;
  if (!deckId) return [];
  return state.cardsByDeckId[deckId] ?? [];
}

function getFilteredCards(cards) {
  const term = state.ui.searchTerm.trim().toLowerCase();
  if (!term) return cards;

  return cards.filter(c => {
    const front = c.front.toLowerCase();
    const back = c.back.toLowerCase();
    return front.includes(term) || back.includes(term);
  });
}

function resetFlip() {
  state.ui.isFlipped = false;
  els.studyCard.classList.remove("is-flipped");
}

function clampIndex(i, max) {
  if (max <= 0) return 0;
  if (i < 0) return 0;
  if (i >= max) return max - 1;
  return i;
}

// ---------- Seed Data (Affirmations) ----------
function seedIfEmpty() {
  if (state.decks.length > 0) return;

  const deckId = uid();
  state.decks.push({ id: deckId, name: "White Lotus — Self Love", createdAt: Date.now() });

  state.cardsByDeckId[deckId] = [
    { id: uid(), front: "I am worthy.", back: "I deserve love, peace, and good things.", updatedAt: Date.now() },
    { id: uid(), front: "I am safe.", back: "My mind and body can relax right now.", updatedAt: Date.now() },
    { id: uid(), front: "I can do hard things.", back: "Step by step, I always figure it out.", updatedAt: Date.now() },
    { id: uid(), front: "I am protected.", back: "I trust myself and my path.", updatedAt: Date.now() },
    { id: uid(), front: "I bloom in my own time.", back: "No rushing. My growth is real.", updatedAt: Date.now() }
  ];

  state.activeDeckId = deckId;
  saveState();
}

// ---------- DOM ----------
const els = {
  deckList: document.getElementById("deckList"),
  deckTitle: document.getElementById("deckTitle"),
  searchInput: document.getElementById("searchInput"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  newDeckBtn: document.getElementById("newDeckBtn"),
  newCardBtn: document.getElementById("newCardBtn"),
  studyCard: document.getElementById("studyCard"),
  cardFront: document.getElementById("cardFront"),
  cardBack: document.getElementById("cardBack"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  flipBtn: document.getElementById("flipBtn"),
  statusText: document.getElementById("statusText"),
  renameDeckBtn: document.getElementById("renameDeckBtn"),
  deleteDeckBtn: document.getElementById("deleteDeckBtn"),

  deckModal: document.getElementById("deckModal"),
  deckNameInput: document.getElementById("deckNameInput"),
  cancelDeckBtn: document.getElementById("cancelDeckBtn"),
  saveDeckBtn: document.getElementById("saveDeckBtn"),

  cardModal: document.getElementById("cardModal"),
  frontInput: document.getElementById("frontInput"),
  backInput: document.getElementById("backInput"),
  cancelCardBtn: document.getElementById("cancelCardBtn"),
  saveCardBtn: document.getElementById("saveCardBtn")
};

// ---------- Render ----------
function renderDecks() {
  els.deckList.innerHTML = "";

  if (state.decks.length === 0) {
    const li = document.createElement("li");
    li.className = "deck-item";
    li.textContent = "No decks yet.";
    els.deckList.appendChild(li);
    return;
  }

  for (const deck of state.decks) {
    const li = document.createElement("li");
    li.className = "deck-item" + (deck.id === state.activeDeckId ? " active" : "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = deck.name;
    btn.setAttribute("data-deck-id", deck.id);

    li.appendChild(btn);
    els.deckList.appendChild(li);
  }
}

function getSessionCards(filteredCards) {
  // NOTE TO SELF: Search should NOT mutate real data, only what we show.
  // Shuffle order should also NOT mutate the stored list.
  if (!state.ui.sessionOrder) return filteredCards;

  const map = new Map(filteredCards.map(c => [c.id, c]));
  const ordered = [];
  for (const id of state.ui.sessionOrder) {
    const found = map.get(id);
    if (found) ordered.push(found);
  }
  return ordered;
}

function renderStudyCard() {
  const deck = getActiveDeck();
  const allCards = getCardsForActiveDeck();
  const filtered = getFilteredCards(allCards);
  const cards = getSessionCards(filtered);

  if (!deck) {
    els.deckTitle.textContent = "No deck selected";
    els.cardFront.textContent = "Pick a deck to begin.";
    els.cardBack.textContent = "Your affirmation will appear here.";
    els.statusText.textContent = "0 / 0";
    resetFlip();
    return;
  }

  els.deckTitle.textContent = deck.name;

  if (cards.length === 0) {
    els.cardFront.textContent = state.ui.searchTerm ? "No cards found." : "No cards yet.";
    els.cardBack.textContent = "Add a new card to begin.";
    els.statusText.textContent = "0 / 0";
    resetFlip();
    return;
  }

  state.ui.activeCardIndex = clampIndex(state.ui.activeCardIndex, cards.length);
  const card = cards[state.ui.activeCardIndex];

  els.cardFront.textContent = card.front;
  els.cardBack.textContent = card.back;

  els.statusText.textContent = `${state.ui.activeCardIndex + 1} / ${cards.length}`;

  // NOTE TO SELF: important bug prevention!
  // Whenever we show a new card, always unflip.
  resetFlip();
}

function renderAll() {
  renderDecks();
  renderStudyCard();
}

// ---------- Modals (simple + ESC close) ----------
let lastFocusEl = null;

function openModal(modalEl, focusEl) {
  lastFocusEl = document.activeElement;
  modalEl.hidden = false;

  // small focus delay so browser can paint the modal first
  setTimeout(() => {
    focusEl.focus();
  }, 0);
}

function closeModal(modalEl) {
  modalEl.hidden = true;
  if (lastFocusEl) lastFocusEl.focus();
}

function wireModalBackdropClose(modalEl) {
  modalEl.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.close === "true") {
      closeModal(modalEl);
    }
  });
}

wireModalBackdropClose(els.deckModal);
wireModalBackdropClose(els.cardModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!els.deckModal.hidden) closeModal(els.deckModal);
    if (!els.cardModal.hidden) closeModal(els.cardModal);
  }
});

// ---------- Deck CRUD ----------
function createDeck(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const id = uid();
  state.decks.push({ id, name: trimmed, createdAt: Date.now() });
  state.cardsByDeckId[id] = [];
  state.activeDeckId = id;
  state.ui.activeCardIndex = 0;
  state.ui.sessionOrder = null;

  saveState();
  renderAll();
}

function renameActiveDeck(newName) {
  const deck = getActiveDeck();
  if (!deck) return;

  const trimmed = newName.trim();
  if (!trimmed) return;

  deck.name = trimmed;
  saveState();
  renderAll();
}

function deleteActiveDeck() {
  const deck = getActiveDeck();
  if (!deck) return;

  const ok = confirm(`Delete deck "${deck.name}"? This cannot be undone.`);
  if (!ok) return;

  state.decks = state.decks.filter(d => d.id !== deck.id);
  delete state.cardsByDeckId[deck.id];

  state.activeDeckId = state.decks[0]?.id ?? null;
  state.ui.activeCardIndex = 0;
  state.ui.sessionOrder = null;

  saveState();
  renderAll();
}

// ---------- Card CRUD ----------
function createCard(front, back) {
  const deckId = state.activeDeckId;
  if (!deckId) return;

  const f = front.trim();
  const b = back.trim();
  if (!f || !b) return;

  const card = { id: uid(), front: f, back: b, updatedAt: Date.now() };
  const list = state.cardsByDeckId[deckId] ?? [];
  list.push(card);
  state.cardsByDeckId[deckId] = list;

  saveState();
  renderAll();
}

function shuffleSession() {
  const allCards = getCardsForActiveDeck();
  const filtered = getFilteredCards(allCards);

  const ids = filtered.map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  state.ui.sessionOrder = ids;
  state.ui.activeCardIndex = 0;

  renderStudyCard();
}

// ---------- Study / Navigation ----------
function flipCard() {
  state.ui.isFlipped = !state.ui.isFlipped;
  els.studyCard.classList.toggle("is-flipped", state.ui.isFlipped);
}

function nextCard() {
  const cards = getSessionCards(getFilteredCards(getCardsForActiveDeck()));
  if (cards.length === 0) return;

  state.ui.activeCardIndex = (state.ui.activeCardIndex + 1) % cards.length;
  renderStudyCard();
}

function prevCard() {
  const cards = getSessionCards(getFilteredCards(getCardsForActiveDeck()));
  if (cards.length === 0) return;

  state.ui.activeCardIndex = (state.ui.activeCardIndex - 1 + cards.length) % cards.length;
  renderStudyCard();
}

// ---------- Event Listeners (single bindings, no duplicates) ----------
els.deckList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-deck-id]");
  if (!btn) return;

  state.activeDeckId = btn.getAttribute("data-deck-id");
  state.ui.activeCardIndex = 0;
  state.ui.sessionOrder = null;
  state.ui.searchTerm = "";
  els.searchInput.value = "";

  saveState();
  renderAll();
});

els.newDeckBtn.addEventListener("click", () => {
  state.ui.deckModalMode = "create";
  els.deckNameInput.value = "";
  openModal(els.deckModal, els.deckNameInput);
});

els.renameDeckBtn.addEventListener("click", () => {
  const deck = getActiveDeck();
  if (!deck) return;

  state.ui.deckModalMode = "rename";
  els.deckNameInput.value = deck.name;
  openModal(els.deckModal, els.deckNameInput);
});

els.deleteDeckBtn.addEventListener("click", deleteActiveDeck);

els.cancelDeckBtn.addEventListener("click", () => closeModal(els.deckModal));

els.saveDeckBtn.addEventListener("click", () => {
  const name = els.deckNameInput.value;

  if (state.ui.deckModalMode === "create") createDeck(name);
  if (state.ui.deckModalMode === "rename") renameActiveDeck(name);

  closeModal(els.deckModal);
});

els.newCardBtn.addEventListener("click", () => {
  if (!state.activeDeckId) {
    alert("Pick or create a deck first.");
    return;
  }
  state.ui.cardModalMode = "create";
  els.frontInput.value = "";
  els.backInput.value = "";
  openModal(els.cardModal, els.frontInput);
});

els.cancelCardBtn.addEventListener("click", () => closeModal(els.cardModal));

els.saveCardBtn.addEventListener("click", () => {
  createCard(els.frontInput.value, els.backInput.value);
  closeModal(els.cardModal);
});

els.shuffleBtn.addEventListener("click", shuffleSession);
els.flipBtn.addEventListener("click", flipCard);
els.nextBtn.addEventListener("click", nextCard);
els.prevBtn.addEventListener("click", prevCard);

els.studyCard.addEventListener("click", flipCard);

// Debounced search (simple)
let searchTimer = null;
els.searchInput.addEventListener("input", (e) => {
  const value = e.target.value;

  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.ui.searchTerm = value;
    state.ui.activeCardIndex = 0;
    state.ui.sessionOrder = null;
    renderStudyCard();
  }, 300);
});

// Keyboard shortcuts: Space flip, arrows navigate
document.addEventListener("keydown", (e) => {
  const deckModalOpen = !els.deckModal.hidden;
  const cardModalOpen = !els.cardModal.hidden;
  if (deckModalOpen || cardModalOpen) return;

  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    flipCard();
  }
  if (e.key === "ArrowRight") nextCard();
  if (e.key === "ArrowLeft") prevCard();
});

// ---------- Init ----------
const hasLoaded = loadState();
if (!hasLoaded) seedIfEmpty();
else seedIfEmpty(); // still seeds if state is empty

renderAll();
