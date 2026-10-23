# Plano: Importar SVG e gerar G-code

Projeto: **cncjs** — controlador CNC (Node/Express + React) para Grbl, Marlin, Smoothieware e TinyG.

## Objetivo

Permitir que o usuário solte um arquivo **SVG** no workspace e o sistema gere e carregue o
**G-code** correspondente, com parâmetros configuráveis (feed, potência, passes, etc).

## Escopo decidido

- **SVG vetorial (stroke)** apenas. Sem raster/fill na primeira versão.
- Conversão **server-side** (testável pelo Jest atual e reaproveitável por API/watch folder).
- Entrada via **dropzone do workspace + modal de parâmetros**.

## Fluxo atual relevante (referência)

- Upload: `src/app/containers/Workspace/Workspace.jsx:266` (`onDrop`) lê o arquivo como texto e
  chama `api.loadGCode` (`src/app/api/index.js:143`) -> `POST /api/gcode`.
- Backend: `src/server/api/api.gcode.js` -> `controller.command('gcode:load', ...)` ->
  streaming em `src/server/controllers/Grbl/GrblController.js:1367`.
- Visualização: o Visualizer consome `gcode:load` via pubsub.
- Widgets são registrados em 3 lugares: `Widget.jsx` (import), `WidgetManager.jsx` (`widgetList`)
  e `src/app/store/defaultState.js`.
- Jest roda apenas em `src/server/**` com `testEnvironment: node`.

---

## Fase 1 - Dependências

Adicionar ao `package.json` (runtime, funcionam em Node, sem DOM):

- `svgpath` — normaliza paths e aplica `transform`/`matrix`.
- `fast-xml-parser` — parse do SVG em Node (sem DOM).

**Verificar:** `yarn install` e `yarn build` sem erros.

## Fase 2 - Núcleo de conversão

Novo arquivo: `src/server/lib/svg-to-gcode.js` (função pura e testável).

```js
convertSvgToGcode(svgString, options) -> { gcode, bbox }
```

`options`:

| Opção            | Descrição                                            |
|------------------|------------------------------------------------------|
| `feedRate`       | Velocidade de corte (G1).                            |
| `travelRate`     | Velocidade de deslocamento (G0).                    |
| `power`          | Valor S aplicado quando `maxS` não é usado.          |
| `maxS`           | Valor S máximo (potência normalizada 0-100%).        |
| `passes`         | Número de passadas por contorno.                     |
| `laserMode`      | `M3` (constante) ou `M4` (dinâmico).                |
| `scale`          | Escala de conversão SVG -> mm.                       |
| `offsetX/offsetY`| Translação da origem.                                |
| `invertY`        | Inverte Y (SVG cresce para baixo, máquina para cima).|
| `curveTolerance` | Tolerância de achatamento de curvas.                |

Pipeline interno:

1. Parse XML (`fast-xml-parser`) -> coleta `viewBox`, `width`, `height`, unidades.
2. Extrai geometria de `path`, `line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`.
3. Normaliza cada forma para `d` e aplica transforms com `svgpath`.
4. Achata curvas (C/Q/A) em segmentos conforme `curveTolerance`.
5. Converte para mm, inverte Y (se configurado) e aplica offset para quadrante positivo.
6. Emite G-code GRBL:

```
G21 G90
G0 Z<focus>
; por contorno, por passe:
G0 X.. Y.. F<travel>
M3/M4 S<power>
G1 X.. Y.. F<feed>
...
M5
G0 X0 Y0
```

7. Calcula e retorna o `bbox` para validação de limites da área de trabalho.

**Verificar:** `src/server/lib/__tests__/svg-to-gcode.test.js` com fixtures:
retângulo, círculo, path com Bézier, `transform`, `viewBox`. Rodar `yarn test`.

## Fase 3 - Endpoint server

- Novo `src/server/api/api.svg.js`: `POST /api/svg` recebe `{ port, name, svg, options }`,
  valida port/svg (espelhando `api.gcode.js`), converte e chama
  `controller.command('gcode:load', name, gcode, ...)`.
- Registrar em `src/server/api/index.js` e na rota em `src/server/app.js:267`.

**Verificar:** teste unitário do handler; `POST` manual retornando o estado do sender.

## Fase 4 - Client API

`src/app/api/index.js`: adicionar `loadSVG(options)` análogo a `loadGCode` (`POST /api/svg`).

## Fase 5 - Dropzone + modal

Em `src/app/containers/Workspace/Workspace.jsx:266`:

1. Detectar `file.type === 'image/svg+xml'` ou extensão `.svg`.
2. Abrir modal de parâmetros (novo componente em `src/app/containers/Workspace/modals/`,
   usando `app/components/Modal`), com defaults persistidos via settings.
3. Ao confirmar: ler texto (`readAsText`) e chamar `api.loadSVG`, publicando `gcode:load`
   para o Visualizer atualizar (igual ao fluxo atual).
4. Arquivos não-SVG mantêm o fluxo atual.

**Verificar:** soltar um SVG -> G-code aparece no Visualizer e no widget G-code.

## Fase 6 - Finalização

- Strings i18n em `src/app/i18n/*` (obrigatório para `yarn lint`).
- Rodar `yarn lint` (ESLint + Stylint + i18n) e `yarn test`.
- Adicionar `.svg` de exemplo em `examples/` e nota no `CHANGELOG.md`.

---

## Riscos / pontos de atenção

- **Y invertido:** SVG cresce para baixo, máquina para cima. Sem isso a peça sai espelhada.
- **Unidades:** SVG costuma ser `px` (96dpi). Sem `width/height` em mm, precisa de `scale` explícito.
- **Transforms aninhados** (`matrix`, `translate`, `rotate`, `scale`, `viewBox`) — erro comum se
  usar só o `d` cru.
- **Círculos/arcos** viram segmentos; `curveTolerance` afeta o tamanho do arquivo.
- **Bounds:** validar que o bbox cabe na área de trabalho antes de enviar.
- **Z de foco:** não há altura definida; decidir se emite `G0 Z` fixo ou ignora.

## Ordem de implementação sugerida

1. Fase 2 (núcleo + testes) — base de tudo.
2. Fase 1 (deps, se ainda não feito).
3. Fase 3 (endpoint) + Fase 4 (client API).
4. Fase 5 (dropzone + modal).
5. Fase 6 (i18n, lint, docs).

---

## Fase 7 - Import de STL (sl)

Slicing horizontal do mesh para gerar contornos 2D, reaproveitando o emissor de G-code do SVG.

- `src/server/lib/svg-to-gcode.js`: extraído `polylinesToGcode(polylines, options)` (emissor comum).
- `src/server/lib/stl-to-gcode.js`: `parseStl` (binário/ASCII), `sliceTriangles` (plano Z),
  `chainSegments` (junção por referência de vértice partilhado) e `convertStlToGcode`.
  `z` por defeito = meio da altura do modelo.
- `src/server/api/api.stl.js` + rota `POST /api/stl`.
- Cliente: `api.loadSTL`, modal com campo `Slice Z (mm)`, dropzone aceita `.stl`,
  botão "Import SVG / STL".
- Testes: `stl-to-gcode.test.js` (9) e `api.stl.test.js` (6). Total 33 nos 4 ficheiros SVG+STL.

**Verificar:** soltar um `.stl` -> contorno no Visualizer. Testado E2E com `Base plakit v2.stl`
(60x30mm, 52 linhas) e `MECPOW - Regua.stl` (120x120mm).

## Fase 8 - Modos de gravação (Line / Fill / Both)

- Novas opções `engraveMode` (`line`, `fill`, `both`), `fillSpacing` (mm) e `fillAngle` (graus)
  em `polylinesToGcode`, partilhadas por SVG e STL.
- O Fill gera linhas de hachura com regra even-odd (buracos ficam vazios). No SVG cada forma é
  preenchida individualmente (formas sobrepostas fazem união); no STL os contornos do slice são
  tratados como um único grupo.
- O modal de importação tem o seletor **Engraving Mode**, campos de espaçamento/ângulo e guarda os
  últimos valores em `localStorage` (`cncjs.import.lastValues`).

## Fase 9 - Perfis de Laser (perfis de material/operação)

### Objetivo

Salvar, selecionar e editar perfis de gravação/corte (potência, velocidade, passes, modo de
gravação, fill, air assist), organizados por material e vinculados ao **Machine Profile** ativo.
Os perfis ficam persistidos no servidor.

### Decisões

| Tema | Decisão |
|---|---|
| Máquina | Mecpow M1, laser diodo 3.5 W |
| Processo | Somente laser: **gravar** e **cortar** (`line`/`fill`/`both`) |
| Vínculo | Todo perfil pertence a um `machineProfileId` |
| Persistência | Servidor via `configstore` (`~/.cncrc`, chave `jobProfiles`) |
| Diálogo de importação | Selecionar, editar, **Salvar** (atualiza) e **Salvar como** |
| Z | Fora do MVP: `focusZ`/`z`/`zStep` não entram no perfil |
| Setup do job | Fora do perfil: `scale`, `invertY`, `offsetX`, `offsetY`, slice Z |

### Modelo de dados

```json
{
  "id": "uuid",
  "version": 1,
  "machineProfileId": "uuid",
  "name": "MDF 3mm — Corte",
  "material": "wood",
  "materialLabel": "MDF",
  "thickness": 3,
  "operation": "cut",
  "notes": "",
  "favorite": false,
  "params": {
    "powerPercent": 100,
    "laserMode": "M4",
    "feedRate": 150,
    "travelRate": 3000,
    "passes": 4,
    "engraveMode": "line",
    "fillSpacing": 0.2,
    "fillAngle": 0,
    "fan": true
  },
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

`powerPercent` é sempre armazenado em `%` e convertido para `S` no momento do import
(`$30` do Grbl), para o perfil funcionar em qualquer controlador.

### Persistência

- `src/server/services/configstore` grava JSON em `~/.cncrc` (configurável com `--config`).
- Mesmo padrão de `api.machines.js`: `CONFIG_KEY = 'jobProfiles'`, `config.get` / `config.set`.
- Limitações aceitáveis: JSON único, sem transações, uma instância de servidor.
- Docker dev: o `docker-compose.yml` usa o volume nomeado `cncjs-config` em `/data/.cncrc`
  (`CNCJS_CONFIG_FILE`), então os perfis sobrevivem a `docker compose down/up`.

### API e arquivos

```
GET    /api/profiles[?machineProfileId=...]
POST   /api/profiles
GET    /api/profiles/:id
PUT    /api/profiles/:id
DELETE /api/profiles/:id
```

- `src/server/api/api.profiles.js` + testes em `src/server/api/__tests__/api.profiles.test.js`
- `src/server/api/index.js`, `src/server/app.js`
- `src/app/api/index.js` (namespace `profiles`)
- `src/app/lib/laserProfiles.js` (enums, defaults, sanitização, conversão perfil ↔ formulário)
- `src/app/containers/Settings/LaserProfiles/` (CRUD)
- `src/app/containers/Settings/Settings.jsx` (nova seção)
- `src/app/containers/Workspace/modals/SvgImport.jsx` e `SaveProfileModal.jsx`
- `src/app/widgets/Visualizer/RunModal.jsx` (seletor + salvar no perfil)

### UX

- **Importação:** seletor de perfil no topo, resumo (`material · espessura · operação · potência ·
  feed · passes`), badge `alterado`, botões `Salvar`, `Salvar como…`, `Restaurar`. Último perfil
  usado por máquina fica em `localStorage` (`cncjs.import.lastProfile.<machineProfileId>`).
- **Layout do modal:** abas **Laser**, **Gravação** e **Posicionamento**, campos em grade
  responsiva (160–220 px por campo), modal largo (95vw, máx. 1100 px) e corpo com rolagem
  vertical em telas baixas.
- **Settings:** tabela com Nome, Máquina, Material, Espessura, Operação, Potência, Feed, Passes,
  Favorito e ações (editar, duplicar, excluir).
- **Run (PLAY):** diálogo largo com abas **Laser**, **Gravação** e **Posicionamento**, expondo
  todos os parâmetros do perfil (não só potência/velocidade/fan). O painel de perfil tem
  `Aplicar`, `Salvar` e `Salvar como…`; o rodapé tem `Pré-visualizar` e `Iniciar`.
  Com **Gerar o G-code novamente a partir da origem antes de iniciar** marcado (padrão quando há
  SVG/STL importado), o `Iniciar` reconstrói o G-code com passes/fill/modo/posicionamento e inicia.
  Desmarcado, aplica apenas potência/velocidade/fan ao G-code carregado. `Pré-visualizar` reconstrói
  sem iniciar.
- Perfis são filtrados pelo Machine Profile ativo; sem máquina selecionada, salvar fica desabilitado.

### Parâmetros sugeridos (M1 3.5 W, pontos de partida)

| Perfil | Op. | Potência | Feed | Passes | Modo | Fill |
|---|---|---:|---:|---:|---|---|
| Papel 0,1 mm | cut | 10–15% | 700–900 | 1 | line | — |
| Papelão 2 mm | cut | 40–60% | 300–450 | 2 | line | — |
| Adesivo/vinil | cut | 15–25% | 700–1000 | 1 | line | — |
| Adesivo/vinil | engrave | 10–20% | 2000–3000 | 1 | fill | 0,10–0,15 |
| MDF 3 mm | cut | 90–100% | 130–180 | 4–6 | line | — |
| MDF 3 mm | engrave | 35–55% | 1200–1800 | 1 | fill | 0,15–0,20 |
| Madeira dura 5 mm | cut | 100% | 90–130 | 6–8 | line | — |
| Acrílico preto 3 mm | cut | 70–90% | 200–300 | 2–3 | line | — |
| Couro 2 mm | cut | 45–60% | 300–450 | 2 | line | — |
| Metal (marcação) | engrave | 100% | 300–600 | 1–2 | line | — |
| PLA 2 mm | cut | 55–70% | 250–400 | 2–3 | line | — |
| ABS 2 mm | cut | 45–60% | 300–450 | 2–3 | line | — |

> Valores indicativos; testar em retalho. O diodo de 3,5 W não corta metal.

### Verificação

- `jest`: 614 testes passando (9 novos em `api.profiles`).
- `eslint`: sem erros nos arquivos alterados.
- `webpack`: bundle compila.
