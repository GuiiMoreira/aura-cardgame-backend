import type { AuraCard } from '../../../contracts/socket-contracts';

type CardViewProps = {
  card: AuraCard;
  context: 'mao' | 'campo';
};

const KNOWN_ABILITIES = ['Instável', 'Congelar', 'Ressurgir', 'Escudo', 'Último Suspiro'];

export function CardView({ card, context }: CardViewProps) {
  return (
    <article style={{ border: '1px solid #777', borderRadius: 8, padding: 8, minWidth: 140 }}>
      <strong>{card.nome ?? card.id}</strong>
      <p style={{ margin: '6px 0' }}>Força: {card.forca ?? '-'}</p>
      <p style={{ margin: '6px 0' }}>Vida: {card.vida ?? '-'}</p>
      <small>Zona: {context}</small>
      <details style={{ marginTop: 6 }}>
        <summary>Habilidades especiais (ready)</summary>
        <ul>
          {KNOWN_ABILITIES.map((ability) => (
            <li key={ability}>{ability}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}
