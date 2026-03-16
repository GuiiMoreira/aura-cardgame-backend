function getOponenteId(estado, userId) {
  return Object.keys(estado.jogadores).find((id) => id !== userId);
}

function passarTurno(estado, userId) {
  const proximoJogadorId = getOponenteId(estado, userId);
  const jogadorDoTurno = estado.jogadores[proximoJogadorId];

  if (jogadorDoTurno.baralho.length > 0) {
    jogadorDoTurno.mao.push(jogadorDoTurno.baralho.shift());
  }

  const { geracaoRecursos: geracao, recursosMax: maximo } = jogadorDoTurno;
  jogadorDoTurno.recursos.C = Math.min(jogadorDoTurno.recursos.C + geracao.C, maximo.C);
  jogadorDoTurno.recursos.M = Math.min(jogadorDoTurno.recursos.M + geracao.M, maximo.M);
  jogadorDoTurno.recursos.O = Math.min(jogadorDoTurno.recursos.O + geracao.O, maximo.O);
  jogadorDoTurno.recursos.A = Math.min(jogadorDoTurno.recursos.A + geracao.A, maximo.A);

  estado.campo[proximoJogadorId].forEach((carta) => {
    carta.exaustao = false;
  });

  estado.turno = proximoJogadorId;
}

function jogarCarta(estado, userId, cartaId) {
  const jogador = estado.jogadores[userId];
  const idx = jogador.mao.findIndex((carta) => carta.id === cartaId);

  if (idx === -1) return;

  const carta = jogador.mao[idx];
  if (
    jogador.recursos.C < carta.C ||
    jogador.recursos.M < carta.M ||
    jogador.recursos.O < carta.O ||
    jogador.recursos.A < carta.A
  ) {
    return;
  }

  jogador.recursos.C -= carta.C;
  jogador.recursos.M -= carta.M;
  jogador.recursos.O -= carta.O;
  jogador.recursos.A -= carta.A;

  jogador.mao.splice(idx, 1);
  carta.exaustao = true;
  estado.campo[userId].push(carta);
}

function atacarFortaleza(estado, userId, atacantesIds) {
  const oponenteId = getOponenteId(estado, userId);
  const oponente = estado.jogadores[oponenteId];
  let danoTotal = 0;

  atacantesIds.forEach((atacanteId) => {
    const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
    if (cartaAtacante && cartaAtacante.Força > 0 && !cartaAtacante.exaustao) {
      danoTotal += cartaAtacante.Força;
      cartaAtacante.exaustao = true;
    }
  });

  if (danoTotal > 0) {
    oponente.vida -= danoTotal;
  }
}

function extrairValorInstavel(cartaAtacante) {
  if (!cartaAtacante.Mecânica || !cartaAtacante.Mecânica.includes('Instável')) {
    return 0;
  }

  const match = cartaAtacante.Mecânica.match(/\((\d+)\)/);
  if (!match) {
    return 0;
  }

  return parseInt(match[1], 10) * 10;
}

function declararAtaque(estado, userId, atacanteId, alvoId) {
  const oponenteId = getOponenteId(estado, userId);
  const cartaAtacante = estado.campo[userId].find((carta) => carta.id === atacanteId);
  const cartaAlvo = estado.campo[oponenteId].find((carta) => carta.id === alvoId);

  if (!cartaAtacante || !cartaAlvo || cartaAtacante.exaustao) {
    return;
  }

  const valorInstavel = extrairValorInstavel(cartaAtacante);
  if (valorInstavel > 0) {
    cartaAtacante.Vida -= valorInstavel;
    cartaAlvo.Vida -= valorInstavel;
  }

  if (cartaAtacante.Vida > 0 && cartaAlvo.Vida > 0) {
    cartaAlvo.Vida -= cartaAtacante.Força;
    cartaAtacante.Vida -= cartaAlvo.Força;
  }

  cartaAtacante.exaustao = true;

  estado.campo[userId] = estado.campo[userId].filter((carta) => {
    if (carta.Vida <= 0) {
      estado.jogadores[userId].cemiterio.push(carta);
      return false;
    }
    return true;
  });

  estado.campo[oponenteId] = estado.campo[oponenteId].filter((carta) => {
    if (carta.Vida <= 0) {
      estado.jogadores[oponenteId].cemiterio.push(carta);
      return false;
    }
    return true;
  });
}

module.exports = {
  passarTurno,
  jogarCarta,
  atacarFortaleza,
  declararAtaque,
};
