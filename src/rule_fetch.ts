import jsdom from 'jsdom';
const { JSDOM } = jsdom;
const query = encodeURIComponent('"大乐透" 2026 "七个奖级"');
JSDOM.fromURL(`https://html.duckduckgo.com/html/?q=${query}`).then(dom => {
  const matches = dom.window.document.querySelectorAll('.result__snippet');
  matches.forEach(m => console.log(m.textContent));
}).catch(e => console.error(e));





