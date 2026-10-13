# Verificação — 13 de outubro de 2026

Projeto instalado na pasta indicada pelo usuário, com Next.js **16.4.0**, React **19.3.0** e MCP SDK **1.32.1**. A interface agora é uma apresentação estática e o acesso operacional é exclusivo pelo MCP/Plugin. Configuração e guia de produção na Vercel incluídos. Ambiente `.env.local` preservado; nenhum valor de credencial foi mostrado no diagnóstico.

| Verificação | Resultado observado |
| --- | --- |
| Dependências | Instalação concluída; auditoria npm não reportou vulnerabilidades |
| TypeScript | `npm run typecheck` aprovado |
| Produção | `npm run build` aprovado: página `/` estática, `/api/mcp` e OAuth metadata dinâmicos |
| Testes | 110 testes aprovados; incluem origens e aliases conhecidos da Vercel, rejeitando hosts externos |
| MCP HTTP | SDK Client inicializou, listou 9 ferramentas, 2 prompts e 1 recurso, e executou o plano editorial |
| MCP stdio | Processo real inicializou e executou a ferramenta editorial com o SDK Client |
| Autenticação | HTTP sem credencial retornou 401; Host/Origin, limites de corpo e JWT foram testados |
| HTML público | `https://example.com` analisado com sucesso; uma página retornada |
| DataForSEO direto | Uma consulta organic BR/pt retornou 5 fontes e 4 perguntas; custo da tarefa reportado pelo provedor: US$ 0,002 |
| DataForSEO via MCP | Consulta `search_web` via HTTP retornou 5 fontes, com `provider=dataforseo` e uma requisição de provedor |
| Google Ads via MCP | Consulta de ideias retornou 5 ideias; consulta histórica retornou métricas para 1 termo |
| Interface | Apresentação conferida no navegador, sem formulários, credenciais, status do ambiente ou controles de operação |
| Acesso exclusivo MCP | Antigas rotas `/api/tools` e `/api/status` retornam 404; chamadas MCP seguem funcionais |
| Plugin ZIP | Conferido: apenas manifesto, configuração HTTP, README e skill, sem `.env.local` |

O nome `GOOGLE_ADS_RESEARCH_CUSTOMER_ID` já utilizado no ambiente do usuário é aceito como alternativa à conta padrão. DataForSEO é o provedor padrão quando `SERP_PROVIDER` não está definido.

Os testes reais de DataForSEO e Google Ads da tabela foram feitos na instalação inicial. A revisão da apresentação e da preparação Vercel foi validada sem repetir consultas pagas: usou o plano editorial, uma página pública e os testes de contrato com mocks.

OAuth foi verificado com JWTs assinados localmente e JWKS de teste, incluindo issuer, audience, expiração, scope e subjects. **O provedor OAuth externo ainda não foi configurado, e o servidor não foi publicado.** A conexão do ChatGPT remoto depende dessas etapas. A conexão atual deste chat não recebeu automaticamente as novas ferramentas.

`.codex/config.toml` foi incluído no projeto; `codex mcp get serp_search --json` ainda informou ausência do servidor na configuração carregada pelo CLI. O servidor stdio funciona quando iniciado diretamente. A configuração de projeto depende da confiança e recarga do cliente; nenhuma configuração global foi alterada.

Não foram feitos testes reais de relatórios de campanhas, SERP News, SerpApi ou Serper. Seus contratos possuem testes com mocks. Nenhuma campanha ou conteúdo foi alterado ou publicado. Não foi feita avaliação de performance ou tráfego real de websites.

Comandos reproduzíveis estão no [README](../README.md), e os requisitos de conexão estão no [guia](connections.md). As consultas reais dos scripts só são acionadas explicitamente por suas flags.
