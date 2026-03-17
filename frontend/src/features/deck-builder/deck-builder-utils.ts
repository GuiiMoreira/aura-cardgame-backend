import type { CatalogCard } from '../../services/firestoreData';

export const DECK_SIZE = 30;
export const MAX_CARD_COPIES = 3;

export type DeckValidation = {
  isValid: boolean;
  size: number;
  errors: string[];
};

export function countCopies(cards: string[]) {
  return cards.reduce<Record<string, number>>((acc, cardId) => {
    acc[cardId] = (acc[cardId] ?? 0) + 1;
    return acc;
  }, {});
}

export function validateDeck(cards: string[]): DeckValidation {
  const errors: string[] = [];
  const copies = countCopies(cards);

  if (cards.length !== DECK_SIZE) {
    errors.push(`O baralho precisa ter exatamente ${DECK_SIZE} cartas (atual: ${cards.length}).`);
  }

  const exceeded = Object.entries(copies).filter(([, total]) => total > MAX_CARD_COPIES);
  if (exceeded.length > 0) {
    errors.push(`Máximo de ${MAX_CARD_COPIES} cópias por carta excedido: ${exceeded.map(([id, total]) => `${id}x${total}`).join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    size: cards.length,
    errors,
  };
}

export function resolveCardName(cardId: string, catalog: CatalogCard[]) {
  return catalog.find((card) => card.id === cardId)?.nome ?? cardId;
}
