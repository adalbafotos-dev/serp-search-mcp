# Plugin privado e verificação de produção

Criado pelo Plugin Creator em 13/10/2026, versão 1.0.1, escopo pessoal USER e visibilidade PRIVATE.

- Nome exibido: SERP Search MCP.
- Plugin: `plugins_6acde74815a881919ff95c78d4c6402a`.
- Release atual OAuth (1.0.4): `pluginrel_6ace84e479e88191a8a07427b8891242`.
- Link: https://chatgpt.com/plugins/plugins_6acde74815a881919ff95c78d4c6402a.
- MCP: https://serp-search-mcp.vercel.app/api/mcp.
- Pacote local: `artifacts/serp-search-mcp-private.zip`.

Use os IDs acima, sem modificá-los, em uma atualização pelo Plugin Creator. Não crie outra cópia para corrigir a conexão.

## Resultado do teste

O cliente oficial MCP SDK conectou por Streamable HTTP à Vercel com o token existente no ambiente local. Os testes passaram: catálogo com nove ferramentas, dois prompts e um recurso; planejamento editorial; análise de uma página HTML pública; pesquisa DataForSEO com cinco resultados; cinco ideias de palavras-chave do Google Ads; métricas de uma palavra-chave do Google Ads. Chamadas sem credencial retornaram 401. O token não foi exibido nem incluído no pacote.

Esse teste verifica o servidor de produção por MCP. Ainda não verifica uma chamada pelo plugin instalado dentro de um chat. Notícias, desempenho de campanhas e comparações completas não foram testados ao vivo nesta verificação.

## Instalação e conexão

Abra o link acima, selecione +/Instalar e inicie uma nova conversa Work com @SERP Search MCP. A instalação não autentica automaticamente o MCP. O pacote declara o Bearer fixo que o servidor aceita atualmente, sem armazenar o segredo.

Para o ChatGPT remoto, falta configurar OAuth com um provedor de autorização compatível e atualizar a declaração de autenticação deste mesmo plugin. As variáveis OAuth vazias não criam esse provedor. O token de acesso MCP é separado das credenciais DataForSEO e Google Ads que a Vercel já utiliza. Consulte [o guia do projeto](connections.md), [a autenticação oficial](https://developers.openai.com/plugins/build/auth) e [a instalação oficial](https://developers.openai.com/plugins/quickstart).

Após concluir a conexão, peça “Pesquise marketing de conteúdo no Brasil e cite cinco fontes” e confirme uma chamada real a search_web. Somente então a verificação de uso dentro do chat estará completa.

## Extensão Search Console e diagnóstico do chat

Em 13/10/2026, as ferramentas instaladas neste chat Codex retornaram dados ao vivo por search_web (DataForSEO, consulta AdalbaPro, Brasil, português, três resultados) e google_ads_keyword_metrics (uma palavra-chave). Esse resultado confirma a conexão deste ambiente; não confirma disponibilidade em outro chat/workspace do ChatGPT.

O código local passou a expor treze ferramentas, incluindo propriedades, desempenho, inspeção de URL e sitemaps do Search Console. Foram verificados 129 testes, build de produção e inicialização SDK HTTP/stdio com treze ferramentas. Search Console não foi consultado ao vivo: ainda requer ativação da API e consentimento Google. O deploy de produção atual continua com nove ferramentas até commit/push/redeploy manual.

A release 1.0.2 atualiza as instruções para diferenciar SERP observada, estimativas Ads e desempenho orgânico da propriedade, e verificar o catálogo antes de usar os novos métodos. A identidade, apresentação, audiência privada e configuração MCP existentes foram preservadas e verificadas após o upload.

O tenant adalbapro.us.auth0.com publicou discovery HTTPS, issuer, JWKS e PKCE S256 confirmados. Os dados públicos OAuth foram preenchidos em .env.local. A habilitação e publicação da conexão OAuth aguardam User ID autorizado, método de autenticação do cliente, configuração da API/escopos/callback e importação das variáveis na Vercel. Não se deve considerar o ChatGPT conectado apenas porque o discovery respondeu.

Na verificação seguinte, a metadata de produção passou a responder 200 com o issuer Auth0 e research:read, e uma chamada sem credencial continuou retornando 401. O painel do aplicativo confirmou Client Secret (Post). A release 1.0.3 passou a declarar OAuth com o Client ID existente e client_secret_post; os manifestos e apresentação foram conferidos após o upload. Nenhum Client Secret foi lido, transferido ou incluído no pacote.

Foi cadastrada no Auth0 a API SERP Search MCP, Identifier https://serp-search-mcp.vercel.app/api/mcp, assinatura RS256, autorização por aplicativo e acesso de máquina desabilitado. O escopo research:read foi definido. ID da API: 6ace8288bd1db205b4811f43. O Auth0 também gerou automaticamente uma Test Application; não foi concedido acesso a ela. A autorização do aplicativo principal para pesquisa foi preparada e aguarda a confirmação de acesso exigida pela ferramenta de navegador. Callback, login e teste OAuth dentro do ChatGPT ainda estão pendentes.

A release 1.0.4 declara oidcEnabled=false porque aplicativos de terceiros estritos do Auth0 não suportam escopos OIDC ou /userinfo. O fluxo continua OAuth com PKCE e scope research:read; issuer, audience, assinatura e subject continuam sendo validados pelo MCP. O formulário ChatGPT foi preparado com cliente definido pelo usuário, client_secret_post, research:read e OIDC desabilitado. O callback exibido pelo host foi https://chatgpt.com/connector_platform_oauth_redirect; ele ainda precisa constar na lista de callbacks do aplicativo Auth0. O campo Segredo do cliente OAuth ficou vazio para preenchimento pelo usuário.

A tela do plugin empacotado mostra a instalação e o link para desktop. Para habilitar as ferramentas como conexão do ChatGPT web, foi aberto o formulário Adicionar servidor MCP personalizado; nenhuma segunda conexão/plugin foi criada. A autorização do aplicativo no Auth0, a inclusão do callback, a conexão de login e o consentimento final permanecem pendentes. A verificação com o Bearer local anterior não autenticou após a mudança de produção; esse teste não comprova o fluxo OAuth.
