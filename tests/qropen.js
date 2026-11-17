// Ouvre le dialogue QR : bouton d'en-tête s'il est visible, sinon via le menu « Classe » (écrans étroits)
module.exports = async (page, tap) => {
  const act = (sel) => tap ? page.tap(sel) : page.click(sel);
  if (await page.isVisible('#btnQr')) return act('#btnQr');
  await act('#btnClass'); await page.waitForSelector('#classMenu [data-cls="qr"]', { state: 'visible' });
  return act('#classMenu [data-cls="qr"]');
};
