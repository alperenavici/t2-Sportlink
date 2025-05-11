import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// Prisma istemcisi oluştur
const prisma = new PrismaClient();

async function createSportData() {
    try {
        console.log('Temel spor verileri oluşturuluyor...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Tanımlı' : 'Tanımlı değil');

        // Temel sporlar
        const sports = [
            { id: '1', name: 'Futbol', description: 'Futbol ile ilgili haberler ve içerikler', icon: 'football' },
            { id: '2', name: 'Basketbol', description: 'Basketbol ile ilgili haberler ve içerikler', icon: 'basketball' },
            { id: '3', name: 'Voleybol', description: 'Voleybol ile ilgili haberler ve içerikler', icon: 'volleyball' },
            { id: '4', name: 'Tenis', description: 'Tenis ile ilgili haberler ve içerikler', icon: 'tennis' },
            { id: '5', name: 'Yüzme', description: 'Yüzme ile ilgili haberler ve içerikler', icon: 'swimming' },
            { id: '6', name: 'Atletizm', description: 'Atletizm ile ilgili haberler ve içerikler', icon: 'athletics' },
            { id: '7', name: 'Diğer', description: 'Diğer sporlar ile ilgili haberler ve içerikler', icon: 'sports' },
        ];

        // Her bir spor kaydını oluştur (eğer yoksa)
        for (const sport of sports) {
            try {
                const existingSport = await prisma.sport.findUnique({
                    where: { id: sport.id }
                });

                if (!existingSport) {
                    await prisma.sport.create({
                        data: sport
                    });
                    console.log(`${sport.name} sporu oluşturuldu.`);
                } else {
                    console.log(`${sport.name} sporu zaten mevcut, atlanıyor.`);
                }
            } catch (error) {
                console.error(`${sport.name} sporu oluşturulurken hata:`, error);
            }
        }

        const totalSports = await prisma.sport.count();
        console.log(`İşlem tamamlandı. Veritabanında toplam ${totalSports} spor bulunuyor.`);
    } catch (error) {
        console.error('Spor verisi oluşturulurken hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Script doğrudan çalıştırıldığında fonksiyonu çağır
if (require.main === module) {
    createSportData()
        .then(() => {
            console.log('Spor verileri başarıyla oluşturuldu.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Spor verileri oluşturulurken hata:', error);
            process.exit(1);
        });
} 