# Conectar o SERP Search MCP

O projeto oferece um servidor MCP por **Streamable HTTP** em `/api/mcp` e por **stdio**. A página em `http://127.0.0.1:3000` é somente uma apresentação do serviço; a URL MCP é `http://127.0.0.1:3000/api/mcp`. Não há formulários de operação, cadastro ou login no site. Consulte [produção na Vercel](vercel.md) para hospedar o endpoint.

As credenciais SERP e Google Ads ficam no servidor, em `.env.local` no desenvolvimento e nas variáveis do ambiente de hospedagem em produção. O cliente de chat recebe os resultados das ferramentas. Não copie credenciais dos provedores para o plugin.

## Codex local: stdio

Esta opção inicia o processo no computador e dispensa um servidor Next.js aberto. Instale as dependências, preencha `.env.local` e adicione o bloco abaixo a uma configuração de projeto `.codex/config.toml`, ou à configuração pessoal por escolha sua. Este projeto não altera sua configuração global automaticamente.

```toml
[mcp_servers.serp_search]
command = "npm.cmd"
args = ["run", "--silent", "mcp:stdio"]
cwd = 'C:\Users\scalb\Documentos\adalba-pro\serp-search-mcp'
startup_timeout_sec = 30
tool_timeout_sec = 120
```

Em macOS/Linux, use `command = "npm"` e ajuste `cwd`. O script `src/mcp/stdio.ts` carrega `.env.local` e `.env` a partir da pasta do projeto; o processo precisa acessar esses arquivos. Não envie logs para o stdout do processo stdio, reservado ao protocolo.

O Codex documenta `command`, `args` e `cwd` para stdio e permite configuração por projeto confiável. Reinicie o cliente após configurar e confira `codex mcp list`. [MCP no Codex](https://learn.chatgpt.com/docs/extend/mcp).

## Codex e clientes com Bearer: HTTP

Execute `npm run dev`. Use `MCP_AUTH_MODE=bearer` e um `MCP_AUTH_TOKEN` forte em `.env.local`. A chamada HTTP precisa de `Authorization: Bearer <token>`, inclusive durante a inicialização MCP.

```toml
[mcp_servers.serp_search]
url = "http://127.0.0.1:3000/api/mcp"
bearer_token_env_var = "MCP_AUTH_TOKEN"
startup_timeout_sec = 30
tool_timeout_sec = 120
```

`bearer_token_env_var` lê a variável **do processo cliente Codex**. O arquivo `.env.local` configura o servidor Next.js, mas não exporta automaticamente essa variável para o aplicativo Codex. Defina-a no ambiente que inicia o cliente, preservando o segredo. O parâmetro está documentado na [referência de configuração](https://learn.chatgpt.com/docs/config-file/config-reference).

O endpoint HTTP funciona sem sessão persistente e devolve respostas JSON. Use um cliente MCP Streamable HTTP; uma visita comum no navegador não executa uma ferramenta. Outros clientes podem usar o mesmo endpoint se permitirem configurar o cabeçalho Bearer. Clientes que usam stdio podem chamar `npm.cmd` com os mesmos argumentos e pasta do exemplo anterior.

## Pacote do plugin

A pasta `plugin/` contém os manifestos portáteis `plugin.json` e `mcp.json`, a skill `skills/content-research/SKILL.md` e os arquivos de compatibilidade Codex `.codex-plugin/plugin.json` e `.mcp.json`. Os dois formatos apontam para o mesmo servidor e não contêm segredos. [Empacotar plugins](https://developers.openai.com/plugins/build/plugins).

Os manifestos MCP apontam para `https://serp-search-mcp.vercel.app/api/mcp` e declaram OAuth com o cliente Auth0 existente, `client_secret_post` e `research:read`. O Client Secret não faz parte do pacote. Se trocar de hospedagem, sincronize a URL nos dois manifestos.

O pacote não instala o servidor, Node.js ou dependências e não inclui `.env.local`. A instalação desktop/Codex é separada da conexão MCP personalizada do ChatGPT web. Os links e IDs estão em [plugin-private.md](plugin-private.md). Para testar no ChatGPT, use o plugin que contém **Aplicativos**, **Gerenciar** e **Testar no chat**.

## ChatGPT remoto: HTTPS e OAuth

O ChatGPT executado remotamente não alcança o `localhost` deste computador. Para a conexão remota padrão, hospede o Next.js e forneça uma URL **HTTPS pública**, como `https://seu-dominio.example/api/mcp`. Um túnel HTTPS pode servir para testes enquanto o computador e o processo estiverem ativos. Hospedagem e configuração da conta ainda precisam ser concluídas.

O ChatGPT não apresenta uma chave de API personalizada nem um token Bearer fixo nessa conexão. Configure OAuth para manter as APIs protegidas; não selecione autenticação ausente para contornar o token. A integração deve usar authorization code com PKCE `S256`, discovery e um cliente pré-registrado, CIMD ou DCR. [Autenticação MCP da OpenAI](https://developers.openai.com/plugins/build/auth).

### Configurar o servidor de autorização externo

Para a instalação pessoal na Vercel, siga [a configuração Auth0 passo a passo](chatgpt-auth0-setup.md), mantendo a identidade do plugin e restringindo o subject autorizado.

Este projeto valida tokens JWT de um provedor externo; ele não cria um provedor de identidade, tela de consentimento ou endpoint de emissão de tokens. Configure:

```dotenv
MCP_AUTH_MODE=oauth
MCP_PUBLIC_URL=https://seu-dominio.example
MCP_OAUTH_ISSUER=https://seu-provedor.example/
MCP_OAUTH_AUDIENCE=https://seu-dominio.example/api/mcp
MCP_OAUTH_JWKS_URL=https://seu-provedor.example/.well-known/jwks.json
MCP_OAUTH_SCOPES=research:read
# Para uso pessoal, restrinja aos subjects autorizados no provedor:
MCP_OAUTH_ALLOWED_SUBJECTS=
```

`MCP_AUTH_MODE=both` aceita OAuth e o token fixo para clientes que o suportam. Para o modo `both`, configure também `MCP_AUTH_TOKEN`. O audience padrão é `MCP_PUBLIC_URL/api/mcp`; mantenha-o igual ao identificador da API no provedor. O issuer deve coincidir exatamente com `iss`, inclusive a barra final. O JWKS precisa conter as chaves que assinam os access tokens. O token deve trazer os escopos exigidos e estar válido.

O projeto publica metadata em `/.well-known/oauth-protected-resource` e `/.well-known/oauth-protected-resource/api/mcp`, e respostas `401` apontam para ela via `WWW-Authenticate`. O provedor deve publicar `/.well-known/oauth-authorization-server` ou `/.well-known/openid-configuration`, com issuer, authorization endpoint, token endpoint, métodos de autenticação aceitos e `code_challenge_methods_supported` contendo `S256`. Configure `resource` como audience dos access tokens. Copie a URL de callback exata exibida no gerenciamento do MCP no ChatGPT para a lista permitida do provedor. Esses requisitos e a validação de issuer, audience, validade e scopes estão na [documentação de autenticação](https://developers.openai.com/plugins/build/auth).

**Exemplo Auth0:** crie uma API com Identifier igual a `MCP_OAUTH_AUDIENCE`, assinatura JWT **RS256** e permissão `research:read`. Use o issuer e JWKS do tenant. Cadastre o cliente OAuth que será fornecido ao ChatGPT e autorize o callback exibido por ele. O fluxo PKCE utiliza `S256` e o `resource` deve identificar a API registrada. [Authorize com PKCE](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce). Habilite **Settings → Advanced → Resource Parameter Compatibility Profile** para o parâmetro `resource` funcionar como audience. [Compatibilidade MCP do Auth0](https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0). Confirme o discovery do tenant e habilite apenas usuários autorizados; configurar as variáveis acima não conclui o cadastro no Auth0.

### Adicionar no ChatGPT

Na superfície que oferece plugins personalizados, siga o fluxo oficial: **Plugins → + → Add custom MCP server**, informe a URL HTTPS `/api/mcp`, escolha OAuth e crie o plugin. Instale-o, conclua **Conectar** e use **Testar no chat** para iniciar uma conversa com a conexão correta selecionada. Essa instalação foi verificada no modo Chat da conta proprietária. [Adicionar MCP personalizado](https://developers.openai.com/api/docs/guides/custom-mcp-server). As opções e permissões podem depender da conta e do workspace.

O formulário oficial aceita OAuth, autenticação ausente ou acesso misto. Embora o schema de plugins descreva API keys, o portal não oferece campo de token Bearer para esse fluxo. [Limitações de autenticação do portal](https://developers.openai.com/plugins/deploy/submission).

## Verificar a conexão

Primeiro liste as ferramentas. Em seguida peça: “Pesquise tendências de conteúdo sobre meu tema no Brasil e mostre as fontes”. Para Google Ads, valide uma consulta curta de palavras-chave depois de configurar as credenciais em [google-ads-setup.md](google-ads-setup.md). Uma conexão MCP válida não garante que as credenciais de cada provedor estejam corretas.

- `401`: verifique token do cliente, issuer, audience e validade do JWT.
- Login Auth0 concluído, mas autenticação pendente no ChatGPT: confira `MCP_AUTH_MODE`. O modo `bearer` recusa tokens OAuth mesmo com as demais variáveis preenchidas. Use `oauth` ou `both`, faça novo deploy e clique em **Gerenciar → Reconectar → Atualizar ferramentas**.
- Ferramenta ausente na conversa: confirme o plugin correto e a conta proprietária. Uma conversa aberta antes da atualização pode precisar de um novo teste por **Testar no chat**.
- Erro de scope: autorize `research:read` no provedor e na conexão.
- Discovery/PKCE: confira as URLs públicas de metadata e `S256` anunciado pelo provedor.
- Timeout/conexão recusada: confirme porta, processo Next.js e alcance da URL pelo cliente.
- Provider não configurado: preencha `.env.local` e reinicie o servidor.

As ferramentas leem dados e produzem insumos de planejamento; não alteram campanhas nem publicam posts. Pesquisas podem consumir cotas e créditos dos provedores.
