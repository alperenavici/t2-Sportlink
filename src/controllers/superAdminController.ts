import { Request, Response, NextFunction } from 'express';
import { superAdminService } from '../services/superAdminService';
import prisma from '../config/prisma';
import { z } from 'zod';

export class SuperAdminController {
    /**
     * Tüm admin kullanıcılarını listeler
     */
    static async getAllAdmins(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const filter = req.query.q as string | undefined;

            const result = await superAdminService.getAdmins(page, limit, filter);

            if (!result.success) {
                res.status(400).json(result);
                return;
            }

            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Yeni admin kullanıcısı oluşturur
     */
    static async createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const superadminId = req.user!.id;

            // Veri doğrulama
            const adminSchema = z.object({
                username: z.string().min(3, 'Kullanıcı adı en az 3 karakter olmalıdır'),
                email: z.string().email('Geçerli bir e-posta adresi giriniz'),
                password: z.string().min(8, 'Parola en az 8 karakter olmalıdır'),
                first_name: z.string().min(2, 'Ad en az 2 karakter olmalıdır'),
                last_name: z.string().min(2, 'Soyad en az 2 karakter olmalıdır'),
                phone: z.string().nullable().optional(),
            });

            const validationResult = adminSchema.safeParse(req.body);

            if (!validationResult.success) {
                res.status(400).json({
                    success: false,
                    message: 'Doğrulama hatası',
                    errors: validationResult.error.errors,
                    code: 'VALIDATION_ERROR'
                });
                return;
            }

            const result = await superAdminService.createAdmin(validationResult.data, superadminId);

            if (!result.success) {
                const status =
                    result.code === 'EMAIL_EXISTS' || result.code === 'USERNAME_EXISTS' ? 409 : 400;

                res.status(status).json(result);
                return;
            }

            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Admin kullanıcısını etkisizleştirir
     */
    static async deactivateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { adminId } = req.params;
            const superadminId = req.user!.id;

            const result = await superAdminService.deactivateAdmin(adminId, superadminId);

            if (!result.success) {
                const status =
                    result.code === 'ADMIN_NOT_FOUND' ? 404 :
                        result.code === 'NOT_ADMIN_ROLE' ? 400 : 500;

                res.status(status).json(result);
                return;
            }

            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Dashboard için özet bilgileri getirir
     */
    static async getDashboardInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Admin kullanıcı sayısı
            const adminCount = await prisma.user.count({
                where: { role: 'admin' }
            });

            // Toplam kullanıcı sayısı
            const userCount = await prisma.user.count();

            // Onay bekleyen etkinlik sayısı
            const pendingEventCount = await prisma.event.count({
                where: { status: 'pending' }
            });

            // Son 10 admin log kaydı
            const recentLogs = await prisma.admin_log.findMany({
                take: 10,
                orderBy: { created_at: 'desc' },
                include: {
                    admin: {
                        select: {
                            id: true,
                            username: true,
                            first_name: true,
                            last_name: true
                        }
                    }
                }
            });

            res.json({
                success: true,
                data: {
                    adminCount,
                    userCount,
                    pendingEventCount,
                    recentLogs
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Kullanıcının SuperAdmin olup olmadığını kontrol eder ve UI için bilgi döner
     */
    static async checkSuperAdminStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userRole = req.user!.role;

            res.json({
                success: true,
                data: {
                    isSuperAdmin: userRole === 'superadmin',
                    userRole
                }
            });
        } catch (error) {
            next(error);
        }
    }
} 