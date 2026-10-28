// Widget "Horas planetárias" para o app Scriptable (cole este texto inteiro num script novo).
// Troque CHAVE pela senha que você pôs na Vercel (variável WIDGET_CHAVE). Não mostre a chave a ninguém.
const CHAVE = "COLE_A_CHAVE_AQUI";
const SITE = "https://falandodeastrologia.vercel.app/api/widget-horas";
const ABRIR = "https://falandodeastrologia.com.br/admin-agenda.html";

const tamanho = config.widgetFamily === "small" ? "p" : config.widgetFamily === "large" ? "g" : "m";
const widget = new ListWidget();
widget.setPadding(0, 0, 0, 0);
widget.url = ABRIR;
widget.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
try {
  const req = new Request(`${SITE}?k=${encodeURIComponent(CHAVE)}&t=${tamanho}`);
  widget.backgroundImage = await req.loadImage();
} catch (e) {
  widget.addText("Sem conexão");
}
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
