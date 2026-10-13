# SERP Search MCP plugin

Este pacote reúne a skill de pesquisa e o manifesto para clientes Codex compatíveis. O servidor está na pasta principal do projeto; execute `npm run dev` nela antes de utilizar o plugin HTTP local.

`.mcp.json` aponta para `http://127.0.0.1:3000/api/mcp`. Configure `MCP_AUTH_TOKEN` no ambiente do cliente que inicia a conexão. As credenciais DataForSEO e Google Ads ficam somente no `.env.local` do servidor e não fazem parte deste pacote.

Para HTTP remoto, altere `url` para sua origem HTTPS real. Para uma conexão OAuth, remova `bearer_token_env_var` e configure o servidor de identidade descrito em `docs/connections.md` do projeto. O pacote não publica o servidor e não registra um cliente OAuth.

Também é possível usar MCP local via stdio com `src/mcp/stdio.ts`, conforme o guia de conexão. O projeto inclui `.codex/config.toml` para a pasta local informada pelo usuário; a configuração de projeto só é carregada depois que o cliente confia no projeto.
