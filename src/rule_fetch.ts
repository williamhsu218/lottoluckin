import https from 'https';
const query = encodeURIComponent('"大乐透" "2026年" 七个等级 中奖规则');
https.get(`https://html.duckduckgo.com/html/?q=${query}`, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
     const matches = data.match(/<a class="result__snippet[^>]+>(.*?)<\/a>/g);
     if (matches) console.log(matches.join('\n').replace(/<\/?[^>]+(>|$)/g, ""));
  });
}).on('error', (err) => console.error(err));





