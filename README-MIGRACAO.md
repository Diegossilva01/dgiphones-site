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


## Chegadas e descontos por atraso

A aba **Chegadas** é exclusiva de administradores. Em **Usuários**, confira salário, entrada de segunda a sexta, entrada aos sábados, horas mensais para cálculo e tolerância de entrada. O divisor inicial é 220 e deve corresponder à jornada contratada; a tolerância inicial é 5 minutos.

O controle usa duas tabelas. **Dias para preencher** gera automaticamente uma linha por funcionário e dia previsto de trabalho. O período começa no **5º dia útil do mês selecionado** e termina na data atual de São Paulo; inicialmente o mês selecionado é o anterior. A contagem segue o financeiro existente, incluindo sábado e excluindo domingo e os feriados já tratados pelo sistema. O campo de mês permite mudar o início do período; não é preciso selecionar a data de cada lançamento. A consulta aceita até um ano de intervalo.

As datas e entradas previstas já vêm preenchidas. Informe a chegada real em cada linha e use **Salvar dia** ou **Salvar preenchidos**; o lote pede uma confirmação de senha e salva sequencialmente. Só linhas com horário informado são enviadas. Se um envio falhar, os campos ainda não salvos permanecem preenchidos e o erro identifica o funcionário e a data. Na virada do dia, ao retornar à aba ou mantê-la aberta, a lista inclui as novas pendências. Rascunhos ficam preservados durante atualizações da aba, mas não após recarregar a página ou encerrar a sessão.

Dias de folga previstos na jornada semanal ficam ocultos inicialmente; **Mostrar também os dias de folga previstos** permite registrá-los. A data de cadastro é respeitada. Meses com salário já marcado como pago não geram pendências; é preciso reabrir o salário em **Pagamentos** para lançar dias desses meses. Dias sem lançamento não geram falta ou desconto automático.

Depois de salvar, o dia sai das pendências e aparece em **Dias preenchidos**. A linha toda fica verde quando a chegada é pontual ou está dentro da tolerância e vermelha quando excede a tolerância. A cor indica pontualidade, mesmo que o atraso tenha sido abonado; o abono é identificado e zera o desconto. **Corrigir** abre os horários salvos e exige justificativa, preservando as bases de salário, divisor e tolerância do registro original. **Cancelar** conserva o histórico e retira o registro da tabela de preenchidos, fazendo o dia voltar às pendências quando aplicável; a reativação exige justificativa. **Histórico** mostra autoria e versões anteriores.

O cálculo é `salário mensal / horas mensais / 60 × minutos descontáveis`, arredondado por lançamento para centavos. Até a tolerância, o desconto é zero; acima dela, considera todo o atraso. Entradas antecipadas não geram crédito. O recurso registra apenas entradas; não calcula saídas, compensações, faltas, DSR ou horas extras. A tolerância de entrada não substitui a apuração de todas as marcações do dia (CLT, art. 58, § 1º).

O período exibido organiza o preenchimento. Os descontos continuam vinculados ao mês de cada ocorrência em **Pagamentos**, e o salário líquido e a baixa consideram salário mensal menos vales aprovados e atrasos. O funcionário vê o desconto e o tempo descontável no seu resumo de pagamento.

**Banco:** não é necessário SQL novo, alteração de variáveis de ambiente ou nova importação. Registros e histórico continuam em `ChegadasEquipe` na tabela `ct_records`; as configurações ficam no JSON de `Funcionarios`. A chave única por funcionário/data e o controle de versão preservam a proteção contra duplicidade e sobrescritas. As linhas pendentes são calculadas, sem inserir lançamentos ou descontos antecipadamente no banco. Os testes não acessam produção.
