import type { CatalogCard } from '../../services/firestoreData';

type CollectionViewProps = {
  cards: CatalogCard[];
  onBack: () => void;
};

export function CollectionView({ cards, onBack }: CollectionViewProps) {
  return (
    <section>
      <h2>Coleção</h2>
      <p>Total de cartas no catálogo: {cards.length}</p>
      <button onClick={onBack}>Voltar ao lobby</button>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <strong>{card.nome ?? card.id}</strong> ({card.id}) · Força {card.Força ?? 0} · Vida {card.Vida ?? 0} · Custo C
            {card.C ?? 0}/M{card.M ?? 0}/O{card.O ?? 0}/A{card.A ?? 0}
          </li>
        ))}
      </ul>
    </section>
  );
}
