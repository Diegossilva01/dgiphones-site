const PLANILHA = "Produtos";

function doGet() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PLANILHA);

  const dados = sheet.getDataRange().getValues();

  let html = "";

  for (let i = 1; i < dados.length; i++) {

    const nome = dados[i][0];
    const categoria = dados[i][1];
    const precoPix = Number(dados[i][2]);
    const classificacao = dados[i][3];
    const descricao = dados[i][4];
    const imagem = converterLinkDrive(dados[i][5]);
    const whatsapp = dados[i][6];

    const precoCartao = (precoPix * 1.12);

    const precoPixFormatado = precoPix.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

    const precoCartaoFormatado = precoCartao.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

    const classe = classificacao.toUpperCase() == "A" ? "a" : "b";

    html += `
<div class="produto" data-categoria="${categoria.toLowerCase()}">

<img src="${imagem}" alt="${nome}">

<div class="info">

<span class="selo">SEMINOVO</span>

<h3>${nome}</h3>

<p>${descricao}</p>

<div class="preco-cartao">

${precoCartaoFormatado}

<small>em até 12x sem juros</small>

</div>

<div class="pix">

<span class="off">10% OFF</span>

<div class="preco-pix">

${precoPixFormatado}

<span>no PIX</span>

</div>

</div>

<p class="classificacao ${classe}">

Classificação ${classificacao}

</p>

<a
class="whatsapp"
target="_blank"
href="${whatsapp}">

Comprar pelo WhatsApp

</a>

</div>

</div>
`;

  }

  return ContentService
    .createTextOutput(html)
    .setMimeType(ContentService.MimeType.TEXT);

}

function converterLinkDrive(link) {

  if (!link) return "";

  if (link.includes("uc?export=view")) {
    return link;
  }

  const regex = /[-\w]{25,}/;
  const resultado = link.match(regex);

  if (resultado) {
    return "https://drive.google.com/uc?export=view&id=" + resultado[0];
  }

  return link;

}
