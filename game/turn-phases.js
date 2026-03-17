const TURN_PHASES = Object.freeze({
  RITUAL_DE_GERACAO: 'Ritual de Geração',
  REVELACAO: 'Revelação',
  MANIFESTACAO: 'Manifestação',
  GUERRA_DOS_VEUS: 'Guerra dos Véus',
  SILENCIO_FINAL: 'Silêncio Final',
});

const TURN_PHASE_SEQUENCE = Object.freeze([
  TURN_PHASES.RITUAL_DE_GERACAO,
  TURN_PHASES.REVELACAO,
  TURN_PHASES.MANIFESTACAO,
  TURN_PHASES.GUERRA_DOS_VEUS,
  TURN_PHASES.SILENCIO_FINAL,
]);

class InvalidPhaseActionError extends Error {
  constructor(actionName, faseAtual, fasesPermitidas) {
    const fasesPermitidasTexto = fasesPermitidas.join(', ');
    super(
      `A ação "${actionName}" não é permitida na fase "${faseAtual}". Fase(s) permitida(s): ${fasesPermitidasTexto}.`
    );
    this.name = 'InvalidPhaseActionError';
    this.code = 'ACAO_FASE_INVALIDA';
    this.actionName = actionName;
    this.faseAtual = faseAtual;
    this.fasesPermitidas = fasesPermitidas;
  }
}

function getNextPhase(faseAtual) {
  const idxAtual = TURN_PHASE_SEQUENCE.indexOf(faseAtual);
  if (idxAtual === -1) {
    return TURN_PHASE_SEQUENCE[0];
  }

  if (idxAtual === TURN_PHASE_SEQUENCE.length - 1) {
    return TURN_PHASE_SEQUENCE[0];
  }

  return TURN_PHASE_SEQUENCE[idxAtual + 1];
}

function assertActionAllowedInPhase(estado, actionName, allowedPhases) {
  const faseAtual = estado.fase;
  if (allowedPhases.includes(faseAtual)) {
    return;
  }

  throw new InvalidPhaseActionError(actionName, faseAtual, allowedPhases);
}

module.exports = {
  TURN_PHASES,
  TURN_PHASE_SEQUENCE,
  InvalidPhaseActionError,
  getNextPhase,
  assertActionAllowedInPhase,
};
