# Google Search Console no SERP Search MCP

Esta integração lê diretamente a API Google; não depende de uma assinatura ou do código do GSC Wizard. Ela acrescenta quatro ferramentas somente leitura: search_console_sites, search_console_performance, search_console_inspect_url e search_console_sitemaps. GA4, Merchant Center, Bing, Yandex, colaboração, previsões e experimentos do outro produto não fazem parte desta implementação.

## Autorizar sua propriedade

1. Abra o [Google Cloud Console](https://console.cloud.google.com/), selecione a conta e o projeto corretos. Em APIs e serviços, ative **Google Search Console API**.
2. Em Google Auth Platform, configure o consentimento e o acesso somente leitura `https://www.googleapis.com/auth/webmasters.readonly`. Se o app estiver em testes, inclua sua conta como usuário de teste. Essa conta deve ter acesso à propriedade no Search Console.
3. Em **Clients**, crie um cliente OAuth do tipo **Desktop app / Aplicativo para computador** para o assistente local de autorização e baixe o JSON. Guarde-o fora da pasta pública e não envie seu conteúdo pelo chat ou pelo GitHub. Ele contém uma credencial.
4. Na pasta do projeto, execute o comando abaixo com o caminho real do JSON:

```powershell
npm run search-console:authorize -- "C:\caminho\cliente-oauth.json"
```

5. Abra o link impresso em seu navegador normal, escolha a conta com acesso à propriedade e conclua o consentimento. O script recebe o callback em um listener local 127.0.0.1, verifica state e PKCE S256, e salva o refresh token em `.env.search-console`. Nunca imprime o token e preserva um arquivo existente.
6. Importe as três variáveis desse arquivo privado na Vercel Production e copie-as para `.env.local` para testes locais. Configure a propriedade exata e, para uso pessoal, a lista de propriedades permitidas:

```dotenv
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:adalbapro.com.br
GOOGLE_SEARCH_CONSOLE_ALLOWED_SITES=sc-domain:adalbapro.com.br
```

Use `sc-domain:adalbapro.com.br` apenas se essa for a propriedade cadastrada; para prefixo de URL, copie `https://adalbapro.com.br/` exatamente como aparecer no Search Console. O nome do domínio sozinho não substitui o identificador da propriedade.

7. Faça o commit/push e o redeploy manual da nova versão. Liste as ferramentas e execute search_console_sites. Depois consulte um período explícito com search_console_performance. As credenciais e o refresh token do Ads não são reaproveitados automaticamente; os escopos são diferentes.

Para verificar a descoberta da conta, após deploy:

```powershell
$env:SMOKE_BASE_URL='https://serp-search-mcp.vercel.app'
npm run verify -- --search-console
```

O Google pode limitar a vida de refresh tokens de apps externos em testes a sete dias. Confira o estado do consentimento antes de depender dessa autorização em produção. [OAuth Google](https://developers.google.com/identity/protocols/oauth2/).

## Interpretar os resultados

SERP do DataForSEO é uma observação de uma consulta, localização e momento. Google Ads fornece estimativas históricas de demanda e competição publicitária. Search Console fornece cliques, impressões, CTR e posição média agregada da propriedade e período autorizados. Uma dessas fontes não substitui a outra.

Search Console não garante todas as linhas: privacidade, filtros e limites internos podem omitir consultas. Não trate a soma de linhas agrupadas como o total garantido do site. Uma lista vazia não demonstra zero tráfego. Valores ausentes são null, e a inspeção informa a versão no índice Google, não a página ao vivo.

Fontes oficiais: [autorização](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing), [métricas](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [inspeção](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect), [OAuth Desktop](https://developers.google.com/identity/protocols/oauth2/native-app).
