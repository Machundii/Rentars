import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { submitReport, listReports, resolveReport } from '../services/report.service.js';
import type { ReportStatus, ReportTargetType } from '../services/report.service.js';

export async function createReport(req: AuthRequest, res: Response): Promise<void> {
  const reporterId = req.userId;
  if (!reporterId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { targetType, targetId, reason, details } = req.body;
  const result = await submitReport(reporterId, targetType, targetId, reason, details);

  if (!result.success) {
    res.status(result.conflict ? 409 : 400).json({ error: result.error });
    return;
  }

  res.status(201).json(result.data);
}

export async function listReportsHandler(req: AuthRequest, res: Response): Promise<void> {
  const status = req.query.status as ReportStatus | undefined;
  const targetType = req.query.targetType as ReportTargetType | undefined;

  const result = await listReports({ status, targetType });

  if (!result.success) {
    res.status(500).json({ error: result.error });
    return;
  }

  res.json(result.data);
}

export async function resolveReportHandler(req: AuthRequest, res: Response): Promise<void> {
  const resolverId = req.userId;
  if (!resolverId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { status, resolutionNote } = req.body;
  const result = await resolveReport(req.params.id, resolverId, status, resolutionNote);

  if (!result.success) {
    res.status(result.error === 'Report not found' ? 404 : 400).json({ error: result.error });
    return;
  }

  res.json(result.data);
}
