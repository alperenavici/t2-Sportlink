import prisma from '../config/prisma';
import { supabase } from '../config/supabase';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

interface AdminCreateData {
    username: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
}

export const superAdminService = {
    /**
     * Sistemdeki admin kullanıcılarını listeler (sadece superadmin)
     */
    async getAdmins(page: number = 1, limit: number = 10, filter?: string) {
        try {
            const skip = (page - 1) * limit;

            // Filtreleme koşulu oluştur
            let where: Prisma.userWhereInput = {
                role: 'admin'
            };

            if (filter) {
                where = {
                    ...where,
                    OR: [
                        { username: { contains: filter, mode: 'insensitive' } },
                        { email: { contains: filter, mode: 'insensitive' } },
                        { first_name: { contains: filter, mode: 'insensitive' } },
                        { last_name: { contains: filter, mode: 'insensitive' } }
                    ],
                };
            }

            // Toplam kayıt sayısını al
            const totalAdmins = await prisma.user.count({ where });

            // Admin kullanıcıları getir
            const admins = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    first_name: true,
                    last_name: true,
                    phone: true,
                    profile_picture: true,
                    created_at: true,
                    updated_at: true,
                    _count: {
                        select: {
                            admin_logs: true,
                            created_events: true
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
            });

            return {
                success: true,
                data: {
                    admins,
                    pagination: {
                        total: totalAdmins,
                        page,
                        limit,
                        totalPages: Math.ceil(totalAdmins / limit),
                    }
                }
            };
        } catch (error: any) {
            return {
                success: false,
                message: 'Admin kullanıcılar listelenirken bir hata oluştu',
                code: 'LIST_ADMINS_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    },

    /**
     * Yeni bir admin kullanıcısı oluşturur (sadece superadmin)
     */
    async createAdmin(data: AdminCreateData, superadminId: string) {
        try {
            // E-posta kontrolü
            const existingEmail = await prisma.user.findUnique({
                where: { email: data.email }
            });

            if (existingEmail) {
                return {
                    success: false,
                    message: 'Bu e-posta adresi zaten kullanılıyor',
                    code: 'EMAIL_EXISTS'
                };
            }

            // Kullanıcı adı kontrolü
            const existingUsername = await prisma.user.findUnique({
                where: { username: data.username }
            });

            if (existingUsername) {
                return {
                    success: false,
                    message: 'Bu kullanıcı adı zaten kullanılıyor',
                    code: 'USERNAME_EXISTS'
                };
            }

            // Supabase'de kullanıcı oluştur
            const { data: authData, error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        role: 'admin'
                    }
                }
            });

            if (error) {
                return {
                    success: false,
                    message: 'Kimlik doğrulama hizmeti hatası: ' + error.message,
                    code: 'AUTH_SERVICE_ERROR'
                };
            }

            // Parolayı hashle
            const hashedPassword = await bcrypt.hash(data.password, 10);

            // Kullanıcıyı veritabanına kaydet
            const admin = await prisma.user.create({
                data: {
                    username: data.username,
                    email: data.email,
                    password: hashedPassword,
                    first_name: data.first_name,
                    last_name: data.last_name,
                    phone: data.phone,
                    role: 'admin',
                    email_verified: false,
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    first_name: true,
                    last_name: true,
                    role: true,
                    created_at: true
                }
            });

            // Admin log kaydı oluştur
            await prisma.admin_log.create({
                data: {
                    admin_id: superadminId,
                    action_type: 'CREATE_ADMIN',
                    description: `"${data.username}" kullanıcı adıyla yeni bir admin kullanıcısı oluşturuldu`
                }
            });

            return {
                success: true,
                message: 'Admin kullanıcısı başarıyla oluşturuldu',
                data: admin
            };
        } catch (error: any) {
            return {
                success: false,
                message: 'Admin kullanıcısı oluşturulurken bir hata oluştu',
                code: 'CREATE_ADMIN_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    },

    /**
     * Admin kullanıcısını etkisizleştirir (sadece superadmin)
     */
    async deactivateAdmin(adminId: string, superadminId: string) {
        try {
            // Admin kullanıcısının var olup olmadığını kontrol et
            const admin = await prisma.user.findUnique({
                where: { id: adminId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true
                }
            });

            if (!admin) {
                return {
                    success: false,
                    message: 'Admin kullanıcısı bulunamadı',
                    code: 'ADMIN_NOT_FOUND'
                };
            }

            // Kullanıcının admin rolünde olup olmadığını kontrol et
            if (admin.role !== 'admin') {
                return {
                    success: false,
                    message: 'Bu kullanıcı admin rolüne sahip değil',
                    code: 'NOT_ADMIN_ROLE'
                };
            }

            // Admin rolünü user olarak değiştir
            const updatedUser = await prisma.user.update({
                where: { id: adminId },
                data: { role: 'user' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true
                }
            });

            // Admin log kaydı oluştur
            await prisma.admin_log.create({
                data: {
                    admin_id: superadminId,
                    action_type: 'DEACTIVATE_ADMIN',
                    description: `"${admin.username}" kullanıcı adına sahip admin kullanıcısının rolü 'user' olarak değiştirildi`
                }
            });

            return {
                success: true,
                message: 'Admin kullanıcısı başarıyla etkisizleştirildi',
                data: updatedUser
            };
        } catch (error: any) {
            return {
                success: false,
                message: 'Admin kullanıcısı etkisizleştirilirken bir hata oluştu',
                code: 'DEACTIVATE_ADMIN_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    }
}; 