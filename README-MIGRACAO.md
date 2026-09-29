# DG iPhones / CellTech Panamby — Vercel + Neon

O projeto usa páginas estáticas na Vercel e funções em `/api` para ler e gravar no PostgreSQL do Neon. Os cadastros e os novos uploads de fotos não usam Apps Script ou Google Sheets.

O painel **Cotações e contatos** mostra os envios de cotação e manutenção já presentes na planilha e os novos envios. Equipe e administradores podem abrir o WhatsApp, escrever observações internas e marcar o andamento (`Novo`, `Em contato`, `Atendido`, `Não fechou`; cotações também têm `Celular comprado`). Revendedores não recebem acesso aos contatos. Os campos de atendimento ficam no JSON de cada registro importado, sem exigir outro comando SQL.

## Antes de publicar

1. Faça uma cópia de segurança da planilha e mantenha o site antigo sem novas alterações durante a migração. Se houver cadastros após a cópia fornecida, exporte outra planilha e gere uma nova importação antes de publicar.
2. Crie um **novo projeto Neon** para este site. No SQL Editor, execute `schema.sql` uma única vez.
3. Execute, **na ordem**, os seis arquivos privados `importacao_01_PRIVADA.sql` a `importacao_06_PRIVADA.sql`. Eles são entregues separadamente do ZIP de código. Não os coloque no GitHub. Os comandos repetidos não sobrescrevem registros já importados.
4. Confirme as contagens com:

```sql
SELECT collection, count(*) AS registros FROM ct_records GROUP BY collection ORDER BY collection;
```

Contagens esperadas da planilha recebida: CotacoesSite 63, PagamentosEquipe 162, Funcionarios 13, Compras 66, Estoque 59, Vendas 42, LogExclusoes 35, ManutencoesSite 1, OrdensServico 7. Total: **448**.

Há uma inconsistência anterior à migração: um item vendido no estoque aponta para um ID de compra ausente da aba Compras. Ele é mantido sem alteração para preservar o histórico.

5. No repositório do site, substitua os arquivos pelo conteúdo do ZIP de código. Em Vercel, conecte esse repositório como projeto sem framework e configure a variável secreta **`DATABASE_URL`** para Production (e Preview, se for testar lá), copiando a string de conexão PostgreSQL da tela **Connect** do novo projeto Neon. Nunca publique a string em Git ou em mensagem.
6. Faça um novo deploy na Vercel depois de salvar a variável. Teste login, catálogo, uma compra de teste, venda, OS, cotação e o financeiro com usuários de cada perfil. Apague somente os registros fictícios depois de conferir o resultado.

## Fotos antigas

A planilha contém **214 IDs de imagens do Google Drive**, mas os bytes das imagens não vieram no arquivo. Os links antigos continuam funcionando enquanto os arquivos estiverem no Drive. Para eliminar essa última dependência, exporte a pasta original `DGIPHONES - Fotos dos Produtos` do Drive em ZIP e envie o ZIP. Com os arquivos, execute `gerar_fotos.py` para gerar o SQL privado das fotos e depois execute esse SQL no Neon. Confira que todas as fotos carregam pelo endereço `/api/foto?id=...` antes de remover a pasta do Drive.

Fotos novas enviadas pelo painel já são salvas no Neon. Cada uma pode ter até 400 KB; o formulário reduz as dimensões automaticamente. O limite de requisição da função também pode impedir o envio simultâneo de muitas fotos grandes: divida o envio se necessário.

## Recursos e limites

- Contas e hashes de senha existentes são importados. Tokens antigos do Apps Script deixam de valer; todos precisam entrar novamente.
- Os links de acompanhamento das sete OS antigas conservam o ID e a chave pública; links antigos que apontem ao domínio do site continuam válidos. Links que apontem diretamente ao Apps Script devem ser reenviados.
- Cotações e solicitações de manutenção são gravadas no Neon. Para voltar a receber o aviso por e-mail, configure `RESEND_API_KEY`, `EMAIL_FROM` (remetente verificado) e `COTACOES_EMAIL` na Vercel e faça novo deploy. Se o envio falhar, a cotação fica registrada e aparece no WhatsApp.
- Não apague a planilha nem a pasta de fotos até conferir a importação e a cópia das imagens.
- O ZIP do código não contém a planilha, SQL com dados de pessoas, conexão do banco nem fotos privadas.
