# Plugin privado e verificação de produção

## Instalações

Há um pacote desktop/Codex e uma conexão MCP nativa do ChatGPT, ambos pessoais e privados, apontando para o mesmo servidor.

- ChatGPT web: https://chatgpt.com/plugins/plugin_asdk_app_6ace8caa41fc8191a34308f06d2accbf.
- Aplicativo nativo: `asdk_app_6ace8caa41fc8191a34308f06d2accbf`.
- Pacote desktop/Codex, com a habilidade content-research: https://chatgpt.com/plugins/plugins_6acde74815a881919ff95c78d4c6402a.
- Pacote: versão 1.0.4, release `pluginrel_6ace84e479e88191a8a07427b8891242`.
- MCP: https://serp-search-mcp.vercel.app/api/mcp.
- Vercel: https://vercel.com/adalbadevs-projects/serp-search-mcp.

Preserve os IDs, a hospedagem e a audiência privada ao atualizar. Para usar no ChatGPT, abra a instalação web e clique em Gerenciar ou Testar no chat. O pacote com abertura no desktop não substitui a conexão OAuth web.

## OAuth e correção

O Auth0 usa `adalbapro.us.auth0.com`, API `6ace8288bd1db205b4811f43`, Identifier `https://serp-search-mcp.vercel.app/api/mcp`, JWT RS256 e permissão `research:read`. O cliente foi autorizado somente para acesso delegado de leitura; não recebeu acesso anônimo ou de máquina.

O callback é `https://chatgpt.com/connector_platform_oauth_redirect`. A conexão de email/senha foi promovida ao nível de domínio após aprovação do titular, com cadastros públicos bloqueados. O titular criou a própria senha e preencheu o Client Secret diretamente no ChatGPT. Segredos não foram extraídos, exibidos ou incluídos no pacote. O cliente usa client_secret_post, PKCE S256 e OIDC desabilitado.

O login Auth0 já funcionava, mas a Vercel ainda tinha `MCP_AUTH_MODE=bearer`, que recusa tokens OAuth. Em 13/10/2026, o titular alterou para `both` e fez redeploy manual. A produção ficou Ready no deployment `EyMgz7Fo9`, branch main, commit `1af576c92811ccc03a50a5fb8bc94e33fc40c3c3`.

Depois foi executado Gerenciar → Reconectar → Atualizar ferramentas no ChatGPT. O aviso de autenticação pendente desapareceu e o catálogo passou a listar treze ferramentas de leitura. A Vercel registrou respostas 200/202 do MCP às 17:39 de Brasília.

## Teste no ChatGPT

Conversa: https://chatgpt.com/c/6ace9787-2928-83e9-abaa-0090d663831d.

Duas chamadas foram concluídas dentro do ChatGPT em 13/10/2026:

- `search_web`: query `site:adalbapro.com.br`, país br, idioma pt, limit 1. DataForSEO retornou a página adalbapro.com.br, título “Ferramentas AdalbaPro | Pré-cadastro”, coleta às 17:42:18 de Brasília. A posição na consulta site: não comprova ranking para uma keyword comercial.
- `google_ads_keyword_metrics`: “fotografia profissional”, Brasil 2076, português 1014, Google Search. Google Ads v25 retornou média mensal de 2.400 pesquisas, competição publicitária LOW e índice 33, coleta às 17:42:19 de Brasília. São estimativas publicitárias, não dificuldade SEO ou tráfego do site.

Comprovações locais: `artifacts/chatgpt-mcp-13-tools.png` e `artifacts/chatgpt-mcp-test-success.png`. Consultas podem consumir cotas dos provedores.

## Limites

O teste confirmou OAuth, catálogo, DataForSEO e métricas históricas Ads no ChatGPT. Não validou todas as operações.

O catálogo de 13 ferramentas acima descreve a verificação histórica de produção. A revisão atual substitui esse catálogo por 10 ferramentas de SEO e conteúdo: retira Search Console e campanhas, e acrescenta check_serp_rank e audit_seo. O deploy da revisão é manual. Veja [SEO por SERP](seo-serp.md).

O código anterior passou por 129 testes. A revisão SEO inclui testes de correspondência de domínio, posição desconhecida e falhas parciais, além do protocolo MCP. Sem commit, push ou deploy automático.
