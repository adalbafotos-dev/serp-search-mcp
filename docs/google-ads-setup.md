# Configurar Google Ads

Esta integração usa a Google Ads API REST com **OAuth de usuário e refresh token**. O objetivo é consultar ideias, métricas de palavras-chave e desempenho de campanhas. O projeto não oferece ferramentas de alteração de campanha. O escopo OAuth do Google Ads é abrangente; o comportamento de leitura é uma restrição deste servidor, não um escopo Google de somente leitura.

## Preencher o ambiente

```dotenv
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_RESEARCH_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v24
```

| Campo | Origem e uso |
| --- | --- |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Credencial de acesso à API associada à configuração Google Ads; precisa de acesso adequado ao ambiente consultado. |
| `GOOGLE_ADS_CLIENT_ID` e `GOOGLE_ADS_CLIENT_SECRET` | Cliente OAuth do seu projeto Google Cloud. |
| `GOOGLE_ADS_REFRESH_TOKEN` | Autorização concedida por um usuário com acesso à conta Google Ads. |
| `GOOGLE_ADS_CUSTOMER_ID` | Conta anunciante consultada, com 10 dígitos e sem hífens. |
| `GOOGLE_ADS_RESEARCH_CUSTOMER_ID` | Alternativa aceita para a conta de pesquisa, quando `GOOGLE_ADS_CUSTOMER_ID` está vazio. |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Conta gerente utilizada para chegar à conta anunciante; omita quando o usuário acessa o anunciante diretamente. |
| `GOOGLE_ADS_API_VERSION` | Versão REST usada por este projeto; padrão `v24`. Não significa “versão mais recente”. |

Chamadas Google Ads precisam do access token OAuth e do developer token. `login-customer-id` identifica a conta gerente, enquanto o customer ID no caminho da requisição é a conta consultada. [Authorization and HTTP Headers](https://developers.google.com/google-ads/api/rest/auth).

## Obter as credenciais

1. Configure um projeto Google Cloud e habilite a Google Ads API. Obtenha o developer token e confirme o nível de acesso aprovado; credenciais de teste não concedem automaticamente acesso de produção. Consulte o [guia de developer token](https://developers.google.com/google-ads/api/docs/api-policy/developer-token).
2. Configure a tela de consentimento e crie um cliente OAuth. Para o fluxo abaixo, selecione **Web application** e cadastre `https://developers.google.com/oauthplayground` como redirect URI.
3. Abra o [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/), entre na configuração e selecione **Use your own OAuth credentials**. Informe o client ID e secret do seu projeto, escolha acesso **Offline** e solicitação de consentimento.
4. Autorize `https://www.googleapis.com/auth/adwords` com o usuário que tem acesso às contas desejadas. Troque o código por tokens e copie o **refresh token**, client ID e secret diretamente para `.env.local`. Use suas próprias credenciais OAuth para evitar a revogação automática de 24 horas dos tokens emitidos pelas credenciais padrão do Playground. [Instruções do Playground](https://developers.google.com/oauthplayground/).
5. Preencha os IDs sem hífens, salve e reinicie o processo servidor. O código troca o refresh token por access tokens conforme necessário; você não precisa colar access tokens temporários na configuração.

O Google documenta esse fluxo de usuário único e também um caminho com cliente **Desktop app** e gcloud CLI. Este projeto implementa refresh token, não autenticação por chave de service account. [Single-user authentication workflow](https://developers.google.com/google-ads/api/docs/oauth/single-user-authentication).

## Validar e interpretar

Comece com uma consulta curta de `google_ads_keyword_metrics` ou `google_ads_keyword_ideas`, indicando localização e idioma. Confira no resultado os filtros utilizados. Para desempenho, use `google_ads_campaign_performance` e um período definido. Se houver vários clientes sob uma conta gerente, confirme qual anunciante está configurado em `GOOGLE_ADS_CUSTOMER_ID`.

Volume, concorrência e faixas de lance são dados de publicidade dependentes dos parâmetros da consulta. Concorrência publicitária não equivale a dificuldade orgânica de SEO. O chat usa os resultados como evidência para recomendar pautas, títulos e canais; o servidor não chama um modelo de linguagem para redigir conteúdo.

| Sintoma | O que conferir |
| --- | --- |
| `invalid_grant` | Refresh token revogado/expirado, usuário correto e consentimento do mesmo cliente OAuth. Apps externos em Testing podem emitir refresh tokens com validade de 7 dias. |
| `USER_PERMISSION_DENIED` | Acesso do usuário à conta, customer ID consultado e manager login ID quando necessário. |
| Developer token não aprovado | Nível de acesso ao ambiente de produção e configuração do projeto Google Cloud. |
| ID inválido | Use 10 dígitos e remova hífens de ambos os IDs. |
| Scope insuficiente | Gere a autorização com `https://www.googleapis.com/auth/adwords`. |

Consulte o diagnóstico oficial de [erros comuns](https://developers.google.com/google-ads/api/docs/get-started/common-errors). Não inclua tokens em mensagens, screenshots ou logs de diagnóstico; use o tipo do erro e request ID quando disponibilizado.

O OAuth para conectar ChatGPT ao MCP é uma configuração separada do OAuth Google Ads usado pelo servidor. Veja [connections.md](connections.md) para Bearer local, stdio e OAuth remoto.
