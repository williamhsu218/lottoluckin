const cheerio = require('cheerio');

const HISTORY_URL = 'https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=50&isVerify=1&pageNo=1';
const HISTORY_FALLBACK_URL = 'https://datachart.500.com/dlt/history/newinc/history.php?limit=50';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchLotteryHistory() {
  try {
    const sportteryRes = await fetch(HISTORY_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.lottery.gov.cn/',
      },
    });

    if (sportteryRes.ok) {
      const data = await sportteryRes.json();
      if (data?.value?.list?.length > 0) return data;
    }
  } catch (err) {
    console.warn('Sporttery API failed, falling back to 500.com', err);
  }

  try {
    const response = await fetch(HISTORY_FALLBACK_URL, {
      headers: { 'User-Agent': USER_AGENT },
    });

    const text = await response.text();
    const $ = cheerio.load(text);
    const rows = $('#tdata tr').toArray().slice(0, 50).map(el => {
      const tds = $(el).find('td');
      if (tds.length === 0) return null;
      return {
        lotteryDrawNum: $(tds[0]).text().trim(),
        lotteryDrawResult: Array.from({ length: 7 }).map((_, i) => $(tds[i + 1]).text().trim()).join(' '),
        poolBalanceAfterdraw: $(tds[8]).text().trim().replace(/,/g, ''),
        lotteryDrawTime: $(tds[14]).text().trim(),
      };
    }).filter(Boolean);

    if (rows.length > 0) return { value: { list: rows } };
  } catch (err) {
    console.warn('500.com scrape failed', err);
  }

  return { value: { list: [] } };
}

async function fetchPrizeInfo(drawNum) {
  const response = await fetch(`https://kaijiang.500.com/shtml/dlt/${drawNum}.shtml`, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://kaijiang.500.com/',
    },
  });
  if (!response.ok) {
    const error = new Error('Failed to fetch');
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  const $ = cheerio.load(text);
  const bodyText = $('body').text().replace(/\s+/g, '');
  let poolAmount = parsePoolAmount(bodyText.match(/奖池滚存[:：]?([0-9.,]+)(元|亿)/));

  if (!poolAmount) {
    $('table').find('tr').toArray().forEach(row => {
      if (poolAmount) return;
      const trText = $(row).text().replace(/\s+/g, '');
      poolAmount = parsePoolAmount(trText.match(/奖池滚存.*?([0-9.,]+)(元|亿)/));
    });
  }

  return { drawNum, poolBalanceAfterdraw: poolAmount || '' };
}

function parsePoolAmount(match) {
  if (!match) return '';
  if (match[2] === '亿') return String(parseFloat(match[1]) * 100000000);
  return match[1].replace(/,/g, '');
}

module.exports = { fetchLotteryHistory, fetchPrizeInfo };
