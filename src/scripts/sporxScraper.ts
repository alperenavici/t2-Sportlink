import { News } from '../models/News';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

// .env dosyasını yükle
dotenv.config();

// Sporx.com kategori URL'leri
const categories = [
  { url: 'https://www.sporx.com/futbol/', sportId: '909a0f7f-54f7-4a47-b47f-5d074b88bcc6' }, // Futbol ID (Spor tablosundaki gerçek ID)
  { url: 'https://www.sporx.com/basketbol/', sportId: '2' }, // Basketbol ID (Spor tablosundaki gerçek ID)
  { url: 'https://www.sporx.com/voleybol/', sportId: '3' }, // Voleybol ID (Spor tablosundaki gerçek ID)
  // Diğer kategoriler buraya eklenebilir
];

const prisma = new PrismaClient();

/**
 * Sporx sitesinden haberler çeker
 */
export async function scrapeSporx() {
  try {
    console.log('Sporx.com\'dan haber çekme işlemi başlıyor...');
    let totalProcessed = 0;
    let totalAdded = 0;

    for (const category of categories) {
      console.log(`${category.url} adresinden haberler çekiliyor...`);

      try {
        // Kategori sayfasını çek
        const response = await axios.get(category.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data as string);
        let processedInCategory = 0;

        // Haber linklerini topla (Sporx sitesine özel CSS seçicileri - güncellemeniz gerekebilir)
        const newsLinks: string[] = [];
        $('.news-list-item a, .news-item a, .card-news a, article a, .headline a').each((_, element: cheerio.Element) => {
          const href = $(element).attr('href');
          if (href && !newsLinks.includes(href)) {
            newsLinks.push(href);
          }
        });

        console.log(`${newsLinks.length} haber linki bulundu.`);

        // Her haberi işle (en fazla 10 haber)
        for (let i = 0; i < Math.min(newsLinks.length, 10); i++) {
          const newsUrl = formatUrl(newsLinks[i], category.url);

          try {
            // Haberi kontrol et
            const existingNews = await checkIfNewsExists(newsUrl);
            if (existingNews) {
              console.log(`Haber zaten mevcut: ${newsUrl}`);
              continue;
            }

            // Haber detay sayfasını çek
            const newsResponse = await axios.get(newsUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              },
              timeout: 10000
            });

            const newsPage = cheerio.load(newsResponse.data as string);

            // Haber verilerini çıkar (Sporx sitesine özel CSS seçicileri - güncellemeniz gerekebilir)
            const title = newsPage('.news-detail h1, .article-title h1, .story-title, .content-title, h1.title').text().trim();
            const content = newsPage('.news-detail .news-content, .article-body, .story-content, .content-text, .article-text').text().trim();
            const imageUrl = newsPage('.news-detail .news-img img, .article-img img, .story-image img, .content-image img, article figure img').attr('src') || '';

            // Tarih çıkar
            let publishedDate = new Date();
            const dateText = newsPage('.news-detail .news-date').text().trim();
            if (dateText) {
              try {
                // Türkçe tarih formatını işle (örnek: "10 Haziran 2023, 14:30")
                const dateParts = dateText.split(/[,\s]+/);

                if (dateParts.length >= 3) {
                  const day = parseInt(dateParts[0]);
                  const month = parseMonthNameTR(dateParts[1]);
                  const year = parseInt(dateParts[2]);

                  if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    publishedDate = new Date(year, month, day);

                    // Saat varsa ekle
                    if (dateParts.length >= 4 && dateParts[3].includes(':')) {
                      const [hour, minute] = dateParts[3].split(':').map(Number);
                      publishedDate.setHours(hour, minute);
                    }
                  }
                }
              } catch (e) {
                console.error('Tarih ayrıştırma hatası:', e);
                // Hata durumunda şu anki tarihi kullan
              }
            }

            // Yeterli veri varsa haberi kaydet
            if (title && content) {
              const newsData: Prisma.newsCreateInput = {
                title,
                content: content.substring(0, 5000),
                source_url: newsUrl,
                image_url: formatUrl(imageUrl, category.url),
                published_date: publishedDate,
                sport: {
                  connect: { id: category.sportId }
                }
              };

              console.log(`Haber ekleniyor: ${title}`);
              try {
                const createdNews = await News.create(newsData);
                console.log(`Haber başarıyla eklendi! ID: ${createdNews.id}`);
                totalAdded++;
              } catch (error) {
                console.error(`Haber eklenirken hata:`, error);
              }
            }

            processedInCategory++;
            totalProcessed++;

            // İki istek arasında bekleme süresi (rate limiting önlemi)
            await new Promise(resolve => setTimeout(resolve, 1500));

          } catch (newsError: any) {
            console.error(`Haber detayı alınırken hata (${newsUrl}): ${newsError.message}`);
          }
        }

        console.log(`${category.url} kategorisinde ${processedInCategory} haber işlendi.`);

      } catch (categoryError: any) {
        console.error(`${category.url} kategorisi işlenirken hata: ${categoryError.message}`);
      }
    }

    console.log(`Sporx.com işlemi tamamlandı. Toplam ${totalProcessed} haber işlendi, ${totalAdded} haber eklendi.`);
    return { processed: totalProcessed, added: totalAdded };

  } catch (error: any) {
    console.error('Sporx scraper genel hatası:', error.message);
    throw error;
  }
}

/**
 * Türkçe ay adını sayıya çevirir
 */
function parseMonthNameTR(monthName: string): number {
  const months: Record<string, number> = {
    'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
    'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
  };

  return months[monthName.toLowerCase()] || 0;
}

/**
 * URL'i mutlak URL'e çevirir
 */
function formatUrl(url: string, baseUrl: string): string {
  if (!url) return '';

  try {
    // URL mutlak ise olduğu gibi döndür
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Göreceli URL'i mutlak URL'e çevir
    const base = new URL(baseUrl);
    if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`;
    } else {
      return `${base.protocol}//${base.host}/${url}`;
    }
  } catch (e) {
    console.error(`URL işlenirken hata:`, e);
    return url;
  }
}

/**
 * Haberin daha önce eklenip eklenmediğini kontrol eder
 */
async function checkIfNewsExists(sourceUrl: string): Promise<boolean> {
  try {
    // Kaynak URL'e göre doğrudan Prisma client kullanarak haberi ara
    const news = await prisma.news.findFirst({
      where: {
        source_url: sourceUrl
      }
    });

    return !!news;
  } catch (error) {
    console.error('Haber kontrolü sırasında hata:', error);
    return false;
  }
}

// Script doğrudan çalıştırıldığında scraping işlemini başlat
if (require.main === module) {
  scrapeSporx().catch(error => {
    console.error('Sporx scraper çalıştırılırken hata:', error);
    process.exit(1);
  });
} 