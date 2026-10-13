# SERP Search MCP

Plugin privado de pesquisa, análise de sites, Google Ads e planejamento de conteúdo. O servidor está em https://serp-search-mcp.vercel.app/api/mcp, com transporte Streamable HTTP. O pacote não inclui credenciais nem executa o servidor.

plugin.json e mcp.json são os manifestos portáteis. A versão 1.0.3 declara OAuth com o tenant adalbapro.us.auth0.com, cliente pré-registrado e autenticação client_secret_post, confirmada no painel Auth0. O Client Secret deve ser preenchido diretamente no formulário OAuth do host; nunca coloque o segredo nestes arquivos. As credenciais DataForSEO e Google Ads permanecem na Vercel.

Os arquivos .codex-plugin/plugin.json e .mcp.json oferecem compatibilidade com clientes que reconhecem esses nomes. A autenticação declarada agora é OAuth nos dois formatos. Para clientes que ainda usam Bearer, configure uma conexão separada ao endpoint com o token no ambiente do cliente; o modo both do servidor precisa continuar habilitado. O .env.local não configura automaticamente o ambiente de um chat remoto.

## Instalar

Abra o link do plugin salvo pelo Plugin Creator, selecione o botão +/Instalar e inicie uma nova conversa com @SERP Search MCP. Instalação e autenticação são etapas distintas; a presença da skill não comprova acesso às ferramentas.

O ChatGPT remoto exige OAuth para este servidor protegido. O endpoint de produção já publica a descoberta do Auth0. Ainda é necessário conceder research:read ao aplicativo Auth0, habilitar uma conexão de login apropriada, configurar o callback exato do host e concluir o consentimento. A criação ou atualização do pacote privado não conclui essas etapas. O servidor valida os tokens; não emite tokens. Consulte docs/connections.md no repositório.

## Testar depois da conexão

Peça: “Pesquise marketing de conteúdo no Brasil e cite cinco fontes.” Confirme uma chamada real a search_web, seguida de fontes e parâmetros geográficos. Para Ads, peça ideias de palavras-chave para o mesmo tema. Se a autenticação falhar, não invente resultados nem selecione acesso anônimo: complete a conexão OAuth ou use um cliente compatível com Bearer.

Documentação: [pacotes](https://developers.openai.com/plugins/build/plugins), [autenticação](https://developers.openai.com/plugins/build/auth) e [instalação](https://developers.openai.com/plugins/quickstart).
