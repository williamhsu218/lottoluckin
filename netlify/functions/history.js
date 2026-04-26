const cheerio = require('cheerio');

exports.handler = async function(event, context) {
    try {
        // Method 1: Try official Sporttery API first
        const sportteryRes = await fetch('https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.lottery.gov.cn/'
            }
        });
        
        if (sportteryRes.ok) {
            const data = await sportteryRes.json();
            if (data && data.value && data.value.list && data.value.list.length > 0) {
                return {
                    statusCode: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                };
            }
        }
    } catch (err) {
        console.warn("Sporttery API via Netlify failed, falling back to 500.com", err);
    }

    try {
        // Method 2: Fallback to scraping datachart.500.com (very reliable)
        const response = await fetch('https://datachart.500.com/dlt/history/newinc/history.php?limit=50', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const text = await response.text();
        const $ = cheerio.load(text);
        const rows = $('#tdata tr').toArray().slice(0, 50).map(el => {
            const tds = $(el).find('td');
            if (tds.length === 0) return null;
            return {
                lotteryDrawNum: $(tds[0]).text().trim(),
                lotteryDrawResult: Array.from({length: 7}).map((_, i) => $(tds[i+1]).text().trim()).join(' '),
                lotteryDrawTime: $(tds[14]).text().trim()
            }
        }).filter(Boolean);
        
        if (rows.length > 0) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: { list: rows } })
            };
        }
    } catch (err) {
        console.warn("500.com scrape failed", err);
    }

    // Return empty fallback if both fail
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: { list: [] } })
    };
};
