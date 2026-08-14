import ExcelJS from 'exceljs';
import { COLUMNAS } from './reglas';
import type { Caso } from './casos';

export async function construirLibro(rows: Caso[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Regularizaciones', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNAS.map((h) => ({ header: h, key: h, width: Math.min(48, Math.max(12, h.length + 3)) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF41617F' } };
  for (const r of rows) {
    ws.addRow([r.rutFmt || r.rut, r.nombre, r.unidad, r.fecha, r.tipo, r.entradaReal || '', r.salidaReal || '', r.motivo, r.obs || '']);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: COLUMNAS.length } };
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
