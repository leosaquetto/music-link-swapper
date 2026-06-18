# Music Link Swapper - especificacao do estado atual

Documento de mapeamento do projeto como ele esta hoje. Ele descreve a superficie existente, as integracoes e os pontos frageis observados no codigo atual, sem assumir que tudo esta funcionando em producao e sem propor correcoes nesta etapa.

## Visao geral

O Music Link Swapper e um web app estatico com uma funcao serverless para converter ou descobrir links de musica entre plataformas de streaming. A interface roda diretamente a partir de `index.html`, `style.css` e `app.js`; a conversao e centralizada em `api/convert.js`.

A aplicacao parece desenhada para uso mobile-first/PWA, com suporte a instalacao no iPhone, atalhos, clipboard, compartilhamento nativo, historico local e tema claro/escuro. O deploy esperado e Vercel, indicado pela pasta `api/` e por `vercel.json`.

Nao ha `package.json`, scripts locais, dependencias instalaveis, harness de testes ou pipeline real de build neste repositorio raiz. A pasta `reference/idonthavespotify` contem uma copia de referencia de outro projeto e nao parece participar diretamente do runtime do Music Link Swapper.

## Estrutura do repositorio

- `index.html`: shell HTML da aplicacao, metatags PWA, estrutura da UI, modais, footer e import de `app.js`.
- `style.css`: todo o sistema visual do app, incluindo temas, layout mobile, cards, modais, listas de plataformas, botoes, estados e responsividade.
- `app.js`: logica principal do frontend, traducoes, eventos, chamada da API, normalizacao de payload, renderizacao de resultados, historico local, clipboard, share e tema.
- `api/convert.js`: endpoint serverless `POST /api/convert`, integracoes externas, fallback de metadados, cache em memoria, rate limit e normalizacao de links.
- `manifest.json`: manifesto PWA com nome, icones, display standalone, protocol handler `web+swapper` e launch handler.
- `telegram.js`: helper para Telegram WebApp, mas nao esta importado por `index.html` no estado atual.
- `vercel.json`: somente declara o schema da Vercel, sem rotas, rewrites, headers ou configuracoes adicionais.
- `.github/workflows/blank.yml`: workflow placeholder gerado pelo GitHub Actions, sem validacao real do projeto.
- `assets/`: contem `logo.png`, `logo.svg`, `logo_transparent.svg`, `leosaquetto.svg` e `faveicon.png`.
- `reference/idonthavespotify/`: projeto de referencia vendorizado, com README, parsers, adapters, schemas, services e utils em TypeScript.

## Superficies do produto

O app oferece duas formas principais de uso:

- Conversao por link: o usuario cola um link de streaming suportado e envia para `/api/convert`.
- Pesquisa por texto: o usuario alterna para modo busca e digita artista + musica, enviando `queryMode: true`.

Fluxos complementares existentes:

- Sorteio de exemplos a partir de uma lista fixa de links do Apple Music.
- Historico local de ate 5 swaps recentes.
- Copia do link original, copia dos links principais e copia individual por plataforma.
- Compartilhamento nativo dos links principais ou de uma plataforma especifica via `navigator.share`, quando disponivel.
- Abertura de links em nova aba ou, em mobile, tentativa de deeplink por esquema de plataforma.
- Modal com instrucoes para instalar como Web App no iPhone.
- Link para Shortcut do iCloud no footer.
- Modais internos de politica de privacidade e termos de uso.
- Menu de idioma com PT-BR, EN, ES, IT e FR.
- Tema claro/escuro persistido localmente.

## Frontend

`index.html` define uma unica pagina, sem framework. O script carregado no final do body e apenas `./app.js`.

O frontend mantem estado em memoria no objeto `state` em `app.js`. Esse estado cobre idioma, loading, resultado atual, URL original, modo pesquisa, tema, modais, historico recente e timers de UI.

Principais responsabilidades de `app.js`:

- Inicializar a aplicacao no `DOMContentLoaded`.
- Sincronizar tema inicial com `localStorage` e `meta[name="theme-color"]`.
- Renderizar chips de plataformas suportadas.
- Controlar input, paste, clear, sample shuffle, busca e conversao.
- Montar o payload para `POST /api/convert`.
- Validar superficialmente links de streaming antes de chamar a API.
- Normalizar resposta da API para um modelo de UI.
- Renderizar capa, titulo, artista/descricao, grupos de plataformas, badges e legendas.
- Adicionar links de busca por plataforma quando faltam links diretos.
- Persistir e renderizar historico local.
- Controlar modais de iOS install, historico e legal.
- Controlar clipboard, share, haptics e deeplinks.

O HTML inclui assets remotos para a marca principal, especialmente o GIF `https://i.imgur.com/T1uEx9T.gif?v=20260411`, alem de assets locais para icones e assinatura.

## API `/api/convert`

O endpoint exportado por `api/convert.js` aceita somente `POST`. O corpo esperado pode ter dois modos:

- Modo link: `{ link, adapters }`
- Modo pesquisa: `{ queryMode: true, query, adapters }`

Resposta de sucesso esperada:

```json
{
  "ok": true,
  "data": {
    "title": "nome da musica",
    "description": "artista ou contexto",
    "image": "url da capa",
    "links": [
      {
        "type": "spotify",
        "url": "https://...",
        "isVerified": true
      }
    ]
  }
}
```

Resposta de erro esperada:

```json
{
  "ok": false,
  "error": "mensagem amigavel"
}
```

Regras e limites observados:

- Metodo diferente de `POST` retorna 405.
- Links vazios, invalidos, longos demais ou fora dos hosts suportados retornam 400.
- Queries vazias, curtas demais no frontend, longas demais ou com padroes suspeitos retornam erro.
- Timeout padrao de chamadas externas: 6 segundos.
- Limite de concorrencia em memoria: 40 requisicoes simultaneas por instancia.
- Rate limit em memoria:
  - link: 5 requisicoes/10s e 20 requisicoes/60s;
  - query: 3 requisicoes/10s e 10 requisicoes/60s;
  - apos 3 strikes, bloqueio por 10 minutos.
- Cache em memoria para Spotify URL, Spotify query, falhas Spotify e resultados de links de exemplo.
- Os caches e rate limits sao volateis por instancia serverless, portanto nao sao persistentes nem globais.

## Modelo de dados esperado pelo frontend

O frontend espera `payload.ok === true` e `payload.data.links` como array. A partir disso, `normalizeApiPayload` deriva:

- `title`: titulo limpo da musica/conteudo.
- `artist`: artista extraido da descricao ou fallback.
- `description`: texto contextual.
- `image`: capa normalizada.
- `links`: lista normalizada por plataforma.
- `sourceLink`: link original, quando o fluxo veio de link.
- `fromSearchMode`: indica resultado criado por busca textual.

Cada item de plataforma renderizado pelo frontend pode conter:

- `type`/`key`: identificador tecnico da plataforma.
- `name`: nome amigavel.
- `url`: URL final ou URL de busca.
- `isVerified`: sinal de link verificado.
- `notAvailable`: sinal de indisponibilidade.
- `isSearchResult`: derivado quando a URL e uma busca/fallback, nao link direto.
- `icon`: SVG inline escolhido pelo frontend.

As plataformas principais sao agrupadas separadamente das demais. O app tambem tenta adicionar URLs de busca para plataformas ausentes quando ha uma query derivada de titulo + artista.

## Integracoes externas

Integracoes usadas pela API:

- `https://idonthavespotify.sjdonado.com/api/search?v=1`: API primaria para conversao por link.
- `https://api.song.link/v1-alpha.1/links`: Song.link/Odesli como fonte primaria ou fallback.
- `https://itunes.apple.com/search`: busca Apple/iTunes para fallback por query.
- `https://itunes.apple.com/lookup`: lookup por track id quando o link de entrada e Apple Music/iTunes.
- `https://open.spotify.com/oembed`: fallback de metadados Spotify.
- Open Graph do Spotify: tentativa de buscar HTML do link Spotify e extrair metadados.
- `https://www.deezer.com/oembed`: enriquecimento pontual de metadados Deezer.

Prioridade especial:

- Para Pandora, Amazon Music, Tidal, SoundCloud e Qobuz, a API tenta priorizar Song.link antes da API primaria.
- Para Spotify, quando as fontes principais falham, a API tenta obter metadados via Spotify, montar query, buscar Apple Music via iTunes e enriquecer via Song.link/API primaria.
- Para Apple Music/iTunes, a API tenta usar o track id do link de entrada como fonte de verdade para titulo, artista, album e capa.

O rodape do resultado no frontend declara dependencia de `idonthavespotify` e `odesli`.

## PWA, iOS e Telegram

`manifest.json` configura:

- `name`: Music Link Swapper.
- `short_name`: Swapper.
- `display`: standalone.
- `start_url` e `scope`: `/`.
- `protocol_handlers`: `web+swapper` com `/?url=%s`.
- `launch_handler`: `focus-existing`.
- icones `assets/logo.png` em 192x192 e 512x512.

`index.html` inclui metatags de iOS Web App, apple touch icon, favicon SVG/PNG, canonical e Open Graph URL. O app tambem tenta hidratar um link recebido por query string e consumir uma fila de launch params quando disponivel.

O modal de instalacao iOS e interno ao HTML e explica o fluxo de adicionar o app a tela inicial. Ha tambem um card de Shortcut apontando para um link iCloud.

`telegram.js` contem integracao com `window.Telegram.WebApp`, incluindo `ready`, `expand`, tentativa de fullscreen, cores de header/background e variaveis CSS de viewport. No estado atual, este arquivo nao e carregado por `index.html`; portanto, ele existe no repositorio, mas nao participa da pagina principal salvo se for importado por outro ambiente fora deste HTML.

## Armazenamento local

O app usa `localStorage` para:

- `mls-theme`: tema claro/escuro.
- `mls-language`: idioma selecionado.
- `mls-recent-swaps`: historico dos ultimos swaps, limitado a 5 entradas.

O historico recente salva dados suficientes para reabrir/copiar/refazer swaps, incluindo titulo, artista, imagem, links, link original e plataforma de origem quando disponiveis. Esses dados ficam somente no navegador do usuario.

## Deploy e automacao

O repositorio esta estruturado para Vercel por usar `api/convert.js` como funcao serverless e `vercel.json` na raiz. O arquivo `vercel.json` contem apenas:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

Nao ha configuracao explicita de build, headers, redirects, rewrites, regioes ou variaveis de ambiente no arquivo.

O workflow `.github/workflows/blank.yml` e o exemplo basico do GitHub Actions, com `echo Hello, world!` e textos placeholder. Ele nao instala dependencias, nao roda lint, nao roda testes e nao valida deploy.

## Referencia `idonthavespotify`

A pasta `reference/idonthavespotify` inclui uma copia de referencia do projeto IDHS. O README dessa referencia descreve parsers, adapters, web app, Raycast extension, setup com Bun e variaveis para Tidal/YouTube.

No Music Link Swapper atual:

- A referencia nao e importada pelo frontend raiz.
- A referencia nao e importada diretamente por `api/convert.js`.
- A API em producao chama uma instancia externa de IDHS via HTTP.
- A referencia serve como material tecnico para entender a origem/conceito de parsers, adapters e busca invertida, mas nao como dependencia runtime local.

## Estado atual e pontos frageis

Pontos mapeados sem correcao aplicada:

- Nao existe `package.json`; nao ha comando padrao local para instalar, buildar, testar ou iniciar o app.
- Nao ha teste automatizado no repositorio raiz.
- O workflow GitHub Actions e placeholder e nao valida o projeto.
- `telegram.js` existe, mas `index.html` importa somente `app.js`.
- `assets/faveicon.png` existe, mas o HTML usa `assets/logo.svg`, `assets/logo.png`, `assets/logo.png` como apple touch icon e imagens remotas.
- `vercel.json` nao configura nada alem do schema.
- A API depende fortemente de provedores externos que podem mudar, bloquear scraping, alterar payloads ou sair do ar.
- A API primaria `idonthavespotify.sjdonado.com` e externa ao repositorio; seu contrato real pode mudar sem controle local.
- Song.link/Odesli, iTunes, Spotify oEmbed/Open Graph e Deezer oEmbed sao pontos externos de falha.
- Rate limit e caches em memoria nao sobrevivem a cold starts e nao sao compartilhados entre instancias.
- O frontend adiciona fallbacks de busca por plataforma; esses links podem ser uteis, mas nao equivalem a links diretos verificados.
- A lista de exemplos e fixa e focada em links Apple Music.
- Ha textos legais embutidos no `app.js`, nao em documentos separados.
- Nao ha indicacao local de ambiente, variaveis secretas ou observabilidade alem de logs/metric heartbeat no proprio endpoint.

## Checklist sugerido para auditorias futuras

Antes de corrigir ou evoluir o projeto, validar:

- Se `POST /api/convert` responde em producao para um link Apple Music simples.
- Se Spotify ainda fornece metadados via oEmbed ou Open Graph.
- Se Song.link/Odesli ainda aceita os links-alvo e retorna `linksByPlatform`.
- Se a API externa IDHS ainda aceita o contrato `{ link, adapters }`.
- Se o modo pesquisa retorna pelo menos Apple Music ou URLs de busca uteis.
- Se o frontend lida bem com erro 400, 429, 500, 502 e 503.
- Se a experiencia mobile/PWA abre, cola, compartilha e limpa resultado corretamente.
- Se os icones e a imagem remota do logo carregam em rede real.
- Se o Shortcut do iCloud ainda existe e aponta para o fluxo desejado.
- Se vale carregar, remover ou reintegrar `telegram.js`.
- Se e necessario criar scripts locais, README, testes minimos e CI real.

