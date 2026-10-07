// Minimal RFC 4180 CSV reader/writer (quotes, embedded newlines, , ; or tab delimiters).

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const c of firstLine) {
    if (c === '"') q = !q;
    else if (!q && c in counts) counts[c]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ',';
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  let any = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
      continue;
    }
    if (c === '"') { q = true; any = true; }
    else if (c === delimiter) { row.push(field); field = ''; any = true; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (any || field) rows.push(row);
      row = []; field = ''; any = false;
    } else { field += c; any = true; }
  }
  if (any || field) { row.push(field); rows.push(row); }
  return rows;
}

export function csvField(v, delimiter = ',') {
  const s = v == null ? '' : String(v);
  return s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function csvLine(values, delimiter = ',') {
  return values.map((v) => csvField(v, delimiter)).join(delimiter);
}
