import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService';
import { Prisma } from '@prisma/client';
import { IReportCreateDTO } from '../types/report';

export class ReportController {
    /**
     * Yeni bir rapor oluşturur
     */
    static async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { event_id, reported_id, report_reason } = req.body;
            const reporter_id = req.user?.id;

            if (!reporter_id) {
                res.status(401).json({
                    success: false,
                    message: 'Kullanıcı bilgisi bulunamadı.',
                });
                return;
            }

            if (!event_id || !reported_id || !report_reason) {
                res.status(400).json({
                    success: false,
                    message: 'Etkinlik ID, raporlanan kullanıcı ID ve rapor nedeni gereklidir.',
                });
                return;
            }

            // Özel tipi kullanarak veri oluştur
            const reportData: IReportCreateDTO = {
                event_id,
                reporter_id,
                reported_id,
                report_reason,
                status: 'pending'
            };

            const report = await ReportService.createReport(reportData);

            res.status(201).json({
                success: true,
                message: 'Rapor başarıyla oluşturuldu.',
                data: report,
            });
            return;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    res.status(409).json({
                        success: false,
                        message: 'Bu rapor zaten mevcut.',
                    });
                    return;
                }
                if (error.code === 'P2003') {
                    res.status(404).json({
                        success: false,
                        message: 'Etkinlik veya kullanıcı bulunamadı.',
                    });
                    return;
                }
            }
            next(error);
            return;
        }
    }

    /**
     * Bir raporun durumunu günceller (admin/superadmin tarafından)
     */
    static async updateReportStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const { status, admin_notes } = req.body;

            if (!id || !status) {
                res.status(400).json({
                    success: false,
                    message: 'Rapor ID ve durum bilgisi gereklidir.',
                });
                return;
            }

            // Sadece admin ve superadmin kullanıcılar rapor durumunu güncelleyebilir
            if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
                res.status(403).json({
                    success: false,
                    message: 'Bu işlemi gerçekleştirmek için yetkiniz yok.',
                });
                return;
            }

            const updatedReport = await ReportService.updateReportStatus(id, status, admin_notes);

            res.status(200).json({
                success: true,
                message: 'Rapor durumu başarıyla güncellendi.',
                data: updatedReport,
            });
            return;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    res.status(404).json({
                        success: false,
                        message: 'Rapor bulunamadı.',
                    });
                    return;
                }
            }
            next(error);
            return;
        }
    }

    /**
     * Belirli bir raporu ID'ye göre getirir
     */
    static async getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const userRole = req.user?.role;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Kullanıcı bilgisi bulunamadı.',
                });
                return;
            }

            if (!id) {
                res.status(400).json({
                    success: false,
                    message: 'Rapor ID gereklidir.',
                });
                return;
            }

            const report = await ReportService.getReportById(id);

            if (!report) {
                res.status(404).json({
                    success: false,
                    message: 'Rapor bulunamadı.',
                });
                return;
            }

            // Sadece raporu oluşturan, rapor edilen kullanıcı veya admin/superadmin'ler görebilir
            if (
                userId !== report.reporter_id &&
                userId !== report.reported_id &&
                userRole !== 'admin' &&
                userRole !== 'superadmin'
            ) {
                res.status(403).json({
                    success: false,
                    message: 'Bu raporu görüntüleme yetkiniz yok.',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: report,
            });
            return;
        } catch (error) {
            next(error);
            return;
        }
    }

    /**
     * Tüm raporları sayfalanmış olarak getirir (sadece admin/superadmin)
     */
    static async getAllReports(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const status = req.query.status as string;

            // Sadece admin ve superadmin kullanıcılar tüm raporları görebilir
            if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
                res.status(403).json({
                    success: false,
                    message: 'Bu işlemi gerçekleştirmek için yetkiniz yok.',
                });
                return;
            }

            const { reports, pagination } = await ReportService.getAllReports(page, limit, status);

            res.status(200).json({
                success: true,
                data: reports,
                pagination,
            });
            return;
        } catch (error) {
            next(error);
            return;
        }
    }

    /**
     * Belirli bir etkinlik için yapılan raporları getirir
     */
    static async getReportsByEventId(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { event_id } = req.params;
            const userId = req.user?.id;
            const userRole = req.user?.role;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Kullanıcı bilgisi bulunamadı.',
                });
                return;
            }

            if (!event_id) {
                res.status(400).json({
                    success: false,
                    message: 'Etkinlik ID gereklidir.',
                });
                return;
            }

            // Etkinlik admins ve superadminler kontrol ediliyor
            const eventAdmins = await ReportService.getEventAdmins(event_id);
            const isEventAdmin = eventAdmins.some((admin: { id: string }) => admin.id === userId);

            // Sadece etkinliğin adminleri veya genel admin/superadmin'ler görebilir
            if (!isEventAdmin && userRole !== 'admin' && userRole !== 'superadmin') {
                res.status(403).json({
                    success: false,
                    message: 'Bu etkinliğin raporlarını görüntüleme yetkiniz yok.',
                });
                return;
            }

            const reports = await ReportService.getReportsByEventId(event_id);

            res.status(200).json({
                success: true,
                data: reports,
            });
            return;
        } catch (error) {
            next(error);
            return;
        }
    }

    /**
     * Kullanıcının kendi raporlarını getirir
     */
    static async getMyReports(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Kullanıcı bilgisi bulunamadı.',
                });
                return;
            }

            const reports = await ReportService.getReportsByReporterId(userId);

            res.status(200).json({
                success: true,
                data: reports,
            });
            return;
        } catch (error) {
            next(error);
            return;
        }
    }

    /**
     * Kullanıcı hakkında yapılan raporları getirir (sadece admin/superadmin)
     */
    static async getReportsByUserId(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { user_id } = req.params;
            const currentUserId = req.user?.id;
            const currentUserRole = req.user?.role;

            if (!currentUserId) {
                res.status(401).json({
                    success: false,
                    message: 'Kullanıcı bilgisi bulunamadı.',
                });
                return;
            }

            if (!user_id) {
                res.status(400).json({
                    success: false,
                    message: 'Kullanıcı ID gereklidir.',
                });
                return;
            }

            // Sadece admin/superadmin veya kullanıcının kendisi raporları görebilir
            if (currentUserId !== user_id && currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
                res.status(403).json({
                    success: false,
                    message: 'Bu kullanıcının raporlarını görüntüleme yetkiniz yok.',
                });
                return;
            }

            const reports = await ReportService.getReportsByReportedUserId(user_id);

            res.status(200).json({
                success: true,
                data: reports,
            });
            return;
        } catch (error) {
            next(error);
            return;
        }
    }
} 