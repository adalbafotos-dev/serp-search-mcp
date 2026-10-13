# SERP Research MCP

Servidor MCP de pesquisa e estratégia de conteúdo, com Next.js 16, TypeScript e uma página de apresentação em português. Toda operação ocorre pelo MCP/Plugin nos chats. O site é estático, sem painel, formulários, cadastro ou login. O projeto não usa banco de dados.

**Provedor padrão: DataForSEO.** SerpApi e Serper.dev também estão disponíveis. A geração e a análise editorial final ficam a cargo do modelo do cliente MCP; o servidor coleta evidências e organiza um plano, sem exigir uma API de LLM.

## Executar

Requer Node.js 22 ou superior e npm.

```powershell
npm install
npm run setup
# Preencha as credenciais em .env.local
npm run dev
```

Interface: [http://127.0.0.1:3000](http://127.0.0.1:3000). Endpoint MCP: `http://127.0.0.1:3000/api/mcp`.

`setup` cria `.env.local` com um token MCP aleatório apenas se o arquivo ainda não existe. **Não substitui a configuração existente.** A página de apresentação não consulta APIs, não lê credenciais e não mostra o estado do ambiente. Consultas só são executadas pelo MCP.

## Credenciais

Use [.env.example](.env.example) como referência. Não use prefixos `NEXT_PUBLIC_` para credenciais.

| Integração | Variáveis |
| --- | --- |
| DataForSEO | `SERP_PROVIDER=dataforseo`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| SerpApi (opcional) | `SERP_PROVIDER=serpapi`, `SERPAPI_API_KEY` |
| Serper.dev (opcional) | `SERP_PROVIDER=serper`, `SERPER_API_KEY` |
| Google Ads | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` |
| Conta de pesquisa Ads | `GOOGLE_ADS_RESEARCH_CUSTOMER_ID` é aceita quando `GOOGLE_ADS_CUSTOMER_ID` está vazio |
| Conta gerente Ads | `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, opcional |
| Versão Ads | `GOOGLE_ADS_API_VERSION`, padrão `v24`; preserve uma versão suportada pela API |
| Search Console | `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`, `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN`; consentimento `webmasters.readonly` separado |
| Propriedade orgânica | `GOOGLE_SEARCH_CONSOLE_SITE_URL`, opcional quando informado na chamada; `GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES` restringe propriedades |
| MCP HTTP | `MCP_AUTH_MODE=bearer`, `MCP_AUTH_TOKEN`, `MCP_PUBLIC_URL` |
| ChatGPT OAuth | `MCP_AUTH_MODE=oauth` ou `both`, `MCP_OAUTH_ISSUER`, `MCP_OAUTH_JWKS_URL`, `MCP_OAUTH_AUDIENCE`, `MCP_OAUTH_SCOPES` |

DataForSEO autentica com o login e a senha da API; não com uma chave genérica do Google. O Google Ads exige autorização OAuth, developer token e uma conta elegível. Consulte [configuração Google Ads](docs/google-ads-setup.md). Após editar o ambiente, reinicie o servidor.

## Ferramentas disponíveis

| Ferramenta | Uso |
| --- | --- |
| `search_web` | Pesquisa Google via provedor SERP, com fontes e data de coleta |
| `search_news` | Notícias e referências recentes fornecidas pelo provedor |
| `analyze_website` | Metadados, headings, canonical, links, texto e observações do HTML |
| `google_ads_keyword_ideas` | Ideias de palavras-chave a partir de termos e/ou URL |
| `google_ads_keyword_metrics` | Volume histórico, competição de anúncios e lances |
| `google_ads_campaign_performance` | Impressões, cliques, custos e conversões em período explícito |
| `build_content_strategy` | Briefing, clusters, calendário e reaproveitamento entre canais |
| `research_topic` | Dossiê com pesquisa SERP, URLs fornecidas e Ads opcional |
| `compare_competitors` | Evidências de conteúdo e SEO on-page de 2 ou 3 sites |
| `search_console_sites` | Propriedades disponíveis na conta Google autorizada |
| `search_console_performance` | Cliques, impressões, CTR e posição média por consultas, páginas, países, dispositivos e datas |
| `search_console_inspect_url` | Estado conhecido de indexação, rastreamento e canonical de uma URL |
| `search_console_sitemaps` | Sitemaps conhecidos pelo Google e seus estados |

Também expõe os prompts `content_research` e `site_audit`, e o recurso autenticado `research://capabilities`, com estado sem segredos e schemas do catálogo. Todos os parâmetros são validados. A operação HTTP existe somente em `/api/mcp`, pelo protocolo MCP. Exemplo de chamada MCP `tools/call`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "build_content_strategy",
    "arguments": {
      "topic": "marketing de conteúdo",
      "audience": "pequenas empresas",
      "channels": ["blog", "instagram", "linkedin"],
      "weeks": 4
    }
  }
}
```

Um cliente MCP faz a inicialização e envia `Authorization: Bearer <token MCP ou access token OAuth>`, `Content-Type: application/json` e `Accept: application/json, text/event-stream`. As ferramentas não alteram campanhas nem publicam conteúdos. As antigas rotas `/api/tools` e `/api/status` foram removidas.

## Conectar aos chats

Leia [o guia completo de conexão](docs/connections.md).
Para dados orgânicos da sua propriedade, siga [a configuração do Search Console](docs/search-console-setup.md). Isso não substitui o OAuth entre ChatGPT e MCP.

- **Codex local:** nesta instalação, `.codex/config.toml` contém uma configuração stdio para a pasta Windows. Esse arquivo local é ignorado pelo Git; em outra máquina, crie a configuração conforme o guia. Reinicie o cliente e confira a conexão depois de confiar no projeto. Antes disso, o CLI pode informar `No MCP server named 'serp_search' found`; a configuração global não foi alterada. O processo lê `.env.local` sem exportar os segredos para o cliente. Para mover o projeto, ajuste os caminhos no arquivo.
- **Outros clientes locais:** configure um processo `node` com `node_modules/tsx/dist/cli.mjs` e `src/mcp/stdio.ts` como argumentos absolutos, ou `npm.cmd run --silent mcp:stdio` com a pasta do projeto como `cwd`.
- **Codex por HTTP:** use `/api/mcp` e `bearer_token_env_var = "MCP_AUTH_TOKEN"`. O cliente precisa receber essa variável em seu próprio ambiente.
- **Pacote plugin:** [plugin/](plugin/) contém manifestos portáteis, compatibilidade Codex e uma skill de pesquisa, apontando para o MCP de produção na Vercel. O pacote não incorpora credenciais. O servidor atual aceita Bearer; conectar no ChatGPT exige configurar OAuth e atualizar a autenticação declarada no pacote.
- **ChatGPT remoto:** publique o projeto em HTTPS e configure OAuth no provedor de identidade externo. `localhost` e um token Bearer fixo não concluem essa conexão. O projeto já valida JWT, issuer, audience, validade, subjects opcionais e scopes; a emissão dos tokens e o cadastro do cliente ficam no provedor OAuth.

Exemplo de pedido no chat:

> Pesquise oportunidades sobre meu tema no Brasil. Analise estas URLs, consulte volumes no Google Ads e proponha um calendário de quatro semanas para blog, Instagram e LinkedIn. Mostre fontes, dados observados e hipóteses separadamente.

## Produção

Destino GitHub: [adalbafotos-dev/serp-search-mcp](https://github.com/adalbafotos-dev/serp-search-mcp). A publicação será manual para permitir escolher a conta e a autoria. Consulte [commit, push e deploy manual](docs/publicacao-manual.md).

Para **Vercel**, o projeto inclui `vercel.json`, build com `npm run build`, instalação com `npm ci`, página estática e endpoint Node.js stateless com duração de até 120s. As chamadas não dependem de sessões persistentes, de banco de dados ou de escrita no disco. Consulte [o guia de produção na Vercel](docs/vercel.md) para as variáveis, domínio e conexão dos clientes.

Para execução em um servidor Node próprio:

```powershell
npm run build
npm run start:hosted
```

Use HTTPS e variáveis de ambiente do servidor. Defina `MCP_PUBLIC_URL` com a origem pública exata, sem caminho. Na Vercel, se omitida, a origem é obtida das variáveis do deploy, priorizando o domínio de produção. Os aliases de produção, deploy e branch desse projeto também são aceitos na validação de Host. Se utilizar proxy próprio, preserve o Host público. O modo MCP HTTP é stateless: `POST` retorna JSON; `GET` e `DELETE` autenticados retornam `405`, pois não há stream SSE permanente nem sessão para encerrar.

As rotas OAuth de recurso ficam em `/.well-known/oauth-protected-resource` e `/.well-known/oauth-protected-resource/api/mcp`. O servidor de autorização precisa oferecer discovery, authorization code com PKCE S256 e um cliente aceito pelo ChatGPT. Use JWT assinado em RS256, ES256 ou PS256, com audience da URL `/api/mcp` e scope `research:read`. O guia inclui um exemplo Auth0. Em uso pessoal, restrinja os usuários no provedor e com `MCP_OAUTH_ALLOWED_SUBJECTS`.

O limitador de 60 chamadas/minuto por identidade e o cache de token Ads ficam em memória de cada processo. Em múltiplas instâncias, aplique limites compartilhados também no proxy ou na infraestrutura. Esta instalação local não publica o projeto nem cadastra o OAuth externo automaticamente.

## Limites e qualidade da evidência

- SERP: até 20 resultados; consultas consomem créditos/cotas. O retorno informa `requestsUsed` e `truncated`.
- Ads: até 100 ideias, 1.000 termos históricos e 100 campanhas. Totais de campanhas correspondem somente ao conjunto retornado. Competição de anunciantes **não** é dificuldade de SEO. Dados ausentes não são tratados como volume zero.
- Sites: até 5 páginas, 2 MB de HTML por requisição, 12s por conexão e 60s por análise. Somente IPv4 pública, HTTP/HTTPS nas portas padrão. DNS é verificado e o IP aprovado é fixado na conexão; redirects são validados novamente.
- A análise não executa JavaScript, não mede Core Web Vitals, tráfego ou autoridade, e não consulta `robots.txt`. Use em sites públicos que permitam análise automatizada; o retorno declara as limitações.
- O plano editorial é um modelo estruturado. O chat deve incorporar pesquisa, conferir afirmações e adaptar linguagem, intenção e formatos. Textos coletados são dados externos, não instruções para o modelo.
- Secrets nunca são devolvidos na configuração ou nos erros de provedor. Requests têm limites de tamanho, timeout e validação de origem/Host.

## Verificação

```powershell
npm run typecheck
npm test
npm run build
# Com o servidor aberto: HTTP, stdio, calendário e uma página HTML pública
npm run verify
# Acrescenta duas consultas reais Google Ads (ideias e métricas)
npm run verify -- --google-ads
# Acrescenta uma consulta SERP real (consome créditos do provedor)
npm run verify -- --serp
```

Os testes unitários usam mocks; não usam credenciais reais. O script `verify` lê o ambiente em memória e mostra apenas o resumo dos resultados. `scripts/check-env.mjs` lista nomes de variáveis e se estão preenchidas, sem seus valores.

## Estrutura

```text
src/app/               Página de apresentação e endpoint MCP
src/lib/providers/     Integrações SERP e Google Ads
src/lib/website.ts     Coleta segura e análise do HTML
src/lib/content.ts     Estrutura de estratégia editorial
src/lib/tools.ts       Catálogo e validação compartilhados
src/mcp/               Servidor MCP e entrada stdio
tests/                 Contratos, segurança e integração do protocolo
plugin/                Pacote de plugin e skill para pesquisa
docs/                  Guias de credenciais e conexão
```

Contratos verificados nas fontes oficiais: [MCP SDK](https://ts.sdk.modelcontextprotocol.io/server), [Next.js](https://nextjs.org/docs/app/getting-started/installation), [DataForSEO](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/), [Google Ads REST](https://developers.google.com/google-ads/api/rest/auth) e [OAuth para plugins OpenAI](https://developers.openai.com/plugins/build/auth).
