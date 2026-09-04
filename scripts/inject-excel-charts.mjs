/**
 * Injecte des graphiques OOXML dans un fichier .xlsx (ExcelJS ne les supporte pas).
 */
import JSZip from 'jszip';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function buildSer({ title, catRange, valRange }) {
  return `<c:ser>
    <c:idx val="0"/><c:order val="0"/>
    <c:tx><c:strRef><c:f>${esc(title)}</c:f></c:strRef></c:tx>
    <c:cat><c:strRef><c:f>${esc(catRange)}</c:f></c:strRef></c:cat>
    <c:val><c:numRef><c:f>${esc(valRange)}</c:f></c:numRef></c:val>
  </c:ser>`;
}

function buildChartXml({ type, title, catRange, valRange, barDir = 'col' }) {
  const ser = buildSer({ title, catRange, valRange });
  let plotArea = '';

  if (type === 'pie') {
    plotArea = `<c:layout/><c:pieChart>${ser}<c:dLbls><c:showPercent val="1"/></c:dLbls></c:pieChart>`;
  } else if (type === 'line') {
    plotArea = `<c:layout/>
      <c:lineChart>${ser}<c:marker val="1"/><c:smooth val="0"/></c:lineChart>
      <c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="20"/></c:catAx>
      <c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="10"/></c:valAx>`;
  } else {
    plotArea = `<c:layout/>
      <c:barChart>${ser}<c:barDir val="${barDir}"/><c:grouping val="clustered"/></c:barChart>
      <c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:crossAx val="20"/></c:catAx>
      <c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:crossAx val="10"/></c:valAx>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>${plotArea}</c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
  </c:chart>
</c:chartSpace>`;
}

function buildDrawingXml(anchors) {
  const frames = anchors.map((anchor, i) => {
    const { col, row, col2, row2 } = anchor;
    return `<xdr:twoCellAnchor>
      <xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${col2}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row2}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Graphique ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>
        </a:graphicData></a:graphic>
      </xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${frames}</xdr:wsDr>`;
}

async function resolveSheetFile(zip, sheetName) {
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const escaped = sheetName.replace(/'/g, '&apos;');
  const sheetMatch = workbookXml.match(new RegExp(`<sheet[^>]+name="${escaped}"[^>]+r:id="(rId\\d+)"`))
    || workbookXml.match(new RegExp(`<sheet[^>]+r:id="(rId\\d+)"[^>]+name="${escaped}"`));
  if (!sheetMatch) throw new Error(`Feuille introuvable: ${sheetName}`);
  const relId = sheetMatch[1];
  const targetMatch = relsXml.match(new RegExp(`Id="${relId}"[^>]+Target="([^"]+)"`));
  if (!targetMatch) throw new Error(`Relation introuvable pour ${sheetName}`);
  return targetMatch[1].replace('worksheets/', '');
}

/** @param {Buffer} xlsxBuffer @param {{ sheetName: string, charts: Array }} config */
export async function injectExcelCharts(xlsxBuffer, config) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const { charts, sheetName } = config;
  const sheetFile = await resolveSheetFile(zip, sheetName);

  charts.forEach((chart, i) => {
    zip.file(`xl/charts/chart${i + 1}.xml`, buildChartXml(chart));
  });

  zip.file('xl/drawings/drawing1.xml', buildDrawingXml(charts.map((c) => c.anchor)));

  let drawingRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  charts.forEach((_, i) => {
    drawingRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${i + 1}.xml"/>`;
  });
  drawingRels += '</Relationships>';
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);

  const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;
  let sheetRels = await zip.file(sheetRelsPath)?.async('string')
    || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const existingIds = [...sheetRels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const nextId = Math.max(0, ...existingIds) + 1;
  const drawingRelId = `rId${nextId}`;

  if (!sheetRels.includes('drawing1.xml')) {
    sheetRels = sheetRels.replace('</Relationships>',
      `<Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    zip.file(sheetRelsPath, sheetRels);
  }

  let sheetXml = await zip.file(`xl/worksheets/${sheetFile}`).async('string');
  if (!sheetXml.includes('<drawing')) {
    sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRelId}"/></worksheet>`);
    zip.file(`xl/worksheets/${sheetFile}`, sheetXml);
  }

  let ct = await zip.file('[Content_Types].xml').async('string');
  charts.forEach((_, i) => {
    const part = `/xl/charts/chart${i + 1}.xml`;
    if (!ct.includes(part)) {
      ct = ct.replace('</Types>', `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
    }
  });
  if (!ct.includes('/xl/drawings/drawing1.xml')) {
    ct = ct.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
  }
  zip.file('[Content_Types].xml', ct);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
