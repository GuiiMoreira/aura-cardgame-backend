const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables } = require('../sockets/manager');

function criarEstado({ atacante, alvo }) {
    return {
        jogadores: {
            j1: { cemiterio: [] },
            j2: { cemiterio: [] }
        },
        campo: {
            j1: [atacante],
            j2: [alvo]
        }
    };
}

test('combate: atacante sobrevive e alvo morre', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 100, Força: 80, exaustao: false },
        alvo: { id: 'b1', Vida: 70, Força: 30, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1.length, 1);
    assert.equal(estado.campo.j1[0].Vida, 70);
    assert.equal(estado.campo.j1[0].exaustao, true);

    assert.equal(estado.campo.j2.length, 0);
    assert.equal(estado.jogadores.j2.cemiterio.length, 1);
    assert.equal(estado.jogadores.j2.cemiterio[0].id, 'b1');
});

test('combate: ambos morrem após troca de dano', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 50, Força: 50, exaustao: false },
        alvo: { id: 'b1', Vida: 50, Força: 50, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1.length, 0);
    assert.equal(estado.campo.j2.length, 0);
    assert.equal(estado.jogadores.j1.cemiterio.length, 1);
    assert.equal(estado.jogadores.j2.cemiterio.length, 1);
});

test('combate: alvo sobrevive e atacante morre por contragolpe', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 40, Força: 30, exaustao: false },
        alvo: { id: 'b1', Vida: 90, Força: 60, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1.length, 0);
    assert.equal(estado.jogadores.j1.cemiterio.length, 1);
    assert.equal(estado.jogadores.j1.cemiterio[0].id, 'a1');

    assert.equal(estado.campo.j2.length, 1);
    assert.equal(estado.campo.j2[0].Vida, 60);
    assert.equal(estado.jogadores.j2.cemiterio.length, 0);
});

test('combate: mecânica Instável é aplicada antes da troca de dano', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 100, Força: 20, Mecânica: 'Instável(3)', exaustao: false },
        alvo: { id: 'b1', Vida: 80, Força: 10, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1[0].Vida, 60);
    assert.equal(estado.campo.j2[0].Vida, 30);
});

test('combate: Instável pode matar antes da troca de dano', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 20, Força: 50, Mecânica: 'Instável(2)', exaustao: false },
        alvo: { id: 'b1', Vida: 90, Força: 80, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1.length, 0);
    assert.equal(estado.jogadores.j1.cemiterio.length, 1);

    assert.equal(estado.campo.j2.length, 1);
    assert.equal(estado.campo.j2[0].Vida, 70);
    assert.equal(estado.jogadores.j2.cemiterio.length, 0);
});


test('combate: Instável sem valor numérico não quebra o combate', () => {
    const estado = criarEstado({
        atacante: { id: 'a1', Vida: 100, Força: 20, Mecânica: 'Instável', exaustao: false },
        alvo: { id: 'b1', Vida: 80, Força: 10, exaustao: false }
    });

    __testables.resolverCombateDeclarado(estado, 'j1', 'a1', 'b1');

    assert.equal(estado.campo.j1[0].Vida, 90);
    assert.equal(estado.campo.j2[0].Vida, 60);
});
