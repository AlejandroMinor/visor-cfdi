# Visor CFDI

Herramienta web para visualizar facturas electrónicas (CFDI) en formato XML como una representación legible, similar a una factura impresa. También permite imprimir o guardar esa representación como PDF.

Se busca una forma sencilla de visualizar los XML sin comprometer información personal: todo el procesamiento ocurre en el navegador, los archivos nunca se suben a ningún servidor.

> Esta visualización es únicamente una **representación** del comprobante. El documento con validez fiscal es el **archivo XML timbrado**.

Por el momento solo soporta comprobantes de tipo **Ingreso (I)**.

## Uso

Pruébalo ahora mismo, sin instalar nada:

**[alejandrominor.github.io/visor-cfdi](https://alejandrominor.github.io/visor-cfdi/)**

También puedes usarlo de forma local:

1. Descarga los archivos de este repositorio (o clónalo con `git clone`).
2. Abre `index.html` en tu navegador.

En cualquiera de los dos casos, arrastra uno o varios archivos `.xml` a la ventana, o haz clic en la zona de carga para seleccionarlos.
