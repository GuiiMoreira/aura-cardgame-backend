const CATALOG_KEY = 'aura.catalog.cards';
const DECKS_KEY_PREFIX = 'aura.user.decks.';

export type CatalogCard = {
  id: string;
  nome?: string;
  Força?: number;
  Vida?: number;
  C?: number;
  M?: number;
  O?: number;
  A?: number;
};

export type UserDeck = {
  id: string;
  nome?: string;
  cartas: string[];
};

function getSeedCards(): CatalogCard[] {
  return [
    { id: 'carta_mock_1', nome: 'Sentinela de Aura', Força: 3, Vida: 4, C: 1, M: 0, O: 0, A: 0 },
    { id: 'carta_mock_2', nome: 'Eco Prismático', Força: 2, Vida: 3, C: 0, M: 1, O: 0, A: 0 },
    { id: 'carta_mock_3', nome: 'Heraldo Rúnico', Força: 4, Vida: 2, C: 1, M: 1, O: 0, A: 0 },
    { id: 'carta_mock_4', nome: 'Golem de Cinzas', Força: 5, Vida: 6, C: 2, M: 0, O: 0, A: 0 },
    { id: 'carta_mock_5', nome: 'Chama do Véu', Força: 6, Vida: 1, C: 0, M: 2, O: 0, A: 0 },
    { id: 'carta_mock_6', nome: 'Feiticeira Sucata', Força: 2, Vida: 5, C: 1, M: 0, O: 1, A: 0 },
    { id: 'carta_mock_7', nome: 'Engenho Alquímico', Força: 1, Vida: 7, C: 0, M: 1, O: 1, A: 0 },
    { id: 'carta_mock_8', nome: 'Colosso de Neon', Força: 7, Vida: 7, C: 3, M: 0, O: 0, A: 0 },
    { id: 'carta_mock_9', nome: 'Arcanista da Ruína', Força: 4, Vida: 4, C: 1, M: 1, O: 1, A: 0 },
    { id: 'carta_mock_10', nome: 'Eco de Sacrifício', Força: 5, Vida: 3, C: 1, M: 0, O: 0, A: 1 },
  ];
}

function readCatalogFromStorage(): CatalogCard[] {
  const raw = localStorage.getItem(CATALOG_KEY);
  if (!raw) {
    const seed = getSeedCards();
    localStorage.setItem(CATALOG_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(raw) as CatalogCard[];
  } catch {
    return getSeedCards();
  }
}

function getDeckStorageKey(userId: string) {
  return `${DECKS_KEY_PREFIX}${userId}`;
}

export async function listCatalogCards(): Promise<CatalogCard[]> {
  return readCatalogFromStorage().sort((a, b) => (a.nome ?? a.id).localeCompare(b.nome ?? b.id));
}

export async function listUserDecks(userId: string): Promise<UserDeck[]> {
  const raw = localStorage.getItem(getDeckStorageKey(userId));
  if (!raw) return [];

  try {
    const decks = JSON.parse(raw) as UserDeck[];
    return decks.sort((a, b) => (a.nome ?? a.id).localeCompare(b.nome ?? b.id));
  } catch {
    return [];
  }
}

export async function saveUserDeck(userId: string, deckId: string, cartas: string[], nome?: string) {
  const deckStorageKey = getDeckStorageKey(userId);
  const currentDecks = await listUserDecks(userId);
  const currentIndex = currentDecks.findIndex((deck) => deck.id === deckId);
  const nextDeck = {
    id: deckId,
    nome: nome?.trim() || deckId,
    cartas,
  };

  if (currentIndex >= 0) {
    currentDecks[currentIndex] = nextDeck;
  } else {
    currentDecks.push(nextDeck);
  }

  localStorage.setItem(deckStorageKey, JSON.stringify(currentDecks));
}
