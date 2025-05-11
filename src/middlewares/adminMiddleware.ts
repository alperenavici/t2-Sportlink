import { Request, Response, NextFunction } from 'express';

/**
 * Sadece admin ve superadmin rolüne sahip kullanıcıların erişimine izin veren middleware
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const userRole = req.user?.role;

        if (!userRole || (userRole !== 'admin' && userRole !== 'superadmin')) {
            res.status(403).json({
                success: false,
                message: 'Bu işleme erişim yetkiniz bulunmamaktadır. Sadece admin ve superadmin rolündeki kullanıcılar erişebilir.'
            });
            return;
        }

        next();
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Yetkilendirme sırasında bir hata oluştu',
            error: error.message
        });
        return;
    }
}; 