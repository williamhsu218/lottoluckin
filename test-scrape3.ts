import * as cheerio from 'cheerio';
fetch('https://kaijiang.500.com/shtml/dlt/26046.shtml', {
  headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
}).then(r=>r.text()).then(t=>{
  const $ = cheerio.load(t);
  const scriptTags = $('script').toArray().map(s => $(s).html() || '');
  const nuxtScript = scriptTags.find(s => s.startsWith('[["ShallowReactive'));
  if (nuxtScript) {
     console.log(nuxtScript.substring(0, 1000));
  } else {
     console.log('No nuxt script found');
  }
}).catch(console.error);
