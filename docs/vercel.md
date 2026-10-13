# Produção na Vercel

O projeto tem duas superfícies: uma página estática de apresentação em `/` e o servidor MCP em `/api/mcp`. Toda pesquisa e análise é feita por ferramentas nos chats. O site não possui operação, cadastro ou login, e o projeto não precisa de banco de dados.

## Configuração do projeto

Importe o repositório no painel da Vercel, usando esta pasta como Root Directory. O preset é **Next.js**; mantenha o Output Directory do framework. O `vercel.json` configura `npm ci`, `npm run build` e Fluid Compute. Selecione uma versão Node.js compatível com o projeto, como **24.x**.

O endpoint já usa o runtime Node.js e exporta `maxDuration = 120`. A página é gerada estaticamente no build. A Vercel executa as rotas do framework sem precisar rodar o script `start:hosted`. [Configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json), [duração de Functions](https://vercel.com/docs/functions/configuring-functions/duration).

## Variáveis em Production

Para este deploy, a origem é `https://serp-search-mcp.vercel.app` e o endpoint MCP é `https://serp-search-mcp.vercel.app/api/mcp`.

Foi preparado um arquivo local privado, `.env.vercel.production`, com as credenciais existentes, `MCP_AUTH_MODE=bearer` e a origem HTTPS correta. No projeto da conta Vercel escolhida, abra **Settings → Environment Variables**, importe o arquivo, selecione **Production** e salve. Depois faça **Redeploy** do deployment de produção. O arquivo é ignorado pelo Git e pelos uploads de código da Vercel. Essa importação habilita clientes com Bearer; OAuth externo para ChatGPT continua sendo uma configuração separada.

Para preparar o arquivo em outra instalação, com o ambiente local já preenchido:

```powershell
npm run vercel:prepare-env -- https://serp-search-mcp.vercel.app
```

O script não sobrescreve um arquivo de importação existente e não publica as variáveis automaticamente. Não imprime seus valores.

Cadastre os valores de `.env.local` nas **Environment Variables** do projeto, aplicadas a Production. A `.vercelignore` exclui os arquivos de segredos, configurações locais do Codex e ZIPs. O arquivo `.env.local` não deve ser enviado como código.

| Grupo | Variáveis |
| --- | --- |
| DataForSEO | `SERP_PROVIDER=dataforseo`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| Google Ads | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_RESEARCH_CUSTOMER_ID` ou `GOOGLE_ADS_CUSTOMER_ID` |
| Google Ads opcional | `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_API_VERSION` |
| Acesso dos clientes | `MCP_AUTH_MODE`, `MCP_AUTH_TOKEN` para clientes com Bearer, ou as variáveis `MCP_OAUTH_*` para OAuth |
| Domínio | `MCP_PUBLIC_URL=https://seu-projeto.vercel.app` ou sua origem HTTPS com domínio próprio |

**Não copie `MCP_PUBLIC_URL=http://localhost:3000` para Production.** O endereço deve ser a origem sem `/api/mcp`. Quando `MCP_PUBLIC_URL` está ausente, o servidor usa `VERCEL_PROJECT_PRODUCTION_URL`, ou `VERCEL_URL` como alternativa. Os aliases conhecidos do deploy e da branch também são aceitos na validação de Host, sem aceitar qualquer domínio `.vercel.app`. A origem explícita é útil para fixar o recurso OAuth ao domínio definitivo. [Variáveis de sistema da Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).

Depois de alterar variáveis, faça um novo deploy para aplicá-las. As credenciais dos provedores ficam no servidor; não são dados da página e não usam prefixo `NEXT_PUBLIC_`.

## Conectar os chats

Use `https://seu-projeto.vercel.app/api/mcp` como URL do servidor **Streamable HTTP**. A página inicial só anuncia o serviço e não executa consultas.

- Codex e clientes com Bearer podem usar `MCP_AUTH_TOKEN` no ambiente do cliente.
- ChatGPT remoto autenticado usa o OAuth externo já suportado pelo projeto. Isso é autorização do cliente MCP; o site não precisa de telas de login ou de cadastro. Os detalhes de issuer, audience, scopes e PKCE estão no [guia de conexão](connections.md).
- No pacote `plugin/.mcp.json`, substitua a URL local pela URL HTTPS definitiva. Se o cliente usa OAuth, remova `bearer_token_env_var` para permitir o fluxo OAuth dele.
- A URL MCP precisa estar alcançável pelo cliente, sem uma página de login da proteção de deploy da Vercel na frente dela. Ajuste a política de acesso do deploy usado pelos chats; preserve a autenticação do endpoint MCP.

## Verificar após publicar

Abra a página inicial para conferir a apresentação. Uma requisição sem credencial ao endpoint retorna `401`; isso confirma que o recurso está protegido, não que os provedores já foram consultados. No cliente MCP, inicialize, liste as treze ferramentas da versão com Search Console e teste primeiro `build_content_strategy`, que não faz consultas pagas. O deploy anterior possui nove ferramentas; use `--legacy` somente ao verificar essa versão.

Para ambientes que aceitam o token fixo (`MCP_AUTH_MODE=bearer` ou `both`), também pode usar o script local contra o deploy, com `MCP_AUTH_TOKEN` disponível no ambiente do script:

```powershell
$env:SMOKE_BASE_URL = 'https://seu-projeto.vercel.app'
npm run verify
```

As flags `--serp` e `--google-ads` fazem consultas reais e são opcionais. O script mostra apenas o resumo; não imprime credenciais.

O cache OAuth do Google Ads e o limite de 60 chamadas/minuto por identidade são otimizações em memória de cada instância. O servidor funciona sem compartilhar esse estado; o limite não é global na Vercel. Para um teto global de requisições em produção, use regras da infraestrutura. Isso não exige adicionar banco de dados ao projeto.

Esta preparação não criou nem publicou um projeto Vercel. O deploy será feito pelo proprietário, conforme solicitado.
