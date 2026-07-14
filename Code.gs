const CONFIG = {
  ABA_LEADS: "Leads",
  INSTANCIA: "celltech",
  NUMERO_NOTIFICACAO: "5511977030517"
};

function doPost(e) {
  try {
    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(CONFIG.ABA_LEADS);

    if (!sheet) {
      throw new Error('A aba "Leads" não foi encontrada.');
    }

    const data = JSON.parse(e.postData.contents || "{}");

    sheet.appendRow([
      new Date(),
      data.nome || "",
      data.telefone || "",
      data.modelo || "",
      data.armazenamento || "",
      data.cor || "",
      data.liga || "",
      data.tela || "",
      data.traseira || "",
      data.bateria || "",
      data.pecas || "",
      data.utm_source || "",
      data.utm_medium || "",
      data.utm_campaign || "",
      data.gclid || "",
      data.fbclid || "",
      data.dispositivo || ""
    ]);

    try {
      enviarNotificacaoEvolution(data);
    } catch (erroWhatsApp) {
      console.error("Lead salvo, mas WhatsApp falhou:", erroWhatsApp);
    }

    return respostaJson({ success: true });

  } catch (erro) {
    console.error("Erro no doPost:", erro);
    return respostaJson({
      success: false,
      message: erro.toString()
    });
  }
}

function enviarNotificacaoEvolution(data) {
  const propriedades = PropertiesService.getScriptProperties();
  const urlBase = propriedades.getProperty("EVOLUTION_URL");
  const apiKey = propriedades.getProperty("EVOLUTION_API_KEY");

  if (!urlBase || !apiKey) {
    throw new Error(
      "EVOLUTION_URL ou EVOLUTION_API_KEY não configurada."
    );
  }

  const numeroCliente = normalizarTelefone(data.telefone || "");

  const mensagem =
    "📱 *NOVO LEAD - CELLTECH PANAMBY*\n\n" +
    "👤 *Nome:* " + (data.nome || "Não informado") + "\n" +
    "📞 *WhatsApp:* " + (data.telefone || "Não informado") + "\n\n" +
    "📱 *Modelo:* " + (data.modelo || "Não informado") + "\n" +
    "💾 *Armazenamento:* " + (data.armazenamento || "Não informado") + "\n" +
    "🎨 *Cor:* " + (data.cor || "Não informado") + "\n\n" +
    "⚡ *Liga:* " + (data.liga || "Não informado") + "\n" +
    "🖥️ *Tela:* " + (data.tela || "Não informado") + "\n" +
    "📱 *Traseira:* " + (data.traseira || "Não informado") + "\n" +
    "🔋 *Bateria:* " + (data.bateria || "Não informado") + "\n" +
    "🔧 *Peças:* " + (data.pecas || "Não informado") + "\n\n" +
    (numeroCliente
      ? "💬 *Chamar cliente:*\nhttps://wa.me/" + numeroCliente
      : "");

  const endpoint =
    urlBase.replace(/\/$/, "") +
    "/message/sendText/" +
    CONFIG.INSTANCIA;

  const response = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: apiKey },
    payload: JSON.stringify({
      number: CONFIG.NUMERO_NOTIFICACAO,
      text: mensagem
    }),
    muteHttpExceptions: true
  });

  const codigo = response.getResponseCode();

  if (codigo < 200 || codigo >= 300) {
    throw new Error(
      "Evolution retornou HTTP " +
      codigo +
      ": " +
      response.getContentText()
    );
  }
}

function normalizarTelefone(telefone) {
  let numero = String(telefone).replace(/\D/g, "");

  if (!numero) return "";

  if (!numero.startsWith("55")) {
    numero = "55" + numero;
  }

  return numero;
}

function respostaJson(conteudo) {
  return ContentService
    .createTextOutput(JSON.stringify(conteudo))
    .setMimeType(ContentService.MimeType.JSON);
}
