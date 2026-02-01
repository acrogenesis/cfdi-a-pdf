(() => {
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  const chooseBtn = document.getElementById("chooseBtn");
  const dropZone = document.getElementById("dropZone");
  const downloadBtn = document.getElementById("downloadBtn");
  const statusEl = document.getElementById("status");
  const resultList = document.getElementById("resultList");
  const summaryCount = document.getElementById("summaryCount");
  const summaryErrors = document.getElementById("summaryErrors");
  const includeXml = document.getElementById("includeXml");
  const langButtons = Array.from(document.querySelectorAll(".lang-btn"));

  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const i18n = {
    es: {
      title: "Todos tus CFDI a PDF",
      lede: "Procesa archivos CFDI XML directamente en tu navegador, genera recibos PDF completos y descarga un ZIP con PDFs y XMLs renombrados.",
      uploadTitle: "Carga",
      dropTitle: "Suelta archivos XML o carpetas aqui",
      dropSub: "o elige archivos/carpetas abajo",
      chooseFiles: "Elegir archivos o carpeta",
      hint: "Nombre: Empresa-AA-MM-XX (empresa tomada del XML Emisor Nombre)",
      statusWaiting: "Esperando archivos.",
      statusNoFiles: "No hay archivos seleccionados.",
      statusSelected: "{count} archivo(s) seleccionados.",
      statusParsing: "Leyendo archivos XML...",
      statusGenerating: "Generando PDFs...",
      statusZipping: "Creando ZIP...",
      statusReady: "Listo. {count} archivos procesados.",
      outputTitle: "Salida",
      includeXml: "Renombrar XML en el ZIP",
      downloadAll: "Descargar todo (ZIP)",
      summaryFiles: "Archivos",
      summaryErrors: "Errores",
      footer: "Todo corre local en tu navegador.",
      downloadPdf: "Descargar PDF",
      downloadXml: "Descargar XML",
      downloadZip: "Descargar ZIP",
      totalLabel: "Total",
    },
    en: {
      title: "All your CFDI to PDF",
      lede: "Process CFDI XML files directly in your browser, generate complete PDF receipts, and download a ZIP with renamed PDFs and XMLs.",
      uploadTitle: "Upload",
      dropTitle: "Drop XML files or folders here",
      dropSub: "or choose files/folders below",
      chooseFiles: "Choose files or folder",
      hint: "Naming: Company-YY-MM-XX (company from XML Emisor Nombre)",
      statusWaiting: "Waiting for files.",
      statusNoFiles: "No files selected.",
      statusSelected: "{count} file(s) selected.",
      statusParsing: "Parsing XML files...",
      statusGenerating: "Generating PDFs...",
      statusZipping: "Building ZIP...",
      statusReady: "Ready. {count} files processed.",
      outputTitle: "Output",
      includeXml: "Rename XMLs in the ZIP",
      downloadAll: "Download all (ZIP)",
      summaryFiles: "Files",
      summaryErrors: "Errors",
      footer: "Everything runs locally in your browser.",
      downloadPdf: "Download PDF",
      downloadXml: "Download XML",
      downloadZip: "Download ZIP",
      totalLabel: "Total",
    },
  };

  const state = {
    files: [],
    results: [],
    zipBlob: null,
    objectUrls: new Set(),
    lang: "es",
  };

  const t = (key, vars = {}) => {
    const template = i18n[state.lang][key] || "";
    return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
  };

  const applyLanguage = (lang) => {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && i18n[lang][key]) {
        el.textContent = i18n[lang][key];
      }
    });
    langButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
    if (!state.files.length) {
      setStatus(t("statusWaiting"));
    }
    renderResults(state.results);
  };

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const pad2 = (num) => String(num).padStart(2, "0");

  const parseIsoLocal = (value) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?/);
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4] || 0),
      minute: Number(match[5] || 0),
      second: Number(match[6] || 0),
    };
  };

  const formatFecha = (parts) => {
    if (!parts) return "-";
    return `${pad2(parts.day)}/${MONTHS[parts.month - 1]}/${parts.year}`;
  };

  const formatHora = (parts) => {
    if (!parts) return "-";
    return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
  };

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const num = toNumber(value);
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const sanitizeName = (value) => {
    return (value || "empresa")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const numberToSpanish = (num) => {
    const units = [
      "cero",
      "uno",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      "seis",
      "siete",
      "ocho",
      "nueve",
      "diez",
      "once",
      "doce",
      "trece",
      "catorce",
      "quince",
      "dieciseis",
      "diecisiete",
      "dieciocho",
      "diecinueve",
      "veinte",
      "veintiuno",
      "veintidos",
      "veintitres",
      "veinticuatro",
      "veinticinco",
      "veintiseis",
      "veintisiete",
      "veintiocho",
      "veintinueve",
    ];
    const tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    const hundreds = [
      "",
      "ciento",
      "doscientos",
      "trescientos",
      "cuatrocientos",
      "quinientos",
      "seiscientos",
      "setecientos",
      "ochocientos",
      "novecientos",
    ];

    const convert = (n) => {
      if (n < 30) return units[n];
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        if (r === 0) return tens[t];
        return `${tens[t]} y ${units[r]}`;
      }
      if (n === 100) return "cien";
      if (n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        if (r === 0) return hundreds[h];
        return `${hundreds[h]} ${convert(r)}`;
      }
      if (n < 1000000) {
        const th = Math.floor(n / 1000);
        const r = n % 1000;
        const prefix = th === 1 ? "mil" : `${convert(th)} mil`;
        if (r === 0) return prefix;
        return `${prefix} ${convert(r)}`;
      }
      if (n < 1000000000) {
        const mil = Math.floor(n / 1000000);
        const r = n % 1000000;
        const prefix = mil === 1 ? "un millon" : `${convert(mil)} millones`;
        if (r === 0) return prefix;
        return `${prefix} ${convert(r)}`;
      }
      return String(n);
    };

    return convert(num);
  };

  const amountToWords = (value) => {
    const num = toNumber(value);
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);
    return `${numberToSpanish(entero)} pesos ${pad2(centavos)}/100 M.N.`;
  };

  const firstByNS = (node, ns, tag) => node.getElementsByTagNameNS(ns, tag)[0] || null;
  const attrs = (node) => {
    const out = {};
    if (!node || !node.attributes) return out;
    for (const attr of node.attributes) {
      out[attr.name] = attr.value;
    }
    return out;
  };

  const parseXml = (xmlText, filename) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const parseError = doc.getElementsByTagName("parsererror")[0];
    if (parseError) {
      return { error: "Invalid XML", filename };
    }

    const root = doc.documentElement;
    const cfdiNs = root.namespaceURI || "http://www.sat.gob.mx/cfd/4";
    const nominaNs = "http://www.sat.gob.mx/nomina12";
    const tfdNs = "http://www.sat.gob.mx/TimbreFiscalDigital";

    const emisor = firstByNS(doc, cfdiNs, "Emisor");
    const receptor = firstByNS(doc, cfdiNs, "Receptor");
    const nomina = firstByNS(doc, nominaNs, "Nomina");
    const nominaEmisor = nomina ? firstByNS(nomina, nominaNs, "Emisor") : null;
    const nominaReceptor = nomina ? firstByNS(nomina, nominaNs, "Receptor") : null;
    const percep = nomina ? firstByNS(nomina, nominaNs, "Percepciones") : null;
    const deduc = nomina ? firstByNS(nomina, nominaNs, "Deducciones") : null;
    const otros = nomina ? firstByNS(nomina, nominaNs, "OtrosPagos") : null;
    const timbre = firstByNS(doc, tfdNs, "TimbreFiscalDigital");
    const impuestos = firstByNS(doc, cfdiNs, "Impuestos");

    const percepItems = percep ? Array.from(percep.getElementsByTagNameNS(nominaNs, "Percepcion")) : [];
    const deducItems = deduc ? Array.from(deduc.getElementsByTagNameNS(nominaNs, "Deduccion")) : [];
    const otrosItems = otros ? Array.from(otros.getElementsByTagNameNS(nominaNs, "OtroPago")) : [];
    const conceptos = Array.from(doc.getElementsByTagNameNS(cfdiNs, "Concepto"));

    const trasladoItems = impuestos ? Array.from(impuestos.getElementsByTagNameNS(cfdiNs, "Traslado")) : [];
    const retencionItems = impuestos ? Array.from(impuestos.getElementsByTagNameNS(cfdiNs, "Retencion")) : [];

    const conceptoTraslados = [];
    const conceptoRetenciones = [];

    conceptos.forEach((concepto) => {
      const imp = firstByNS(concepto, cfdiNs, "Impuestos");
      if (!imp) return;
      const tras = Array.from(imp.getElementsByTagNameNS(cfdiNs, "Traslado"));
      const ret = Array.from(imp.getElementsByTagNameNS(cfdiNs, "Retencion"));
      tras.forEach((t) => conceptoTraslados.push(attrs(t)));
      ret.forEach((r) => conceptoRetenciones.push(attrs(r)));
    });

    const fecha = root.getAttribute("Fecha") || root.getAttribute("FechaExp") || "";

    return {
      filename,
      xmlText,
      root: attrs(root),
      emisor: attrs(emisor),
      receptor: attrs(receptor),
      nomina: attrs(nomina),
      nominaEmisor: attrs(nominaEmisor),
      nominaReceptor: attrs(nominaReceptor),
      percepciones: attrs(percep),
      percepcionItems: percepItems.map(attrs),
      deducciones: attrs(deduc),
      deduccionItems: deducItems.map(attrs),
      otros: attrs(otros),
      otroItems: otrosItems.map(attrs),
      timbre: attrs(timbre),
      conceptos: conceptos.map(attrs),
      impuestos: attrs(impuestos),
      traslados: trasladoItems.map(attrs),
      retenciones: retencionItems.map(attrs),
      conceptoTraslados,
      conceptoRetenciones,
      fecha,
      hasNomina: Boolean(nomina),
    };
  };

  const buildNominaPdf = (data) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 36;
    const width = 612 - margin * 2;
    let y = 36;

    const addLine = (text, size = 11, bold = false) => {
      doc.setFont("times", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, width);
      doc.text(lines, margin, y);
      y += lines.length * (size + 2);
    };

    const addSpace = (space = 6) => {
      y += space;
    };

    const autoTable = (head, body, opts = {}) => {
      doc.autoTable({
        head: [head],
        body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { font: "times", fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [241, 233, 220], textColor: [26, 26, 26] },
        ...opts,
      });
      y = doc.lastAutoTable.finalY + 10;
    };

    const fechaParts = parseIsoLocal(data.fecha);

    addLine("Comprobante Fiscal Digital por Internet", 14, true);
    addLine(data.emisor.Nombre || "-");

    const headerLine = [
      fechaParts ? `Fecha: ${formatFecha(fechaParts)}` : "",
      fechaParts ? `Hora: ${formatHora(fechaParts)}` : "",
      data.emisor.Rfc ? `RFC: ${data.emisor.Rfc}` : "",
      data.nominaEmisor.RegistroPatronal ? `Reg Pat: ${data.nominaEmisor.RegistroPatronal}` : "",
    ].filter(Boolean).join(" ");
    if (headerLine) addLine(headerLine);

    const headerLine2 = [
      data.emisor.RegimenFiscal ? `Reg Fiscal: ${data.emisor.RegimenFiscal}` : "",
      data.root.LugarExpedicion ? `Lugar de expedicion: ${data.root.LugarExpedicion}` : "",
    ].filter(Boolean).join(" ");
    if (headerLine2) addLine(headerLine2);

    addSpace(6);

    const receptorLines = [
      data.receptor.Nombre || "-",
      data.receptor.Rfc ? `RFC: ${data.receptor.Rfc}` : "",
      data.nominaReceptor.Curp ? `CURP: ${data.nominaReceptor.Curp}` : "",
      data.nominaReceptor.NumSeguridadSocial ? `NSS: ${data.nominaReceptor.NumSeguridadSocial}` : "",
      data.nominaReceptor.NumEmpleado ? `Num Empleado: ${data.nominaReceptor.NumEmpleado}` : "",
      data.nominaReceptor.Departamento ? `Depto: ${data.nominaReceptor.Departamento}` : "",
      data.nominaReceptor.Puesto ? `Puesto: ${data.nominaReceptor.Puesto}` : "",
      data.nominaReceptor.TipoContrato ? `Tipo Contrato: ${data.nominaReceptor.TipoContrato}` : "",
      data.nominaReceptor.TipoJornada ? `Jornada: ${data.nominaReceptor.TipoJornada}` : "",
      data.nominaReceptor.PeriodicidadPago ? `Periodicidad: ${data.nominaReceptor.PeriodicidadPago}` : "",
      data.receptor.RegimenFiscalReceptor ? `Reg Fiscal Receptor: ${data.receptor.RegimenFiscalReceptor}` : "",
      data.receptor.DomicilioFiscalReceptor ? `Domicilio Fiscal: ${data.receptor.DomicilioFiscalReceptor}` : "",
    ].filter(Boolean);

    const nominaLines = [
      data.nomina.FechaInicialPago || data.nomina.FechaFinalPago
        ? `Periodo: ${data.nomina.FechaInicialPago || "-"} - ${data.nomina.FechaFinalPago || "-"}`
        : "",
      data.nomina.FechaPago ? `Fecha Pago: ${data.nomina.FechaPago}` : "",
      data.nomina.NumDiasPagados ? `Dias de pago: ${data.nomina.NumDiasPagados}` : "",
      data.nominaReceptor.FechaInicioRelLaboral ? `Fecha ini relacion laboral: ${data.nominaReceptor.FechaInicioRelLaboral}` : "",
      data.nominaReceptor.Antiguedad || data.nominaReceptor["Antig\u00fcedad"]
        ? `Antiguedad: ${data.nominaReceptor.Antiguedad || data.nominaReceptor["Antig\u00fcedad"]}`
        : "",
      data.nominaReceptor.SalarioBaseCotApor ? `SBC: ${formatMoney(data.nominaReceptor.SalarioBaseCotApor)}` : "",
      data.nominaReceptor.SalarioDiarioIntegrado ? `SDI: ${formatMoney(data.nominaReceptor.SalarioDiarioIntegrado)}` : "",
      data.nomina.TipoNomina ? `Tipo Nomina: ${data.nomina.TipoNomina}` : "",
    ].filter(Boolean);

    autoTable(
      ["Receptor", "Nomina"],
      [[receptorLines.join("\n"), nominaLines.join("\n")]],
      {
        styles: { font: "times", fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [241, 233, 220] },
        columnStyles: { 0: { cellWidth: 260 }, 1: { cellWidth: 260 } },
      }
    );

    if (data.percepcionItems.length) {
      addLine("Percepciones", 10, true);
      const body = data.percepcionItems.map((p) => {
        const grav = toNumber(p.ImporteGravado);
        const exen = toNumber(p.ImporteExento);
        return [
          p.TipoPercepcion || "-",
          p.Clave || "-",
          p.Concepto || "-",
          formatMoney(grav),
          formatMoney(exen),
          formatMoney(grav + exen),
        ];
      });
      autoTable(["Tipo", "Clave", "Concepto", "Gravado", "Exento", "Total"], body, {
        columnStyles: { 2: { cellWidth: 200 } },
      });
    }

    if (data.deduccionItems.length) {
      addLine("Deducciones", 10, true);
      const body = data.deduccionItems.map((d) => [
        d.TipoDeduccion || "-",
        d.Clave || "-",
        d.Concepto || "-",
        formatMoney(d.Importe),
      ]);
      autoTable(["Tipo", "Clave", "Concepto", "Importe"], body, {
        columnStyles: { 2: { cellWidth: 240 } },
      });
    }

    if (data.otroItems.length) {
      addLine("Otros Pagos", 10, true);
      const body = data.otroItems.map((o) => [
        o.TipoOtroPago || "-",
        o.Clave || "-",
        o.Concepto || "-",
        formatMoney(o.Importe),
      ]);
      autoTable(["Tipo", "Clave", "Concepto", "Importe"], body, {
        columnStyles: { 2: { cellWidth: 240 } },
      });
    }

    const totalPerc = toNumber(data.nomina.TotalPercepciones);
    const totalDed = toNumber(data.nomina.TotalDeducciones);
    const totalOtros = toNumber(data.nomina.TotalOtrosPagos);
    const neto = totalPerc + totalOtros - totalDed;

    autoTable(
      ["Totales", ""],
      [
        ["SubTotal", formatMoney(data.root.SubTotal)],
        ["Descuentos", formatMoney(data.root.Descuento)],
        ["Retenciones", formatMoney(totalDed)],
        ["Total", formatMoney(data.root.Total)],
        ["Total Percepciones", formatMoney(totalPerc)],
        ["Total Otros Pagos", formatMoney(totalOtros)],
        ["Neto del recibo", formatMoney(neto)],
      ],
      { columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 120 } } }
    );

    if (data.root.Total) {
      addLine("Importe con letra", 9, true);
      addLine(amountToWords(data.root.Total), 9);
    }

    addLine("Este documento es una representacion impresa de un CFDI", 8);
    if (data.root.MetodoPago) {
      const metodo = data.root.FormaPago ? `${data.root.MetodoPago} - ${data.root.FormaPago}` : data.root.MetodoPago;
      addLine(metodo, 8);
    }

    addSpace(6);

    const tim = data.timbre || {};
    if (Object.keys(tim).length) {
      addLine("Datos de timbrado", 9, true);
      const timRows = [];
      if (data.root.NoCertificado) timRows.push(["Serie del Certificado del emisor", data.root.NoCertificado]);
      if (tim.UUID) timRows.push(["Folio Fiscal UUID", tim.UUID]);
      if (tim.NoCertificadoSAT) timRows.push(["No. serie Certificado SAT", tim.NoCertificadoSAT]);
      if (tim.FechaTimbrado) timRows.push(["Fecha y hora de certificacion", tim.FechaTimbrado]);
      if (tim.RfcProvCertif) timRows.push(["RfcProvCertif", tim.RfcProvCertif]);
      if (timRows.length) {
        autoTable(["Campo", "Valor"], timRows, { columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 320 } } });
      }

      if (data.root.Sello) {
        addLine("Sello digital del CFDI", 7, true);
        addLine(data.root.Sello, 7);
      }

      if (tim.SelloSAT) {
        addLine("Sello del SAT", 7, true);
        addLine(tim.SelloSAT, 7);
      }

      if (tim.UUID && tim.FechaTimbrado && tim.RfcProvCertif && tim.NoCertificadoSAT && tim.SelloCFD) {
        const cadena = `||1.1|${tim.UUID}|${tim.FechaTimbrado}|${tim.RfcProvCertif}|${tim.SelloCFD}|${tim.NoCertificadoSAT}||`;
        addLine("Cadena original del complemento del certificacion digital del SAT", 7, true);
        addLine(cadena, 7);
      }
    }

    return doc.output("arraybuffer");
  };

  const buildCfdiPdf = (data) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 36;
    const width = 612 - margin * 2;
    let y = 36;

    const addLine = (text, size = 11, bold = false) => {
      doc.setFont("times", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, width);
      doc.text(lines, margin, y);
      y += lines.length * (size + 2);
    };

    const addSpace = (space = 6) => {
      y += space;
    };

    const autoTable = (head, body, opts = {}) => {
      doc.autoTable({
        head: [head],
        body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { font: "times", fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [241, 233, 220], textColor: [26, 26, 26] },
        ...opts,
      });
      y = doc.lastAutoTable.finalY + 10;
    };

    const fechaParts = parseIsoLocal(data.fecha);

    addLine("Comprobante Fiscal Digital por Internet", 14, true);
    addLine(data.emisor.Nombre || "-");

    const headerLine = [
      fechaParts ? `Fecha: ${formatFecha(fechaParts)}` : "",
      fechaParts ? `Hora: ${formatHora(fechaParts)}` : "",
      data.emisor.Rfc ? `RFC: ${data.emisor.Rfc}` : "",
    ].filter(Boolean).join(" ");
    if (headerLine) addLine(headerLine);

    const headerLine2 = [
      data.emisor.RegimenFiscal ? `Reg Fiscal: ${data.emisor.RegimenFiscal}` : "",
      data.root.LugarExpedicion ? `Lugar de expedicion: ${data.root.LugarExpedicion}` : "",
    ].filter(Boolean).join(" ");
    if (headerLine2) addLine(headerLine2);

    addSpace(6);

    const emisorLines = [
      data.emisor.Nombre || "-",
      data.emisor.Rfc ? `RFC: ${data.emisor.Rfc}` : "",
      data.emisor.RegimenFiscal ? `Reg Fiscal: ${data.emisor.RegimenFiscal}` : "",
    ].filter(Boolean);

    const receptorLines = [
      data.receptor.Nombre || "-",
      data.receptor.Rfc ? `RFC: ${data.receptor.Rfc}` : "",
      data.receptor.UsoCFDI ? `Uso CFDI: ${data.receptor.UsoCFDI}` : "",
      data.receptor.RegimenFiscalReceptor ? `Reg Fiscal Receptor: ${data.receptor.RegimenFiscalReceptor}` : "",
      data.receptor.DomicilioFiscalReceptor ? `Domicilio Fiscal: ${data.receptor.DomicilioFiscalReceptor}` : "",
    ].filter(Boolean);

    autoTable(
      ["Emisor", "Receptor"],
      [[emisorLines.join("\n"), receptorLines.join("\n")]],
      {
        styles: { font: "times", fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [241, 233, 220] },
        columnStyles: { 0: { cellWidth: 260 }, 1: { cellWidth: 260 } },
      }
    );

    const compRows = [
      ["Serie", data.root.Serie || "-"],
      ["Folio", data.root.Folio || "-"],
      ["Moneda", data.root.Moneda || "-"],
      ["Tipo", data.root.TipoDeComprobante || "-"],
      ["MetodoPago", data.root.MetodoPago || "-"],
      ["FormaPago", data.root.FormaPago || "-"],
      ["Exportacion", data.root.Exportacion || "-"],
      ["SubTotal", formatMoney(data.root.SubTotal)],
      ["Descuento", formatMoney(data.root.Descuento)],
      ["Total", formatMoney(data.root.Total)],
    ];
    autoTable(["Comprobante", ""], compRows, { columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 180 } } });

    if (data.conceptos.length) {
      const body = data.conceptos.map((c) => [
        c.ClaveProdServ || "-",
        c.Cantidad || "-",
        c.Unidad || c.ClaveUnidad || "-",
        c.Descripcion || "-",
        formatMoney(c.ValorUnitario),
        formatMoney(c.Importe),
        formatMoney(c.Descuento),
      ]);
      autoTable(
        ["Clave", "Cant", "Unidad", "Descripcion", "Valor Unit", "Importe", "Desc"],
        body,
        { columnStyles: { 3: { cellWidth: 180 } } }
      );
    }

    const traslados = data.traslados.length ? data.traslados : data.conceptoTraslados;
    const retenciones = data.retenciones.length ? data.retenciones : data.conceptoRetenciones;

    if (traslados.length || retenciones.length) {
      const taxRows = [];
      traslados.forEach((t) => {
        taxRows.push([
          "Traslado",
          t.Impuesto || "-",
          t.TipoFactor || "-",
          t.TasaOCuota || "-",
          formatMoney(t.Base),
          formatMoney(t.Importe),
        ]);
      });
      retenciones.forEach((r) => {
        taxRows.push([
          "Retencion",
          r.Impuesto || "-",
          r.TipoFactor || "-",
          r.TasaOCuota || "-",
          formatMoney(r.Base),
          formatMoney(r.Importe),
        ]);
      });
      autoTable(["Tipo", "Impuesto", "Factor", "Tasa", "Base", "Importe"], taxRows, {
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 60 }, 2: { cellWidth: 60 }, 3: { cellWidth: 60 } },
      });
    }

    if (data.root.Total) {
      addLine("Importe con letra", 9, true);
      addLine(amountToWords(data.root.Total), 9);
    }

    addLine("Este documento es una representacion impresa de un CFDI", 8);
    if (data.root.MetodoPago) {
      const metodo = data.root.FormaPago ? `${data.root.MetodoPago} - ${data.root.FormaPago}` : data.root.MetodoPago;
      addLine(metodo, 8);
    }

    addSpace(6);

    const tim = data.timbre || {};
    if (Object.keys(tim).length) {
      addLine("Datos de timbrado", 9, true);
      const timRows = [];
      if (data.root.NoCertificado) timRows.push(["Serie del Certificado del emisor", data.root.NoCertificado]);
      if (tim.UUID) timRows.push(["Folio Fiscal UUID", tim.UUID]);
      if (tim.NoCertificadoSAT) timRows.push(["No. serie Certificado SAT", tim.NoCertificadoSAT]);
      if (tim.FechaTimbrado) timRows.push(["Fecha y hora de certificacion", tim.FechaTimbrado]);
      if (tim.RfcProvCertif) timRows.push(["RfcProvCertif", tim.RfcProvCertif]);
      if (timRows.length) {
        autoTable(["Campo", "Valor"], timRows, { columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 320 } } });
      }

      if (data.root.Sello) {
        addLine("Sello digital del CFDI", 7, true);
        addLine(data.root.Sello, 7);
      }

      if (tim.SelloSAT) {
        addLine("Sello del SAT", 7, true);
        addLine(tim.SelloSAT, 7);
      }

      if (tim.UUID && tim.FechaTimbrado && tim.RfcProvCertif && tim.NoCertificadoSAT && tim.SelloCFD) {
        const cadena = `||1.1|${tim.UUID}|${tim.FechaTimbrado}|${tim.RfcProvCertif}|${tim.SelloCFD}|${tim.NoCertificadoSAT}||`;
        addLine("Cadena original del complemento del certificacion digital del SAT", 7, true);
        addLine(cadena, 7);
      }
    }

    return doc.output("arraybuffer");
  };

  const buildPdf = (data) => (data.hasNomina ? buildNominaPdf(data) : buildCfdiPdf(data));

  const clearObjectUrls = () => {
    state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.objectUrls.clear();
  };

  const makeObjectUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    state.objectUrls.add(url);
    return url;
  };

  const downloadBundle = async (item) => {
    if (!item || !item.pdfArray) return;
    const zip = new JSZip();
    zip.file(`${item.outputBase}.pdf`, item.pdfArray);
    zip.file(`${item.outputBase}.xml`, item.xmlText);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = makeObjectUrl(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${item.outputBase}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const renderResults = (results) => {
    resultList.innerHTML = "";
    results.forEach((item) => {
      const card = document.createElement("div");
      card.className = "item";
      if (item.error) {
        card.innerHTML = `<div class="item-title">${item.filename}</div><div class="item-error">${item.error}</div>`;
      } else {
        const actions = document.createElement("div");
        actions.className = "item-actions";

        if (item.pdfUrl) {
          const pdfLink = document.createElement("a");
          pdfLink.href = item.pdfUrl;
          pdfLink.download = `${item.outputBase}.pdf`;
          pdfLink.textContent = t("downloadPdf");
          pdfLink.className = "primary";
          actions.appendChild(pdfLink);
        }

        if (item.xmlUrl) {
          const xmlLink = document.createElement("a");
          xmlLink.href = item.xmlUrl;
          xmlLink.download = `${item.outputBase}.xml`;
          xmlLink.textContent = t("downloadXml");
          actions.appendChild(xmlLink);
        }

        const bundleLink = document.createElement("a");
        bundleLink.href = "#";
        bundleLink.textContent = t("downloadZip");
        bundleLink.addEventListener("click", async (event) => {
          event.preventDefault();
          await downloadBundle(item);
        });
        actions.appendChild(bundleLink);

        const title = item.outputBase || item.filename || "unnamed";
        const meta = `${item.filename} - ${formatFecha(item.fechaParts)} - ${t("totalLabel")} ${formatMoney(item.data.root.Total)}`;
        card.innerHTML = `
          <div class="item-title">${title}</div>
          <div class="item-meta">${meta}</div>
        `;
        card.appendChild(actions);
      }
      resultList.appendChild(card);
    });
  };

  const updateSummary = (results) => {
    const errors = results.filter((r) => r.error).length;
    summaryCount.textContent = String(results.length);
    summaryErrors.textContent = String(errors);
  };

  const processFiles = async () => {
    if (!state.files.length) {
      setStatus(t("statusNoFiles"));
      return;
    }

    setStatus(t("statusParsing"));
    downloadBtn.disabled = true;
    clearObjectUrls();
    state.zipBlob = null;

    const parsed = await Promise.all(
      state.files.map(async (file) => {
        try {
          const text = await file.text();
          const data = parseXml(text, file.name);
          if (data.error) return { filename: file.name, error: data.error };
          const fechaParts = parseIsoLocal(data.fecha);
          if (!fechaParts) {
            return { filename: file.name, error: "Missing or invalid Fecha attribute" };
          }
          return { filename: file.name, xmlText: text, data, fechaParts };
        } catch (err) {
          return { filename: file.name, error: "Failed to read file" };
        }
      })
    );

    const valid = parsed.filter((r) => !r.error);
    const grouped = new Map();
    valid.forEach((item) => {
      const company = sanitizeName(item.data.emisor.Nombre || item.data.emisor.Rfc || "empresa");
      const key = `${company}-${item.fechaParts.year}-${pad2(item.fechaParts.month)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => {
        const aa = a.fechaParts;
        const bb = b.fechaParts;
        const aKey = `${aa.year}${pad2(aa.month)}${pad2(aa.day)}${pad2(aa.hour)}${pad2(aa.minute)}${pad2(aa.second)}`;
        const bKey = `${bb.year}${pad2(bb.month)}${pad2(bb.day)}${pad2(bb.hour)}${pad2(bb.minute)}${pad2(bb.second)}`;
        if (aKey !== bKey) return aKey.localeCompare(bKey);
        return a.filename.localeCompare(b.filename);
      });
    });

    for (const [key, items] of grouped.entries()) {
      const parts = key.split("-");
      const company = parts.slice(0, parts.length - 2).join("-");
      const month = parts[parts.length - 1];
      const year = parts[parts.length - 2];
      const yy = year.slice(-2);
      items.forEach((item, idx) => {
        item.outputBase = `${company}-${yy}-${month}-${pad2(idx + 1)}`;
      });
    }

    setStatus(t("statusGenerating"));
    for (const item of valid) {
      item.pdfArray = buildPdf(item.data);
      item.pdfUrl = makeObjectUrl(new Blob([item.pdfArray], { type: "application/pdf" }));
      item.xmlUrl = makeObjectUrl(new Blob([item.xmlText], { type: "application/xml" }));
    }

    state.results = parsed;
    renderResults(parsed);
    updateSummary(parsed);

    setStatus(t("statusZipping"));
    const zip = new JSZip();
    for (const item of valid) {
      zip.file(`${item.outputBase}.pdf`, item.pdfArray);
      if (includeXml.checked) {
        zip.file(`${item.outputBase}.xml`, item.xmlText);
      }
    }
    state.zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBtn.disabled = false;
    setStatus(t("statusReady", { count: valid.length }));
  };

  const downloadZip = () => {
    if (!state.zipBlob) return;
    const url = makeObjectUrl(state.zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cfdi-pdfs.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const readAllFilesFromEntries = async (entries) => {
    const queue = [...entries];
    const files = [];

    const readEntry = (entry) =>
      new Promise((resolve) => {
        if (entry.isFile) {
          entry.file((file) => {
            files.push(file);
            resolve();
          });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const readBatch = () =>
            new Promise((res) => {
              reader.readEntries(async (ents) => {
                if (!ents.length) {
                  res();
                  return;
                }
                queue.push(...ents);
                await readBatch();
                res();
              });
            });
          readBatch().then(resolve);
        } else {
          resolve();
        }
      });

    while (queue.length) {
      const entry = queue.shift();
      await readEntry(entry);
    }

    return files;
  };




  const readFilesFromHandles = async (handles) => {
    const files = [];

    const walk = async (handle) => {
      if (!handle) return;
      if (handle.kind === "file") {
        const file = await handle.getFile();
        files.push(file);
        return;
      }
      if (handle.kind === "directory") {
        for await (const entry of handle.values()) {
          await walk(entry);
        }
      }
    };

    for (const handle of handles) {
      await walk(handle);
    }

    return files;
  };

  const filterXmlFiles = (files) => files.filter((file) => file.name.toLowerCase().endsWith(".xml"));

  const setFiles = (files) => {
    state.files = filterXmlFiles(files);
    setStatus(t("statusSelected", { count: state.files.length }));
    if (state.files.length) {
      processFiles();
    }
  };

  fileInput.addEventListener("change", (event) => {
    setFiles(Array.from(event.target.files || []));
  });

  folderInput.addEventListener("change", (event) => {
    setFiles(Array.from(event.target.files || []));
  });

  chooseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener

  dropZone.addEventListener

  dropZone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    fileInput.click();
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
    const items = Array.from(event.dataTransfer.items || []);
    if (items.length) {
      const handleItems = items.filter((item) => typeof item.getAsFileSystemHandle === "function");
      if (handleItems.length) {
        const handles = await Promise.all(handleItems.map((item) => item.getAsFileSystemHandle()));
        const files = await readFilesFromHandles(handles);
        setFiles(files);
        return;
      }
      if (items[0].webkitGetAsEntry) {
        const entries = items
          .map((item) => item.webkitGetAsEntry())
          .filter(Boolean);
        const files = await readAllFilesFromEntries(entries);
        setFiles(files);
        return;
      }
    }

    const files = Array.from(event.dataTransfer.files || []);
    setFiles(files);
  });

  langButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.dataset.lang);
    });
  });

  downloadBtn.addEventListener("click", downloadZip);

  applyLanguage("es");
})();
