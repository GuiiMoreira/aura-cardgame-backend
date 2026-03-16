import type { AuraCard } from '../../../contracts/socket-contracts';
import { CardView } from './CardView';

type HandViewProps = {
  title: string;
  cards: AuraCard[];
};

export function HandView({ title, cards }: HandViewProps) {
  return (
    <section>
      <h4>{title}</h4>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cards.length > 0 ? cards.map((card) => <CardView key={card.id} card={card} context="mao" />) : <p>Mão vazia.</p>}
      </div>
    </section>
  );
}
