import type { AuraCard } from '../../../contracts/socket-contracts';
import { CardView } from './CardView';

type FieldViewProps = {
  ownerId: string;
  cards: AuraCard[];
};

export function FieldView({ ownerId, cards }: FieldViewProps) {
  return (
    <section>
      <h4>Campo de {ownerId}</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cards.length > 0 ? cards.map((card) => <CardView key={card.id} card={card} context="campo" />) : <p>Sem cartas no campo.</p>}
      </div>
    </section>
  );
}
