/* Visor CFDI — app en JavaScript normal, sin dependencias. Procesa los XML
   localmente en el navegador; nada se sube a ningún servidor. */
(() => {
  "use strict";

  // ---- Catálogos del SAT (Anexo 20) ----
  const CAT = {
    regimen: { "601":"General de Ley Personas Morales","603":"Personas Morales con Fines no Lucrativos","605":"Sueldos y Salarios","606":"Arrendamiento","607":"Enajenación o Adquisición de Bienes","608":"Demás ingresos","610":"Residentes en el Extranjero","611":"Ingresos por Dividendos","612":"Personas Físicas con Actividades Empresariales y Profesionales","614":"Ingresos por intereses","615":"Ingresos por obtención de premios","616":"Sin obligaciones fiscales","620":"Sociedades Cooperativas de Producción","621":"Incorporación Fiscal","622":"Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras","623":"Opcional para Grupos de Sociedades","624":"Coordinados","625":"Actividades Empresariales con ingresos a través de Plataformas Tecnológicas","626":"Régimen Simplificado de Confianza" },
    uso: { "G01":"Adquisición de mercancías","G02":"Devoluciones, descuentos o bonificaciones","G03":"Gastos en general","I01":"Construcciones","I02":"Mobiliario y equipo de oficina","I03":"Equipo de transporte","I04":"Equipo de cómputo y accesorios","I05":"Dados, troqueles, moldes, matrices y herramental","I06":"Comunicaciones telefónicas","I07":"Comunicaciones satelitales","I08":"Otra maquinaria y equipo","D01":"Honorarios médicos, dentales y gastos hospitalarios","D02":"Gastos médicos por incapacidad o discapacidad","D03":"Gastos funerales","D04":"Donativos","D05":"Intereses reales por créditos hipotecarios","D06":"Aportaciones voluntarias al SAR","D07":"Primas por seguros de gastos médicos","D08":"Gastos de transportación escolar obligatoria","D09":"Depósitos en cuentas para el ahorro","D10":"Pagos por servicios educativos","S01":"Sin efectos fiscales","CP01":"Pagos","CN01":"Nómina" },
    forma: { "01":"Efectivo","02":"Cheque nominativo","03":"Transferencia electrónica de fondos","04":"Tarjeta de crédito","05":"Monedero electrónico","06":"Dinero electrónico","08":"Vales de despensa","12":"Dación en pago","13":"Pago por subrogación","14":"Pago por consignación","15":"Condonación","17":"Compensación","23":"Novación","24":"Confusión","25":"Remisión de deuda","26":"Prescripción o caducidad","27":"A satisfacción del acreedor","28":"Tarjeta de débito","29":"Tarjeta de servicios","30":"Aplicación de anticipos","31":"Intermediario pagos","99":"Por definir" },
    metodo: { "PUE":"Pago en una sola exhibición","PPD":"Pago en parcialidades o diferido" },
    tipo: { "I":"Ingreso","E":"Egreso","T":"Traslado","N":"Nómina","P":"Pago" },
    imp: { "001":"ISR","002":"IVA","003":"IEPS" },
    exporta: { "01":"No aplica","02":"Definitiva","03":"Temporal","04":"Definitiva A1" }
  };

  // ---- Estado ----
  const state = { files: [], sel: -1 };

  const SIN_UUID = "Sin timbre — UUID no encontrado";

  // ---- Utilidades ----
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  function notify(msg) {
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      document.body.appendChild(box);
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg; 
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener("transitionend", () => t.remove(), { once: true });
      setTimeout(() => t.remove(), 400);
    }, 4000);
  }

  function cat(code, map) {
    if (!code) return null;
    const label = CAT[map][code];
    return label ? code + " · " + label : code;
  }

  function money(n, moneda) {
    const v = parseFloat(n);
    if (isNaN(v)) return "—";
    try {
      return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(v);
    } catch (e) {
      return "$" + v.toFixed(2) + " " + (moneda || "");
    }
  }

  function fecha(s) {
    if (!s) return "—";
    const dt = new Date(s);
    if (isNaN(dt)) return s;
    return dt.toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function tasa(s) {
    const p = parseFloat(s) * 100;
    if (isNaN(p)) return "";
    return (Math.round(p * 100) / 100) + "%";
  }

  // ---- Parseo del CFDI ----
  function parse(text, name) {
    let doc;
    try {
      doc = new DOMParser().parseFromString(text, "application/xml");
    } catch (e) {
      return { name, error: "No se pudo leer el archivo" };
    }
    if (doc.getElementsByTagName("parsererror").length) return { name, error: "XML inválido o mal formado" };
    const all = [...doc.getElementsByTagName("*")];
    const comp = all.find(n => n.localName === "Comprobante");
    if (!comp) return { name, error: "No es un CFDI (falta cfdi:Comprobante)" };
    const a = el => (attr, fb) => (el && el.getAttribute(attr)) || fb || null;
    const c = a(comp);
    const version = c("Version") || c("version") || "?";
    const moneda = c("Moneda") || "MXN";
    const emisor = all.find(n => n.localName === "Emisor" && n.parentNode === comp);
    const receptor = all.find(n => n.localName === "Receptor" && n.parentNode === comp);
    const tfd = all.find(n => n.localName === "TimbreFiscalDigital");
    const ae = a(emisor), ar = a(receptor), at = a(tfd);

    const conceptos = all.filter(n => n.localName === "Concepto").map(n => {
      const ac = a(n);
      return {
        cantidad: ac("Cantidad"),
        unidad: ac("Unidad") || ac("ClaveUnidad") || "",
        descripcion: ac("Descripcion") || "",
        clave: ac("ClaveProdServ") || "—",
        vu: money(ac("ValorUnitario"), moneda),
        importe: money(ac("Importe"), moneda)
      };
    });

    const impGlobal = [...comp.children].find(n => n.localName === "Impuestos");
    const totales = [];
    const sub = parseFloat(c("SubTotal"));
    if (!isNaN(sub)) totales.push({ label: "Subtotal", value: money(sub, moneda), neg: false });
    const desc = parseFloat(c("Descuento"));
    if (!isNaN(desc) && desc > 0) totales.push({ label: "Descuento", value: "− " + money(desc, moneda), neg: true });
    if (impGlobal) {
      [...impGlobal.getElementsByTagName("*")].forEach(n => {
        const an = a(n);
        if (n.localName === "Traslado") {
          const nombre = CAT.imp[an("Impuesto")] || an("Impuesto") || "Impuesto";
          const t = an("TasaOCuota") ? " " + tasa(an("TasaOCuota")) : "";
          totales.push({ label: nombre + t + " (traslado)", value: money(an("Importe"), moneda), neg: false });
        } else if (n.localName === "Retencion") {
          const nombre = CAT.imp[an("Impuesto")] || an("Impuesto") || "Impuesto";
          totales.push({ label: "Retención " + nombre, value: "− " + money(an("Importe"), moneda), neg: true });
        }
      });
    }

    const datos = [];
    const push = (label, value) => { if (value) datos.push({ label, value }); };
    push("Forma de pago", cat(c("FormaPago"), "forma"));
    push("Método de pago", cat(c("MetodoPago"), "metodo"));
    if (moneda !== "XXX") push("Moneda", moneda + (c("TipoCambio") ? " · T.C. " + c("TipoCambio") : ""));
    push("Lugar de expedición", "C.P. " + (c("LugarExpedicion") || "—"));
    push("Exportación", cat(c("Exportacion"), "exporta"));
    push("Condiciones de pago", c("CondicionesDePago"));

    const timbre = [];
    const pushT = (label, value) => { if (value) timbre.push({ label, value }); };
    pushT("Fecha de timbrado", fecha(at("FechaTimbrado")));
    pushT("RFC proveedor de certificación", at("RfcProvCertif"));
    pushT("No. certificado SAT", at("NoCertificadoSAT"));
    pushT("No. certificado emisor (CSD)", c("NoCertificado"));

    // Complemento de Recepción de Pagos (1.0 o 2.0). Se identifica por localName,
    let pagos = null;
    const pagosNode = all.find(n => n.localName === "Pagos");
    if (pagosNode) {
      const totalesNode = [...pagosNode.children].find(n => n.localName === "Totales");
      const montoTotal = totalesNode ? a(totalesNode)("MontoTotalPagos") : null;
      const lista = [...pagosNode.children].filter(n => n.localName === "Pago").map(p => {
        const ap = a(p);
        const monedaP = ap("MonedaP") || moneda;
        const doctos = [...p.getElementsByTagName("*")].filter(n => n.localName === "DoctoRelacionado").map(dr => {
          const ad = a(dr);
          const monedaDR = ad("MonedaDR") || monedaP;
          return {
            uuid: ad("IdDocumento") || "—",
            serieFolio: [ad("Serie"), ad("Folio")].filter(Boolean).join("-") || null,
            parcialidad: ad("NumParcialidad"),
            saldoAnt: ad("ImpSaldoAnt") != null ? money(ad("ImpSaldoAnt"), monedaDR) : null,
            pagado: ad("ImpPagado") != null ? money(ad("ImpPagado"), monedaDR) : null,
            saldoInsoluto: ad("ImpSaldoInsoluto") != null ? money(ad("ImpSaldoInsoluto"), monedaDR) : null
          };
        });
        // Impuestos causados con este pago (ImpuestosP). En pagos en parcialidades
        // corresponden solo a la porción cubierta, no al total de la factura.
        const impuestos = [];
        const impuestosP = [...p.children].find(n => n.localName === "ImpuestosP");
        if (impuestosP) {
          [...impuestosP.getElementsByTagName("*")].forEach(n => {
            const an = a(n);
            if (n.localName === "TrasladoP") {
              const nombre = CAT.imp[an("ImpuestoP")] || an("ImpuestoP") || "Impuesto";
              const t = an("TasaOCuotaP") ? " " + tasa(an("TasaOCuotaP")) : "";
              impuestos.push({ label: nombre + t + " (traslado)", value: money(an("ImporteP"), monedaP), neg: false });
            } else if (n.localName === "RetencionP") {
              const nombre = CAT.imp[an("ImpuestoP")] || an("ImpuestoP") || "Impuesto";
              impuestos.push({ label: "Retención " + nombre, value: "− " + money(an("ImporteP"), monedaP), neg: true });
            }
          });
        }
        return {
          fecha: fecha(ap("FechaPago")),
          forma: cat(ap("FormaDePagoP"), "forma") || "—",
          montoFmt: money(ap("Monto"), monedaP),
          numOperacion: ap("NumOperacion"),
          doctos, impuestos
        };
      });
      const primerPago = [...pagosNode.children].find(n => n.localName === "Pago");
      const monedaPago = (primerPago && a(primerPago)("MonedaP")) || moneda;
      pagos = {
        // MontoTotalPagos siempre se expresa en MXN (regla del complemento 2.0).
        montoTotalFmt: montoTotal != null ? money(montoTotal, "MXN") : null,
        moneda: monedaPago,  // moneda real del pago, para agrupar en el resumen
        lista
      };
    }

    const tipo = c("TipoDeComprobante") || "?";
    const tipoColor = { I:"#047857", E:"#B4483C", P:"#2563EB", N:"#7C3AED", T:"#B45309" }[tipo] || "#14284A";

    return {
      name,
      model: {
        version,
        uuid: at("UUID") || SIN_UUID,
        tipoLabel: CAT.tipo[tipo] || tipo,
        tipoCorto: CAT.tipo[tipo] || tipo,
        tipoColor,
        serieFolio: (c("Serie") || c("Folio")) ? [c("Serie") ? "Serie " + c("Serie") : null, c("Folio") ? "Folio " + c("Folio") : null].filter(Boolean).join(" · ") : null,
        fechaFmt: fecha(c("Fecha")),
        emisorNombre: ae("Nombre", "—"),
        emisorRfc: ae("Rfc", "—"),
        emisorRegimen: cat(ae("RegimenFiscal"), "regimen") || "—",
        receptorNombre: ar("Nombre", "—"),
        receptorRfc: ar("Rfc", "—"),
        receptorRegimen: cat(ar("RegimenFiscalReceptor"), "regimen") || "—",
        receptorCP: ar("DomicilioFiscalReceptor", "—"),
        usoCfdi: cat(ar("UsoCFDI"), "uso") || "—",
        datos, conceptos, totales, timbre, pagos,
        tipo,
        moneda,
        total: parseFloat(c("Total")),
        totalFmt: money(c("Total"), moneda),
        selloCFD: c("Sello") || "—",
        selloSAT: at("SelloSAT") || "—"
      }
    };
  }

  // ---- Alta y baja de archivos ----
  async function addFiles(fileList) {
    const all = [...fileList];
    const xmls = all.filter(f => /\.xml$/i.test(f.name) || f.type.includes("xml"));
    if (xmls.length < all.length) {
      const n = all.length - xmls.length;
      notify("Solo se permiten archivos .xml — se ignoró " + n + (n === 1 ? " archivo." : " archivos."));
    }
    if (!xmls.length) return;


    const uuidKey = p => (p.model && p.model.uuid !== SIN_UUID) ? p.model.uuid.trim().toUpperCase() : null;
    const seen = new Set(state.files.map(uuidKey).filter(Boolean));

    const parsed = [];
    let dup = 0;
    for (const f of xmls) {
      const p = parse(await f.text(), f.name);
      const key = uuidKey(p);
      if (key && seen.has(key)) { dup++; continue; }
      if (key) seen.add(key);
      parsed.push(p);
    }
    if (dup) notify("Se omitió " + dup + (dup === 1
      ? " archivo duplicado (mismo UUID ya cargado)."
      : " archivos duplicados (mismo UUID ya cargado)."));
    if (!parsed.length) return;

    const firstOk = parsed.findIndex(p => !p.error);
    if (state.sel === -1 && firstOk !== -1) state.sel = state.files.length + firstOk;
    state.files = state.files.concat(parsed);
    render();
  }

  function removeFile(i) {
    state.files = state.files.filter((_, j) => j !== i);
    if (i === state.sel) state.sel = state.files.length ? Math.min(i, state.files.length - 1) : -1;
    else if (i < state.sel) state.sel -= 1;
    render();
  }

  // ---- Render de la lista de archivos ----
  function renderFiles() {
    const panel = document.getElementById("files-panel");
    if (!state.files.length) { panel.innerHTML = ""; return; }
    const rows = state.files.map((f, i) => {
      // En los Pagos el Total es 0 (moneda XXX); se muestra el monto pagado.
      const importe = f.error ? null : (f.model.pagos ? f.model.pagos.montoTotalFmt : f.model.totalFmt);
      const sub = f.error ? f.error : (importe ? importe + " · " : "") + f.model.tipoCorto;
      const cls = "file-item" + (i === state.sel ? " is-selected" : "") + (f.error ? " is-error" : "");
      return `
        <div class="${cls}" data-index="${i}">
          <div class="file-row">
            <span class="file-name">${esc(f.name)}</span>
            <span class="file-remove" data-remove="${i}" title="Quitar">×</span>
          </div>
          <div class="file-sub">${esc(sub)}</div>
        </div>`;
    }).join("");
    panel.innerHTML = `
      <div class="files-head">
        <span class="files-head-label">Archivos · ${state.files.length}</span>
        <span class="clear-all" data-clear>Quitar todos</span>
      </div>
      <div class="files-list">${rows}</div>`;
  }

  // ---- Resumen de los comprobantes cargados ----
  // Agrupa por moneda y tipo; los Pagos solo se cuentan (su Total es 0).
  const TIPO_ORDEN = ["I", "E", "P", "N", "T"];
  const TIPO_PLURAL = { I:"Ingresos", E:"Egresos", P:"Pagos", N:"Nómina", T:"Traslados" };

  function renderSummary() {
    const panel = document.getElementById("summary-panel");
    const ok = state.files.filter(f => !f.error);
    if (!ok.length) { panel.innerHTML = ""; return; }

    const porMoneda = {};
    for (const f of ok) {
      const m = f.model;
      // Los Pagos traen Moneda "XXX" (placeholder); se agrupan por la moneda real del pago.
      const cur = (m.moneda === "XXX" && m.pagos) ? m.pagos.moneda : (m.moneda || "MXN");
      const g = porMoneda[cur] || (porMoneda[cur] = { count: 0, tipos: {} });
      g.count++;
      const t = g.tipos[m.tipo] || (g.tipos[m.tipo] = { sum: 0, count: 0 });
      t.count++;
      if (!isNaN(m.total)) t.sum += m.total;
    }

    const monedas = Object.keys(porMoneda).sort();
    const bloques = monedas.map(cur => {
      const g = porMoneda[cur];
      const tipos = Object.keys(g.tipos).sort((a, b) => {
        const ia = TIPO_ORDEN.indexOf(a), ib = TIPO_ORDEN.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      const filas = tipos.map(tp => {
        const t = g.tipos[tp];
        const label = TIPO_PLURAL[tp] || (CAT.tipo[tp] || tp);
        let monto;
        if (tp === "P") monto = `<span class="sum-amount is-muted">—</span>`;
        else if (tp === "E") monto = `<span class="sum-amount is-neg">−${esc(money(t.sum, cur))}</span>`;
        else monto = `<span class="sum-amount">${esc(money(t.sum, cur))}</span>`;
        return `
          <div class="sum-row">
            <span class="sum-tipo">${esc(label)}</span>
            <span class="sum-count">(${t.count})</span>
            ${monto}
          </div>`;
      }).join("");
      const multiMoneda = monedas.length > 1;
      return `
        <div class="sum-cur">
          ${multiMoneda ? `<div class="sum-cur-label">${esc(cur)}</div>` : ""}
          ${filas}
        </div>`;
    }).join("");

    const n = ok.length;
    panel.innerHTML = `
      <div class="summary-head">
        <span class="files-head-label">Resumen</span>
        <span class="summary-count">${n} comprobante${n === 1 ? "" : "s"}</span>
      </div>
      ${bloques}`;
  }

  // ---- Render del comprobante seleccionado ----
  function renderMain() {
    const main = document.getElementById("main");
    const cur = state.sel >= 0 ? state.files[state.sel] : null;
    const d = cur && cur.model;

    if (!d) {
      main.innerHTML = `
        <div class="empty">
          <div class="empty-inner">
            <div class="empty-icon">.xml</div>
            <div class="empty-title">Sin CFDI seleccionado</div>
            <div class="empty-text">Arrastra uno o varios archivos XML a cualquier parte de esta ventana para visualizarlos como una representación de factura.</div>
          </div>
        </div>`;
      return;
    }

    const datos = d.datos.map(x => `
      <div class="field"><span class="field-label">${esc(x.label)}</span><span class="field-value">${esc(x.value)}</span></div>`).join("");

    const conceptos = d.conceptos.map(c => `
      <div class="tbl-row">
        <div class="td">${esc(c.cantidad)}</div>
        <div class="td">${esc(c.unidad)}</div>
        <div class="td-desc">${esc(c.descripcion)}<div class="clave">ClaveProdServ ${esc(c.clave)}</div></div>
        <div class="td-num">${esc(c.vu)}</div>
        <div class="td-num">${esc(c.importe)}</div>
      </div>`).join("");

    const totales = d.totales.map(t => `
      <div class="total-row"><span>${esc(t.label)}</span><span class="mono${t.neg ? " is-neg" : ""}">${esc(t.value)}</span></div>`).join("");

    const timbre = d.timbre.map(t => `
      <div class="field"><span class="field-label">${esc(t.label)}</span><span class="field-value-mono">${esc(t.value)}</span></div>`).join("");

    const drField = (label, value, mono) => value
      ? `<div class="field"><span class="field-label">${esc(label)}</span><span class="${mono ? "field-value-mono" : "field-value"}">${esc(value)}</span></div>`
      : "";
    const pagosHtml = d.pagos ? `
      <div class="pagos">
        <div class="sec-label">Pagos recibidos</div>
        ${d.pagos.montoTotalFmt ? `<div class="pagos-total"><span>Total pagado</span><span class="mono">${esc(d.pagos.montoTotalFmt)}</span></div>` : ""}
        ${d.pagos.lista.map(p => `
          <div class="pago-card">
            <div class="pago-head">
              <div class="pago-monto">${esc(p.montoFmt)}</div>
              <div class="pago-meta">
                <span class="muted-sm">${esc(p.fecha)}</span>
                <span class="muted-sm">${esc(p.forma)}</span>
                ${p.numOperacion ? `<span class="muted-sm">Op. ${esc(p.numOperacion)}</span>` : ""}
              </div>
            </div>
            ${p.doctos.length ? `<div class="dr-list">${p.doctos.map(dr => `
              <div class="dr">
                ${drField("Documento relacionado", dr.uuid, true)}
                <div class="dr-grid">
                  ${drField("Serie-Folio", dr.serieFolio, true)}
                  ${drField("Parcialidad", dr.parcialidad, false)}
                  ${drField("Saldo anterior", dr.saldoAnt, true)}
                  ${drField("Pagado", dr.pagado, true)}
                  ${drField("Saldo insoluto", dr.saldoInsoluto, true)}
                </div>
              </div>`).join("")}</div>` : ""}
            ${p.impuestos.length ? `<div class="pago-impuestos">
              <span class="field-label">Impuestos del pago</span>
              ${p.impuestos.map(t => `<div class="total-row"><span>${esc(t.label)}</span><span class="mono${t.neg ? " is-neg" : ""}">${esc(t.value)}</span></div>`).join("")}
            </div>` : ""}
          </div>`).join("")}
      </div>` : "";

    main.innerHTML = `
      <div class="doc">
        <div id="actionbar">
          <span class="actionbar-name">${esc(cur.name)}</span>
          <button class="btn-print" data-print>Imprimir / Guardar PDF</button>
        </div>
        <div class="sheet-wrap">
          <div id="banner">
            <span class="banner-icon">ⓘ</span>
            <span>Esta visualización es únicamente una <strong>representación</strong> del comprobante. El documento con validez fiscal es el <strong>archivo XML timbrado</strong>.</span>
          </div>
          <div id="sheet" style="--tipo:${esc(d.tipoColor)}">
            <div class="party-row">
              <div class="party">
                <div class="sec-label">Emisor</div>
                <div class="emisor-name">${esc(d.emisorNombre)}</div>
                <div class="rfc">${esc(d.emisorRfc)}</div>
                <div class="muted-sm">${esc(d.emisorRegimen)}</div>
              </div>
              <div class="party-right">
                <span class="type-badge">${esc(d.tipoLabel)}</span>
                ${d.serieFolio ? `<div class="serie-folio">${esc(d.serieFolio)}</div>` : ""}
                <div class="muted-sm">${esc(d.fechaFmt)}</div>
                <div class="version">Versión ${esc(d.version)}</div>
              </div>
            </div>

            <div class="uuid-box">
              <span class="uuid-label">Folio fiscal (UUID)</span>
              <span class="uuid-value">${esc(d.uuid)}</span>
            </div>

            <div class="grid-2">
              <div class="col">
                <div class="sec-label">Receptor</div>
                <div class="receptor-name">${esc(d.receptorNombre)}</div>
                <div class="rfc">${esc(d.receptorRfc)}</div>
                <div class="muted-sm">${esc(d.receptorRegimen)}</div>
                <div class="muted-sm">C.P. ${esc(d.receptorCP)}</div>
              </div>
              <div class="col">
                <div class="sec-label">Uso del CFDI</div>
                <div class="uso-value">${esc(d.usoCfdi)}</div>
              </div>
            </div>

            <div class="datos-grid">${datos}</div>

            ${d.pagos ? pagosHtml : `
            <div class="conceptos">
              <div class="sec-label">Conceptos</div>
              <div class="tbl">
                <div class="tbl-head">
                  <div class="th">Cant.</div>
                  <div class="th">Unidad</div>
                  <div class="th">Descripción</div>
                  <div class="th-right">V. unitario</div>
                  <div class="th-right">Importe</div>
                </div>
                ${conceptos}
              </div>
            </div>

            <div class="totales-wrap">
              <div class="totales">
                ${totales}
                <div class="total-grand"><span>Total</span><span class="mono">${esc(d.totalFmt)}</span></div>
              </div>
            </div>`}

            <div class="timbre">
              <div class="sec-label">Timbre Fiscal Digital</div>
              <div class="timbre-grid">${timbre}</div>
            </div>

            <div class="legal">Este documento es una representación impresa de un CFDI (Comprobante Fiscal Digital por Internet). El archivo XML es el único comprobante con validez fiscal.</div>
          </div>
        </div>
      </div>`;
  }

  function render() {
    renderSummary();
    renderFiles();
    renderMain();
  }

  // ---- Eventos ----
  function init() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");
    const panel = document.getElementById("files-panel");
    const main = document.getElementById("main");

    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });

    // Lista de archivos (delegación de eventos).
    panel.addEventListener("click", e => {
      const rm = e.target.closest("[data-remove]");
      if (rm) { e.stopPropagation(); removeFile(+rm.dataset.remove); return; }
      if (e.target.closest("[data-clear]")) { state.files = []; state.sel = -1; render(); return; }
      const item = e.target.closest(".file-item");
      if (item && !item.classList.contains("is-error")) { state.sel = +item.dataset.index; render(); }
    });

    // Botón de imprimir.
    main.addEventListener("click", e => { if (e.target.closest("[data-print]")) window.print(); });

    // Arrastrar y soltar sobre toda la ventana.
    window.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    window.addEventListener("dragleave", e => { if (!e.relatedTarget) dropzone.classList.remove("drag-over"); });
    window.addEventListener("drop", e => { e.preventDefault(); dropzone.classList.remove("drag-over"); addFiles(e.dataTransfer.files); });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
