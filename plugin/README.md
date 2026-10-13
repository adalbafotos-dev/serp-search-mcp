# SERP Search MCP

Plugin privado de pesquisa, análise de sites, Google Ads e planejamento de conteúdo. O servidor está em https://serp-search-mcp.vercel.app/api/mcp, com transporte Streamable HTTP. O pacote não inclui credenciais nem executa o servidor.

plugin.json e mcp.json são os manifestos portáteis. O MCP declara autenticação API key com esquema Bearer, correspondente ao servidor atual; o segredo deve ser fornecido por um cliente compatível durante a conexão. Nunca coloque o token nestes arquivos. As credenciais DataForSEO e Google Ads permanecem apenas na Vercel.

Os arquivos .codex-plugin/plugin.json e .mcp.json oferecem compatibilidade com clientes antigos. Nesse formato, bearer_token_env_var lê MCP_AUTH_TOKEN do ambiente do processo cliente. O .env.local deste projeto não configura automaticamente o ambiente de um chat remoto.

## Instalar

Abra o link do plugin salvo pelo Plugin Creator, selecione o botão +/Instalar e inicie uma nova conversa com @SERP Search MCP. Instalação e autenticação são etapas distintas; a presença da skill não comprova acesso às ferramentas.

O ChatGPT remoto exige OAuth para este servidor protegido e não envia tokens Bearer fixos personalizados. A criação do pacote privado não resolve essa limitação. Antes de conectar as ferramentas no ChatGPT, configure um provedor OAuth compatível no servidor, altere a declaração auth de mcp.json para OAuth e atualize o plugin. O servidor já possui validação de tokens e descoberta de recurso protegido; ele não fornece um servidor de autorização. Consulte docs/connections.md no repositório.

## Testar depois da conexão

Peça: “Pesquise marketing de conteúdo no Brasil e cite cinco fontes.” Confirme uma chamada real a search_web, seguida de fontes e parâmetros geográficos. Para Ads, peça ideias de palavras-chave para o mesmo tema. Se a autenticação falhar, não invente resultados nem selecione acesso anônimo: complete a conexão OAuth ou use um cliente compatível com Bearer.

Documentação: [pacotes](https://developers.openai.com/plugins/build/plugins), [autenticação](https://developers.openai.com/plugins/build/auth) e [instalação](https://developers.openai.com/plugins/quickstart).
