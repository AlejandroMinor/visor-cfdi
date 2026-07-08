# Visor CFDI

Herramienta web para visualizar facturas electrónicas (CFDI) en formato XML como una representación legible, similar a una factura impresa. También permite imprimir o guardar esa representación como PDF.

Se busca una forma sencilla de visualizar los XML sin comprometer información personal: todo el procesamiento ocurre en el navegador, los archivos nunca se suben a ningún servidor.

> Esta visualización es únicamente una **representación** del comprobante. El documento con validez fiscal es el **archivo XML timbrado**.

## Qué hace

- Visualiza **facturas y notas de crédito** (CFDI de Ingreso y Egreso) con sus conceptos, impuestos y totales.
- Soporta el **complemento de recepción de pagos** (1.0 y 2.0): muestra los pagos recibidos, las facturas que cada pago salda (parcialidad y saldos) y el desglose de impuestos del pago.
- Soporta el **complemento de nómina** (1.2): muestra los datos del trabajador, las percepciones, deducciones y otros pagos, y el neto a pagar.
- Los CFDI de **Traslado** se muestran solo a nivel base; aún no se lee su complemento (carta porte).
- Carga **varios archivos a la vez** (arrastrar y soltar o seleccionar) con una lista lateral, coloreada por tipo de comprobante.
- **Resumen** de lo cargado, agrupado por moneda y tipo.
- **Evita duplicados** por UUID al cargar el mismo comprobante dos veces.
- Permite **imprimir o guardar como PDF** la representación.

## Uso

Pruébalo ahora mismo, sin instalar nada:

**[alejandrominor.github.io/visor-cfdi](https://alejandrominor.github.io/visor-cfdi/)**

También puedes usarlo de forma local:

1. Descarga los archivos de este repositorio (o clónalo con `git clone`).
2. Abre `index.html` en tu navegador.

En cualquiera de los dos casos, arrastra uno o varios archivos `.xml` a la ventana, o haz clic en la zona de carga para seleccionarlos.
