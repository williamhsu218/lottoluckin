import lotteryData from '../../src/server/lottery-data.cjs';

const { fetchLotteryHistory } = lotteryData;

export async function handler() {
  try {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await fetchLotteryHistory()),
    };
  } catch (err) {
    console.warn('Lottery history function failed', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
