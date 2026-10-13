# SEO de clientes com SERPs reais

O MCP usa DataForSEO para consultar o Google e HTML público para analisar páginas de clientes e concorrentes acessíveis. Não precisa cadastrar clientes nem entrar em suas contas Google. Ads complementa com ideias e estimativas de volume usando a conta de pesquisa existente. Search Console e campanhas não fazem parte do catálogo.

## Consultar uma palavra-chave

Chame `check_serp_rank` com:

```json
{"site":"site-do-cliente.com.br","keyword":"fotografia profissional","country":"br","language":"pt","limit":20}
```

O retorno contém SERP, URLs correspondentes ao hostname e subdomínios (opcional), melhor posição observada, parâmetros e datas. Se não encontrar, a posição é null e o status é `not_found_in_returned_results`. Isso não significa ausência do índice Google. Uma consulta `site:` é pesquisa restrita, não ranking comercial.

No DataForSEO, a posição é `rank_group` dos resultados orgânicos; não se mistura à posição absoluta com outros elementos da SERP. Quando esse campo não vier, a posição permanece desconhecida.

## Combinar conteúdo e SERP

Chame `audit_seo` com:

```json
{"url":"https://site-do-cliente.com.br/","keywords":["fotografia profissional","fotógrafo de eventos"],"country":"br","language":"pt","maxPages":3,"limit":10}
```

Uma chamada combina até 5 páginas públicas e de 1 a 3 pesquisas SERP. O chat interpreta as evidências para apresentar intenção de busca, concorrentes, problemas on-page e oportunidades de conteúdo. Se uma fonte falhar, as demais evidências continuam disponíveis. Não produz uma nota SEO artificial nem estima tráfego privado.

## Pedido no chat

> Analise o SEO deste site para estas palavras-chave, no Brasil e em português. Use SERP Search MCP, compare as URLs concorrentes, indique melhorias por página e proponha pautas. Cite consultas, fontes e datas. Não use Search Console nem solicite acesso às contas dos clientes.

Se faltarem termos, o chat começa com `analyze_website` e seleciona termos pelo conteúdo antes de consultar a SERP. Para mercado local, indique a cidade na palavra-chave; o filtro do país não simula localização em uma cidade específica. A coleta DataForSEO atual usa desktop.

## Publicar esta alteração

1. Faça commit e push manual para a branch de produção, escolhendo sua conta e autoria.
2. Faça deploy na Vercel pelo procedimento já utilizado. Preserve as variáveis DataForSEO, Ads e MCP/Auth0, incluindo `MCP_AUTH_MODE=both` ou `oauth`.
3. No ChatGPT, abra SERP Search MCP e clique em **Atualizar ferramentas**. O catálogo deverá mostrar 10 ferramentas, incluindo `check_serp_rank` e `audit_seo`, sem Search Console ou campanhas.
4. Faça uma consulta e confira a execução e o retorno DataForSEO. Até o deploy, a produção usa o servidor anterior; as instruções do plugin usam `search_web` e `analyze_website` como alternativa.

Nenhuma nova credencial Google é necessária. Variáveis antigas `GOOGLE_SEARCH_CONSOLE_*` podem permanecer no ambiente, mas não são usadas pelo catálogo.
