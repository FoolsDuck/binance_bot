const rsi = require("trading-indicator").rsi;
const indicators = require("trading-indicator");
const axios = require("axios");
const fs = require("fs");
const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const { channel, token } = require("./config.json");

// USE ANY JSON FILE OF TICKERS YOU WANT:
const jsonFile = require("./futures.json");

const BASE_URL = "https://www.binance.com/bapi/composite/v1/public/marketing";
const HOT_ASSETS = "recommend/hotAsset/list?currency=USD&type=1";

const getTrends = async () => {
  const trendingList = await axios
    .get(`${BASE_URL}/${HOT_ASSETS}`)
    .then(async (res) => {
      const trends = await Promise.all(
        res.data.data.map(async (item) => {
          const assets = await axios.get(
            `${BASE_URL}/tardingPair/detail?symbol=${item.baseAsset}`
          );

          if (assets.data.data[0]) {
            let obj = {
              symbol: item.baseAsset,
              marketCap: assets.data.data[0].marketCap,
              rank: assets.data.data[0].rank,
              circulatingSupply: assets.data.data[0].circulatingSupply,
              totalSupply: assets.data.data[0].totalSupply,
              dayChange: assets.data.data[0].dayChange,
            };
            return obj;
          }
        })
      ).catch((err) => console.log(err));
      return trends;
    })
    .catch((err) => console.log(err));
  return trendingList;
};

const checkRsi = async (symbol, timeframe) => {
  try {
    return await indicators.rsiCheck(
      14,
      80,
      20,
      "binance",
      symbol,
      timeframe,
      false
    );
  } catch (err) {
    return err;
  }
};

const checkBreakout = async (symbol, timeframe) => {
  try {
    let macdData = await indicators.macd(
      12,
      26,
      9,
      "close",
      "binance",
      symbol,
      timeframe,
      true
    );

    const last2 = {
      prev: macdData[macdData.length - 2],
      last: macdData[macdData.length - 1],
    };

    if (
      last2.prev.MACD > last2.prev.signal &&
      last2.last.MACD < last2.last.signal
    ) {
      return true;
    } else return false;
  } catch (err) {
    return err;
  }
};

const login = async () => {
  if (!client || !client.readyAt) {
    try {
      const loggedIn = await client.login(token);
      console.log(`Logged in as ${client.user.tag}!`);
    } catch (err) {
      console.log(err);
    }
  }
};

const sendMsg = (msg) => {
  client.channels.cache.get(channel).send(msg);
};

const send = async (trends) => {
  // YOU CAN REPLACE jsonFile WITH trends
  const tickers = jsonFile.filter(
    (s) =>
      !s.symbol.includes("DOWN") &&
      !s.symbol.includes("UP") &&
      !s.symbol.includes("LUNA")
  );

  await Promise.all(
    tickers.map(async (item, index) => {
      const ticker = item.symbol;
      const symbol = ticker.split("USDT")[0];
      // SET YOUR INTERVAL
      const interval = process.argv[2];
      setTimeout(async () => {
        const rsiResult = await checkRsi(`${symbol}/USDT`, interval);
        const breakout = await checkBreakout(`${symbol}/USDT`, interval);

        item.rsi = rsiResult;
        item.breakout = breakout;
        let msg;
        // Breakout Alerts:

        if (breakout) {
          msg = `
                       BREAKOUT ALERT! (${interval} interval)

                       Symbol: ${symbol}/USDT
                       RSI_VALUE: ${rsiResult.rsiVal}
                       OverBought: ${rsiResult.overBought}
                       OverSold: ${rsiResult.overSold}

                       LINK: https://www.binance.com/en/trade/${symbol}_USDT
                       end.
                       `;
          sendMsg(msg);
        }

        // RSI Alerts:
        if (rsiResult.overSold || rsiResult.overBought) {
          console.log({
            breakout: breakout,
            rsi: rsiResult,
          });
          msg = `
          ${
            rsiResult.overSold ? "OVERSOLD" : "OVERBOUGHT"
          } ALERT! (${interval} interval)

          Symbol: ${symbol}/USDT
          RSI_VALUE: ${rsiResult.rsiVal}
          OverBought: ${rsiResult.overBought}
          OverSold: ${rsiResult.overSold}

          LINK: https://www.binance.com/en/trade/${symbol}_USDT
          end.
          `;
          sendMsg(msg);
        }

        if (index === tickers.length - 1) {
          main(true);
        }
      }, 2000 * index);
    })
  ).catch((err) => console.log(err));
};

const main = async (isLoggedIn) => {
  if (!isLoggedIn) {
    await login();
  }
  const trends = await getTrends();
  const tickers = await send(trends);
};

main(false);
