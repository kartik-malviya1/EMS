import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Attendance } from '../models/attendance.model.js';
import { buildScopeFilter, canAccessEmployee } from './scope.service.js';
import { nowInBusinessTime, getBusinessTimezone } from '../utils/time.js';

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
      .sort({ workDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.find(filter).select('workingStatus verification.status overtime.status'),
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
      overtimeStatus: r.overtime?.status || 'not_requested',
      hasPunchInSelfie: Boolean(r.punchIn?.selfie?.mimeType || r.punchIn?.selfie?.publicId),
      hasPunchOutSelfie: Boolean(r.punchOut?.selfie?.mimeType || r.punchOut?.selfie?.publicId),
    };
  });

  // 6. Aggregate summary counts over all matching records
  const summary = {
    workingStatus: { completed: 0, incomplete: 0, in_progress: 0, missed: 0 },
    verificationStatus: { pending: 0, valid: 0, invalid: 0 },
    overtimeStatus: { not_requested: 0, pending: 0, approved: 0, rejected: 0 },
  };

  for (const doc of allMatching) {
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
      { header: 'Worked Minutes', key: 'workedMinutes', width: 16 },
      { header: 'Worked Hours', key: 'workedHours', width: 14 },
      { header: 'Working Status', key: 'workingStatus', width: 16 },
      { header: 'Verification Status', key: 'verificationStatus', width: 18 },
      { header: 'Overtime Status', key: 'overtimeStatus', width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    // Add data rows
    for (const row of reportData.rows) {
      sheet.addRow({
        employeeName: row.employeeName,
        employeeEmail: row.employeeEmail,
        workDate: row.workDate,
        punchInAt: row.punchInAt || '-',
        punchOutAt: row.punchOutAt || '-',
        punchInLocation: row.punchInLocation || '-',
        punchOutLocation: row.punchOutLocation || '-',
        workedMinutes: row.workedMinutes ?? 0,
        workedHours: row.workedHours ?? 0,
        workingStatus: row.workingStatus,
        verificationStatus: row.verificationStatus,
        overtimeStatus: row.overtimeStatus,
      });
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

    // Title & Metadata
    doc.fontSize(16).text('Daily Attendance Report', { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Date Range: ${dateRangeLabel}  |  Generated At: ${generatedAt}`);
    doc.moveDown(0.8);

    // Table Header
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

    doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], doc.y, { width: 90, continued: i < headers.length - 1 });
    });
    doc.moveDown(0.5);

    // Underline header
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(30, doc.y).lineTo(800, doc.y).stroke();
    doc.moveDown(0.3);

    // Rows
    doc.font('Helvetica').fontSize(8).fillColor('#334155');

    for (const row of reportData.rows) {
      if (doc.y > 540) {
        doc.addPage();
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold');
        headers.forEach((h, i) => {
          doc.text(h, colX[i], doc.y, { width: 90, continued: i < headers.length - 1 });
        });
        doc.moveDown(0.5);
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(30, doc.y).lineTo(800, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
      }

      const curY = doc.y;
      doc.text(row.employeeName.substring(0, 18), colX[0], curY, { width: 95 });
      doc.text(row.employeeEmail.substring(0, 22), colX[1], curY, { width: 105 });
      doc.text(row.workDate, colX[2], curY, { width: 65 });
      doc.text(row.punchInAt ? row.punchInAt.substring(11, 16) : '-', colX[3], curY, { width: 65 });
      doc.text(row.punchOutAt ? row.punchOutAt.substring(11, 16) : '-', colX[4], curY, { width: 85 });
      doc.text(`${row.workedMinutes ?? 0}m (${row.workedHours ?? 0}h)`, colX[5], curY, { width: 85 });
      doc.text(row.workingStatus, colX[6], curY, { width: 65 });
      doc.text(row.verificationStatus, colX[7], curY, { width: 75 });
      doc.text(row.overtimeStatus, colX[8], curY, { width: 85 });
      doc.moveDown(0.5);
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
