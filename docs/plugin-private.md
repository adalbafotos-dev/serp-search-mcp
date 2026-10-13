# Plugin privado e verificação de produção

Criado pelo Plugin Creator em 13/10/2026, versão 1.0.1, escopo pessoal USER e visibilidade PRIVATE.

- Nome exibido: SERP Search MCP.
- Plugin: `plugins_6acde74815a881919ff95c78d4c6402a`.
- Release atual de instruções (1.0.2): `pluginrel_6ace7a5635608191b9b9ff4f2074dea7`.
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
