import { Report } from '../models/Report';
import { IReportCreateDTO, IReportUpdateDTO, IReportFilterOptions, IUser, IEvent } from '../types/report';

export class ReportService {
    /**
     * Yeni bir rapor oluşturur
     */
    static async createReport(data: IReportCreateDTO) {
        return Report.create(data);
    }

    /**
     * Bir raporun durumunu günceller
     */
    static async updateReportStatus(id: string, status: string, adminNotes?: string) {
        return Report.update(
            { id },
            {
                status,
                admin_notes: adminNotes,
            }
        );
    }

    /**
     * Belirli bir raporu ID'ye göre getirir
     */
    static async getReportById(id: string) {
        return Report.findUnique({ id });
    }

    /**
     * Tüm raporları sayfalanmış olarak getirir
     */
    static async getAllReports(page = 1, limit = 10, status?: string) {
        const skip = (page - 1) * limit;
        const where: IReportFilterOptions = status ? { status } : {};

        const reports = await Report.findMany({
            skip,
            take: limit,
            where,
            orderBy: { report_date: 'desc' },
        });

        const totalCount = await Report.count(where);

        return {
            reports,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    /**
     * Belirli bir etkinlik için yapılan raporları getirir
     */
    static async getReportsByEventId(eventId: string) {
        return Report.findByEventId(eventId);
    }

    /**
     * Belirli bir kullanıcı hakkında yapılan raporları getirir
     */
    static async getReportsByReportedUserId(userId: string) {
        return Report.findByReportedUserId(userId);
    }

    /**
     * Belirli bir kullanıcının oluşturduğu raporları getirir
     */
    static async getReportsByReporterId(userId: string) {
        return Report.findByReporterId(userId);
    }

    /**
     * Belirli bir etkinlikteki admin/superadmin rolündeki kullanıcıları getirir
     */
    static async getEventAdmins(eventId: string): Promise<IUser[]> {
        const filter: any = { event_id: eventId };

        const eventReport = await Report.findFirst(filter);

        if (!eventReport || !eventReport.event) {
            return [];
        }

        const event = eventReport.event as unknown as IEvent;

        // Etkinlik yaratıcısı
        const creator = event.creator;

        if (!creator || !event.participants) {
            return creator ? [creator] : [];
        }

        // Admin veya superadmin rolündeki katılımcılar
        const adminParticipants: IUser[] = event.participants
            .filter(participant =>
                participant.user && (participant.user.role === 'admin' || participant.user.role === 'superadmin'))
            .map(participant => participant.user);

        // Eğer etkinlik yaratıcısı admin veya superadmin değilse ve adminParticipants içinde bulunmuyorsa ekle
        if (creator && (creator.role === 'admin' || creator.role === 'superadmin')) {
            const creatorExists = adminParticipants.some((admin: IUser) => admin.id === creator.id);
            if (!creatorExists) {
                adminParticipants.push(creator);
            }
        }

        return adminParticipants;
    }
} 