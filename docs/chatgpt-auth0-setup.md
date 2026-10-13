# Concluir a conexão ChatGPT com Auth0

O plugin privado existe e as ferramentas SERP/Ads funcionam no Codex. No ChatGPT, o token fixo não conclui a conexão: é necessário um servidor OAuth. Adicionar outras APIs ao catálogo não corrige esse ponto. Não escolha autenticação ausente e não publique o token na URL ou no pacote.

## Configurar Auth0

1. Entre ou crie a conta em https://manage.auth0.com/. Escolha o tenant que ficará responsável por este MCP. A autorização acontece no Auth0; o site da Vercel continua uma apresentação sem cadastro e sem banco de dados.
2. Em **Applications → APIs**, crie uma API com nome SERP Search MCP, Identifier exato `https://serp-search-mcp.vercel.app/api/mcp` e assinatura **RS256**. Em **Permissions**, adicione `research:read`. Habilite **Allow Offline Access** na API se usar refresh tokens.
3. Use o aplicativo Auth0 já cadastrado para este MCP. Confira seu tipo e o método na aba **Credentials / Credenciais**: um cliente Native público pode usar `none`; um Regular Web App pode exigir `client_secret_basic` ou `client_secret_post`. O manifesto deve declarar o método real, sem adivinhar. Habilite Authorization Code, Refresh Token e PKCE S256. Client Secret, quando necessário, é informado no fluxo de conexão ChatGPT, nunca no pacote ou no chat.
   Para um aplicativo marcado **Third-party / Terceiro** (Client ID começando com `tpc_`), abra **API Access / Acesso à API** e conceda acesso somente à API SERP Search MCP com `research:read`, para o fluxo do usuário. Criar a API e a permissão não concede automaticamente acesso ao aplicativo; o Auth0 exige um grant explícito para aplicativos de terceiros. Não use machine-to-machine para a conexão ChatGPT. [Controles Auth0](https://auth0.com/docs/get-started/applications/third-party-applications/security-controls).
   Escolha também uma conexão de login. Email/senha do Auth0 e Google são opções diferentes; para aplicativos de terceiros, a conexão escolhida precisa estar disponível em nível de domínio, em **Authentication → conexão → Settings → Advanced → Promote Connection to Domain Level**. Essa configuração permite login por essa conexão a todos os aplicativos de terceiros do tenant; mantenha a lista de subjects do MCP restrita à sua identidade. [Conexões Auth0](https://auth0.com/docs/authenticate/identity-providers/promote-connections-to-domain-level).
4. No tenant, em **Settings → Advanced**, habilite **Resource Parameter Compatibility Profile**. Isso permite interpretar o `resource` que o ChatGPT envia como audience da API. Não altere um Default Audience de outros projetos para contornar essa configuração. [Orientação Auth0](https://support.auth0.com/center/s/article/mcp-audience-error-with-auth0).
5. Autorize apenas a sua identidade para o MCP. Em **User Management → Users**, obtenha o **User ID** da conta que usará no consentimento, exatamente como aparece (`auth0|...`, `google-oauth2|...` etc.). O MCP verificará esse subject além da assinatura, issuer, audience, validade e scope. O email não substitui o User ID.
6. Obtenha o domínio do tenant e o **Client ID**, que não é um segredo. Execute:

```powershell
npm run oauth:prepare -- "seu-tenant.us.auth0.com" "seu-User-ID" "seu-Client-ID" "metodo-confirmado"
```

O comando consulta o discovery real, valida os endpoints e gera `.env.vercel.oauth` e `.env.auth0-connection.json`, preservando arquivos existentes. Não cria a API ou o cliente no Auth0.

Substitua `metodo-confirmado` por `none`, `client_secret_basic` ou `client_secret_post`, exatamente como configurado. Escolher Google nesta conexão apenas autentica a pessoa no Auth0; não autoriza automaticamente Search Console ou Ads. As credenciais dessas APIs ficam no servidor, com consentimentos próprios.

7. Importe `.env.vercel.oauth` na Vercel Production e faça Redeploy. O modo `both` preserva o acesso Bearer de clientes compatíveis e habilita o OAuth. O token existente não é modificado. A lista de subjects restringe acesso à identidade informada.
8. No mesmo plugin, altere a declaração de autenticação dos manifestos MCP de API key para o objeto de `.env.auth0-connection.json`. Remova `bearer_token_env_var` do manifesto de compatibilidade quando ele declarar OAuth. Mantenha URL, nome e ID do plugin; atualize a release pelo Plugin Creator.
9. Na conexão OAuth do plugin, copie a **URL de callback exata exibida pelo ChatGPT** para Allowed Callback URLs do cliente Auth0. Não use wildcard e não adivinhe a URL. Conclua o login/consentimento com a identidade cujo User ID foi permitido.

## Instalar e verificar

Instale o plugin na mesma conta/workspace em que vai usá-lo e abra uma conversa **Work** pela página inicial do ChatGPT. Não é necessário um botão “nova conversa” no painel do plugin. Selecione-o com @ no compositor. Se ele não aparecer, confira a instalação, conta, workspace, modo da conversa e a situação da conexão.

Primeiro confirme a descoberta das ferramentas; depois peça uma pesquisa curta e verifique uma chamada real a search_web. O fluxo atual é [SEO por SERP](seo-serp.md), sem Search Console ou acesso às contas dos clientes. Não substitua falhas de conexão por métricas inventadas.

Auth0 autoriza ChatGPT → MCP. O Google Ads usa as credenciais já configuradas no servidor para pesquisa de palavras-chave; não é necessário um novo consentimento Google para cada cliente.

Fontes: [instalação e Work](https://developers.openai.com/plugins/quickstart), [autenticação MCP OpenAI](https://developers.openai.com/plugins/build/auth), [manifestos OAuth](https://developers.openai.com/plugins/build/plugins), [PKCE Auth0](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce).
