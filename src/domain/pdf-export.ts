import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AccordDefinition,
  Formula,
  FormulaVersion,
  RawMaterial,
  SensoryEvaluation,
} from './types';

export interface GenerateFormulaPDFOptions {
  formula: Formula;
  version: FormulaVersion;
  materials: RawMaterial[];
  accords?: AccordDefinition[];
  evaluations?: SensoryEvaluation[];
}

/**
 * Generates and downloads a formatted, professional formulation dossier PDF.
 * Uses standard sans-serif typography (Helvetica) for clean, high-contrast, modern layout.
 */
export function generateFormulaPDF({
  formula,
  version,
  materials,
  accords = [],
  evaluations = [],
}: GenerateFormulaPDFOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  let currentY = margin;

  // --- 1. Top Header Banner ---
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 48, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129); // Emerald-400
  doc.text('OSMOLAB PERFUMERY ATELIER', margin + 14, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text('OFFICIAL FORMULATION & SENSORY DOSSIER', margin + 14, currentY + 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const statusBadge = `STATUS: ${formula.status.toUpperCase()} · VER ${version.versionLabel}`;
  doc.text(statusBadge, pageWidth - margin - 14, currentY + 28, { align: 'right' });

  currentY += 60;

  // --- 2. Title & Metadata Section ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(formula.name, margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`Project: ${formula.projectName} · Active Iteration: ${version.versionLabel}`, margin, currentY + 15);

  currentY += 28;

  // Metadata Grid Box
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 54, 4, 4, 'FD');

  const colW = (pageWidth - margin * 2 - 24) / 4;
  const metaY = currentY + 16;

  // Meta Col 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INTENDED PRODUCT', margin + 12, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formula.intendedProduct || 'Eau de Parfum', margin + 12, metaY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Conc: ${formula.finalProductConcentration || 20}%`, margin + 12, metaY + 24);

  // Meta Col 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('IFRA REGULATORY CLASS', margin + 12 + colW, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formula.ifraCategory || 'Category 4', margin + 12 + colW, metaY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129);
  doc.text('Safety Compliant', margin + 12 + colW, metaY + 24);

  // Meta Col 3
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MATURATION TARGET', margin + 12 + colW * 2, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${version.maturationDays || 14} Days Target`, margin + 12 + colW * 2, metaY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Created: ${version.createdAt || new Date().toISOString().slice(0, 10)}`, margin + 12 + colW * 2, metaY + 24);

  // Meta Col 4
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('OLFACTORY DIRECTION', margin + 12 + colW * 3, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const families = formula.targetFamilies?.length ? formula.targetFamilies.join(', ') : 'Chypre / Woody';
  doc.text(families.length > 20 ? families.slice(0, 18) + '...' : families, margin + 12 + colW * 3, metaY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Intensity: ${formula.targetIntensity || 7}/10`, margin + 12 + colW * 3, metaY + 24);

  currentY += 66;

  // --- 3. Description & Target Brief ---
  if (formula.description || formula.targetBrief) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('CREATIVE BRIEF & FORMULATION INTENT:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const briefText = formula.description || formula.targetBrief || '';
    const splitBrief = doc.splitTextToSize(briefText, pageWidth - margin * 2);
    doc.text(splitBrief, margin, currentY + 11);
    currentY += 13 + splitBrief.length * 9;
  }

  // --- 4. Materials Table ---
  const totalGrams = version.items.reduce((s, it) => s + (Number(it.quantityGrams) || 0), 0);
  const totalPercent = version.items.reduce((s, it) => s + (Number(it.percentage) || 0), 0);

  // Group line items
  let topWeight = 0;
  let heartWeight = 0;
  let baseWeight = 0;

  const tableBody = version.items.map((item, idx) => {
    const mat = item.materialId ? materials.find((m) => m.id === item.materialId) : null;
    const acc = item.accordId ? accords.find((a) => a.id === item.accordId) : null;
    const vol = mat?.volatility || (item.type === 'accord' ? 'Accord Base' : 'Heart');

    if (vol.includes('Top')) topWeight += item.quantityGrams;
    else if (vol.includes('Heart')) heartWeight += item.quantityGrams;
    else baseWeight += item.quantityGrams;

    const dilutionStr =
      item.dilutionPercent && item.dilutionPercent < 100
        ? `${item.dilutionPercent}% in ${item.solvent || 'DPG'}`
        : 'Neat (100%)';

    const supplierStr = item.supplier || mat?.supplier || (item.type === 'accord' ? 'In-House' : '-');

    return [
      String(idx + 1),
      item.name + (item.type === 'accord' ? ' (Accord Base)' : ''),
      vol,
      dilutionStr,
      item.quantityGrams.toFixed(3) + 'g',
      item.percentage.toFixed(3) + '%',
      supplierStr,
      item.notes || mat?.descriptiveNotes?.slice(0, 45) || '-',
    ];
  });

  // Table summary row
  const summaryRow = [
    '',
    'FORMULA TOTAL (BATCH SUM)',
    '',
    '',
    `${totalGrams.toFixed(3)}g`,
    `${totalPercent.toFixed(3)}%`,
    '',
    '',
  ];

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '#',
        'Material / Component',
        'Volatility Tier',
        'Dilution',
        'Quantity',
        'Share (%)',
        'Supplier',
        'Notes & Olfactory Function',
      ],
    ],
    body: [...tableBody, summaryRow],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.5,
      lineColor: [203, 213, 225],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 120, fontStyle: 'bold' },
      2: { cellWidth: 64 },
      3: { cellWidth: 64 },
      4: { cellWidth: 50, halign: 'right' },
      5: { cellWidth: 48, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 76 },
      7: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Highlight summary row
      if (data.row.index === tableBody.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    margin: { left: margin, right: margin },
  });

  // Position after table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  currentY = finalY;

  // --- Check Page Break ---
  if (currentY > pageHeight - 160) {
    doc.addPage();
    currentY = margin;
  }

  // --- 5. Volatility Distribution & Architectural Balance ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 42, 4, 4, 'FD');

  const topPct = totalGrams > 0 ? (topWeight / totalGrams) * 100 : 0;
  const heartPct = totalGrams > 0 ? (heartWeight / totalGrams) * 100 : 0;
  const basePct = totalGrams > 0 ? (baseWeight / totalGrams) * 100 : 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ARCHITECTURAL VOLATILITY BALANCE (OLFACTORY PYRAMID DISTRIBUTION)', margin + 12, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Top Notes: ${topPct.toFixed(1)}% (${topWeight.toFixed(2)}g)   ·   Heart Notes: ${heartPct.toFixed(1)}% (${heartWeight.toFixed(2)}g)   ·   Base Notes: ${basePct.toFixed(1)}% (${baseWeight.toFixed(2)}g)`,
    margin + 12,
    currentY + 28
  );

  currentY += 52;

  // --- Check Page Break for Sensory Notes ---
  if (currentY > pageHeight - 180) {
    doc.addPage();
    currentY = margin;
  }

  // --- 6. Version Notes & Attached Sensory Evaluations ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('ATTACHED SENSORY NOTES & EVALUATION DOSSIER', margin, currentY);
  currentY += 12;

  // Version Developer Notes
  if (version.versionNotes) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 34, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`VERSION ${version.versionLabel} LOG NOTES:`, margin + 10, currentY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const splitNotes = doc.splitTextToSize(version.versionNotes, pageWidth - margin * 2 - 20);
    doc.text(splitNotes, margin + 10, currentY + 23);

    currentY += 42;
  }

  // Matching sensory evaluations for this formula / version
  const matchingEvals = evaluations.filter(
    (ev) =>
      ev.formulaId === formula.id &&
      (!ev.formulaVersionLabel || ev.formulaVersionLabel === version.versionLabel)
  );

  if (matchingEvals.length > 0) {
    matchingEvals.slice(0, 2).forEach((ev) => {
      if (currentY > pageHeight - 110) {
        doc.addPage();
        currentY = margin;
      }

      doc.setFillColor(254, 252, 243); // Warm subtle
      doc.setDrawColor(245, 158, 11); // Amber border
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 60, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(
        `BLOTTER EVALUATION RECORD (${ev.createdAt || 'Recent'} · Checkpoint: ${ev.checkpoint || 'Evaluation'})`,
        margin + 10,
        currentY + 14
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const metricsText = `Overall Score: ${ev.overallScore || 8}/10  ·  Diffusion: ${ev.scores?.diffusion ?? 7}/10  ·  Longevity: ${ev.scores?.longevity ?? 8}/10  ·  Heart: ${ev.scores?.heart ?? 7}/10`;
      doc.text(metricsText, margin + 10, currentY + 26);

      const drydownText = `Sensory Notes: [Opening: ${ev.openingNotes || 'Bright'}]  →  [Heart: ${ev.heartNotes || 'Harmonized'}]  →  [Drydown: ${ev.drydownNotes || 'Substantive'}]`;
      const splitDry = doc.splitTextToSize(drydownText, pageWidth - margin * 2 - 20);
      doc.text(splitDry, margin + 10, currentY + 38);

      if (ev.voiceTranscript) {
        const sensorySnippet = `Transcript: ${ev.voiceTranscript}`;
        const splitSensory = doc.splitTextToSize(sensorySnippet, pageWidth - margin * 2 - 20);
        doc.text(splitSensory, margin + 10, currentY + 49);
      }

      currentY += 68;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'No formal blotter evaluation recorded yet for this version. Test on scent strip and record in Step 6 (Evaluate).',
      margin,
      currentY + 6
    );
    currentY += 18;
  }

  // --- 7. Document Footer on All Pages ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `OsmoLab Perfumery Atelier · Formula: ${formula.name} (${version.versionLabel}) · Confidential Laboratory Document`,
      margin,
      pageHeight - 12
    );

    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 12, {
      align: 'right',
    });
  }

  // --- 8. Trigger Clean Download ---
  const safeName = formula.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const fileName = `${safeName}_${version.versionLabel}_Dossier.pdf`;
  doc.save(fileName);
}
