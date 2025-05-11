import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// Prisma istemcisi oluştur
const prisma = new PrismaClient();

async function listSports() {
    try {
        const sports = await prisma.sport.findMany();
        console.log('Veritabanındaki spor kayıtları:');
        console.table(sports);
        console.log(`Toplam ${sports.length} spor kaydı bulundu.`);
    } catch (error) {
        console.error('Spor kayıtları listelenirken hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Script doğrudan çalıştırıldığında fonksiyonu çağır
if (require.main === module) {
    listSports()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Hata:', error);
            process.exit(1);
        });
} 