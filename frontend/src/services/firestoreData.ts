import { collection, doc, getDocs, getFirestore, setDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import { app } from './firebaseAuth';

const db = getFirestore(app);

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

export async function listCatalogCards(): Promise<CatalogCard[]> {
  const snapshot = await getDocs(collection(db, 'cartas_mestras'));
  return snapshot.docs
    .map((cardDoc: QueryDocumentSnapshot) => ({ id: cardDoc.id, ...(cardDoc.data() as Omit<CatalogCard, 'id'>) }))
    .sort((a: CatalogCard, b: CatalogCard) => (a.nome ?? a.id).localeCompare(b.nome ?? b.id));
}

export async function listUserDecks(userId: string): Promise<UserDeck[]> {
  const snapshot = await getDocs(collection(db, 'usuarios', userId, 'baralhos'));
  return snapshot.docs
    .map((deckDoc: QueryDocumentSnapshot) => {
      const data = deckDoc.data() as { nome?: string; cartas?: unknown };
      const cartas = Array.isArray(data.cartas) ? data.cartas.map((value) => String(value)) : [];
      return {
        id: deckDoc.id,
        nome: data.nome,
        cartas,
      };
    })
    .sort((a: UserDeck, b: UserDeck) => (a.nome ?? a.id).localeCompare(b.nome ?? b.id));
}

export async function saveUserDeck(userId: string, deckId: string, cartas: string[], nome?: string) {
  await setDoc(
    doc(db, 'usuarios', userId, 'baralhos', deckId),
    {
      nome: nome?.trim() || deckId,
      cartas,
    },
    { merge: true },
  );
}
