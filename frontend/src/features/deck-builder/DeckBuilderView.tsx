import { useMemo, useState } from 'react';
import type { CatalogCard, UserDeck } from '../../services/firestoreData';
import { DECK_SIZE, MAX_CARD_COPIES, countCopies, resolveCardName, validateDeck } from './deck-builder-utils';

type DeckBuilderViewProps = {
  cards: CatalogCard[];
  deck?: UserDeck;
  onBack: () => void;
  onSave: (deckId: string, deckName: string, cartas: string[]) => Promise<void>;
};

export function DeckBuilderView({ cards, deck, onBack, onSave }: DeckBuilderViewProps) {
  const [deckId, setDeckId] = useState(deck?.id ?? 'deck-novo');
  const [deckName, setDeckName] = useState(deck?.nome ?? 'Novo baralho');
  const [selectedCards, setSelectedCards] = useState<string[]>(deck?.cartas ?? []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>(undefined);

  const copies = useMemo(() => countCopies(selectedCards), [selectedCards]);
  const validation = useMemo(() => validateDeck(selectedCards), [selectedCards]);

  const addCard = (cardId: string) => {
    if ((copies[cardId] ?? 0) >= MAX_CARD_COPIES || selectedCards.length >= DECK_SIZE) {
      return;
    }
    setSelectedCards((prev) => [...prev, cardId]);
  };

  const removeCard = (cardId: string) => {
    const idx = selectedCards.findIndex((id) => id === cardId);
    if (idx < 0) return;
    setSelectedCards((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleSave = async () => {
    setFeedback(undefined);
    if (!validation.isValid) {
      setFeedback('Corrija as validações antes de salvar.');
      return;
    }

    try {
      setSaving(true);
      await onSave(deckId.trim(), deckName.trim(), selectedCards);
      setFeedback('Baralho salvo com sucesso.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Erro ao salvar baralho.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Deck Builder</h2>
      <button onClick={onBack}>Voltar ao lobby</button>
      <p>Monte um deck com {DECK_SIZE} cartas e até {MAX_CARD_COPIES} cópias por carta.</p>

      <label>
        Deck ID
        <input value={deckId} onChange={(e) => setDeckId(e.target.value)} />
      </label>
      <label>
        Nome
        <input value={deckName} onChange={(e) => setDeckName(e.target.value)} />
      </label>

      <h3>Validação</h3>
      {validation.errors.length > 0 ? (
        <ul style={{ color: 'crimson' }}>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p style={{ color: 'green' }}>Deck válido para jogar.</p>
      )}

      <h3>Deck atual ({selectedCards.length}/{DECK_SIZE})</h3>
      <ul>
        {Object.entries(copies).map(([cardId, total]) => (
          <li key={cardId}>
            {resolveCardName(cardId, cards)} ({cardId}) x{total} <button onClick={() => removeCard(cardId)}>Remover 1</button>
          </li>
        ))}
      </ul>

      <h3>Catálogo</h3>
      <ul>
        {cards.map((card) => {
          const totalCopies = copies[card.id] ?? 0;
          const disabled = totalCopies >= MAX_CARD_COPIES || selectedCards.length >= DECK_SIZE;
          return (
            <li key={card.id}>
              <strong>{card.nome ?? card.id}</strong> ({card.id}) x{totalCopies} <button disabled={disabled} onClick={() => addCard(card.id)}>Adicionar</button>
            </li>
          );
        })}
      </ul>

      <button disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Salvando...' : 'Salvar baralho'}
      </button>
      {feedback ? <p>{feedback}</p> : null}
    </section>
  );
}
