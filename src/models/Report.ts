import prisma from '../config/prisma';
import { IReportCreateDTO, IReportUpdateDTO, IReportFilterOptions } from '../types/report';

/**
 * Rapor modeli
 */
export class Report {
    /**
     * Yeni bir rapor oluşturur
     */
    static async create(data: IReportCreateDTO) {
        return prisma.report.create({
            data: {
                event_id: data.event_id,
                reporter_id: data.reporter_id,
                reported_id: data.reported_id,
                report_reason: data.report_reason,
                status: data.status
            },
        });
    }

    /**
     * Rapor bilgilerini günceller
     */
    static async update(where: { id: string }, data: IReportUpdateDTO) {
        return prisma.report.update({
            where,
            data,
        });
    }

    /**
     * Raporu siler
     */
    static async delete(where: { id: string }) {
        return prisma.report.delete({
            where,
        });
    }

    /**
     * Belirli bir raporu getirir
     */
    static async findUnique(where: { id: string }) {
        return prisma.report.findUnique({
            where,
            include: {
                reporter: true,
                reported: true,
                event: true,
            },
        });
    }

    /**
     * Belirli bir koşula göre ilk raporu getirir
     */
    static async findFirst(filter: any) {
        return prisma.report.findFirst({
            where: filter,
            include: {
                reporter: true,
                reported: true,
                event: true,
            },
        });
    }

    /**
     * Toplam rapor sayısını hesaplar
     */
    static async count(filter?: any) {
        return prisma.report.count({
            where: filter,
        });
    }

    /**
     * Raporları filtreli şekilde getirir
     */
    static async findMany(params?: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
    }) {
        const { skip, take, where, orderBy } = params || {};

        return prisma.report.findMany({
            skip,
            take,
            where,
            orderBy,
            include: {
                reporter: {
                    select: {
                        id: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        profile_picture: true,
                    },
                },
                reported: {
                    select: {
                        id: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        profile_picture: true,
                    },
                },
                event: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                username: true,
                                first_name: true,
                                last_name: true,
                                role: true,
                            },
                        },
                        participants: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        username: true,
                                        first_name: true,
                                        last_name: true,
                                        role: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Belirli bir etkinliğin tüm raporlarını getirir
     */
    static async findByEventId(eventId: string) {
        return prisma.report.findMany({
            where: {
                event_id: eventId,
            },
            include: {
                reporter: {
                    select: {
                        id: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        profile_picture: true,
                    },
                },
                reported: {
                    select: {
                        id: true,
                        username: true,
                        first_name: true,
                        last_name: true,
                        profile_picture: true,
                    },
                },
                event: true,
            },
        });
    }

    /**
     * Belirli bir kullanıcı hakkında yapılan raporları getirir
     */
    static async findByReportedUserId(userId: string) {
        return prisma.report.findMany({
            where: {
                reported_id: userId,
            },
            include: {
                reporter: true,
                event: true,
            },
        });
    }

    /**
     * Belirli bir kullanıcının yaptığı raporları getirir
     */
    static async findByReporterId(userId: string) {
        return prisma.report.findMany({
            where: {
                reporter_id: userId,
            },
            include: {
                reported: true,
                event: true,
            },
        });
    }

    /**
     * Belirli bir statüdeki raporları getirir
     */
    static async findByStatus(status: string) {
        return prisma.report.findMany({
            where: {
                status,
            },
            include: {
                reporter: true,
                reported: true,
                event: true,
            },
        });
    }
} 