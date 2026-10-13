# Publicação manual: GitHub e Vercel

Destino: [adalbafotos-dev/serp-search-mcp](https://github.com/adalbafotos-dev/serp-search-mcp).

A pasta local está preparada como repositório Git na branch `main`, com `origin` apontando para `https://github.com/adalbafotos-dev/serp-search-mcp.git`. Esta preparação não executou commit, push nem login. A escolha da conta, a revisão e a publicação ficam com o proprietário.

## Selecionar conta e autoria

A autoria do commit é definida por `user.name` e `user.email` no Git. A conta autenticada para enviar ao GitHub é uma configuração separada do cliente Git. Escolher um perfil de navegador não altera automaticamente a autoria de commits locais. [Nome do autor](https://docs.github.com/en/get-started/git-basics/setting-your-username-in-git), [e-mail dos commits](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).

A identidade foi corrigida **somente nesta pasta** para a conta do repositório:

```powershell
git config --local user.name "adalbafotos-dev"
git config --local user.email "262252081+adalbafotos-dev@users.noreply.github.com"
```

O e-mail usa o ID público da conta e o formato `noreply` do GitHub. Essa configuração substitui a identidade global Capí Joy apenas neste projeto. Não muda a conta autenticada do cliente Git ou de seus navegadores.

Foi habilitado `credential.https://github.com.useHttpPath=true` apenas neste repositório. Isso separa o armazenamento de credenciais por URL do repositório; não troca sua conta nem limpa as credenciais de outras contas. Ao enviar, confira qual conta seu cliente está usando. [Múltiplas contas no GitHub](https://docs.github.com/en/account-and-profile/how-tos/account-management/managing-multiple-accounts).

## Commit e push pelo seu cliente

Abra esta pasta no cliente Git que você utiliza. No GitHub Desktop, use **File → Add Local Repository**, selecione a pasta do projeto e confira a conta ativa nas opções antes de enviar. O destino já existe, então mantenha o `origin` configurado para ele. [Adicionar repositório local](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop).

Revise os arquivos, selecione os que deseja incluir e crie o commit na branch `main`. Depois, envie para `origin/main` usando a conta com acesso ao repositório.

Alternativa pelo terminal, **para você executar após selecionar sua identidade e autenticação**:

```powershell
git status
git add .
git diff --cached --stat
git commit -m "Configura MCP de pesquisa e apresentação estática"
git push -u origin main
```

O `.gitignore` já exclui `.env.local`, dependências, build, configuração local do Codex e dados locais da Vercel. `.env.example` contém somente os campos de referência. As credenciais ficam no ambiente do servidor.

## Deploy manual na Vercel

No navegador ou perfil com a conta Vercel desejada, importe um projeto a partir de `adalbafotos-dev/serp-search-mcp`. Selecione **Next.js**, configure as variáveis de Production e use o domínio definitivo em `MCP_PUBLIC_URL`.

Siga [o guia de produção na Vercel](vercel.md). Depois do deploy, a página inicial será somente apresentação; os chats usarão `https://SEU_DOMINIO/api/mcp`.

O GitHub guarda o código; a Vercel executa o projeto. Nenhuma autenticação no navegador ou publicação externa foi feita por esta preparação.

## Corrigir a autoria do primeiro commit já publicado

Foi verificado que o primeiro commit `25bff3ae0c9ba652c1d8836cc8e1254cf736a793`, na branch `main`, está atribuído a `capi-joy`. `capi-joy` é a conta associada ao e-mail do autor; não é o nome da branch. Alterar `user.name` e `user.email` corrige os próximos commits, mas não altera commits existentes.

Para você corrigir manualmente esse commit, sem incluir as alterações que ainda estão fora do stage:

```powershell
git branch backup/autoria-original 25bff3ae0c9ba652c1d8836cc8e1254cf736a793
git commit --amend --no-edit --reset-author
git push --force-with-lease=refs/heads/main:25bff3ae0c9ba652c1d8836cc8e1254cf736a793 origin main
```

Execute esse procedimento apenas enquanto esse commit for o último commit local que deseja corrigir. O backup guarda o commit anterior localmente. O amend atualiza autor e committer usando a identidade local já corrigida. O push exige que `main` no GitHub ainda aponte para o hash verificado, protegendo alterações remotas feitas depois da conferência; se for rejeitado, confira o histórico antes de tentar novamente. Não adicione `git add .` a esse procedimento se deseja mudar apenas a autoria do commit publicado.

Estes comandos foram documentados para execução manual; o projeto não reescreveu nem reenviou seu commit automaticamente.
