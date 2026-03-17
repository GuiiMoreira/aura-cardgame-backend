# Cartas do jogo

Este arquivo reúne o conteúdo enviado, organizado em seções Markdown com blocos de código em JavaScript.

## cardsClaDaCinza

```javascript
const cardsClaDaCinza = [
    {
        "Nome": "Canhoneiro Cego", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Anão", "Classe": "Combatente", "Raridade": "Incomum", "C": 20, "M": 0, "O": 10, "A": 0, "Vida": 50, "Força": 40, "Mecânica": "Recarregável (1)", "DescricaoMecanica": "Ao atacar, aguarde 1 turno para atacar novamente.", "Efeito": "", "Flavor": "Ele diz que a mira atrapalha."
    },
    {
        "Nome": "Recruta Fuliginoso", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Combatente", "Raridade": "Comum", "C": 20, "M": 10, "O": 10, "A": 0, "Vida": 30, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Uma bomba com telhado."
    },
    {
        "Nome": "Testador de Vapores", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Alquimista", "Raridade": "Comum", "C": 20, "M": 0, "O": 10, "A": 0, "Vida": 30, "Força": 20, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Silêncio absoluto. E medo absoluto."
    },
    {
        "Nome": "Operário da Fumaça", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Anão", "Classe": "Combatente", "Raridade": "Comum", "C": 20, "M": 0, "O": 10, "A": 0, "Vida": 20, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Ninguém vê. Ninguém respira."
    },
    {
        "Nome": "Derik, o Herege da Centelha", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Alquimista", "Raridade": "Rara", "C": 30, "M": 10, "O": 10, "A": 20, "Vida": 90, "Força": 40, "Mecânica": "Instável (2)", "DescricaoMecanica": "Ao atacar, causa 20 de dano a si e ao inimigo alvo.", "Efeito": "", "Flavor": "Ele não descobriu a pólvora. Ele a invocou."
    },
    {
        "Nome": "Soldado de Ensaio", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Combatente", "Raridade": "Comum", "C": 20, "M": 10, "O": 10, "A": 10, "Vida": 50, "Força": 30, "Mecânica": "Instável (1)", "DescricaoMecanica": "Ao atacar, causa 10 de dano a si e ao inimigo alvo.", "Efeito": "", "Flavor": "Primeiro atiramos. Depois vemos se valeu a pena."
    },
    {
        "Nome": "Mestre do Sopro Sombrio", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Elfo", "Classe": "Alquimista", "Raridade": "Incomum", "C": 20, "M": 0, "O": 20, "A": 20, "Vida": 70, "Força": 30, "Mecânica": "Instável (2)", "DescricaoMecanica": "Ao atacar, causa 10 de dano a si e ao inimigo alvo.", "Efeito": "", "Flavor": "Ele respira o que nos mata."
    },
    {
        "Nome": "Aprendiz Descontrolado", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Alquimista", "Raridade": "Comum", "C": 10, "M": 0, "O": 0, "A": 30, "Vida": 40, "Força": 20, "Mecânica": "Instável (1)", "DescricaoMecanica": "Ao atacar, causa 10 de dano a si e ao inimigo alvo.", "Efeito": "", "Flavor": "Ele não sabe o que faz. E é por isso que dá certo."
    },
    {
        "Nome": "Portador da Carga", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Orc", "Classe": "Fanático", "Raridade": "Comum", "C": 30, "M": 10, "O": 0, "A": 0, "Vida": 60, "Força": 20, "Mecânica": "", "DescricaoMecanica": "Ao sofrer dano, aplica 1 resíduo de pólvora a si. Com 3 resíduos, Portador da carga se explode, e causa 20 de dano ao personagem que atacou.", "Efeito": "", "Flavor": "Carrega pólvora nas costas. Não o abrace."
    },
    {
        "Nome": "Sabotador de Fornalha", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Goblin", "Classe": "Fanático", "Raridade": "Comum", "C": 10, "M": 10, "O": 10, "A": 10, "Vida": 60, "Força": 30, "Mecânica": "", "DescricaoMecanica": "Sabotador de fornalha só pode atacar construções.", "Efeito": "", "Flavor": "A ciência fede."
    },
    {
        "Nome": "Lenza, Forjadora da Ruptura", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humana", "Classe": "Alquimista", "Raridade": "Lendária", "C": 20, "M": 10, "O": 20, "A": 30, "Vida": 90, "Força": 40, "Mecânica": "Alquimia (4)", "DescricaoMecanica": "Consuma 4 cartas do cemitério para ativar o efeito.", "Efeito": "Destrua resíduos de pólvora de uma carta e cause 20 de dano por resíduo ou aplique 3 resíduos de pólvora na carta alvo.", "Flavor": "A magia falhou. Ela a reinventou com coragem."
    },
    {
        "Nome": "Meliot, Fios Vivos", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Gnoma", "Classe": "Combatente", "Raridade": "Rara", "C": 30, "M": 0, "O": 10, "A": 10, "Vida": 60, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "Ao atacar aplica 1 marcador de resíduo de pólvora na carta inimiga. Se a carta já possuir 3 ou mais resíduos de pólvora, consuma todos e cause 10 de dano por marcador destruído.", "Flavor": "Cada fio canta uma nota do caos."
    },
    {
        "Nome": "Jino e Jeno, Gêmeos do Fulgor", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humanos", "Classe": "Fanático", "Raridade": "Incomum", "C": 60, "M": 0, "O": 20, "A": 20, "Vida": 80, "Força": 30, "Mecânica": "Instável (2)", "DescricaoMecanica": "Ao atacar, causa 20 de dano a si e ao inimigo alvo.", "Efeito": "Ao atacar, dobre o ataque ou escolha dois alvos. Em seguida, cause 20 de dano a si.", "Flavor": "O que é queimado, retorna em força."
    },
    {
        "Nome": "Engenheiro da Fumaça", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Combatente", "Raridade": "Incomum", "C": 20, "M": 0, "O": 20, "A": 0, "Vida": 50, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "A cada 2 turnos, gera 10 de Aura.", "Flavor": "Precisa de pólvora para funcionar? Perfeito."
    },
    {
        "Nome": "Mercador da Brasa", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Goblin", "Classe": "Fanático", "Raridade": "Comum", "C": 30, "M": 0, "O": 10, "A": 0, "Vida": 40, "Força": 20, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "1 vez por turno você pode vender 20 de Material Bruto por 10 de ouro", "Flavor": "Onde falta segurança, sobra criatividade."
    },
    {
        "Nome": "Grelta, Alquimista da Faísca", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humana", "Classe": "Alquimista", "Raridade": "Incomum", "C": 20, "M": 0, "O": 10, "A": 30, "Vida": 60, "Força": 30, "Mecânica": "Alquimia (6)", "DescricaoMecanica": "Consuma 6 cartas do cemitério para ativar o efeito.", "Efeito": "Uma vez por turno, Cause 30 de dano ou recupere 30 de vida de uma carta.", "Flavor": "O que explode hoje pode curar amanhã."
    },
    {
        "Nome": "Xênia, Tecelã de Pólvora", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humana", "Classe": "Alquimista", "Raridade": "Rara", "C": 30, "M": 0, "O": 10, "A": 30, "Vida": 70, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "DescricaoMecanica": "Consuma 4 cartas do cemitério para ativar o efeito.", "Efeito": "1 vez por turno aplica 1 resíduo de pólvora a uma carta.", "Flavor": "Ela enxerga através da fumaça e do medo."
    },
    {
        "Nome": "Zereda, a Explosiva", "Senda": "A Arte Ígnea", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Alquimista", "Raridade": "Incomum", "C": 10, "M": 0, "O": 20, "A": 30, "Vida": 40, "Força": 40, "Mecânica": "Instável (2)", "DescricaoMecanica": "Ao atacar, causa 20 de dano a si e ao inimigo alvo.", "Efeito": "Ao morrer, cause 20 de dano a uma carta.", "Flavor": "Ela não pergunta onde. Só explode."
    },
    {
        "Nome": "Toque do Fogo Negro", "Senda": "A Arte Ígnea", "Tipo": "Feitiço", "Subtipo": "", "Classe": "", "Raridade": "Comum", "C": 0, "M": 10, "O": 0, "A": 10, "Vida": null,
        "Força": null,
        "Mecânica": "", "DescricaoMecanica": "", "Efeito": "Adiciona 1 resíduo de pólvora a uma carta.", "Flavor": "A dor é invisível. Só se ouve o grito."
    }
];
```

## cardsCirculoDasBrumas

```javascript
const cardsCirculoDasBrumas = [
    {
        "Nome": "Vigia das Vozes", "Senda": "Bruma Anímica", "Tipo": "Personagem", "Subtipo": "Elfo", "Classe": "Combatente", "Raridade": "Comum", "C": 20, "M": 0, "O": 10, "A": 10, "Vida": 50, "Força": 20, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Seu arco está impregnado de fel."
    },
    {
        "Nome": "Aderente da Corrupção", "Senda": "Bruma Anímica", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Fanático", "Raridade": "Comum", "C": 20, "M": 0, "O": 10, "A": 10, "Vida": 40, "Força": 20, "Mecânica": "Resíduo Áurico (1)", "DescricaoMecanica": "Ao invocar um feitiço, ela recebe 1 resíduo de aura.", "Efeito": "", "Flavor": "Sorri enquanto apodrece por dentro."
    }
];
```

## cardsTribosDoVazio

```javascript
const cardsTribosDoVazio = [
    {
        "Nome": "Coletor de Sementes", "Senda": "A Senda Disforme", "Tipo": "Personagem", "Subtipo": "Gnomo", "Classe": "Druida", "Raridade": "Comum", "C": 30, "M": 0, "O": 10, "A": 0, "Vida": 50, "Força": 20, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Suas sacolas carregam cura e caos."
    },
    {
        "Nome": "Combatente Folhamuda", "Senda": "A Senda Disforme", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Combatente", "Raridade": "Comum", "C": 20, "M": 10, "O": 0, "A": 10, "Vida": 40, "Força": 30, "Mecânica": "", "DescricaoMecanica": "", "Efeito": "", "Flavor": "Anda sem som, como o vento entre as árvores."
    }
];
```

## cardsFilhosDoEstilhaço

```javascript
const cardsFilhosDoEstilhaço = [
    {
        "Nome": "Cria do Fim", "Senda": "Estilhaços da Aurora", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Fanático", "Raridade": "Comum", "C": 20, "M": 10, "O": 0, "A": 0, "Vida": 40, "Força": 10, "Mecânica": "Sacrifício (1)", "DescricaoMecanica": "Sacrifique-se.", "Efeito": "Ao ser sacrificado, causa 20 de dano a uma carta alvo.", "Flavor": "Nasce sabendo que vai explodir."
    },
    {
        "Nome": "Bombardeador de Pó", "Senda": "Estilhaços da Aurora", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Fanático", "Raridade": "Comum", "C": 30, "M": 10, "O": 10, "A": 0, "Vida": 50, "Força": 20, "Mecânica": "Sacrifício (1)", "DescricaoMecanica": "Sacrifique-se.", "Efeito": "Ao ser sacrificado, destrua uma construção com vida ≤ 30.", "Flavor": "Sua fé termina em gritos."
    }
];
```

## cardsUltimaFe

```javascript
const cardsUltimaFe = [
    {
        "Nome": "Portador da Graça Menor", "Senda": "A Teurgia Imaculada", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Sacerdote", "Raridade": "Incomum", "C": 30, "M": 0, "O": 0, "A": 10, "Vida": 40, "Força": 10, "Mecânica": "Antimagia (1)", "DescricaoMecanica": "Esta carta não pode ser alvo de feitiços inimigos, a menos que o jogador pague 10 de aura.", "Efeito": " Uma vez por turno, pague 10 de aura para curar 10 de vida de um aliado e remover um marcador qualquer.", "Flavor": "Seu sussurro desfaz maldições."
    },
    {
        "Nome": "Guarda-Cruz da Purificação", "Senda": "A Teurgia Imaculada", "Tipo": "Personagem", "Subtipo": "Humano", "Classe": "Paladino", "Raridade": "Incomum", "C": 30, "M": 0, "O": 10, "A": 10, "Vida": 80, "Força": 20, "Mecânica": "Antimagia (1)", "DescricaoMecanica": "Esta carta não pode ser alvo de feitiços inimigos, a menos que o jogador pague 10 de aura.", "Efeito": " 1 vez por turno Guarda-Cruz da Purificação pode redirecionar dano de feitiços para si.", "Flavor": "Suor e fé purificam a pólvora."
    }
]
```

## cardsNeutros

```javascript
const cardsNeutros = [
    {
        Nome: "Trabalhador da Colheita", Senda: "-", Tipo: "Personagem", Subtipo: "Humano", Classe: "Camponês", Raridade: "Comum", C: 10, M: 0, O: 10, A: 0, Vida: 10, Força: 10, Mecânica: "", DescricaoMecanica: "", Efeito: "Ao entrar, gere 10 de Comida. A cada 2 turnos gere mais 10 de comida.", Flavor: "Cultiva com suor e esperança."
    },
    {
        Nome: "Lenhador Errante", Senda: "-", Tipo: "Personagem", Subtipo: "Humano", Classe: "Trabalhador", Raridade: "Comum", C: 10, M: 0, O: 10, A: 0, Vida: 10, Força: 10, Mecânica: "", DescricaoMecanica: "", Efeito: "Ao entrar, gere 10 de material. A cada 2 turnos gere mais 10 de material.", Flavor: "Seus machados contam histórias."
    }
];
```
