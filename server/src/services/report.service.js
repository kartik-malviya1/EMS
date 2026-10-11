import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Attendance } from '../models/attendance.model.js';
import { buildScopeFilter, canAccessEmployee } from './scope.service.js';
import { nowInBusinessTime, getBusinessTimezone } from '../utils/time.js';

const sanitizeExcelValue = (val) => {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
};

/**
 * Fetches daily report data scoped by role, including rows, summary counts, and pagination metadata.
 */
export const getDailyReportData = async (user, query) => {
  const { date, from, to, userId, page = 1, limit = 20 } = query;

  // 1. Base scope filter (admin: {}, manager: team members, employee: self)
  const scopeFilter = await buildScopeFilter(user);
  const filter = { ...scopeFilter };

  // 2. Explicit userId filter if within scope
  if (userId) {
    const isAllowed = await canAccessEmployee(user, userId);
    if (!isAllowed) {
      return {
        rows: [],
        summary: {
          workingStatus: { completed: 0, incomplete: 0, in_progress: 0, missed: 0 },
          verificationStatus: { pending: 0, valid: 0, invalid: 0 },
          overtimeStatus: { not_requested: 0, pending: 0, approved: 0, rejected: 0 },
        },
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }
    filter.employeeId = userId;
  }

  // 3. Date range filter
  if (date) {
    filter.workDate = date;
  } else if (from || to) {
    filter.workDate = {};
    if (from) filter.workDate.$gte = from;
    if (to) filter.workDate.$lte = to;
  }

  const skip = (page - 1) * limit;

  // 4. Fetch records for current page + total count & all matching for summary
  const [records, allMatching] = await Promise.all([
    Attendance.find(filter)
      .populate('employeeId', 'name email')
      .populate('verification.reviewedBy', 'name email')
      .populate('overtime.reviewedBy', 'name email')
      .sort({ workDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.find(filter).select('workDate workingStatus workedMinutes verification.status overtime.status'),
  ]);

  // 5. Map rows
  const rows = records.map((r) => {
    const inLoc =
      r.punchIn?.location?.latitude != null && r.punchIn?.location?.longitude != null
        ? `${r.punchIn.location.latitude}, ${r.punchIn.location.longitude}`
        : null;

    const outLoc =
      r.punchOut?.location?.latitude != null && r.punchOut?.location?.longitude != null
        ? `${r.punchOut.location.latitude}, ${r.punchOut.location.longitude}`
        : null;

    const workedMinutes = r.workedMinutes ?? null;
    const workedHours = workedMinutes != null ? Number((workedMinutes / 60).toFixed(2)) : null;
    const hasInSelfie = Boolean(r.punchIn?.selfie?.mimeType || r.punchIn?.selfie?.publicId);
    const hasOutSelfie = Boolean(r.punchOut?.selfie?.mimeType || r.punchOut?.selfie?.publicId);

    const otMinutes = r.overtime?.requestedMinutes ?? 0;
    const otHours = otMinutes > 0 ? Number((otMinutes / 60).toFixed(2)) : 0;

    return {
      attendanceId: r._id.toString(),
      employeeName: r.employeeId?.name || 'Unknown',
      employeeEmail: r.employeeId?.email || '',
      workDate: r.workDate,
      punchInAt: r.punchIn?.at ? new Date(r.punchIn.at).toISOString() : null,
      punchOutAt: r.punchOut?.at ? new Date(r.punchOut.at).toISOString() : null,
      punchInLocation: inLoc,
      punchOutLocation: outLoc,
      workedMinutes,
      workedHours,
      workingStatus: r.workingStatus,
      verificationStatus: r.verification?.status || 'pending',
      verificationRemarks: r.verification?.remarks || null,
      verifiedBy: r.verification?.reviewedBy?.name || null,
      verificationAt: r.verification?.reviewedAt ? new Date(r.verification.reviewedAt).toISOString() : null,
      overtimeStatus: r.overtime?.status || 'not_requested',
      overtimeMinutes: otMinutes,
      overtimeHours: otHours,
      overtimeReason: r.overtime?.reason || null,
      overtimeRemarks: r.overtime?.remarks || null,
      hasPunchInSelfie: hasInSelfie,
      hasPunchOutSelfie: hasOutSelfie,
      punchInSelfieUrl: hasInSelfie ? `/api/attendance/${r._id}/selfies/punch-in` : null,
      punchOutSelfieUrl: hasOutSelfie ? `/api/attendance/${r._id}/selfies/punch-out` : null,
    };
  });

  // 6. Aggregate summary counts over all matching records
  const summary = {
    workingStatus: { completed: 0, incomplete: 0, in_progress: 0, missed: 0 },
    verificationStatus: { pending: 0, valid: 0, invalid: 0 },
    overtimeStatus: { not_requested: 0, pending: 0, approved: 0, rejected: 0 },
    byDate: {},
    totalWorkedMinutes: 0,
    totalWorkedHours: 0,
  };

  for (const doc of allMatching) {
    if (doc.workDate) {
      summary.byDate[doc.workDate] = (summary.byDate[doc.workDate] || 0) + 1;
    }
    if (doc.workedMinutes && doc.workedMinutes > 0) {
      summary.totalWorkedMinutes += doc.workedMinutes;
    }
    if (summary.workingStatus[doc.workingStatus] !== undefined) {
      summary.workingStatus[doc.workingStatus]++;
    }
    const vStatus = doc.verification?.status || 'pending';
    if (summary.verificationStatus[vStatus] !== undefined) {
      summary.verificationStatus[vStatus]++;
    }
    const oStatus = doc.overtime?.status || 'not_requested';
    if (summary.overtimeStatus[oStatus] !== undefined) {
      summary.overtimeStatus[oStatus]++;
    }
  }

  summary.totalWorkedHours = Number((summary.totalWorkedMinutes / 60).toFixed(2));

  const total = allMatching.length;
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    rows,
    summary,
    meta: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

/**
 * Streams daily report export as XLSX or PDF (capped at 5000 rows).
 */
export const exportDailyReport = async (user, query, res) => {
  const { format, date, from, to } = query;

  // Max 5000 rows cap for export
  const reportData = await getDailyReportData(user, {
    ...query,
    page: 1,
    limit: 5000,
  });

  const isTruncated = reportData.meta.total > 5000;
  if (isTruncated) {
    res.setHeader('X-Export-Truncated', 'true');
  }

  const zone = getBusinessTimezone();
  const generatedAt = nowInBusinessTime(zone).toFormat('yyyy-MM-dd HH:mm:ss ZZZZ');

  let dateRangeLabel = 'All Dates';
  if (date) {
    dateRangeLabel = date;
  } else if (from && to) {
    dateRangeLabel = `${from} to ${to}`;
  } else if (from) {
    dateRangeLabel = `From ${from}`;
  } else if (to) {
    dateRangeLabel = `Up to ${to}`;
  }

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Attendance Management System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Daily Attendance');

    sheet.columns = [
      { header: 'Employee Name', key: 'employeeName', width: 22 },
      { header: 'Employee Email', key: 'employeeEmail', width: 26 },
      { header: 'Work Date', key: 'workDate', width: 14 },
      { header: 'Punch In At', key: 'punchInAt', width: 24 },
      { header: 'Punch Out At', key: 'punchOutAt', width: 24 },
      { header: 'Punch In Location', key: 'punchInLocation', width: 24 },
      { header: 'Punch Out Location', key: 'punchOutLocation', width: 24 },
      { header: 'Punch In Selfie', key: 'punchInSelfie', width: 16 },
      { header: 'Punch Out Selfie', key: 'punchOutSelfie', width: 16 },
      { header: 'Worked Minutes', key: 'workedMinutes', width: 16 },
      { header: 'Worked Hours', key: 'workedHours', width: 14 },
      { header: 'Working Status', key: 'workingStatus', width: 16 },
      { header: 'Verification Status', key: 'verificationStatus', width: 18 },
      { header: 'Verification Remarks', key: 'verificationRemarks', width: 24 },
      { header: 'Overtime Status', key: 'overtimeStatus', width: 18 },
      { header: 'Overtime Minutes', key: 'overtimeMinutes', width: 16 },
      { header: 'Overtime Hours', key: 'overtimeHours', width: 14 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    // Add data rows with formula injection sanitization
    for (const row of reportData.rows) {
      sheet.addRow({
        employeeName: sanitizeExcelValue(row.employeeName),
        employeeEmail: sanitizeExcelValue(row.employeeEmail),
        workDate: row.workDate,
        punchInAt: row.punchInAt || '-',
        punchOutAt: row.punchOutAt || '-',
        punchInLocation: sanitizeExcelValue(row.punchInLocation || '-'),
        punchOutLocation: sanitizeExcelValue(row.punchOutLocation || '-'),
        punchInSelfie: row.hasPunchInSelfie ? 'Captured' : 'None',
        punchOutSelfie: row.hasPunchOutSelfie ? 'Captured' : 'None',
        workedMinutes: row.workedMinutes ?? 0,
        workedHours: row.workedHours ?? 0,
        workingStatus: row.workingStatus,
        verificationStatus: row.verificationStatus,
        verificationRemarks: sanitizeExcelValue(row.verificationRemarks || '-'),
        overtimeStatus: row.overtimeStatus,
        overtimeMinutes: row.overtimeMinutes ?? 0,
        overtimeHours: row.overtimeHours ?? 0,
      });
    }

    if (isTruncated) {
      sheet.insertRow(1, [
        `NOTICE: Export is capped at 5000 rows (total records: ${reportData.meta.total})`,
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(Buffer.from(buffer));
  }

  if (format === 'pdf') {
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margin: 30,
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');

    doc.pipe(res);

    const totalRecords = reportData.meta.total;
    const summary = reportData.summary;
    const isWeekly = Boolean(from && to);

    // ==========================================
    // PAGE 1: EXECUTIVE DASHBOARD & VISUALIZATIONS
    // ==========================================

    // 1. Header & Metadata
    doc.fontSize(16).fillColor('#0f172a').font('Helvetica-Bold').text('Attendance Management System', 30, 30);
    const reportSubtitle = isWeekly ? 'Weekly Attendance Report' : 'Daily Attendance Report';
    doc.fontSize(11).fillColor('#2563eb').font('Helvetica-Bold').text(reportSubtitle, 30, 48);

    doc.fontSize(8.5).fillColor('#64748b').font('Helvetica');
    doc.text(
      `Period: ${dateRangeLabel}   |   Scope: ${(user.role || 'ALL').toUpperCase()}   |   Generated: ${generatedAt}   |   Total Shifts: ${totalRecords}`,
      30,
      64
    );

    if (isTruncated) {
      doc.fontSize(8.5).fillColor('#dc2626').text(`NOTICE: Export is capped at 5000 rows (total records: ${totalRecords})`, 30, 76);
    }

    // Top Divider Line
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(30, 88).lineTo(810, 88).stroke();

    // 2. Summary Metric Cards (4 cards across width 780 pt)
    const cardY = 98;
    const cardH = 46;

    // Card 1: Total Shifts
    doc.roundedRect(30, cardY, 186, cardH, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(7.5).fillColor('#64748b').font('Helvetica-Bold').text('TOTAL SHIFTS', 40, cardY + 7);
    doc.fontSize(13).fillColor('#0f172a').font('Helvetica-Bold').text(String(totalRecords), 40, cardY + 20);

    // Card 2: Completed Shifts
    doc.roundedRect(228, cardY, 186, cardH, 6).fillAndStroke('#f0fdf4', '#bbf7d0');
    doc.fontSize(7.5).fillColor('#16a34a').font('Helvetica-Bold').text('COMPLETED SHIFTS', 238, cardY + 7);
    doc.fontSize(13).fillColor('#15803d').font('Helvetica-Bold').text(String(summary.workingStatus.completed), 238, cardY + 20);

    // Card 3: Total Worked Hours
    doc.roundedRect(426, cardY, 186, cardH, 6).fillAndStroke('#eff6ff', '#bfdbfe');
    doc.fontSize(7.5).fillColor('#2563eb').font('Helvetica-Bold').text('CUMULATIVE WORKED HOURS', 436, cardY + 7);
    doc.fontSize(13).fillColor('#1d4ed8').font('Helvetica-Bold').text(`${summary.totalWorkedHours || 0} hrs`, 436, cardY + 20);

    // Card 4: Pending Audits
    doc.roundedRect(624, cardY, 186, cardH, 6).fillAndStroke('#faf5ff', '#e9d5ff');
    doc.fontSize(7.5).fillColor('#9333ea').font('Helvetica-Bold').text('PENDING REVIEWS', 634, cardY + 7);
    const pendingTotal = (summary.verificationStatus.pending || 0) + (summary.overtimeStatus.pending || 0);
    doc.fontSize(13).fillColor('#7e22ce').font('Helvetica-Bold').text(`${pendingTotal} items`, 634, cardY + 20);

    // 3. Three Vector Visualizations
    const visY = 154;

    // Visualization 1: Shift Status Distribution (Box on Left)
    doc.roundedRect(30, visY, 384, 150, 6).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text('1. Shift Status Distribution', 42, visY + 12);

    const barX = 42;
    const barY = visY + 34;
    const barW = 360;
    const barH = 18;

    if (totalRecords === 0) {
      doc.roundedRect(barX, barY, barW, barH, 4).fill('#f1f5f9');
      doc.fontSize(8).fillColor('#94a3b8').text('No shifts recorded in this period', barX, barY + 5, { width: barW, align: 'center' });
    } else {
      // Proportional segmented bar
      const compW = Math.round((summary.workingStatus.completed / totalRecords) * barW);
      const progW = Math.round((summary.workingStatus.in_progress / totalRecords) * barW);
      const incW = Math.round((summary.workingStatus.incomplete / totalRecords) * barW);
      const missW = Math.max(0, barW - compW - progW - incW);

      let curBX = barX;
      if (compW > 0) { doc.rect(curBX, barY, compW, barH).fill('#10b981'); curBX += compW; }
      if (progW > 0) { doc.rect(curBX, barY, progW, barH).fill('#3b82f6'); curBX += progW; }
      if (incW > 0) { doc.rect(curBX, barY, incW, barH).fill('#f59e0b'); curBX += incW; }
      if (missW > 0) { doc.rect(curBX, barY, missW, barH).fill('#ef4444'); }

      // Legend
      const pct = (cnt) => totalRecords > 0 ? Math.round((cnt / totalRecords) * 100) : 0;
      doc.fontSize(8).font('Helvetica');

      // Completed
      doc.rect(42, visY + 68, 8, 8).fill('#10b981');
      doc.fillColor('#334155').text(`Completed: ${summary.workingStatus.completed} (${pct(summary.workingStatus.completed)}%)`, 56, visY + 68);

      // In Progress
      doc.rect(220, visY + 68, 8, 8).fill('#3b82f6');
      doc.fillColor('#334155').text(`In Progress: ${summary.workingStatus.in_progress} (${pct(summary.workingStatus.in_progress)}%)`, 234, visY + 68);

      // Incomplete
      doc.rect(42, visY + 88, 8, 8).fill('#f59e0b');
      doc.fillColor('#334155').text(`Incomplete: ${summary.workingStatus.incomplete} (${pct(summary.workingStatus.incomplete)}%)`, 56, visY + 88);

      // Missed
      doc.rect(220, visY + 88, 8, 8).fill('#ef4444');
      doc.fillColor('#334155').text(`Missed: ${summary.workingStatus.missed} (${pct(summary.workingStatus.missed)}%)`, 234, visY + 88);
    }

    // Visualization 2: Attendance by Day (Weekly / Multi-Day View) (Box on Right)
    doc.roundedRect(426, visY, 384, 150, 6).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text('2. Attendance by Day (Daily Volume)', 438, visY + 12);

    const dateEntries = Object.entries(summary.byDate || {}).sort((a, b) => a[0].localeCompare(b[0]));
    if (dateEntries.length === 0) {
      doc.fontSize(8.5).fillColor('#94a3b8').text('No day-by-day attendance records', 438, visY + 65, { width: 360, align: 'center' });
    } else {
      const maxCount = Math.max(...dateEntries.map((e) => e[1]), 1);
      const chartBaseY = visY + 115;
      const chartH = 60;
      const barCount = Math.min(dateEntries.length, 12);
      const daySlice = dateEntries.slice(-12);
      const slotW = Math.floor(340 / barCount);
      const vBarW = Math.max(10, slotW - 8);

      // Baseline axis
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(438, chartBaseY).lineTo(798, chartBaseY).stroke();

      daySlice.forEach(([dt, cnt], idx) => {
        const vBarH = Math.max(4, Math.round((cnt / maxCount) * chartH));
        const vBarX = 444 + idx * slotW + Math.floor((slotW - vBarW) / 2);
        const vBarY = chartBaseY - vBarH;

        doc.roundedRect(vBarX, vBarY, vBarW, vBarH, 2).fill('#6366f1');

        // Count label above bar
        doc.fontSize(7).fillColor('#4338ca').font('Helvetica-Bold').text(String(cnt), vBarX - 4, vBarY - 9, {
          width: vBarW + 8,
          align: 'center',
        });

        // Date label below axis
        const shortDate = dt.length >= 10 ? dt.substring(5) : dt;
        doc.fontSize(6.5).fillColor('#64748b').font('Helvetica').text(shortDate, vBarX - 6, chartBaseY + 4, {
          width: vBarW + 12,
          align: 'center',
        });
      });
    }

    // Visualization 3: Verification & Overtime Audit Breakdown (Full-Width Compact Box)
    const vis3Y = 316;
    doc.roundedRect(30, vis3Y, 780, 140, 6).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fontSize(9.5).fillColor('#0f172a').font('Helvetica-Bold').text('3. Verification & Overtime Audit Breakdown', 42, vis3Y + 12);

    // Left sub-panel: Verification Status
    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('ATTENDANCE VERIFICATION AUDIT', 42, vis3Y + 30);
    const vMax = Math.max(summary.verificationStatus.valid + summary.verificationStatus.pending + summary.verificationStatus.invalid, 1);
    const drawProgressBar = (label, count, max, color, yPos, leftX) => {
      doc.fontSize(7.5).fillColor('#334155').font('Helvetica').text(`${label}: ${count}`, leftX, yPos);
      const pW = 180;
      doc.roundedRect(leftX + 110, yPos + 1, pW, 8, 2).fill('#f1f5f9');
      const fillW = Math.max(2, Math.round((count / max) * pW));
      if (count > 0) {
        doc.roundedRect(leftX + 110, yPos + 1, fillW, 8, 2).fill(color);
      }
    };

    drawProgressBar('Valid', summary.verificationStatus.valid, vMax, '#10b981', vis3Y + 48, 42);
    drawProgressBar('Pending Audit', summary.verificationStatus.pending, vMax, '#f59e0b', vis3Y + 68, 42);
    drawProgressBar('Marked Invalid', summary.verificationStatus.invalid, vMax, '#ef4444', vis3Y + 88, 42);

    // Vertical separator
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(410, vis3Y + 30).lineTo(410, vis3Y + 115).stroke();

    // Right sub-panel: Overtime Status
    doc.fontSize(8).fillColor('#64748b').font('Helvetica-Bold').text('OVERTIME REQUEST AUDIT', 438, vis3Y + 30);
    const oMax = Math.max(
      summary.overtimeStatus.approved + summary.overtimeStatus.pending + summary.overtimeStatus.rejected + summary.overtimeStatus.not_requested,
      1
    );

    drawProgressBar('Approved OT', summary.overtimeStatus.approved, oMax, '#10b981', vis3Y + 48, 438);
    drawProgressBar('Pending Review', summary.overtimeStatus.pending, oMax, '#f59e0b', vis3Y + 68, 438);
    drawProgressBar('Rejected OT', summary.overtimeStatus.rejected, oMax, '#94a3b8', vis3Y + 88, 438);
    drawProgressBar('Not Requested', summary.overtimeStatus.not_requested, oMax, '#cbd5e1', vis3Y + 108, 438);

    // Page 1 Footer Note
    doc.fontSize(7.5).fillColor('#94a3b8').font('Helvetica-Oblique').text(
      'Deterministic metrics verified directly against persistent database records. Detailed attendance rows start on Page 2.',
      30,
      472,
      { width: 780, align: 'center' }
    );

    // ==========================================
    // PAGE 2 ONWARDS: ATTENDANCE TABLE
    // ==========================================
    doc.addPage();

    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text('Detailed Attendance Records', 30, 30);
    doc.moveDown(0.2);
    doc.fontSize(8.5).fillColor('#64748b').font('Helvetica').text(`Period: ${dateRangeLabel}  |  Total Rows: ${reportData.rows.length}`, 30, 46);
    doc.moveDown(0.6);
    let tableY = 66;

    const colX = [30, 130, 240, 310, 380, 470, 560, 630, 710];
    const headers = [
      'Employee',
      'Email',
      'Date',
      'In',
      'Out',
      'Worked',
      'Status',
      'Verification',
      'Overtime',
    ];

    const printTableHeader = (curY) => {
      doc.rect(30, curY - 2, 780, 16).fill('#1e293b');
      doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX[i] + 4, curY + 2, { width: 90, continued: i < headers.length - 1 });
      });
    };

    printTableHeader(tableY);
    tableY += 20;

    let rowIdx = 0;
    for (const row of reportData.rows) {
      if (tableY > 530) {
        doc.addPage();
        tableY = 30;
        printTableHeader(tableY);
        tableY += 20;
      }

      // Zebra striping
      if (rowIdx % 2 === 1) {
        doc.rect(30, tableY - 2, 780, 14).fill('#f8fafc');
      }

      doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
      doc.text(row.employeeName.substring(0, 18), colX[0] + 4, tableY, { width: 95 });
      doc.text(row.employeeEmail.substring(0, 22), colX[1], tableY, { width: 105 });
      doc.text(row.workDate, colX[2], tableY, { width: 65 });
      doc.text(row.punchInAt ? row.punchInAt.substring(11, 16) : '-', colX[3], tableY, { width: 65 });
      doc.text(row.punchOutAt ? row.punchOutAt.substring(11, 16) : '-', colX[4], tableY, { width: 85 });
      doc.text(`${row.workedMinutes ?? 0}m (${row.workedHours ?? 0}h)`, colX[5], tableY, { width: 85 });
      doc.text(row.workingStatus, colX[6], tableY, { width: 65 });

      const vText = row.verificationRemarks
        ? `${row.verificationStatus} (${row.verificationRemarks.substring(0, 10)})`
        : row.verificationStatus;
      doc.text(vText, colX[7], tableY, { width: 75 });

      const oText = row.overtimeHours
        ? `${row.overtimeStatus} (${row.overtimeHours}h)`
        : row.overtimeStatus;
      doc.text(oText, colX[8], tableY, { width: 85 });

      tableY += 15;
      rowIdx++;
    }

    // Add Page Numbers on all buffered pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(`Page ${i + 1} of ${range.count}`, 30, doc.page.height - 20, {
          align: 'center',
          width: doc.page.width - 60,
        });
    }

    doc.end();
  }
};

