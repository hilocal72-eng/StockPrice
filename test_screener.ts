import yahooFinance from "yahoo-finance2";
const symbols = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS', 'SBIN.NS', 'INFY.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS', 'BAJFINANCE.NS', 'HCLTECH.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'TATAMOTORS.NS', 'TATASTEEL.NS', 'KOTAKBANK.NS', 'TITAN.NS', 'ADANIENT.NS', 'ASIANPAINT.NS', 'BAJAJFINSV.NS', 'WIPRO.NS', 'ULTRACEMCO.NS', 'ONGC.NS', 'NTPC.NS', 'POWERGRID.NS', 'M&M.NS', 'LTIM.NS', 'COALINDIA.NS', 'ADANIPORTS.NS', 'HINDALCO.NS', 'BRITANNIA.NS', 'TECHM.NS', 'EICHERMOT.NS', 'DIVISLAB.NS', 'GRASIM.NS', 'CIPLA.NS', 'JSWSTEEL.NS', 'HEROMOTOCO.NS', 'APOLLOHOSP.NS', 'DRREDDY.NS', 'SBILIFE.NS', 'HDFCLIFE.NS', 'BAJAJ-AUTO.NS', 'UPL.NS', 'INDUSINDBK.NS', 'NESTLEIND.NS', 'BPCL.NS'];
async function run() {
  try {
    const quotes = await yahooFinance.quote(symbols) as any[];
    console.log("Success:", quotes.length);
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();
