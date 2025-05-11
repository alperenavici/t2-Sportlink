import { News } from '../models/News';
import * as cheerio from 'cheerio';
import axios from 'axios';
import dotenv from 'dotenv';
import { scrapeSporx } from './sporxScraper';
import { scrapeKonyasporNews } from './konyasporScraper';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// .env dosyasından ortam değişkenlerini yükle
dotenv.config();

// Scraping yapılacak sitelerin URL'leri ve spor ID'leri
interface NewsSource {
  name: string;
  url: string;
  sportId: string;
  selectors: {
    articles: string;
    title: string;
    content: string;
    link: string;
    image: string;
    date: string;
  }
}

const sourceSites: NewsSource[] = [
  {
    name: 'NTVSpor',
    url: 'https://www.ntvspor.net/',
    sportId: '909a0f7f-54f7-4a47-b47f-5d074b88bcc6', // Futbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: '.category-news article, .news-item, .list-item', // Haberleri içeren ana eleman
      title: 'h2, .news-title, .title',   // Başlık elemanı
      content: '.spot, .summary, .excerpt', // İçerik elemanı (özet)
      link: 'a',     // Kaynak linki elemanı
      image: 'img',   // Resim elemanı
      date: '.date, .time, .news-date, time'      // Tarih elemanı
    }
  },
  {
    name: 'Fanatik',
    url: 'https://www.fanatik.com.tr/futbol',
    sportId: '1', // Futbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: '.card, .news-card, .news-list-item',
      title: 'h3, .card-title, .title',
      content: '.card-text, .summary, .excerpt',
      link: 'a',
      image: 'img, .card-img-top',
      date: '.date, .time, .publish-date'
    }
  },
  {
    name: 'TRTSpor Basketbol',
    url: 'https://www.trtspor.com.tr/haber/basketbol/',
    sportId: '5dc3ebe8-3111-47e3-86d4-648cc1c1df98', // Basketbol ID (Spor tablosundaki gerçek ID)
    selectors: {
      articles: '.news-list-item, .card, article',
      title: 'h2, h3, .title',
      content: '.summary, .excerpt, .description',
      link: 'a',
      image: 'img',
      date: '.date, time'
    }
  }
];

/**
 * Web sayfalarından haberleri çeker
 */
async function scrapeGenericNews() {
  try {
    console.log('Starting generic news scraping...');

    for (const site of sourceSites) {
      console.log(`Scraping news from ${site.name} (${site.url})...`);

      try {
        const response = await axios.get(site.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data as string);
        let newsCount = 0;
        const articles = $(site.selectors.articles).toArray();

        for (const element of articles) {
          const title = $(element).find(site.selectors.title).text().trim();
          const content = $(element).find(site.selectors.content).text().trim();
          const sourceUrl = $(element).find(site.selectors.link).attr('href') || site.url;
          const imageUrl = $(element).find(site.selectors.image).attr('src') || '';

          let publishedDate = new Date();
          const dateText = $(element).find(site.selectors.date).text().trim();
          if (dateText) {
            try {
              publishedDate = new Date(dateText);
            } catch (e) {
              console.warn(`Failed to parse date: ${dateText}`, e);
            }
          }

          if (title && content) {
            newsCount++;

            const newsData: Prisma.newsCreateInput = {
              title,
              content: content.substring(0, 5000),
              source_url: formatUrl(sourceUrl, site.url),
              image_url: formatUrl(imageUrl, site.url),
              published_date: publishedDate,
              sport: {
                connect: { id: site.sportId }
              }
            };

            if (newsData.source_url) {
              const exists = await checkIfNewsExists(title, newsData.source_url);

              if (!exists) {
                console.log(`Adding new news: ${title}`);
                try {
                  const createdNews = await News.create(newsData);
                  console.log(`Haber başarıyla eklendi! ID: ${createdNews.id}, Başlık: "${title.substring(0, 50)}..."`);

                  // Veritabanı istatistikleri
                  const count = await prisma.news.count();
                  console.log(`Veritabanında toplam ${count} haber bulunuyor.`);
                } catch (error) {
                  console.error(`Error adding news:`, error);
                }
              } else {
                console.log(`Haber zaten mevcut: "${title.substring(0, 50)}..."`);
              }
            }
          }
        }

        console.log(`Processed ${newsCount} news from ${site.name}`);
      } catch (siteError: any) {
        console.error(`Error scraping from ${site.name}: ${siteError.message}`);
      }
    }

    console.log('Generic news scraping completed!');
  } catch (error) {
    console.error('General error during scraping:', error);
  }
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
async function checkIfNewsExists(title: string, sourceUrl: string): Promise<boolean> {
  try {
    // Başlık ile haberi ara
    const searchResults = await News.search(title.substring(0, 20));

    if (!searchResults || searchResults.length === 0) {
      return false;
    }

    // Aynı başlık veya kaynak URL ile eşleşen haberi bul
    return searchResults.some(news =>
      news.title.toLowerCase() === title.toLowerCase() ||
      news.source_url === sourceUrl
    );
  } catch (error) {
    console.error('Haber kontrolü sırasında hata:', error);
    return false;
  }
}

/**
 * Tüm scraperları çalıştırır
 */
export async function scrapeNews() {
  console.log('Tüm scraperlar çalıştırılıyor...');

  try {
    // Konyaspor haberlerini çek
    console.log('Konyaspor haberleri çekiliyor...');
    await scrapeKonyasporNews();

    // Sporx.com'dan haber çek
    console.log('Sporx haberleri çekiliyor...');
    await scrapeSporx();

    // Genel haber sitelerinden çek
    console.log('Genel spor haberleri çekiliyor...');
    await scrapeGenericNews();

    console.log('Tüm scraping işlemleri tamamlandı!');
  } catch (error) {
    console.error('Scraping işlemi sırasında hata:', error);
  }
}

// Script doğrudan çalıştırıldığında scraping işlemini başlat
if (require.main === module) {
  scrapeNews().catch(error => {
    console.error('Scraper çalıştırılırken hata:', error);
    process.exit(1);
  });
} 